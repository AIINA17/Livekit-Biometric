from voiceverification.services.biometric_service import BiometricService
from voiceverification.core.replay_heuristic import replay_heuristic

service = BiometricService(device="cpu")
ENROLL_PATH = "voiceverification/dataset/enroll.wav"


async def verify_voice_once() -> bool:
    """
    Dipanggil background.
    Return:
        True  -> suara valid
        False -> spoof / tidak dikenal
    """

    # contoh pakai sample terakhir (sesuai implementasi kamu)
    path = service.get_latest_audio()

    replay = replay_heuristic(path, 16000)
    if isinstance(replay, dict):
        replay = replay["replay_score"]

    if replay > 0.7:
        return False

    result = service.verify_user(path, ENROLL_PATH)

    return result["identity_score"] > 0.6 and result["spoof_score"] < 0.4
