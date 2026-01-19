import librosa
from core.replay_heuristic import replay_heuristic

files = {
    "live": "dataset/live.wav",
    "replay": "dataset/replay_hp.wav",
}

for label, path in files.items():
    y, sr = librosa.load(path, sr=16000)
    result = replay_heuristic(y, sr)

    print(
        f"{label.upper()} → replay_score={result['replay_prob']:.3f}, "
        f"centroid_var={result['centroid_var']:.2f}, "
        f"rolloff_var={result['rolloff_var']:.2f}, "
        f"am_var={result['am_var']:.6f}, "
        f"mod_ratio={result['mod_ratio']:.2f}"
    )
