import librosa
import numpy as np
from time import time
from typing import List, Optional

from voiceverification.core.behavior_profile import BehaviorProfile
from voiceverification.models.speaker_verifier import SpeakerVerifier
from voiceverification.core.asvspoof import compute_score
from voiceverification.core.decision_engine import decide, Decision
from voiceverification.core.trusted_update import TrustedUpdatePolicy
from voiceverification.core.behavior_scoring import compute_behavior_score

from voiceverification.db.behavior_repo import save_behavior_profile


class BiometricService:
    def __init__(self, device="cpu"):
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
        user_id: Optional[str] = None,
        is_retry: bool = False,
    ) -> dict:
        # 1. Extract live embedding
        live_emb = self.speaker.extract_embedding(live_wav)

        scores = [
            self.speaker.compare_embeddings(live_emb, emb) 
            for emb in enroll_embeddings
        ]

        best_idx = int(np.argmax(scores))
        best_score = float(scores[best_idx])

        # 2. Spoof Score
        spoof_prob, _ = compute_score(live_wav)

        # 3. Decision
        decision, reason = decide(
            speaker_score=best_score,
            replay_prob=spoof_prob,
        )

        # 4. Behavior
        behavior_score = None
        pitch, rate = None, None
        z_pitch = z_rate = None

        if decision == Decision.VERIFIED:
            y, sr = librosa.load(live_wav, sr=16000)
            pitch = float(np.nanmean(librosa.yin(y, fmin=50, fmax=300, sr=sr)))
            rate = float(len(y) / sr)

        if behavior_profile is not None:
            behavior_profile = BehaviorProfile()
            behavior_profile.update(pitch, rate, time())

            if user_id:
                save_behavior_profile(user_id, behavior_profile)

        else:
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


        # 5. Trusted Update
        if behavior_profile is not None and self.policy.should_update(
                decision=decision.value,
                speaker_score=best_score,
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

            "score": best_score,
            "spoof_prob": spoof_prob,
            
            "best_index": best_idx,
            "all_scores": scores,
            
            "pitch": pitch,
            "rate": rate,
            "behavior_score": behavior_score,
        } 
