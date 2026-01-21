"""
Run:
python -m agent.agent connect --room mainroom
"""

import os
import sys
import json
import asyncio
import time

# ================= PATH FIX =================
AGENT_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_DIR = os.path.dirname(AGENT_DIR)
sys.path.insert(0, AGENT_DIR)
sys.path.insert(0, BASE_DIR)

from dotenv import load_dotenv
load_dotenv()

# ================= LIVEKIT =================
from livekit import agents
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
from agent.state import agent_state

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
        print("🤖 ShoppingAgent started (voice via web)")

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

    session = AgentSession(
        llm=google.beta.realtime.RealtimeModel(voice="Charon")
    )

    # ================= DATA CHANNEL (VOICE VERIF RESULT) =================
    @room.on("data_received")
    def on_room_data_received(data_packet):
        """
        data_packet: rtc.DataPacket
        """
        try:
            # Ambil raw bytes
            payload = data_packet.data
            print("📩 RAW payload from room:", payload)

            # Decode JSON
            if isinstance(payload, bytes):
                data = json.loads(payload.decode("utf-8"))
            else:
                data = json.loads(payload)

            print("📦 Parsed data:", data)

        except Exception as e:
            print("❌ Failed to parse data packet:", e)
            return

        if data.get("voice_verified") is True:
            agent_state["is_voice_verified"] = True
            agent_state["voice_status"] = "VERIFIED"
            agent_state["last_verified_at"] = time.time()

            print("🔐 Voice verification CONFIRMED from web")

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

    # GREETING LANGSUNG
    await session.generate_reply(instructions=SESSION_INSTRUCTION)


# ================= CLI =================
if __name__ == "__main__":
    cli.run_app(server)