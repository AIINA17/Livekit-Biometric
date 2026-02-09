import sounddevice as sd
from scipy.io.wavfile import write

FS = 16000
SECONDS = 10


def record_audio():
    print("🎙️ Recording...")
    audio = sd.rec(int(SECONDS * FS), samplerate=FS, channels=1)
    sd.wait()
    path = "audio/recorded.wav"
    write(path, FS, audio)
    print(f"✅ Recorded audio saved to: {path}")
    return path

if __name__ == "__main__":
    record_audio()