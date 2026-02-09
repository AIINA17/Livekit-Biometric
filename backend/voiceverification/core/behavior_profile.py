from dataclasses import dataclass
from datetime import datetime, timezone
import math


@dataclass
class BehaviorProfile:
    n_samples: int = 0
    mean_pitch: float = 0.0
    var_pitch: float = 0.0
    mean_rate: float = 0.0
    var_rate: float = 0.0
    last_update_ts: datetime = datetime.now(timezone.utc)
    @property
    def std_pitch(self):
        return math.sqrt(self.var_pitch) if self.var_pitch > 1e-9 else 1e-6
    
    @property
    def std_rate(self):
        return math.sqrt(self.var_rate) if self.var_rate > 1e-9 else 1e-6
    
    def update(self, pitch: float, rate: float, ts: datetime):
        self.n_samples += 1
        
        # Update pitch stats
        dp = pitch - self.mean_pitch
        self.mean_pitch += dp / self.n_samples
        self.var_pitch += dp * (pitch - self.mean_pitch)

        # Update rate stats
        dr = rate - self.mean_rate
        self.mean_rate += dr / self.n_samples
        self.var_rate += dr * (rate - self.mean_rate)

        self.last_update_ts = ts