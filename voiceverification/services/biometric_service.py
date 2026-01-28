import librosa
import numpy as np
from time import time
from typing import List, Optional

from voiceverification.models.speaker_verifier import SpeakerVerifier

from voiceverification.core.asvspoof import compute_score
from voiceverification.core.pitch import pitch_similarity
from voiceverification.core.speaking_rate import speaking_rate_similarity
from voiceverification.core.fusion import fuse
from voiceverification.core.decision_engine import decide, Decision
from voiceverification.core.trusted_update import TrustedUpdatePolicy
from voiceverification.core.behavior_scoring import compute_behavior_score

from voiceverification.db.behavior_repo import save_behavior_profile


class BiometricService:
    def __init__(self, device="cpu"):
        print("Loading models...")
        self.speaker = SpeakerVerifier(device)
        self.policy = TrustedUpdatePolicy()
        print("Biometric ready.")

    # ======================================================
    # MAIN VERIFY FUNCTION (USED BY SERVER)
    # ======================================================
    def verify_against_multiple_embeddings(
        self,
        *,
        live_wav: str,
        enroll_embeddings: List[np.ndarray],
        behavior_profile=None,
        enroll_wavs: Optional[List[str]] = None,
        is_retry: bool = False,
        user_id: Optional[str] = None,
    ) -> dict:
        # 1. Extract live embedding
        live_emb = self.speaker.extract_embedding(live_wav)

        # 2. Compare ke semua enroll embeddings
        scores = [
            self.speaker.compare_embeddings(live_emb, emb) 
            for emb in enroll_embeddings
        ]

        best_idx = int(np.argmax(scores))
        best_score = float(scores[best_idx])

        # 3. Spoof Score
        spoof_prob, _ = compute_score(live_wav)

        # 4. Behavior
        pitch, rate = None, None
        behavior_score = None
        z_pitch = z_rate = None
        if enroll_wavs:
            y_live, sr_live = librosa.load(live_wav, sr=16000)
            y_ref, _ = librosa.load(enroll_wavs[best_idx], sr=16000)

            pitch = pitch_similarity(y_live, y_ref, sr_live)
            rate = speaking_rate_similarity(y_live, y_ref, sr_live)

            (
                behavior_score,
                z_pitch,
                z_rate,
                _,
                _
            ) = compute_behavior_score(
                pitch,
                rate,
                behavior_profile
            )

        # 5️ Fusion
        final_score = fuse(
            best_score,
            pitch or 0.0,
            rate or 0.0
        )

        # 6️ Decision (adaptive)
        decision, reason = decide(
            speaker_score=final_score,
            replay_prob=spoof_prob,
        )

        # 7️ Trusted Update
        if behavior_profile and decision == Decision.VERIFIED:
            if self.update_policy.should_update(
                decision=decision.value,
                speaker_score=final_score,
                spoof_prob=spoof_prob,
                behavior_score=behavior_score,
                n_samples=behavior_profile.n_samples,
                z_pitch=z_pitch,
                z_rate=z_rate,
                last_update_time=behavior_profile.last_update_ts,
                is_retry=is_retry,
            ):
                behavior_profile.update(
                    pitch,
                    rate,
                    time()
                )

                if user_id:
                    save_behavior_profile(user_id, behavior_profile)


        return {
            "verified": decision == Decision.VERIFIED,
            "decision": decision.value,
            "reason": reason,

            "score": final_score,
            "identity_score": best_score,
            "spoof_prob": spoof_prob,
            
            "best_index": best_idx,
            "all_scores": scores,
            
            "pitch": pitch,
            "rate": rate,
            "behavior_score": behavior_score,
        } 

    def verify_user(self, live_path, enroll_embedding_path, enroll_wav_path):
        # ---- Speaker Embedding Verification ----
        enroll_emb = np.load(enroll_embedding_path)
        live_emb = self.speaker.extract_embedding(live_path)

        identity_score = self.speaker.compare_embeddings(
            live_emb, enroll_emb
        )

        # ---- Spoof Score ----
        spoof_score, spoof_details = compute_score(live_path)

        # ---- Load Audio for Behavioral Biometrics ----
        y_live, sr_live = librosa.load(live_path, sr=16000)
        y_enroll, sr_enroll = librosa.load(enroll_wav_path, sr=16000)

        # ---- Pitch Similarity ----
        pitch = pitch_similarity(y_live, y_enroll, sr_live)

        # ---- Speaking Rate Similarity ----
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
            "pitch": float(pitch),
            "rate": float(rate),
        }

    
    def get_latest_audio(self):
        return "voiceverification/dataset/live.wav"