# import librosa
# import numpy as np


# def speaking_rate(y, sr):
#     onset_env = librosa.onset.onset_strength(y=y, sr=sr)
#     onsets = librosa.onset.onset_detect(onset_envelope=onset_env, sr=sr)
#     dur = len(y) / sr
#     return len(onsets) / dur if dur > 1 else 0.0


# def speaking_rate_similarity(y1, y2, sr):
#     r1, r2 = speaking_rate(y1, sr), speaking_rate(y2, sr)
#     if r1 == 0 or r2 == 0:
#         return 0.0
#     return float(1 - abs(r1 - r2) / max(r1, r2))
