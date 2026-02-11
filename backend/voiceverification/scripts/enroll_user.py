import numpy as np
from models.speaker_verifier import SpeakerVerifier

ENROLL_WAV = "voiceverification/dataset/enroll.wav"
OUT_EMB = "voiceverification/dataset/enroll_embedding.npy"

verifier = SpeakerVerifier()
emb = verifier.extract_embedding(ENROLL_WAV)
np.save(OUT_EMB, emb)

print(f"Speaker embedding saved to {OUT_EMB}")
print(f"Embedding shape: {emb.shape}")