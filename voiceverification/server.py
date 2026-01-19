from fastapi import FastAPI, UploadFile, File
import os, uuid, tempfile
    
from livekit.api import AccessToken, VideoGrants


from fastapi.middleware.cors import CORSMiddleware

from voiceverification.services.biometric_service import BiometricService
from voiceverification.core.replay_heuristic import replay_heuristic


from dotenv import load_dotenv

load_dotenv() 

api_key = os.getenv("LIVEKIT_API_KEY")
api_secret = os.getenv("LIVEKIT_API_SECRET")

if not api_key or not api_secret:
    raise ValueError("LIVEKIT credentials are not set in environment variables.")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # for testing purpose only, restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


biometric = BiometricService(device="cpu")
ENROLL_PATH = "voiceverification/dataset/enroll.wav"


# 🔥 VERIFY + GENERATE TOKEN (BARU)
@app.post("/verify-and-token")
async def verify_and_token(audio: UploadFile = File(...)):
    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as f:
        f.write(await audio.read())
        temp = f.name

    # 1️⃣ Replay check
    replay_result = replay_heuristic(temp, 16000)
    replay_score = replay_result["replay_prob"]

    if replay_score > 0.7:
        return {"status": "DENIED", "reason": "replay detected"}
    
    # 2️⃣ Speaker verification
    result = biometric.verify_user(temp, ENROLL_PATH)
    if result["final_score"] < 0.1:
        return {"status": "DENIED", "reason": "verification failed"}
    
    # 3️⃣ Generate LiveKit token
    grant = VideoGrants(
        room_join=True,
        room="mainroom",
        can_publish=True,
        can_subscribe=True,
    )

    token = AccessToken(
        api_key, 
        api_secret, 
    )
    
    token.with_identity(str(uuid.uuid4()))
    token.with_grants(grant)

    return {
        "verified": True,
        "status": "VERIFIED",
        "token": token.to_jwt()
    }

