import os
import uuid
import tempfile

import soundfile as sf

from dotenv import load_dotenv

from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware

import librosa
from livekit.api import AccessToken, VideoGrants

from voiceverification.services.biometric_service import BiometricService
from voiceverification.core.replay_heuristic import replay_heuristic

from voiceverification.core.decision_engine import Decision, decide 


from voiceverification.utils.audio import save_audio, normalize_audio
from voiceverification.utils.csv_log import log_verify

# =========================
# ENV SETUP
# =========================
load_dotenv()

LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY")
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET")

if not LIVEKIT_API_KEY or not LIVEKIT_API_SECRET:
    raise RuntimeError("LIVEKIT credentials not set")

ENROLL_PATH = "voiceverification/dataset/enroll.wav"


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


biometric = None

def get_biometric():
    global biometric
    if biometric is None:
        print("🔧 Initializing BiometricService...")
        try:
            biometric = BiometricService(device="cpu")
            print("✅ BiometricService initialized")
        except Exception as e:
            print(f"❌ Failed to initialize BiometricService: {e}")
            raise
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


    room_name = "mainroom"

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
async def verify(audio: UploadFile = File(...)):
    wav_path = save_audio(audio)
    normalize_audio(wav_path)

    try:
        speaker = biometric.verify_user(wav_path, ENROLL_PATH)
        replay= replay_heuristic(wav_path)

        speaker_score = speaker["final_score"]
        replay_prob = replay["replay_prob"]

        decision, reason = decide(
            speaker_score=speaker_score,
            replay_prob=replay_prob,
        )

        log_verify(speaker_score, replay_prob, decision)

        return {
            "verified": decision == Decision.VERIFIED,
            "status": decision.value,
            "reason": reason,
            "score": speaker_score,
            "replay_prob": replay_prob
        }

    except Exception as e:
        print(f"❌ Verification error: {e}")
        raise

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
        "biometric_service": "OK" if bio_service else "ERROR",
        "enroll_file_exists": os.path.exists(ENROLL_PATH)
    }

