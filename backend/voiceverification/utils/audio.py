import os
import shutil
import uuid
import librosa
import soundfile as sf

from fastapi import UploadFile
from voiceverification.utils.ffmpeg import webm_to_wav

UPLOAD_DIR = "tmp_audio"
os.makedirs(UPLOAD_DIR, exist_ok=True)

def save_audio(audio: UploadFile) -> str:
    ext = os.path.splitext(audio.filename)[-1] or ".webm"
    raw_path = os.path.join(UPLOAD_DIR, f"{uuid.uuid4().hex}{ext}")
    wav_path = raw_path.replace(ext, ".wav")

    with open(raw_path, "wb") as buffer:
        shutil.copyfileobj(audio.file, buffer)

    webm_to_wav(raw_path, wav_path)
    os.remove(raw_path)

    return wav_path
def normalize_audio(path):
    y, sr = librosa.load(path, sr=16000, mono=True)
    sf.write(path, y, 16000)