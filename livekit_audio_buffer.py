import numpy as np
import soundfile as sf
import os

class LiveKitAudioBuffer:
    def __init__(self, sample_rate=16000, min_seconds=3):
        self.sample_rate = sample_rate
        self.min_samples = sample_rate * min_seconds
        self.buffer = []

    def add_frame(self, frame: np.ndarray):
        """
        frame: PCM float32 mono
        """
        self.buffer.append(frame)

    def is_ready(self):
        total = sum(len(f) for f in self.buffer)
        return total >= self.min_samples

    def save_wav(self, path):
        audio = np.concatenate(self.buffer, axis=0)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        sf.write(path, audio, self.sample_rate)
        self.buffer.clear()
        return path
