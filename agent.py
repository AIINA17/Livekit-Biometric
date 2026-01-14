import os
from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ENV_PATH = os.path.join(BASE_DIR, ".env")

load_dotenv(ENV_PATH)

print("DEBUG LIVEKIT_URL =", os.getenv("LIVEKIT_URL"))

from livekit import agents, rtc
from livekit.agents import AgentServer, AgentSession, Agent, room_io
from livekit.plugins import (
    noise_cancellation,
)
from livekit.plugins import google
from prompts import AGENT_INSTRUCTION, SESSION_INSTRUCTION
from tools import (
    # General tools
    get_weather,
    web_search,
    # Auth tools
    login,
    register,
    logout,
    check_login_status,
    # User tools
    get_shopkupay_balance,
    # Product tools
    search_product,
    get_product_detail,
    # Cart tools
    add_to_cart,
    get_cart,
    remove_from_cart,
    # Order tools
    checkout,
    get_order_history,
    get_order_detail,
    pay_order,
)

load_dotenv(".env.local")

class Assistant(Agent):
    def __init__(self) -> None:
        super().__init__(
            instructions=AGENT_INSTRUCTION,
            tools=[
                # General tools
                get_weather,
                web_search,
                # Auth tools
                login,
                register,
                logout,
                check_login_status,
                # User tools
                get_shopkupay_balance,
                # Product tools
                search_product,
                get_product_detail,
                # Cart tools
                add_to_cart,
                get_cart,
                remove_from_cart,
                # Order tools
                checkout,
                get_order_history,
                get_order_detail,
                pay_order,
            ],
        )

server = AgentServer()

@server.rtc_session()
async def my_agent(ctx: agents.JobContext):
    session = AgentSession(
        llm=google.beta.realtime.RealtimeModel(
            voice="Charon"
        )
    )

    # Event handler untuk transcript (user & agent) - setelah selesai ngomong
    @session.on("conversation_item_added")
    def on_conversation_item(event):
        role = event.item.role
        text = event.item.text_content
        
        if role == "user":
            print(f"\n🎤 User: {text}")
            
            # Check shutdown command
            if text:
                text_lower = text.lower()
                shutdown_keywords = ["matikan", "stop", "berhenti", "shutdown", "tutup", "end conversation", "bye", "dadah"]
                if any(keyword in text_lower for keyword in shutdown_keywords):
                    print("\n⚠️  Shutdown command detected. Closing session...")
                    import asyncio
                    asyncio.create_task(session.aclose())
        
        elif role == "assistant":
            print(f"🤖 Agent: {text}")

    await session.start(
        room=ctx.room,
        agent=Assistant(),
        room_options=room_io.RoomOptions(
            audio_input=room_io.AudioInputOptions(
                noise_cancellation=lambda params: noise_cancellation.BVCTelephony() if params.participant.kind == rtc.ParticipantKind.PARTICIPANT_KIND_SIP else noise_cancellation.BVC(),
            ),
        ),
    )

    await session.generate_reply(
        instructions=SESSION_INSTRUCTION,
    )


if __name__ == "__main__":
    agents.cli.run_app(server)