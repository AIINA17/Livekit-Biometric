import time
import asyncio
import os

from  dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV_PATH = os.path.join(BASE_DIR, ".env")

load_dotenv(ENV_PATH)

from livekit.agents import Agent, JobContext, cli, WorkerOptions

from voiceverification.verifier import verify_voice_once


from agent.prompts import AGENT_INSTRUCTION
from agent.tools import (
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

    # Voice verification tool
    auth_state
)



ENROLL_PATH = os.path.join(os.path.dirname(__file__), "dataset/enroll.wav")

REVERIFY_INTERVAL = 180  # 3 minutes
MAX_ATTEMPTS = 3


print("LIVEKIT_URL:", os.getenv("LIVEKIT_URL"))
print("LIVEKIT_API_KEY:", os.getenv("LIVEKIT_API_KEY"))
print("LIVEKIT_API_SECRET:", "SET" if os.getenv("LIVEKIT_API_SECRET") else "MISSING")

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

    async def on_agent_start(self, session):
        await session.say("Hi! Gue Happy, teman terbaik lo. Lagi butuh apa nih?")

    async def on_user_message(self, message: str, session):
        now = time.time()

        # =============================
        # 🔐 PERLU VERIFIKASI?
        # =============================
        need_verify = (
            not auth_state["verified"]
            or (now - auth_state["last_verified_at"]) > REVERIFY_INTERVAL
        )

        if need_verify:
            ok = await verify_voice_once()

            if not ok:
                auth_state["verify_attempts"] += 1

                if auth_state["verify_attempts"] >= MAX_ATTEMPTS:
                    await session.say(
                        "Maaf, gue belum bisa memastikan identitas suara lo. "
                        "Coba lagi nanti ya."
                    )
                    return

                await session.say(
                    "Boleh ulangi bicara sekali lagi? Gue mau memastikan suara lo."
                )
                return

            # ✅ sukses
            auth_state["verified"] = True
            auth_state["last_verified_at"] = now
            auth_state["verify_attempts"] = 0

        # =============================
        # ✅ SUDAH VERIFIED → NORMAL FLOW
        # =============================
        return await super().on_user_message(message, session)



# ==============================
# AGENT ENTRY POINT
# ==============================    
async def entrypoint(ctx: JobContext):
    await ctx.connect()
    return Assistant()


if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint
        )
    )
