import os
import uuid

from dotenv import load_dotenv
from time import time

from fastapi import FastAPI, UploadFile, File, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from livekit.api import AccessToken, VideoGrants
import torch

from voiceverification.services.biometric_service import BiometricService


from voiceverification.core.decision_engine import Decision


from voiceverification.utils.audio import save_audio, normalize_audio
from voiceverification.utils.csv_log import log_verify

from voiceverification.db.behavior_repo import (load_behavior_profile,save_behavior_profile)

from voiceverification.db.speaker_repo import count_enrollments, save_embedding, load_all_embeddings

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
async def verify_voice(request: Request, audio: UploadFile = File(...)):
    user_id = get_user_id_from_request(request)

    # 1️⃣ Load enrollment & behavior
    enroll_embeddings = load_all_embeddings(user_id)
    if not enroll_embeddings:
        return {
            "status": "ERROR",
            "reason": "No enrollment profile found for user."
        }
    
    behavior_profile = load_behavior_profile(user_id)


    # 2️⃣ Save & normalize live audio
    wav_path = save_audio(audio)
    normalize_audio(wav_path)

    try:
        bio = get_biometric()

        # 3️⃣ SINGLE CALL — semua logika di dalam
        result = bio.verify_against_multiple_embeddings(
            live_wav=wav_path,
            enroll_embeddings=enroll_embeddings,          # optional
            behavior_profile=behavior_profile,
            user_id=user_id,
        )

        # 4️⃣ Logging (optional)
        log_verify(
            result["score"],
            result["spoof_prob"],
            Decision.VERIFIED if result["verified"] else Decision.DENIED
        )

        # 5️⃣ Response ke client / agent
        return {
            "verified": result["verified"],
            "status": result["decision"],
            "reason": result["reason"],
            "score": result["score"],
            "spoof_prob": result["spoof_prob"],
            "best_index": result["best_index"],
            "all_scores": result["all_scores"],
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

    if count_enrollments(user_id) >= 3:
        raise HTTPException(
            status_code=400, 
            detail="Maximum enrollment reached (3)."
        )

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
