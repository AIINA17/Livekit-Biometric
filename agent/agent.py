"""
Run:
python -m agent.agent connect --room mainroom
"""

import os
import sys
import json
import asyncio
import time

from requests import session

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
VERIFY_INTERVAL = 180 # seconds
VOICE_THRESHOLD = 0.1
MAX_VERIFY_ATTEMPTS = 3
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

    # ================= VERIFICATION FLOW =================
            # ================= SEND COMMAND =================
    async def send_cmd(action:str):
        payload = json.dumps({
            "type": "VOICE_CMD",
            "action": action,
            "ts": time.time()
        }).encode("utf-8")

        await room.local_participant.publish_data(
            payload,
            reliable=True
        )
        print(f"📤 Sent VOICE_CMD: {action}")
    async def start_verification():
        await asyncio.sleep(5)

        print("🎙️ Memulai proses verifikasi suara...")
        await send_cmd("START_RECORD")

        await asyncio.sleep(5)

        print("⏹️ Menghentikan perekaman suara untuk verifikasi...")
        await send_cmd("STOP_RECORD")

        
    async def retry_verification():
        """Mengirim perintah verifikasi ulang ke web setelah interval tertentu"""
        print("🔄 Mengirim perintah verifikasi ulang ke web...")
        await asyncio.sleep(0.5)
        await send_cmd("START_RECORD")

        await asyncio.sleep(5)  # Waktu perekaman di web
        await send_cmd("STOP_RECORD")

    # ================== PARTICIPANT CONNECT =================
    @room.on("participant_connected")
    def on_participant_connected(participant):
        print(f"👤 Participant connected: {participant.identity}")
        asyncio.create_task(handle_user_join(participant))

    async def handle_user_join(participant):
        max_retries = 10
        for attempt in range(max_retries):
            try:
                # Coba generate reply
                await session.generate_reply(
                    instructions=SESSION_INSTRUCTION
                )
                
                # Jika berhasil (tidak error), lanjut ke verifikasi
                print("✅ Greeting sent, starting verification...")
                await start_verification()
                return # Keluar dari fungsi

            except RuntimeError as e:
                # Tangkap error spesifik "isn't running"
                if "isn't running" in str(e):
                    print(f"🔄 Session belum siap (Attempt {attempt+1}/{max_retries}). Menunggu...")
                    await asyncio.sleep(1) # Tunggu 1 detik sebelum coba lagi
                else:
                    # Jika error lain, throw ulang
                    print(f"❌ Error lain saat greeting: {e}")
                    raise e
        
        print("⚠️ Gagal menyapa user setelah beberapa kali percobaan (Session timeout).")

    # ================= DATA CHANNEL (VOICE VERIF RESULT) =================
    @room.on("data_received")
    def on_room_data_received(packet):
        """
        data: bytes (payload raw)
        participant: RemoteParticipant (pengirim)
        kind: DataPacketKind
        topic: str (opsional)
        """
        try:

            data = packet.data  # bytes
            participant = packet.participant

            print("📩 RAW payload bytes:", data) 

            # Decode JSON
            payload_str = data.decode("utf-8")
            decoded_data = json.loads(payload_str)

            print("📦 Parsed data:", decoded_data)

            # Logika Verifikasi
            if decoded_data.get("voice_verified") is True:
                agent_state["is_voice_verified"] = True
                agent_state["voice_status"] = "VERIFIED"
                agent_state["last_verified_at"] = time.time()
                print("🔐 Voice verification CONFIRMED from web")
                

            else:
                agent_state["verify_attempts"] += 1
                agent_state["voice_status"] = "DENIED"
                print(f"❌ Verification denied. Attempt: {agent_state['verify_attempts']}")
                
                if agent_state["verify_attempts"] >= MAX_VERIFY_ATTEMPTS:
                    asyncio.create_task(
                        session.generate_reply(
                            instructions="Maaf, verifikasi suara gagal berulang kali. Sesi akan diakhiri."
                        )
                    )
                else:
                    asyncio.create_task(retry_verification())

        except Exception as e:
            print(f"❌ Error processing data packet: {e}")

    

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


# ================= CLI =================
if __name__ == "__main__":
    cli.run_app(server)