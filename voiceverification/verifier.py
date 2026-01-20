"""
Voice verification module for LiveKit agent integration
"""
import os
import tempfile
import httpx
from typing import Optional

VERIFICATION_SERVER = os.getenv("VERIFICATION_SERVER", "http://localhost:8000")


async def verify_voice_from_audio(audio_data: bytes) -> dict:
    """
    Verifikasi suara dari audio data (bytes).
    
    Args:
        audio_data: Raw audio bytes (WAV format)
    
    Returns:
        dict: {
            "verified": bool,
            "score": float,
            "reason": str (optional)
        }
    """
    try:
        # Save audio to temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as f:
            f.write(audio_data)
            temp_path = f.name

        # Send to verification server
        async with httpx.AsyncClient(timeout=15.0) as client:
            with open(temp_path, "rb") as audio_file:
                files = {"audio": ("voice.wav", audio_file, "audio/wav")}
                response = await client.post(
                    f"{VERIFICATION_SERVER}/verify-voice",
                    files=files
                )
                result = response.json()

        # Cleanup
        os.unlink(temp_path)
        
        return result

    except Exception as e:
        print(f"❌ Voice verification error: {e}")
        return {
            "verified": False,
            "reason": f"error: {str(e)}",
            "score": 0.0
        }


async def verify_voice_from_file(file_path: str) -> dict:
    """
    Verifikasi suara dari file audio.
    
    Args:
        file_path: Path to audio file
    
    Returns:
        dict: Verification result
    """
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            with open(file_path, "rb") as audio_file:
                files = {"audio": ("voice.wav", audio_file, "audio/wav")}
                response = await client.post(
                    f"{VERIFICATION_SERVER}/verify-voice",
                    files=files
                )
                result = response.json()
        
        return result

    except Exception as e:
        print(f"❌ Voice verification error: {e}")
        return {
            "verified": False,
            "reason": f"error: {str(e)}",
            "score": 0.0
        }


# Backward compatibility - jika ada yang masih pakai verify_voice_once
async def verify_voice_once(audio_data: Optional[bytes] = None) -> bool:
    """
    Legacy function for backward compatibility.
    Returns True if verified, False otherwise.
    """
    if audio_data is None:
        return False
    
    result = await verify_voice_from_audio(audio_data)
    return result.get("verified", False)