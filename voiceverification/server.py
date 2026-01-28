import os
import uuid
import shutil

import soundfile as sf

from dotenv import load_dotenv

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware

import librosa
from livekit.api import AccessToken, VideoGrants
import torch

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

# Folder untuk enrollment files
ENROLL_DIR = "voiceverification/dataset/users"
MAX_ENROLL_FILES = 3  # Max 3 suara per akun

os.makedirs(ENROLL_DIR, exist_ok=True)
os.makedirs("voiceverification/dataset/live", exist_ok=True)

# =========================
# APP INIT
# =========================
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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
            device = "cuda" if torch.cuda.is_available() else "cpu"     
            biometric = BiometricService(device=device, enroll_dir=ENROLL_DIR)
            print("✅ BiometricService initialized")
        except Exception as e:
            print(f"❌ Failed to initialize BiometricService: {e}")
            raise
    return biometric

@app.on_event("startup")
async def startup_event():
    get_biometric()
    print(f"📁 Enrollment folder: {ENROLL_DIR}")
    print(f"📊 Max enrollment files: {MAX_ENROLL_FILES}")
    print("🚀 Server is ready.")

# =========================
# JOIN TOKEN
# =========================
@app.post("/join-token")
async def join_token():
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
# ENROLL VOICE (Daftarin suara baru)
# =========================
@app.post("/enroll-voice")
async def enroll_voice(audio: UploadFile = File(...)):
    """
    Daftarin suara baru untuk verifikasi.
    Max 3 file per akun.
    """
    bio = get_biometric()
    
    # Cek apakah masih bisa enroll
    current_count = bio.get_enrollment_count()
    if current_count >= MAX_ENROLL_FILES:
        raise HTTPException(
            status_code=400, 
            detail=f"Sudah mencapai batas maksimal {MAX_ENROLL_FILES} suara. Hapus salah satu untuk menambah yang baru."
        )
    
    # Save audio
    wav_path = save_audio(audio)
    normalize_audio(wav_path)
    
    try:
        # Generate filename: voice_1.wav, voice_2.wav, voice_3.wav
        new_index = current_count + 1
        new_filename = f"voice_{new_index}.wav"
        new_path = os.path.join(ENROLL_DIR, new_filename)
        
        # Copy file ke enrollment folder
        shutil.copy2(wav_path, new_path)
        
        print(f"✅ Enrolled new voice: {new_filename}")
        
        return {
            "status": "OK",
            "message": f"Suara berhasil didaftarkan sebagai {new_filename}",
            "file": new_filename,
            "total_enrolled": new_index
        }
        
    except Exception as e:
        print(f"❌ Enrollment error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    
    finally:
        if os.path.exists(wav_path):
            os.remove(wav_path)

# =========================
# DELETE ENROLLED VOICE
# =========================
@app.delete("/enroll-voice/{index}")
async def delete_enrolled_voice(index: int):
    """
    Hapus suara yang sudah didaftarkan.
    Index: 1, 2, atau 3
    """
    if index < 1 or index > MAX_ENROLL_FILES:
        raise HTTPException(status_code=400, detail=f"Index harus 1-{MAX_ENROLL_FILES}")
    
    filename = f"voice_{index}.wav"
    filepath = os.path.join(ENROLL_DIR, filename)
    
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail=f"File {filename} tidak ditemukan")
    
    os.remove(filepath)
    
    # Re-index files (optional: biar tetap urut)
    _reindex_enrollment_files()
    
    return {
        "status": "OK",
        "message": f"Suara {filename} berhasil dihapus"
    }

def _reindex_enrollment_files():
    """Re-index enrollment files supaya tetap urut: voice_1, voice_2, voice_3"""
    files = sorted([f for f in os.listdir(ENROLL_DIR) if f.startswith("voice_") and f.endswith(".wav")])
    
    # Rename ke temporary names dulu
    temp_files = []
    for f in files:
        old_path = os.path.join(ENROLL_DIR, f)
        temp_path = os.path.join(ENROLL_DIR, f"temp_{f}")
        os.rename(old_path, temp_path)
        temp_files.append(temp_path)
    
    # Rename ke urutan yang benar
    for i, temp_path in enumerate(temp_files):
        new_path = os.path.join(ENROLL_DIR, f"voice_{i+1}.wav")
        os.rename(temp_path, new_path)

# =========================
# GET ENROLLED VOICES
# =========================
@app.get("/enrolled-voices")
async def get_enrolled_voices():
    """
    List semua suara yang sudah didaftarkan.
    """
    bio = get_biometric()
    files = bio.get_enrollment_files()
    
    return {
        "status": "OK",
        "count": len(files),
        "max": MAX_ENROLL_FILES,
        "can_enroll_more": len(files) < MAX_ENROLL_FILES,
        "files": [os.path.basename(f) for f in files]
    }

# =========================
# VOICE VERIFICATION
# =========================
@app.post("/verify-voice")
async def verify(audio: UploadFile = File(...)):
    """
    Verifikasi suara terhadap semua enrolled files.
    Cek satu-satu sampai ada yang match.
    """
    bio = get_biometric()
    enroll_files = bio.get_enrollment_files()
    
    if not enroll_files:
        raise HTTPException(
            status_code=400,
            detail="Belum ada suara yang didaftarkan. Silakan daftarkan suara terlebih dahulu."
        )
    
    wav_path = save_audio(audio)
    normalize_audio(wav_path)

    try:
        # Replay check dulu
        replay = replay_heuristic(wav_path)
        replay_prob = replay["replay_prob"]
        
        # Verify against all enrolled files
        result = bio.verify_against_multiple(
            wav_path, 
            enroll_files, 
            threshold=0.5  # Sesuaikan threshold
        )
        
        speaker_score = result["score"]
        
        # Decision
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
            "matched_file": os.path.basename(result["matched_file"]) if result["matched_file"] else None,
            "matched_index": result["matched_index"],
            "attempts": result["attempts"],
            "total_files": len(enroll_files),
            "all_scores": result["all_scores"],
            "replay_prob": replay_prob
        }

    except Exception as e:
        print(f"❌ Verification error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        if os.path.exists(wav_path):
            os.remove(wav_path)

# =========================
# HEALTH CHECK
# =========================
@app.get("/health")
async def health_check():
    bio = get_biometric()
    enrolled = bio.get_enrollment_files()
    return {
        "status": "OK",
        "biometric_service": "OK" if bio else "ERROR",
        "enrolled_count": len(enrolled),
        "enrolled_files": [os.path.basename(f) for f in enrolled]
    }