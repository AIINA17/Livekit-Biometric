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
from dotenv import load_dotenv

# ================= PATH FIX =================
AGENT_DIR = os.path.dirname(os.path.abspath(__file__))
VOICEVERIFICATION_DIR = os.path.dirname(AGENT_DIR)
BACKEND_DIR = os.path.dirname(VOICEVERIFICATION_DIR)

ENV_PATH = os.path.join(BACKEND_DIR, ".env")
load_dotenv(ENV_PATH)


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

# ================ LOGS =================
from db.conversation_logs import insert_conversation_log
from db.conversation_sessions import create_conversation_session


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
    get_product_from_search_index,
    add_to_cart,
    get_cart,
    remove_from_cart,
    checkout,
    pay_order,
    get_order_history,
    get_order_detail,
    auth_state
)
from agent.state import agent_state

# ================= CONFIG =================
SAMPLE_RATE = 16000
VERIFY_INTERVAL = 180 # seconds
VOICE_THRESHOLD = 0.1
MAX_VERIFY_ATTEMPTS = 3

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
                get_product_from_search_index,
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

    auth_state["room_ref"] = room

    session = AgentSession(
        llm=google.beta.realtime.RealtimeModel(
            voice="Charon"
        )
    )

    # ================== PARTICIPANT CONNECT =================
    @room.on("participant_connected")
    def on_participant_connected(participant):
        print(f"👤 Participant connected: {participant.identity}")
        asyncio.create_task(handle_user_join(participant))

    async def handle_user_join(participant):
        session_id = create_conversation_session(
            user_id=participant.identity,
            label=f"Session for {participant.identity}"
        )

        agent_state["conversation_session_id"] = session_id

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
        try:
            # 🔥 FILTER TOPIC
            if packet.topic != "VOICE_RESULT":
                return

            data = packet.data
            if not data:
                return

            payload_str = data.decode("utf-8").strip()
            if not payload_str.startswith("{"):
                return

            decoded = json.loads(payload_str)
            print("📦 Voice result:", decoded)

            decision = decoded.get("decision") or decoded.get("status")


            if decision == "VERIFIED":
                agent_state["is_voice_verified"] = True
                agent_state["voice_status"] = "VERIFIED"
                agent_state["verify_attempts"] = 0
                agent_state["last_verified_at"] = time.time()
                print("🔐 Voice VERIFIED")

            elif decision == "REPEAT":
                agent_state["is_voice_verified"] = False
                agent_state["voice_status"] = "REPEAT"
                agent_state["verify_attempts"] += 1
                print("🔁 Voice REPEAT")

            elif decision == "DENIED":
                agent_state["is_voice_verified"] = False
                agent_state["voice_status"] = "DENIED"
                agent_state["verify_attempts"] += 1
                print("❌ Voice DENIED")

        except Exception as e:
            print("❌ Error processing VOICE_RESULT:", e)

    # ================= LOGGING PERCAKAPAN =================
    @session.on("conversation_item_added")
    def on_conversation_item(event):
        role = event.item.role
        text = event.item.text_content
        
        if not text: return

        if role not in ("user", "assistant"):
            return
    
        insert_conversation_log(
            session_id=agent_state["conversation_session_id"], 
            role=role, 
            content=text
        )

        # ================= USER MESSAGE =================
        if role == "user":
            print(f"\n🎤 User: {text}")
            
            if agent_state["voice_status"] != "VERIFIED":

                # 🚫 STOP retry kalau sudah kebanyakan
                if agent_state["verify_attempts"] >= MAX_VERIFY_ATTEMPTS:
                    print("🚫 Max verification attempts reached")

                    asyncio.create_task(
                        session.generate_reply(
                            instructions=(
                                "Maaf ya, gue gak bisa verifikasi suara lo. "
                                "Kita tetep bisa ngobrol kok, tapi untuk aksi sensitif "
                                "kayak checkout atau pembayaran, gue gak bisa lanjutin."
                            )
                        )
                    )

                else:
                    asyncio.create_task(start_verification())
            # Check shutdown command
            if text:
                text_lower = text.lower()
                shutdown_keywords = [
                    # Indonesian
                    "udahan", "udah dulu", "udahan dulu", "sampai jumpa", "sampai ketemu",
                    "dadah", "dah dulu", "cabut dulu", "gue pergi dulu", "pergi dulu",
                    "matikan", "tutup", "selesai", "cukup", "sudah cukup",
                    # English
                    "bye", "goodbye", "see you", "stop", "end", "quit", "exit",
                    "that's all", "thats all", "i'm done", "im done", "gotta go"
                ]
                if any(keyword in text_lower for keyword in shutdown_keywords):
                    print("\n⚠️  Shutdown command detected. Closing session...")
                    asyncio.create_task(handle_goodbye())

            asyncio.create_task(
                room.local_participant.publish_data(
                    json.dumps({
                        "type": "USER_MESSAGE",
                        "text": text,
                        "ts": time.time()
                    }).encode("utf-8"),
                    reliable=True,
                    topic="chat"
                )
            )
        # ================= AGENT MESSAGE =================
        elif role == "assistant":
            print(f"🤖 Agent: {text}")

            asyncio.create_task(
                room.local_participant.publish_data(
                    json.dumps({
                        "type": "AGENT_MESSAGE",
                        "text": text,
                        "ts": time.time()
                    }).encode("utf-8"),
                    reliable=True,
                    topic="chat"
                )
            )

    # ================= GOODBYE HANDLER =================
    async def handle_goodbye():
        """Handle goodbye - say farewell and disconnect from room"""
        try:
            # Say goodbye first
            await session.generate_reply(
                instructions="Bilang goodbye dengan singkat dan friendly, contoh: 'Oke siap, sampai ketemu lagi ya! Bye!' atau 'Sip, kabarin lagi kalo butuh bantuan. Dadah!'"
            )
            
            # Wait a bit for the goodbye message to be spoken
            await asyncio.sleep(3)
            
            # Close session and disconnect from room
            print("👋 Closing session and leaving room...")
            await session.aclose()
            await room.disconnect()
            print("✅ Successfully disconnected from room")
            
        except Exception as e:
            print(f"❌ Error during goodbye: {e}")
            # Force disconnect if error
            try:
                await room.disconnect()
            except:
                pass

    # ================= START SESSION =================
    await session.start(
        room=room,
        agent=ShoppingAgent(),
        room_options=room_io.RoomOptions(
            audio_input=room_io.AudioInputOptions(
                noise_cancellation=noise_cancellation.BVC()
            ),
            audio_output=room_io.AudioOutputOptions(
                sample_rate=SAMPLE_RATE 
            )
        ),
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
            reliable=True,
            topic="VOICE_CMD"
        )
        print(f"📤 Sent VOICE_CMD: {action}")

    # ================= START VERIFICATION =================
    async def start_verification():
        await asyncio.sleep(0.5)

        print("👂 Mengizinkan user bicara...")
        await send_cmd("READY_FOR_USER")

        await asyncio.sleep(0.3)

        print("🎙️ Memulai proses verifikasi suara...")
        await send_cmd("START_RECORD")


    # ================= RETRY VERIFICATION =================
    async def retry_verification():
        """Mengirim perintah verifikasi ulang ke web setelah interval tertentu"""
        print("🔄 Mengirim perintah verifikasi ulang ke web...")
        await asyncio.sleep(0.5)
        await send_cmd("READY_FOR_USER")

        await asyncio.sleep(0.3)

        print("🎙️ Memulai proses verifikasi suara...")
        await send_cmd("START_RECORD")


# ================= CLI =================
if __name__ == "__main__":
    cli.run_app(server)