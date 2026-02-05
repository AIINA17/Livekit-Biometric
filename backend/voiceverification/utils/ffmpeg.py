import subprocess
import os

def ensure_ffmpeg():
    if os.system("which ffmpeg > /dev/null") != 0:
        raise RuntimeError("ffmpeg not installed")

def webm_to_wav(src: str, dst: str):
    ensure_ffmpeg()

    subprocess.run(
        [
            "ffmpeg", "-y",
            "-i", src,
            "-ar", "16000",   # sample rate
            "-ac", "1",       # mono
            "-f", "wav",
            dst
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        check=True
    )
