import numpy as np
import librosa

def replay_heuristic(y, sr):
    """
    Return:
    - suspicion_score (int)
    - details (dict)
    """

    stft = np.abs(librosa.stft(y, n_fft=1024, hop_length=512)) + 1e-9

    # 1. Spectral centroid variance
    centroid = librosa.feature.spectral_centroid(S=stft)
    centroid_var = np.var(centroid)

    # 2. Spectral rolloff variance
    rolloff = librosa.feature.spectral_rolloff(S=stft, roll_percent=0.85)
    rolloff_var = np.var(rolloff)

    # 3. Amplitude modulation variance
    env = np.mean(stft, axis=0)
    am_var = np.var(np.diff(env))

    suspicion = 0

    if centroid_var < 50:
        suspicion += 1
    if rolloff_var < 100:
        suspicion += 1
    if am_var < 1e-4:
        suspicion += 1

    print(f"Replay Heuristic - Centroid Var: {centroid_var:.2f}, Rolloff Var: {rolloff_var:.2f}, AM Var: {am_var:.6f}, Suspicion Score: {suspicion}")

    return suspicion, {
        "centroid_var": centroid_var,
        "rolloff_var": rolloff_var,
        "am_var": am_var
    }
