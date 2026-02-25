import numpy as np
import torch
from numpy.linalg import norm

from speechbrain.pretrained import SpeakerRecognition


class SpeakerVerifier:
    def __init__(self, device="cpu"):
        self.model = SpeakerRecognition.from_hparams(
            source="speechbrain/spkrec-ecapa-voxceleb",
            savedir="pretrained_models/spkrec-ecapa-voxceleb",
            run_opts={"device": device},
        )
        self.device = device

    def extract_embedding(self, wav_path) -> np.ndarray:
        """
        Extract speaker embedding from wavn
        """
        self.model.eval()
        with torch.no_grad():
            waveform = self.model.load_audio(wav_path)
            if waveform.dim() == 1:
                waveform = waveform.unsqueeze(0)
            emb = self.model.encode_batch(waveform)
        emb = emb.squeeze().cpu().numpy()
        emb = emb / np.linalg.norm(emb)
        return emb
    
    def compare_embeddings(self, emb1: np.ndarray, emb2: np.ndarray) -> float:
        """
        Cosine similarity between two embeddings (0 to 1)
        """
        score = np.dot(emb1, emb2)
        return float(score)


    def verify(self, live, enroll):
        score, _ = self.model.verify_files(live, enroll)
        return float(score.item())