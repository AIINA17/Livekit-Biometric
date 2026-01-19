import librosa
from voiceverification.core.asvspoof import compute_score
from voiceverification.core.pitch import pitch_similarity
from voiceverification.core.speaking_rate import speaking_rate_similarity
from voiceverification.core.fusion import fuse
from voiceverification.models.speaker_verifier import SpeakerVerifier
from voiceverification.core.replay_heuristic import replay_heuristic


class BiometricService:
    def __init__(self, device="cpu",
                spoof_threshold=0.44,
                biometric_threshold=0.47):
        print("Loading models...")
        self.speaker = SpeakerVerifier(device)
        self.spoof_threshold = spoof_threshold
        self.biometric_threshold = biometric_threshold
        print("Biometric ready.")

    def verify_user(self, live_path, enroll_path):
        # ---- Spoof Score ----
        spoof_score, spoof_details = compute_score(live_path)

        # ---- Load Audio ----
        y_live, sr_live = librosa.load(live_path, sr=16000)
        y_enroll, sr_enroll = librosa.load(enroll_path, sr=16000)

        # ---- Identity Score ----
        identity_score = self.speaker.verify(live_path, enroll_path)

        # ---- Behavioral Biometrics Features ----
        # Pitch Similarity
        pitch = pitch_similarity(y_live, y_enroll, sr_live)    

        # Speaking Rate Similarity
        rate = speaking_rate_similarity(y_live, y_enroll, sr_live)

        # ---- Fusion ----
        final_score = fuse(
            identity_score,
            pitch,
            rate
        )

        return {
            "identity_score": float(identity_score),
            "spoof_score": float(spoof_score),
            "final_score": float(final_score),
        }
    
    def get_latest_audio(self):
        return "voiceverification/dataset/live.wav"