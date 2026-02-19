import os
import json
import asyncio
import time
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
from db.conversation_logs import insert_conversation_log
from db.conversation_sessions import create_conversation_session

from agent.tools import (
    get_weather,
    web_search,
    login,
    register,
    logout,
    check_login_status,
    check_voice_status,
    get_shopkupay_balance,
    send_product_cards,
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

# ================= CONFIG =================
SAMPLE_RATE = 16000
MAX_VERIFY_ATTEMPTS = 3

# ================= AGENT =================
class ShoppingAgent(Agent):
    def __init__(self):
        super().__init__(
            instructions=AGENT_INSTRUCTION,
            tools=[
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
                send_product_cards,
                add_to_cart,
                get_cart,
                remove_from_cart,
                checkout,
                pay_order,
                get_order_history,
                get_order_detail,
            ],
        )

    async def on_agent_start(self, session: AgentSession):
        print("🤖 ShoppingAgent started")

# ================= SERVER =================
server = AgentServer()

@server.rtc_session()
async def connect(ctx: agents.JobContext):
    """
    Dipanggil otomatis oleh LiveKit Worker.
    1 room = 1 agent instance.
    """

    room = ctx.room
    room_name = room.name

    # Optional filter
    if not room_name.startswith("user-"):
        print(f"⏭ Skip room: {room_name}")
        return

    print(f"🤖 Agent CONNECT ke room: {room_name}")

    # ================= ROOM STATE =================
    room_state = {
        "conversation_session_id": None,
        "user_id": None,
        "voice_status": "UNVERIFIED",
        "verify_attempts": 0,
        "is_voice_verified": False,
        "last_verified_at": None,
        "greeted": False,
    }

    auth_state["agent_state"] = room_state  # Share state with tools
    auth_state["room_ref"] = room  # Share room reference for tools to send messages if needed

    session = AgentSession(
        llm=google.beta.realtime.RealtimeModel(
            model="models/gemini-2.5-flash-native-audio-latest",
            voice="Charon",
        )
    )


    # ================= DATA CHANNEL =================
    @room.on("data_received")
    def on_data(packet):
        if packet.topic != "VOICE_RESULT":
            return

        try:
            print("RAW VOICE RESULT:", packet.data)
            decoded = json.loads(packet.data.decode())
            decision = decoded.get("decision") or decoded.get("status")

            print("📦 Voice result:", decision)

            if decision == "VERIFIED":
                room_state["voice_status"] = "VERIFIED"
                room_state["verify_attempts"] = 0
                room_state["is_voice_verified"] = True
                room_state["last_verified_at"] = time.time()

            elif decision == "REPEAT":
                room_state["verify_attempts"] += 1
                room_state["voice_status"] = "REPEAT"

            elif decision == "DENIED":
                room_state["verify_attempts"] += 1
                room_state["voice_status"] = "DENIED"

        except Exception as e:
            print("❌ Voice result error:", e)

    # ================= CONVERSATION LOGGING =================
    @session.on("conversation_item_added")
    def on_conversation_item(event):
        role = event.item.role
        text = event.item.text_content

        if not text or role not in ("user", "assistant"):
            return

        if room_state["conversation_session_id"]:
            insert_conversation_log(
                session_id=room_state["conversation_session_id"],
                role=role,
                content=text
            )

        print(f"{role.upper()}: {text}")

        if role == "user":
            asyncio.create_task(ensure_conversation_session())
            if room_state["voice_status"] != "VERIFIED":

                if room_state["verify_attempts"] >= MAX_VERIFY_ATTEMPTS:
                    asyncio.create_task(
                        session.generate_reply(
                            instructions=(
                                "Maaf, verifikasi suara gagal. "
                                "Aksi sensitif tidak bisa dilakukan."
                            )
                        )
                    )
                else:
                    asyncio.create_task(start_verification())

            asyncio.create_task(
                room.local_participant.publish_data(
                    json.dumps({
                        "type": "USER_MESSAGE",
                        "text": text,
                        "ts": time.time()
                    }).encode(),
                    reliable=True,
                    topic="chat"
                )
            )

        elif role == "assistant":
            asyncio.create_task(
                room.local_participant.publish_data(
                    json.dumps({
                        "type": "AGENT_MESSAGE",
                        "text": text,
                        "ts": time.time()
                    }).encode(),
                    reliable=True,
                    topic="chat"
                )
            )

    # ================= GOODBYE =================
    async def handle_goodbye():
        try:
            await session.generate_reply(
                instructions="Ucapkan goodbye singkat dan ramah."
            )
            await asyncio.sleep(3)
            await session.aclose()
            await room.disconnect()
        except:
            await room.disconnect()

    # ================= VERIFICATION =================
    async def send_cmd(action: str):
        payload = json.dumps({
            "type": "VOICE_CMD",
            "action": action,
            "ts": time.time()
        }).encode()

        await room.local_participant.publish_data(
            payload,
            reliable=True,
            topic="VOICE_CMD"
        )

    async def start_verification():
        await asyncio.sleep(0.4)
        await send_cmd("READY_FOR_USER")
        await asyncio.sleep(0.3)
        await send_cmd("START_RECORD")

    async def ensure_conversation_session():
        if room_state["conversation_session_id"]:
            return

        session_id = create_conversation_session(
            user_id=room_state["user_id"],
            label="New session",
        )

        room_state["conversation_session_id"] = session_id
        print("📝 Session created:", session_id)

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
            ),
        ),
    )

    print(f"🚀 Agent running for room: {room_name}")

    participant = await ctx.wait_for_participant()
    identity = participant.identity

    room_state["user_id"] = identity


    # 🔥 GREETING LANGSUNG DI SINI
    await session.generate_reply(
        instructions=SESSION_INSTRUCTION
    )

    print("✅ Greeting sent")

    await start_verification()

# ================= ENTRYPOINT =================
if __name__ == "__main__":
    cli.run_app(server)
