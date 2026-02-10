import os
from supabase import create_client

_supabase = None

def get_supabase():
    global _supabase

    if _supabase is None:
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

        if not supabase_url or not supabase_key:
            raise RuntimeError("Supabase env vars not loaded")

        _supabase = create_client(supabase_url, supabase_key)

    return _supabase
