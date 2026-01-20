import os
import uuid
import tempfile
from dotenv import load_dotenv

from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware

from livekit.api import AccessToken, VideoGrants

from voiceverification.services.biometric_service import BiometricService
from voiceverification.core.replay_heuristic import replay_heuristic


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
# 1️⃣ JOIN TOKEN (NO VERIFICATION)
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
async def verify_and_token(audio: UploadFile = File(...)):
    """
    Voice verification endpoint.
    NO TOKEN ISSUED HERE.
    Used by agent-side or frontend if needed.
    """

    bio_service = get_biometric()  # ← FIX: USE get_biometric()!
    
    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as f:
            content = await audio.read()
            f.write(content)
            temp_path = f.name

        print(f"📁 Received audio: {len(content)} bytes")

        # 1️⃣ Replay check
        replay_result = replay_heuristic(temp_path, 16000)
        replay_score = replay_result["replay_prob"]
        print(f"📊 Replay score: {replay_score:.3f}")

        if replay_score > 0.7:
            return {
                "status": "DENIED", 
                "reason": "replay detected",
                "score": float(replay_score),
                "verified": False
            }
        
        # 2️⃣ Speaker verification
        print("🔍 Verifying speaker...")
        result = bio_service.verify_user(temp_path, ENROLL_PATH)
        final_score = result["final_score"]
        print(f"📊 Verification score: {final_score:.3f}")
        
        if final_score < 0.1:
            return {
                "status": "DENIED", 
                "reason": "verification failed",
                "score": float(final_score),
                "verified": False
            }

        return {
            "verified": True,
            "status": "VERIFIED",
            "score": float(final_score),
        }
    
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return {
            "status": "ERROR",
            "reason": str(e),
            "verified": False,
            "score": 0.0
        }
    
    finally:
        if temp_path and os.path.exists(temp_path):
            os.unlink(temp_path)

# =========================
# 3️⃣ VERIFY + LOGIN TOKEN
# =========================
@app.post("/verify-and-login")
async def verify_and_login(audio: UploadFile = File(...)):
    """
    Optional endpoint for:
    - Voice login
    - High-security actions
    """

    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as f:
        f.write(await audio.read())
        temp_path = f.name

    replay = replay_heuristic(temp_path, 16000)
    if replay["replay_prob"] > 0.7:
        return {"status": "DENIED", "reason": "replay_detected", "score": replay["replay_prob"], "verified": False}

    result = biometric.verify_user(temp_path, ENROLL_PATH)
    if result["final_score"] < 0.1:
        return {"status": "DENIED", "reason": "verification_failed", "score": result["final_score"], "verified": False}
    grant = VideoGrants(
        room_join=True,
        room="mainroom",
        can_publish=True,
        can_subscribe=True,
    )

    token = AccessToken(
        LIVEKIT_API_KEY,
        LIVEKIT_API_SECRET,
    )

    token.with_identity(f"verified-{uuid.uuid4()}")
    token.with_grants(grant)

    return {
        "status": "VERIFIED",
        "score": result["final_score"], 
        "token": token.to_jwt(),
    }


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