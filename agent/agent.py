"""
AgentServer + CONNECT MODE with PER-UTTERANCE Voice Verification
Compatible with livekit-agents == 1.3.11

Run:
python -m agent.agent connect --room mainroom
"""

import os
import sys
import asyncio
import time
import tempfile
import wave
import struct
import json

# ================= PATH FIX =================
AGENT_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_DIR = os.path.dirname(AGENT_DIR)
sys.path.insert(0, AGENT_DIR)
sys.path.insert(0, BASE_DIR)

from dotenv import load_dotenv

ENV_PATH = os.path.join(AGENT_DIR, ".env")
loaded = load_dotenv(ENV_PATH)
print(f"DEBUG .env loaded from {ENV_PATH}: {loaded}")
print("DEBUG LIVEKIT_URL =", os.getenv("LIVEKIT_URL"))

# ================= LIVEKIT =================
from livekit import agents, rtc
from livekit.agents import (
    AgentServer,
    AgentSession,
    Agent,
    cli,
    room_io,
)
from livekit.plugins import google, noise_cancellation

# ================= APP LOGIC =================
from prompts import AGENT_INSTRUCTION, SESSION_INSTRUCTION

from tools import (
    get_weather,
    web_search,
    login,
    register,
    logout,
    check_login_status,
    check_voice_status,
    get_shopkupay_balance,
    search_product,
    get_product_detail,
    add_to_cart,
    get_cart,
    remove_from_cart,
    update_cart_quantity,
    checkout,
    get_order_history,
    get_order_detail,
    pay_order,
    auth_state,
)

# ================= VOICE VERIFICATION =================
from voiceverification.services.biometric_service import BiometricService
from voiceverification.core.replay_heuristic import replay_heuristic


# ================= CONFIG =================
SAMPLE_RATE = 16000
VOICE_THRESHOLD = 0.1
ENROLL_PATH = "voiceverification/dataset/enroll.wav"


# ================= GLOBAL AUDIO BUFFER =================
audio_buffer = []
audio_buffer_lock = asyncio.Lock()


def add_audio_to_buffer(frame):
    """Tambah audio samples ke buffer - FIXED for memoryview"""
    global audio_buffer
    try:
        # Get the raw data from frame
        raw_data = frame.data if hasattr(frame, 'data') else frame
        
        # Convert memoryview to bytes first!
        if isinstance(raw_data, memoryview):
            raw_data = bytes(raw_data)
        
        # Now convert bytes to int16 samples
        if isinstance(raw_data, (bytes, bytearray)):
            # int16 = 2 bytes per sample
            num_samples = len(raw_data) // 2
            samples = struct.unpack(f'{num_samples}h', raw_data)
            audio_buffer.extend(samples)
        else:
            # Fallback: try to convert directly
            audio_buffer.extend(list(raw_data))
        
        # Keep max 10 seconds
        max_samples = SAMPLE_RATE * 10
        if len(audio_buffer) > max_samples:
            audio_buffer = audio_buffer[-max_samples:]
            
    except Exception as e:
        print(f"⚠️ add_audio error: {type(raw_data).__name__} - {e}")


# ================= VOICE VERIFIER CLASS =================
class PerUtteranceVerifier:
    def __init__(self, biometric: BiometricService):
        self.biometric = biometric
    
    def get_buffer_duration(self) -> float:
        global audio_buffer
        return len(audio_buffer) / SAMPLE_RATE
    
    def clear_buffer(self):
        global audio_buffer
        audio_buffer = []
    
    async def verify_utterance(self) -> dict:
        global audio_buffer
        
        async with audio_buffer_lock:
            buffer_len = len(audio_buffer)
            buffer_duration = buffer_len / SAMPLE_RATE
            print(f"🔍 Buffer: {buffer_len} samples ({buffer_duration:.2f}s)")
            
            if buffer_duration < 0.5:
                return {"verified": False, "score": 0.0, "reason": "audio_too_short"}
            
            samples_to_use = list(audio_buffer[-SAMPLE_RATE * 3:])
        
        temp_path = None
        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as f:
                temp_path = f.name
                with wave.open(temp_path, "wb") as w:
                    w.setnchannels(1)
                    w.setsampwidth(2)
                    w.setframerate(SAMPLE_RATE)
                    clamped = [max(-32768, min(32767, int(s))) for s in samples_to_use]
                    w.writeframes(struct.pack(f"{len(clamped)}h", *clamped))
            
            print(f"📁 Temp WAV: {len(samples_to_use)} samples")
            
            # Replay check
            replay = replay_heuristic(temp_path, SAMPLE_RATE)
            replay_prob = replay.get("replay_prob", 0)
            print(f"🔄 Replay prob: {replay_prob:.3f}")
            
            if replay_prob > 0.7:
                return {"verified": False, "score": 0.0, "reason": "replay_detected"}
            
            # Speaker verification
            result = self.biometric.verify_user(temp_path, ENROLL_PATH)
            score = result.get("final_score", 0.0)
            verified = score >= VOICE_THRESHOLD
            
            print(f"🎯 Score: {score:.3f}, Threshold: {VOICE_THRESHOLD}, Verified: {verified}")
            
            return {"verified": verified, "score": score, "reason": "verified" if verified else "not_matched"}
            
        except Exception as e:
            print(f"❌ Verification error: {e}")
            import traceback
            traceback.print_exc()
            return {"verified": False, "score": 0.0, "reason": f"error: {str(e)}"}
        finally:
            if temp_path and os.path.exists(temp_path):
                os.unlink(temp_path)


