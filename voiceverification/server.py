import os
import uuid

from dotenv import load_dotenv
from time import time

from fastapi import FastAPI, UploadFile, File, Request
from fastapi.middleware.cors import CORSMiddleware

from livekit.api import AccessToken, VideoGrants
import torch

from voiceverification.services.biometric_service import BiometricService
from voiceverification.core.replay_heuristic import replay_heuristic

from voiceverification.core.decision_engine import Decision, decide 


from voiceverification.utils.audio import save_audio, normalize_audio
from voiceverification.utils.csv_log import log_verify

from voiceverification.core.trusted_update import TrustedUpdatePolicy
from voiceverification.core.behavior_scoring import compute_behavior_score, zscores

from voiceverification.db.speaker_repo import load_embedding
from voiceverification.db.behavior_repo import (
    load_behavior_profile,
    save_behavior_profile
)
from voiceverification.db.speaker_repo import save_embedding

from voiceverification.auth.auth_utils import get_user_id_from_request

from voiceverification.models.speaker_verifier import SpeakerVerifier
# =========================
# ENV SETUP
# =========================
load_dotenv()

LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY")
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET")

if not LIVEKIT_API_KEY or not LIVEKIT_API_SECRET:
    raise RuntimeError("LIVEKIT credentials not set")


policy = TrustedUpdatePolicy()

# =========================
# APP INIT
# =========================
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # ⚠️ restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)


biometric: BiometricService | None = None

def get_biometric() -> BiometricService:
    global biometric
    if biometric is None:
        print("🔧 Initializing BiometricService...")
        device = "cuda" if torch.cuda.is_available() else "cpu"
        biometric = BiometricService(device=device)
        print("✅ BiometricService initialized")
    return biometric



@app.on_event("startup")
async def startup_event():
    get_biometric()
    print("🚀 Server is ready.")

# =========================
#  JOIN TOKEN (NO VERIFICATION)
# =========================
@app.post("/join-token")
async def join_token():
    """
    Transport-only token.
    Allows user to join room so agent can greet first.
    """


    room_name = "test-room"

    grant = VideoGrants(
        room_join=True,
        room=room_name,
        can_publish=True,
        can_subscribe=True,
    )

    token = AccessToken(
        LIVEKIT_API_KEY, 
        LIVEKIT_API_SECRET, 
    )
    
    token.with_identity(str(uuid.uuid4()))
    token.with_grants(grant)

    return {
        "status": "OK",
        "token": token.to_jwt(),
        "room": room_name
    }


# =========================
# 2️⃣ VOICE VERIFICATION ONLY
# =========================
@app.post("/verify-voice")
async def verify(request: Request, audio: UploadFile = File(...)):
    user_id = get_user_id_from_request(request)


    enroll_emb = load_embedding(user_id)
    if enroll_emb is None:
        return{
            "status": "ERROR",
            "reason": "No enrollment profile found for user."
        }

    behavior_profile = load_behavior_profile(user_id)
    
    wav_path = save_audio(audio)
    normalize_audio(wav_path)

    try:
        bio = get_biometric()

        speaker = bio.verify_user(wav_path, enroll_emb)
        replay= replay_heuristic(wav_path)

        speaker_score = speaker["final_score"]
        replay_prob = replay["replay_prob"]

        decision, reason = decide(
            speaker_score=speaker_score,
            replay_prob=replay_prob,
        )

        log_verify(speaker_score, replay_prob, decision)

        # === Trusted Behavioral Update (SAFE) ===
        behavior_score = compute_behavior_score(
            speaker["pitch"],
            speaker["rate"],
            behavior_profile
        )

        z_pitch, z_rate = zscores(
            speaker["pitch"],
            speaker["rate"],
            behavior_profile
        )

        if policy.should_update(
            decision=decision.value,
            speaker_score=speaker_score,
            spoof_prob=replay_prob,
            behavior_score=behavior_score,
            n_samples=behavior_profile.n_samples,
            z_pitch=z_pitch,
            z_rate=z_rate,
            last_update_ts=behavior_profile.last_update_ts, 
            is_retry=False,
        ):
            behavior_profile.update(
                speaker["pitch"],
                speaker["rate"],
                time()
            )
            save_behavior_profile(user_id, behavior_profile)
            

        return {
            "verified": decision == Decision.VERIFIED,
            "status": decision.value,
            "reason": reason,
            "score": speaker_score,
            "replay_prob": replay_prob
        }

    finally:
        if os.path.exists(wav_path):
            os.remove(wav_path)


# =========================
# HEALTH CHECK
# =========================
@app.get("/health")
async def health_check():
    bio_service = get_biometric()
    return {
        "status": "OK",
        "biometric_service": biometric is not None
    }

# =========================
# VOICE ENROLLMENT 
# =========================

@app.post("/enroll-voice")
async def enroll_voice(request: Request, audio: UploadFile = File(...)):
    """
    Enroll user voice:
    - extract speaker embedding
    - normalize & save to Supabase
    - NO decision engine
    - NO adaptive update
    """
    user_id = get_user_id_from_request(request)

    wav_path = save_audio(audio)
    normalize_audio(wav_path)



    try:
        verifier = SpeakerVerifier()

        # 1️⃣ Extract embedding
        embedding = verifier.extract_embedding(wav_path)

        # 2️⃣ Save to Supabase
        save_embedding(user_id, embedding)

        return {
            "status": "OK",
            "message": "Voice enrollment successful",
        }

    finally:
        if os.path.exists(wav_path):
            os.remove(wav_path)
