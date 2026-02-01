import csv
import os

from datetime import datetime

LOG_FILE = "./voiceverification/dataset/verify_log.csv"
os.makedirs(os.path.dirname(LOG_FILE), exist_ok=True)

def log_verify(speaker_score, replay_prob, decision):
    with open(LOG_FILE, "a", newline="") as f:
        writer = csv.writer(f)
        writer.writerow([
            datetime.now().isoformat(),
            speaker_score,
            replay_prob,
            decision.value
        ])
