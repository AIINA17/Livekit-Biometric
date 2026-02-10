import os

import uuid
import numpy as np
import librosa
import torch

from dotenv import load_dotenv
from datetime import datetime, timezone


from fastapi import FastAPI, Form, UploadFile, File, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from livekit.api import AccessToken, VideoGrants

from pydantic import BaseModel
from voiceverification.db.connection import get_supabase
from voiceverification.services.biometric_service import BiometricService


from voiceverification.core.decision_engine import Decision
from voiceverification.core.behavior_profile import BehaviorProfile

from voiceverification.utils.audio import save_audio, normalize_audio
from voiceverification.utils.csv_log import log_verify

from voiceverification.db.behavior_repo import (load_behavior_profile,save_behavior_profile)

from voiceverification.db.speaker_repo import count_enrollments, save_embedding, load_all_embeddings

from voiceverification.db.conversation_sessions import update_conversation_session_label

# =========================
# ENV SETUP
# =========================
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV_PATH = os.path.join(BASE_DIR, ".env")
load_dotenv(ENV_PATH)

from voiceverification.auth.auth_utils import get_user_id_from_request

from voiceverification.models.speaker_verifier import SpeakerVerifier



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


    room_name = "testroom" 

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
    

    # 2️⃣ Save & normalize live audio
    wav_path = save_audio(audio)
    normalize_audio(wav_path)

    try:
        bio = get_biometric()

        # 3️⃣ SINGLE CALL — semua logika di dalam
        result = bio.verify_against_multiple_embeddings(
            live_wav=wav_path,
            enroll_embeddings=enroll_embeddings,
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
            "matched_label": result["best_label"],
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
async def enroll_voice(
    request: Request, 
    audio: UploadFile = File(...), 
    label: str = Form(...)
):
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

        # 1️⃣ Extract & save embedding
        embedding = verifier.extract_embedding(wav_path)
        save_embedding(user_id, embedding, label)

        # 2️⃣ Bootstrap behavior profile (ONLY IF NOT EXISTS)
        behavior_profile = load_behavior_profile(user_id, label)

        if behavior_profile is None:
            y, sr = librosa.load(wav_path, sr=16000)

            pitch = float(np.nanmean(
                librosa.yin(y, fmin=50, fmax=300, sr=sr)
            ))
            rate = float(len(y) / sr)

            behavior_profile = BehaviorProfile(
                n_samples=1,
                mean_pitch=pitch,
                var_pitch=0.0,
                mean_rate=rate,
                var_rate=0.0,
                last_update_ts=datetime.now(timezone.utc)
            )

            save_behavior_profile(user_id, label, behavior_profile)

        return {
            "status": "OK",
            "message": "Voice enrollment successful",
            "label": label
        }

    finally:
        if os.path.exists(wav_path):
            os.remove(wav_path)

# =========================
# CONVERSATION LOGS & SESSIONS
# =========================
@app.get("/logs/sessions")
async def get_conversation_sessions(request: Request):
    user_id = get_user_id_from_request(request)
    sb = get_supabase()

    res = (
        sb.table("conversation_sessions")
        .select("id, label, created_at")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )

    return {
        "status": "OK",
        "sessions": res.data or []
    }

# =========================
# GET LOGS BY SESSION ID
# =========================
@app.get("/logs/sessions/{session_id}")
async def get_conversation_logs(
    session_id: str,
    request: Request
):
    user_id = get_user_id_from_request(request)
    sb = get_supabase()

    # Optional: pastikan session milik user
    session_check = (
        sb.table("conversation_sessions")
        .select("id")
        .eq("id", session_id)
        .eq("user_id", user_id)
        .execute()
    )

    if not session_check.data:
        raise HTTPException(status_code=404, detail="Session not found")

    logs = (
        sb.table("conversation_logs")
        .select("role, content, created_at")
        .eq("session_id", session_id)
        .order("created_at")
        .execute()
    )

    return {
        "status": "OK",
        "session_id": session_id,
        "logs": logs.data or []
    }


# =========================
# UPDATE SESSION LABEL
# =========================
class UpdateSessionLabelPayload(BaseModel):
    label: str

@@app.patch("/conversation-sessions/{session_id}/label")
async def update_session_label(
    session_id: str,
    payload: UpdateSessionLabelPayload,
    request: Request
):
    user_id = get_user_id_from_request(request)
    sb = get_supabase()

    if not payload.label.strip():
        raise HTTPException(400, "Label cannot be empty")

    session_check = (
        sb.table("conversation_sessions")
        .select("id")
        .eq("id", session_id)
        .eq("user_id", user_id)
        .execute()
    )

    if not session_check.data:
        raise HTTPException(404, "Session not found")

    update_conversation_session_label(
        session_id=session_id,
        label=payload.label
    )

    return {
        "status": "OK",
        "session_id": session_id,
        "label": payload.label
    }

# =========================
# DELETE SESSION (AND LOGS)
# =========================
@app.delete("/conversation-sessions/{session_id}")
async def delete_conversation_session(
    session_id: str,
    request: Request
):
    user_id = get_user_id_from_request(request)
    sb = get_supabase()

    # (opsional) validasi ownership session di sini
    session_check = (
        sb.table("conversation_sessions")
        .select("id")
        .eq("id", session_id)
        .eq("user_id", user_id)
        .execute()
    )

    if not session_check.data:
        raise HTTPException(status_code=404, detail="Session not found")

    # Hapus logs terkait
    sb.table("conversation_logs")\
        .delete()\
        .eq("session_id", session_id)\
        .execute()  