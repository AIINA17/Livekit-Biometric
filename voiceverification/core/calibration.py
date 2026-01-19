import numpy as np


def find_eer_threshold(scores_genuine, scores_impostor):
    """
    Cari threshold Equal Error Rate (EER)
    """
    scores = np.concatenate([scores_genuine, scores_impostor])
    labels = np.concatenate([
        np.ones(len(scores_genuine)),     # genuine = 1
        np.zeros(len(scores_impostor)),   # impostor = 0
    ])

    thresholds = np.unique(scores)
    fars, frrs = [], []

    for t in thresholds:
        far = np.mean(scores_impostor >= t)   # false accept
        frr = np.mean(scores_genuine < t)     # false reject
        fars.append(far)
        frrs.append(frr)

    fars = np.array(fars)
    frrs = np.array(frrs)

    eer_idx = np.argmin(np.abs(fars - frrs))
    eer_threshold = thresholds[eer_idx]
    eer = (fars[eer_idx] + frrs[eer_idx]) / 2

    return float(eer_threshold), float(eer)
