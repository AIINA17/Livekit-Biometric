# agent/state.py
agent_state = {
    "is_voice_verified": False,
    "voice_status": "UNKNOWN", # UNKNOWN | VERIFIED | REPEAT | DENIED
    "last_verified_at": 0,
    "verify_attempts": 0,   
    "conversation_session_id": None,
}
