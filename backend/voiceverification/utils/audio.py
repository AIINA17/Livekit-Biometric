
import os
import shutil
import uuid
import librosa
import soundfile as sf

from fastapi import UploadFile

UPLOAD_DIR = "tmp_audio"
os.makedirs(UPLOAD_DIR, exist_ok=True)

def save_audio(audio: UploadFile) -> str:
    """
    Simpan audio UploadFile ke file wav sementara
    Return path file
    """
    ext = os.path.splitext(audio.filename)[-1] or ".wav"
    filename = f"{uuid.uuid4().hex}{ext}"
    path = os.path.join(UPLOAD_DIR, filename)

    with open(path, "wb") as buffer:
        shutil.copyfileobj(audio.file, buffer)

    return path

def normalize_audio(path):
    y, sr = librosa.load(path, sr=16000, mono=True)
    sf.write(path, y, 16000)