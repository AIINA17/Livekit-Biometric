import time

agent_state = {
    # Voice verification state
    "is_voice_verified": False,
    "voice_status": "INIT",  # INIT, VERIFIED, DENIED, REPEAT, EXPIRED
    "last_verified_at": 0,
    "verify_attempts": 0,
    
    # Session state
    "session_id": None,
    "conversation_history": [],
}