# voiceverification/db/speaker_repo.py
import numpy as np
from .connection import get_supabase

def load_embedding(user_id: str) -> np.ndarray | None:
    sb = get_supabase()

    res = (
        sb.table("speaker_profiles")
        .select("embedding")
        .eq("user_id", user_id)
        .single()
        .execute()
    )

    if not res.data:
        return None

    return np.array(res.data["embedding"], dtype=np.float32)


def save_embedding(user_id: str, emb: np.ndarray):
    sb = get_supabase()

    sb.table("speaker_profiles").upsert(
        {
            "user_id": user_id,
            "embedding": emb.tolist(),
        },
        on_conflict="user_id",
    ).execute()
