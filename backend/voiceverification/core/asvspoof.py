import warnings

import librosa
import numpy as np

warnings.filterwarnings("ignore", category=RuntimeWarning)

MODEL_MEANS  = [0.011605034616271345, 0.03527778138717016, 0.0]
MODEL_SCALES = [0.010305995506340091, 0.014120233215618267, 1.0]
MODEL_COEFFS = [0.6451673888241342, 0.08283186796791177, 0.0]
MODEL_BIAS   = 0.10828528294764354


def _sigmoid(x):
    return 1 / (1 + np.exp(-x))


def _load_audio(path, sr=16000):
    try:
        y, _ = librosa.load(path, sr=sr, mono=True)
        if len(y) == 0:
            return np.zeros(1024)

        y, _ = librosa.effects.trim(y, top_db=25)
        return y if len(y) > 512 else np.zeros(1024)

    except Exception:
        return np.zeros(1024)


def compute_score(input_data, sr=16000):
    if isinstance(input_data, str):
        y = _load_audio(input_data, sr)
    else:
        y = input_data

    if np.max(np.abs(y)) < 1e-6:
        return 0.0, {}

    stft = np.abs(librosa.stft(y, n_fft=1024, hop_length=512)) + 1e-9

    flat = np.mean(librosa.feature.spectral_flatness(S=stft))
    energy = np.mean(stft, axis=0)
    energy /= np.max(energy) if np.max(energy) > 0 else 1
    temp_var = np.var(energy)

    freqs = librosa.fft_frequencies(sr=sr, n_fft=1024)

    voice_band = stft[(freqs > 300) & (freqs < 3400)]
    high_band  = stft[(freqs > 10000) & (freqs < 16000)]

    voice = np.mean(voice_band) if voice_band.size > 0 else 0.0
    high  = np.mean(high_band)  if high_band.size > 0 else 0.0

    highband = high / voice if voice > 1e-6 else 0.0

    feats = np.array([flat, temp_var, highband])
    z = (feats - MODEL_MEANS) / MODEL_SCALES
    score = _sigmoid(np.dot(z, MODEL_COEFFS) + MODEL_BIAS)

    print(f"ASVspoof Score: {score:.4f} (flat: {flat:.4f}, var: {temp_var:.4f}, high: {highband:.4f})")
    return score, {
        "flatness": flat,
        "temporal_var": temp_var,
        "highband": highband,
        "ml_prob": score
    }
