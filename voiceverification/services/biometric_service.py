import os
import librosa
from voiceverification.core.asvspoof import compute_score
from voiceverification.core.pitch import pitch_similarity
from voiceverification.core.speaking_rate import speaking_rate_similarity
from voiceverification.core.fusion import fuse
from voiceverification.models.speaker_verifier import SpeakerVerifier


class BiometricService:
    def __init__(self, device="cpu",
                spoof_threshold=0.44,
                biometric_threshold=0.47,
                enroll_dir="voiceverification/dataset/users"):
        print("Loading models...")
        self.speaker = SpeakerVerifier(device)
        self.spoof_threshold = spoof_threshold
        self.biometric_threshold = biometric_threshold
        self.enroll_dir = enroll_dir
        
        # Buat folder users kalau belum ada
        os.makedirs(self.enroll_dir, exist_ok=True)
        
        print("Biometric ready.")
        print(f"📁 Enrollment directory: {self.enroll_dir}")

    def verify_user(self, live_path, enroll_path):
        """
        Verify single file (original method)
        """
        # ---- Spoof Score ----
        spoof_score, spoof_details = compute_score(live_path)

        # ---- Load Audio ----
        y_live, sr_live = librosa.load(live_path, sr=16000)
        y_enroll, sr_enroll = librosa.load(enroll_path, sr=16000)

        # ---- Identity Score ----
        identity_score = self.speaker.verify(live_path, enroll_path)

        # ---- Behavioral Biometrics Features ----
        pitch = pitch_similarity(y_live, y_enroll, sr_live)    
        rate = speaking_rate_similarity(y_live, y_enroll, sr_live)

        # ---- Fusion ----
        final_score = fuse(identity_score, pitch, rate)

        return {
            "identity_score": float(identity_score),
            "spoof_score": float(spoof_score),
            "final_score": float(final_score),
        }

    def verify_against_multiple(self, live_path, enroll_files, threshold=0.5):
        """
        Verify live audio against multiple enrollment files.
        Cek satu-satu sampai ada yang match atau semua gagal.
        
        Args:
            live_path: Path ke file audio yang mau diverifikasi
            enroll_files: List of paths ke enrollment files
            threshold: Minimum score untuk dianggap match
            
        Returns:
            dict dengan:
                - verified: bool
                - matched_file: path file yang match (atau None)
                - matched_index: index file yang match (1-based, atau None)
                - score: score tertinggi
                - all_scores: list semua scores
                - attempts: jumlah file yang dicek
        """
        if not enroll_files:
            return {
                "verified": False,
                "matched_file": None,
                "matched_index": None,
                "score": 0.0,
                "all_scores": [],
                "attempts": 0,
                "reason": "no_enrollment_files"
            }
        
        all_scores = []
        
        for i, enroll_path in enumerate(enroll_files):
            if not os.path.exists(enroll_path):
                print(f"⚠️ File not found: {enroll_path}")
                all_scores.append(0.0)
                continue
            
            try:
                result = self.verify_user(live_path, enroll_path)
                score = result["final_score"]
                all_scores.append(score)
                
                print(f"🔍 Check file {i+1}/{len(enroll_files)}: score={score:.3f}")
                
                # Kalau score >= threshold, langsung return success
                if score >= threshold:
                    print(f"✅ Match found at file {i+1}!")
                    return {
                        "verified": True,
                        "matched_file": enroll_path,
                        "matched_index": i + 1,
                        "score": score,
                        "all_scores": all_scores,
                        "attempts": i + 1,
                        "reason": "verified"
                    }
                    
            except Exception as e:
                print(f"❌ Error verifying against {enroll_path}: {e}")
                all_scores.append(0.0)
        
        # Semua file dicek, tidak ada yang match
        best_score = max(all_scores) if all_scores else 0.0
        print(f"❌ No match found. Best score: {best_score:.3f}")
        
        return {
            "verified": False,
            "matched_file": None,
            "matched_index": None,
            "score": best_score,
            "all_scores": all_scores,
            "attempts": len(enroll_files),
            "reason": "no_match"
        }

    def get_enrollment_files(self):
        """
        Get list of all enrollment files in users folder.
        Returns list of paths.
        """
        files = []
        if os.path.exists(self.enroll_dir):
            for f in sorted(os.listdir(self.enroll_dir)):
                if f.endswith('.wav'):
                    files.append(os.path.join(self.enroll_dir, f))
        return files

    def get_enrollment_count(self):
        """Get number of enrolled voice files"""
        return len(self.get_enrollment_files())

    def can_enroll_more(self, max_files=3):
        """Check if can enroll more voice files"""
        return self.get_enrollment_count() < max_files

    def get_latest_audio(self):
        return "voiceverification/dataset/live.wav"