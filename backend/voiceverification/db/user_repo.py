# voiceverification/db/user_repo.py
from .connection import get_supabase


def get_user_id_from_jwt(jwt_sub: str) -> str:
    """
    Supabase Auth user_id = JWT sub
    """
    return jwt_sub
