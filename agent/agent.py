"""
AgentServer + CONNECT MODE (UPDATED WITH ALL TOOLS)
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

# ================= PATH FIX =================
AGENT_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_DIR = os.path.dirname(AGENT_DIR)
sys.path.insert(0, AGENT_DIR)
sys.path.insert(0, BASE_DIR)

from dotenv import load_dotenv
load_dotenv()

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
from agent.prompts import AGENT_INSTRUCTION, SESSION_INSTRUCTION

# IMPORT SEMUA TOOLS BARU DISINI
from agent.tools import (
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
    checkout,
    pay_order,
    get_order_history,
    get_order_detail,
    auth_state, # State global untuk verifikasi suara
)

# ================= VOICE VERIFICATION =================
from voiceverification.services.biometric_service import BiometricService
from voiceverification.core.replay_heuristic import replay_heuristic
from voiceverification.core.decision_engine import decide, Decision


# ================= CONFIG =================
SAMPLE_RATE = 16000
VERIFY_INTERVAL = 180
VOICE_THRESHOLD = 0.1
MAX_FAIL = 3
ENROLL_PATH = "voiceverification/dataset/enroll.wav"


# ================= AGENT =================
class ShoppingAgent(Agent):
    def __init__(self):
        super().__init__(
            instructions=AGENT_INSTRUCTION,
            tools=[
                # General
                get_weather,
                web_search,
                # Auth
                login,
                register,
                logout,
                check_login_status,
                check_voice_status,
                # User & Product
                get_shopkupay_balance,
                search_product,
                get_product_detail,
                # Cart
                add_to_cart,
                get_cart,
                remove_from_cart,
                # Order & Payment
                checkout,
                pay_order,
                get_order_history,
                get_order_detail,
            ],
        )

    async def on_agent_start(self, session: AgentSession):
        # Reset verify status saat agent mulai
        auth_state["is_voice_verified"] = False
        # Greeting manual (bisa dihapus jika sudah ada di prompt session)
        # await session.say("Halo! Gue Happy. Ada yang bisa gue bantu?")


# ================= SERVER =================
server = AgentServer()


@server.rtc_session()
async def connect(ctx: agents.JobContext):
    """
    CONNECT MODE
    Called by:
    python -m agent.agent connect --room <room>
    """
    room = ctx.room
    print(f"🤖 Agent CONNECT ke room: {room.name}")

    biometric = BiometricService(device="cpu")
    audio_buffer = []
    
    state = {
        "last_verify": 0,
        "failures": 0
    }

    session = AgentSession(
        llm=google.beta.realtime.RealtimeModel(voice="Charon")
    )

    # ================= LOGGING PERCAKAPAN =================
    @session.on("conversation_item_created")
    def on_conversation_item(item):
        """Mencetak percakapan ke console"""
        text = ""
        if item.content and hasattr(item.content[0], "text"):
            text = item.content[0].text
        elif hasattr(item, "text_content"):
            text = item.text_content
            
        if not text:
            return

        if item.role == "user":
            print(f"\n🎤 User: {text}")
        elif item.role == "assistant":
            print(f"🤖 Agent: {text}")

    # ================= START SESSION =================
    await session.start(
        room=room,
        agent=ShoppingAgent(),
        room_options=room_io.RoomOptions(
            audio_input=room_io.AudioInputOptions(
                noise_cancellation=noise_cancellation.BVC()
            )
        ),
    )

    # 🔑 GREETING LANGSUNG
    await session.generate_reply(instructions=SESSION_INSTRUCTION)

    # ================= AUDIO TRACK (VOICE VERIF) =================
    @room.on("track_subscribed")
    def on_track(track: rtc.Track, *_):
        if track.kind != rtc.TrackKind.KIND_AUDIO:
            return

        async def audio_loop():
            stream = rtc.AudioStream(track)
            async for ev in stream:
                audio_buffer.extend(ev.frame.data)
                audio_buffer[:] = audio_buffer[-SAMPLE_RATE * 5 :]

                now = time.time()
                if now - state["last_verify"] < VERIFY_INTERVAL:
                    continue
                if len(audio_buffer) < SAMPLE_RATE * 2:
                    continue

                state["last_verify"] = now

                temp_path = ""
                try:
                    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as f:
                        temp_path = f.name
                        with wave.open(temp_path, "wb") as w:
                            w.setnchannels(1)
                            w.setsampwidth(2)
                            w.setframerate(SAMPLE_RATE)
                            w.writeframes(
                                struct.pack(f"{len(audio_buffer)}h", *audio_buffer)
                            )

                    replay = replay_heuristic(temp_path, SAMPLE_RATE)
                    replay_prob = replay["replay_prob"]

                    result = biometric.verify_user(temp_path, ENROLL_PATH)
                    score = result.get("final_score", 0.0)

                    decision, reason = decide(
                        speaker_score=score,
                        replay_prob=replay_prob
                    )

                    print(
                        f"[DECISION] speaker={score:.3f}, "
                        f"replay={replay_prob:.3f}, "
                        f"decision={decision.value}, reason={reason}"
                    )

                    # UPDATE GLOBAL AUTH STATE
                    if decision == Decision.VERIFIED:
                        auth_state["is_voice_verified"] = True
                        auth_state["voice_score"] = score
                        auth_state["voice_status"] = "VERIFIED"
                        auth_state["last_verified_at"] = time.time()
                        state["failures"] = 0
                        print("✅ Voice VERIFIED")

                    elif decision == Decision.REPEAT:
                        state["failures"] += 1
                        auth_state["voice_status"] = "VERIFYING"
                        print(f"🔁 Voice REPEAT ({state['failures']}/{MAX_FAIL})")

                    else:  # DENIED
                        state["failures"] += 1
                        print(f"❌ Voice DENIED ({state['failures']}/{MAX_FAIL})")

                        if state["failures"] >= MAX_FAIL:
                            auth_state["is_voice_verified"] = False
                            auth_state["voice_status"] = "DENIED"

                            
                except Exception as e:
                    print(f"Error verification: {e}")
                finally:
                    if temp_path and os.path.exists(temp_path):
                        os.unlink(temp_path)

        asyncio.create_task(audio_loop())

# ================= CLI =================
if __name__ == "__main__":
    cli.run_app(server)