import numpy as np
import librosa

def replay_heuristic(wav_path, sr=16000):
    """
    Return:
    - suspicion_score (int)
    - details (dict)
    """

    y, _ = librosa.load(wav_path, sr=sr)

    stft = np.abs(librosa.stft(y, n_fft=1024, hop_length=512)) + 1e-9

    # 1. Spectral centroid variance
    centroid = librosa.feature.spectral_centroid(S=stft)[0]
    centroid_var = np.var(centroid)

    # 2. Spectral rolloff variance
    rolloff = librosa.feature.spectral_rolloff(S=stft, roll_percent=0.85)[0]
    rolloff_var = np.var(rolloff)

    # 3. Amplitude modulation variance
    env = np.mean(stft, axis=0)
    am_var = np.var(np.diff(env))

    # 4.
    mod = np.abs(np.fft.rfft(env - np.mean(env)))
    low = np.mean(mod[:10])
    high = np.mean(mod[10:50])

    mod_ratio = low / (high + 1e-9)

    score = 0.0

    score += np.clip((50 - centroid_var) / 50, 0, 1)
    score += np.clip((100 - rolloff_var) / 100, 0, 1)
    score += np.clip((1e-4 - am_var) / 1e-4, 0, 1)
    score += np.clip((mod_ratio - 1.5) / 1.5, 0, 1)

    score /= 4.0  # normalize 0–1
    

    return {
        "replay_prob": score,
        "centroid_var": centroid_var,
        "rolloff_var": rolloff_var,
        "am_var": am_var,
        "mod_ratio": mod_ratio
    }
