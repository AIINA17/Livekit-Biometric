from datetime import datetime
from typing import List, Dict
from uuid import UUID

from db.connection import get_supabase

def insert_conversation_log(
        session_id: UUID,
        role: str,
        content: str,
):
    """
    Insert a conversation log into the database.
    """
    supabase = get_supabase()
    try:
        supabase.table("conversation_logs").insert({
            "session_id": str(session_id),
            "role": role,
            "content": content,
        }).execute()
    except Exception as e:
        print(f"Error inserting conversation log: {e}")
        raise

def get_conversation_logs(session_id: UUID) -> List[Dict]:
    """
    Retrieve conversation logs for a given session_id.
    """
    supabase = get_supabase()
    try:
        response = supabase.table("conversation_logs")\
            .select("role, content, created_at")\
            .eq("session_id", str(session_id))\
            .order("created_at", ascending=True)\
            .execute()
        return response.data
    except Exception as e:
        print(f"Error retrieving conversation logs: {e}")
        raise