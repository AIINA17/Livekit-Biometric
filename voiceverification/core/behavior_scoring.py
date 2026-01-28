import numpy as np

def zscores(x, mean, std):
    """
    Z-score normalization
    """
    return (x - mean) / (std if std > 1e-6 else 1e-6)

def compute_behavior_score(live_pitch, live_rate, profile):
    """
    Compute behavior score based on z-scores of pitch and rate
    """
    z_pitch = zscores(live_pitch, profile.mean_pitch, profile.std_pitch)
    z_rate = zscores(live_rate, profile.mean_rate, profile.std_rate)

    # Combine z-scores into a behavior score
    score_pitch = np.exp(-0.5 * z_pitch**2)
    score_rate = np.exp(-0.5 * z_rate**2)

    behavior_score = 0.5 * (score_pitch + score_rate)

    return behavior_score, z_pitch, z_rate, score_pitch, score_rate 