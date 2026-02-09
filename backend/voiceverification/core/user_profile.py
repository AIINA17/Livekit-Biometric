from dataclasses import dataclass

@dataclass
class UserProfile:
    n_samples: int
    mean_score: float
    std_score: float
    mean_replay: float
