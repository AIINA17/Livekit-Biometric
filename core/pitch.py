import librosa
import numpy as np


def extract_pitch(y, sr):
    f0 = librosa.yin(y, fmin=80, fmax=350, sr=sr)
    f0 = f0[np.isfinite(f0)]
    return f0 if len(f0) > 10 else None


def pitch_similarity(y1, y2, sr):
    p1, p2 = extract_pitch(y1, sr), extract_pitch(y2, sr)
    if p1 is None or p2 is None:
        return 0.0

    p1 = (p1 - p1.mean()) / (p1.std() + 1e-6)
    p2 = (p2 - p2.mean()) / (p2.std() + 1e-6)

    L = min(len(p1), len(p2))
    sim = np.dot(p1[:L], p2[:L]) / (
        np.linalg.norm(p1[:L]) * np.linalg.norm(p2[:L]) + 1e-6
    )

    return float((sim + 1) / 2)
