import os
from dotenv import load_dotenv
from fastapi import Request, HTTPException
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

supabase = create_client(
    SUPABASE_URL, 
    SUPABASE_SERVICE_ROLE_KEY
)


def get_user_id_from_request(request: Request) -> str:
    """
    Extract & verify Supabase JWT from Authorization header.
    Return auth.users.id (UUID).
    """
    auth_header= request.headers.get("Authorization")
    
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Authorization header")

    token = auth_header.replace("Bearer ", "")

    try:
        res = supabase.auth.get_user(token)
        user = res.user

        if user is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        return user.id
    except Exception:
        raise HTTPException(status_code=401, detail="Token verification failed")