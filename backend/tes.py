from google import genai
from dotenv import load_dotenv
import os

# Load .env dari root project
load_dotenv("/home/izz/kp_ws/integrate/backend/.env")

# print("KEY:", os.getenv("GOOGLE_API_KEY"))

client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))

for m in client.models.list():
    print(m.name)
