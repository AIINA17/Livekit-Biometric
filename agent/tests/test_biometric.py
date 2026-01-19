from services.biometric_service import BiometricService

svc = BiometricService(device="cpu")

result = svc.verify_user(
    "dataset/live.wav",
    "dataset/enroll.wav"
)

print(result)
