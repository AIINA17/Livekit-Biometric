from uuid import UUID
from db.connection import get_supabase

def create_conversation_session(
        user_id: str,
        label: str
) -> UUID:
    """
    Create a new conversation session in the database.
    """
    supabase = get_supabase()
    response = (
        supabase
        .table("conversation_sessions")
        .insert({
            "user_id": user_id,
            "label": label,
        })
        .execute()
    )

    # Supabase return inserted row
    session = response.data[0]
    return UUID(session["id"])