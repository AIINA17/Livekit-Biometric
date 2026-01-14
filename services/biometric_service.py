import librosa
from core.asvspoof import compute_score
from core.pitch import pitch_similarity
from core.speaking_rate import speaking_rate_similarity
from core.fusion import fuse
from models.speaker_verifier import SpeakerVerifier
from core.replay_heuristic import replay_heuristic


class BiometricService:
    def __init__(self, device="cpu",
                spoof_threshold=0.44,
                biometric_threshold=0.47):
        print("Loading models...")
        self.speaker = SpeakerVerifier(device)
        self.spoof_threshold = spoof_threshold
        self.biometric_threshold = biometric_threshold
        print("Ready.")

    def verify_user(self, live_path, enroll_path):
        spoof_score, details = compute_score(live_path)
        if spoof_score < self.spoof_threshold:
            return f"DENIED (spoof): {spoof_score:.4f}"

        # Load audio once
        y_live, sr = librosa.load(live_path, sr=16000)

        # Replay heuristic check
        replay_score, replay_details = replay_heuristic(y_live, sr)

        if replay_score >= 2:
            return "DENIED (suspected replay)"


        ecapa = self.speaker.verify(live_path, enroll_path)

        y1, sr = librosa.load(live_path, sr=16000)
        y2, _  = librosa.load(enroll_path, sr=16000)

        pitch = pitch_similarity(y1, y2, sr)
        rate  = speaking_rate_similarity(y1, y2, sr)

        final = fuse(ecapa, pitch, rate)

        highband = details.get("highband", 0)

        adaptive_threshold = self.biometric_threshold
        if highband < 0.005:
            adaptive_threshold -= 0.05  # toleransi mic jelek

        return (
            "ACCESS GRANTED"
            if final >= adaptive_threshold
            else "ACCESS DENIED"
        )
