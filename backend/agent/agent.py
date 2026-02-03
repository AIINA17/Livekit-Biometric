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

# IMPORT SEMUA TOOLS
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
    auth_state,  # Import auth_state untuk set room reference
)
from agent.state import agent_state

# ================= CONFIG =================
SAMPLE_RATE = 16000
VERIFY_INTERVAL = 180  # seconds
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
    
    # Set room reference di agent_state DAN auth_state
    agent_state["room"] = room
    print("✅ Room set in agent_state")

    # IMPORTANT: Set room_ref untuk tools.py
    from agent.tools import auth_state as tools_auth_state
    tools_auth_state["room_ref"] = room
    print("✅ Room reference set for product cards")
    
    # ================= AGENT SESSION =================
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
        """Handle new participant joining - with retry logic"""
        max_retries = 10
        
        for attempt in range(max_retries):
            try:
                # Try to generate greeting
                await session.generate_reply(
                    instructions=SESSION_INSTRUCTION
                )
                
                # If successful, proceed to verification
                print("✅ Greeting sent, starting verification...")
                await asyncio.sleep(1.5)  # Brief delay before verification
                await start_verification()
                return  # Exit function on success

            except RuntimeError as e:
                # Handle "isn't running" error specifically
                if "isn't running" in str(e):
                    print(f"🔄 Session not ready yet (Attempt {attempt+1}/{max_retries}). Waiting...")
                    await asyncio.sleep(1)
                else:
                    # Other errors - re-raise
                    print(f"❌ Unexpected error during greeting: {e}")
                    raise e
        
        print("⚠️ Failed to greet user after multiple attempts (Session timeout).")

    # ================= DATA CHANNEL (VOICE VERIFICATION RESULT) =================
    @room.on("data_received")
    def on_room_data_received(packet):
        """
        Handle incoming data from web client (voice verification results)
        """
        try:
            data = packet.data  # bytes
            participant = packet.participant

            print("📩 RAW payload bytes:", data[:100])  # Log first 100 bytes

            # Decode JSON
            payload_str = data.decode("utf-8")
            decoded_data = json.loads(payload_str)

            print("📦 Parsed data:", decoded_data)

            # Get data type
            data_type = decoded_data.get("type")
            
            # Handle VOICE_RESULT (voice verification)
            if data_type == "VOICE_RESULT":
                handle_voice_result(decoded_data)
            else:
                print(f"ℹ️ Ignoring data with type: {data_type}")

        except json.JSONDecodeError as e:
            print(f"❌ JSON decode error: {e}")
            print(f"Raw data: {data.decode('utf-8', errors='ignore')[:200]}")
        except Exception as e:
            print(f"❌ Error processing data packet: {e}")

    def handle_voice_result(decoded_data):
        """Process voice verification result"""
        decision = decoded_data.get("decision")
        score = decoded_data.get("score", 0)
        spoof_prob = decoded_data.get("spoof_prob", 0)
        
        print(f"🔍 Voice Result - Decision: {decision}, Score: {score:.2f}, Spoof: {spoof_prob:.2f}")

        if decision == "VERIFIED":
            agent_state["is_voice_verified"] = True
            agent_state["voice_status"] = "VERIFIED"
            agent_state["last_verified_at"] = time.time()
            agent_state["verify_attempts"] = 0
            print("✅ Voice VERIFIED")
            
            # Send success feedback
            asyncio.create_task(
                session.generate_reply(
                    instructions="Bilang ke user: 'Oke, suara lo udah terverifikasi. Sekarang lo bisa belanja dengan aman. Ada yang bisa gue bantu?'"
                )
            )

        elif decision == "REPEAT":
            agent_state["is_voice_verified"] = False
            agent_state["voice_status"] = "REPEAT"
            agent_state["verify_attempts"] += 1
            print("🔁 Voice unclear, requesting repeat")
            
            asyncio.create_task(retry_verification())

        else:  # DENIED
            agent_state["is_voice_verified"] = False
            agent_state["voice_status"] = "DENIED"
            agent_state["verify_attempts"] += 1
            print(f"❌ Voice DENIED (Attempt {agent_state['verify_attempts']}/{MAX_VERIFY_ATTEMPTS})")

            if agent_state["verify_attempts"] >= MAX_VERIFY_ATTEMPTS:
                print("🚫 Max verification attempts reached")
                asyncio.create_task(
                    session.generate_reply(
                        instructions="Bilang: 'Waduh, gue udah coba beberapa kali tapi suara lo ga bisa diverifikasi. Mungkin ada masalah sama mic atau koneksi lo. Coba restart browser atau pake device lain deh. Maaf ya!'"
                    )
                )
            else:
                asyncio.create_task(retry_verification())

    # ================= LOGGING PERCAKAPAN =================
    @session.on("conversation_item_added")
    def on_conversation_item(event):
        role = event.item.role
        text = event.item.text_content
        
        if role == "user":
            print(f"\n🎤 User: {text}")
            
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
                    print("\n⚠️ Shutdown command detected. Closing session...")
                    asyncio.create_task(handle_goodbye())
        
        elif role == "assistant":
            print(f"🤖 Agent: {text}")

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
            )
        ),
    )

    # ================= VERIFICATION FLOW =================
    async def send_cmd(action: str):
        """Send command to web client via data channel"""
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

    async def start_verification():
        """Initiate voice verification process"""
        try:
            print("🎙️ Starting voice verification process...")
            
            # Send command to web to start recording
            await send_cmd("START_RECORD")
            
            # Give instruction to agent to ask user to speak
            await session.generate_reply(
                instructions="Minta user untuk bicara sebentar buat verifikasi suara. Bilang: 'Halo! Sebelum mulai belanja, gue perlu verifikasi suara lo dulu. Coba ngomong apa aja, bebas.'"
            )
            
            print("✅ Verification request sent to user")
            
        except Exception as e:
            print(f"❌ Error starting verification: {e}")

    async def retry_verification():
        """Retry voice verification with user feedback"""
        try:
            print("🔄 Retrying voice verification...")
            
            await asyncio.sleep(0.5)  # Brief pause
            
            # Send retry command
            await send_cmd("START_RECORD")
            
            # Give friendly feedback
            if agent_state["verify_attempts"] == 1:
                instruction = "Bilang: 'Hmm, suara lo kurang jelas tadi. Coba ngomong lagi ya, lebih keras dikit.'"
            elif agent_state["verify_attempts"] == 2:
                instruction = "Bilang: 'Masih belum kedengeran jelas. Coba deketin mic-nya atau ngomong lebih keras.'"
            else:
                instruction = "Bilang: 'Satu kali lagi ya, coba ngomong dengan jelas dan agak keras.'"
            
            await session.generate_reply(instructions=instruction)
            
        except Exception as e:
            print(f"❌ Error retrying verification: {e}")


# ================= CLI =================
if __name__ == "__main__":
    cli.run_app(server)