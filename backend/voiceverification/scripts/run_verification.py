import torch
from utils.audio_io import record_audio
from services.biometric_service import BiometricService


def main():
    # audio = record_audio()
    device = "cuda" if torch.cuda.is_available() else "cpu"
    system = BiometricService(device=device)
    print(system.verify_user("./dataset/spoof/s11.wav", "./dataset/enroll.wav"))

if __name__ == "__main__":
    main()
