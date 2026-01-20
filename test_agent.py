import os
from dotenv import load_dotenv
from livekit.agents import Agent, JobContext, cli, WorkerOptions

load_dotenv()

class TestAgent(Agent):
    def __init__(self):
        super().__init__(
            instructions="Kamu adalah Happy, asisten yang ramah.",
            tools=[]
        )
    
    async def on_agent_start(self, session):
        print("🤖 Agent started!")
        await session.say("Hi! Gue Happy, teman terbaik lo. Lagi butuh apa nih?")

async def entrypoint(ctx: JobContext):
    print("🟢 Connecting to room:", ctx.room.name)
    return TestAgent()

if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
