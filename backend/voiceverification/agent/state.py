import time

agent_state = {
    # Voice verification state
    "is_voice_verified": False,
<<<<<<< HEAD:backend/agent/state.py
    "voice_status": "INIT",  # INIT, VERIFIED, DENIED, REPEAT, EXPIRED
    "last_verified_at": 0,
    "verify_attempts": 0,
    
    # Session state
    "session_id": None,
    "conversation_history": [],
}
=======
    "voice_status": "UNKNOWN", # UNKNOWN | VERIFIED | REPEAT | DENIED
    "last_verified_at": 0,
    "verify_attempts": 0,   
    "conversation_session_id": None,
}
>>>>>>> origin/main:backend/voiceverification/agent/state.py
