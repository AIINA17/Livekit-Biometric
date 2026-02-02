import os
import numpy as np
from collections import Counter

from voiceverification.services.biometric_service import BiometricService
from voiceverification.core.replay_heuristic import replay_heuristic
from voiceverification.core.decision_engine import (
    decide,
    build_decision_config,
    Decision,
)
from voiceverification.core.user_profile import UserProfile

import matplotlib.pyplot as plt

# ======================
# CONFIG
# ======================
DATASET_DIR = "voiceverification/dataset"
ENROLL_EMB = os.path.join(DATASET_DIR, "enroll_embedding.npy")
ENROLL_WAV = os.path.join(DATASET_DIR, "enroll.wav")

GENUINE_DIR = os.path.join(DATASET_DIR, "genuine")
IMPOSTOR_DIR = os.path.join(DATASET_DIR, "impostor")
SPOOF_DIR = os.path.join(DATASET_DIR, "spoof")

MIN_ADAPTIVE_SAMPLES = 5


# ======================
# USER PROFILE UTILS
# ======================
def update_user_profile(profile, speaker_score, replay_prob):
    """
    Incremental mean & std update (Welford)
    """
    n = profile.n_samples + 1

    delta = speaker_score - profile.mean_score
    mean = profile.mean_score + delta / n
    delta2 = speaker_score - mean

    var = (
        ((profile.n_samples - 1) * profile.std_score**2 + delta * delta2)
        / max(profile.n_samples, 1)
    )

    profile.n_samples = n
    profile.mean_score = mean
    profile.std_score = np.sqrt(var)
    profile.mean_replay = (
        (profile.mean_replay * (n - 1) + replay_prob) / n
    )


# ======================
# CORE SIMULATION
# ======================
def run_folder(folder, label, biometric, user_profile, adaptive=True):
    decisions = []

    for fname in sorted(os.listdir(folder)):
        if not fname.lower().endswith(".wav"):
            continue

        path = os.path.join(folder, fname)

        speaker_score = biometric.verify_user(path, ENROLL_EMB, ENROLL_WAV)["final_score"]
        replay_prob = replay_heuristic(path)["replay_prob"]

        config = (
            build_decision_config(user_profile)
            if adaptive else
            build_decision_config(None)
        )

        decision, _ = decide(
            speaker_score,
            replay_prob,
            config
        )

        decisions.append(decision.value)

        if label == "genuine" and decision == Decision.VERIFIED:
            update_user_profile(
                user_profile,
                speaker_score,
                replay_prob
            )

    return decisions


# ======================
# MAIN
# ======================
def main():
    biometric = BiometricService()

    print("\n==============================")
    print(" GLOBAL DECISION ENGINE ")
    print("==============================")

    user_profile = UserProfile(0, 0.0, 0.0, 0.0)

    g_global = run_folder(GENUINE_DIR, "genuine", biometric, user_profile, adaptive=False)
    i_global = run_folder(IMPOSTOR_DIR, "impostor", biometric, user_profile, adaptive=False)
    s_global = run_folder(SPOOF_DIR, "spoof", biometric, user_profile, adaptive=False)

    plot_results("GLOBAL - Genuine", g_global)
    plot_results("GLOBAL - Impostor", i_global)
    plot_results("GLOBAL - Spoof", s_global)

    print("\n==============================")
    print(" ADAPTIVE DECISION ENGINE ")
    print("==============================")

    user_profile = UserProfile(0, 0.0, 0.0, 0.0)

    g_adapt = run_folder(GENUINE_DIR, "genuine", biometric, user_profile, adaptive=True)
    i_adapt = run_folder(IMPOSTOR_DIR, "impostor", biometric, user_profile, adaptive=True)
    s_adapt = run_folder(SPOOF_DIR, "spoof", biometric, user_profile, adaptive=True)

    plot_results("ADAPTIVE - Genuine", g_adapt)
    plot_results("ADAPTIVE - Impostor", i_adapt)
    plot_results("ADAPTIVE - Spoof", s_adapt)

    print("\nFINAL USER PROFILE")
    print(user_profile)

    plt.show()


# ======================
# PLOTTING
# ======================
def plot_results(title, results):
    labels = ["VERIFIED", "REPEAT", "DENIED"]
    counts = [results.count(l) for l in labels]

    plt.figure()
    plt.bar(labels, counts)
    plt.title(title)
    plt.ylabel("Count")
    plt.grid(axis="y")
    plt.tight_layout()


if __name__ == "__main__":
    main()