# ================= AGENT =================
class Assistant(Agent):
    def __init__(self) -> None:
        super().__init__(
            instructions=AGENT_INSTRUCTION,
            tools=[
                get_weather, web_search, login, register, logout,
                check_login_status, check_voice_status, get_shopkupay_balance,
                search_product, get_product_detail, add_to_cart, get_cart,
                remove_from_cart, update_cart_quantity, checkout,
                get_order_history, get_order_detail, pay_order,
            ],
        )


# ================= SERVER =================
server = AgentServer()


@server.rtc_session()
async def connect(ctx: agents.JobContext):
    room = ctx.room
    print(f"🤖 Agent CONNECT ke room: {room.name}")

    # ================= INIT BIOMETRIC =================
    print("Loading biometric models...")
    biometric = BiometricService(device="cpu")
    verifier = PerUtteranceVerifier(biometric)
    print("✅ Biometric ready")
    
    verification_state = {"last_verified": False, "last_score": 0.0}
    is_processing = {"value": False}

    # ================= AUDIO CAPTURE =================
    @room.on("track_subscribed")
    def on_track_subscribed(track: rtc.Track, publication: rtc.TrackPublication, participant: rtc.RemoteParticipant):
        if track.kind != rtc.TrackKind.KIND_AUDIO:
            return
        if "agent" in participant.identity.lower():
            return
        
        print(f"📡 AUDIO TRACK SUBSCRIBED: {participant.identity}")
        
        async def capture_loop():
            print(f"🔴 STARTING AUDIO CAPTURE...")
            stream = rtc.AudioStream(track)
            frame_count = 0
            try:
                async for ev in stream:
                    frame_count += 1
                    add_audio_to_buffer(ev.frame)
                    if frame_count % 500 == 0:
                        dur = len(audio_buffer) / SAMPLE_RATE
                        print(f"🔊 Frames: {frame_count}, Buffer: {dur:.2f}s")
            except Exception as e:
                print(f"❌ Audio capture stopped: {e}")
        
        asyncio.create_task(capture_loop())

    # ================= SESSION =================
    session = AgentSession(
        llm=google.beta.realtime.RealtimeModel(voice="Charon")
    )

    # ================= HELPERS =================
    async def send_to_web(verified: bool, score: float, reason: str):
        data = json.dumps({
            "type": "voice_verification",
            "verified": verified,
            "score": round(score * 100, 1),
            "reason": reason,
            "timestamp": time.time()
        })
        try:
            await room.local_participant.publish_data(data.encode('utf-8'), reliable=True)
            print(f"📤 Web: {score*100:.1f}% {'✅' if verified else '❌'}")
        except Exception as e:
            print(f"⚠️ Send failed: {e}")

    async def verify_and_respond(user_text: str):
        if is_processing["value"]:
            return
        is_processing["value"] = True
        
        try:
            await asyncio.sleep(0.5)
            
            result = await verifier.verify_utterance()
            verified = result["verified"]
            score = result["score"]
            reason = result["reason"]
            
            print(f"🔊 RESULT: score={score:.3f}, verified={verified}, reason={reason}")
            
            verification_state["last_verified"] = verified
            verification_state["last_score"] = score
            auth_state["voice_score"] = score
            auth_state["is_voice_verified"] = verified
            auth_state["voice_status"] = "VERIFIED" if verified else "DENIED"
            auth_state["last_verified_at"] = time.time()
            
            await send_to_web(verified, score, reason)
            
            if not verified:
                print("❌ REJECTED - Suara tidak dikenali")
                await session.interrupt()
                await asyncio.sleep(0.1)
                await session.generate_reply(
                    instructions="TOLAK. Bilang HANYA: 'Maaf, saya tidak mengenal suara Anda.' JANGAN jawab pertanyaan."
                )
            else:
                print("✅ VERIFIED")
                text_lower = user_text.lower()
                if any(kw in text_lower for kw in ["matikan", "stop", "berhenti", "bye", "dadah"]):
                    await session.aclose()
        finally:
            is_processing["value"] = False

    # ================= EVENTS =================
    @session.on("user_input_transcribed")
    def on_user_transcribed(event):
        if not getattr(event, 'is_final', True):
            return
        text = getattr(event, 'transcript', '')
        if text:
            print(f"\n🎤 USER: {text}")
            asyncio.create_task(verify_and_respond(text))

    @session.on("agent_speech_transcribed")
    def on_agent_transcribed(event):
        text = getattr(event, 'transcript', '')
        if text:
            print(f"🤖 AGENT: {text}")

    # ================= START =================
    await session.start(
        room=room,
        agent=Assistant(),
        room_options=room_io.RoomOptions(
            audio_input=room_io.AudioInputOptions(
                noise_cancellation=noise_cancellation.BVC(),
            ),
        ),
    )

    # Check existing participants
    for participant in room.remote_participants.values():
        for pub in participant.track_publications.values():
            if pub.kind == rtc.TrackKind.KIND_AUDIO and pub.track:
                print(f"📡 Found existing audio: {participant.identity}")
                on_track_subscribed(pub.track, pub, participant)

    print("🎙️ Sending greeting...")
    await session.generate_reply(instructions=SESSION_INSTRUCTION)


if __name__ == "__main__":
    cli.run_app(server)