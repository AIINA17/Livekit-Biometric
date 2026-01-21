from enum import Enum
from dataclasses import dataclass

class Decision(Enum):
    VERIFIED = "VERIFIED"
    REPEAT = "REPEAT"
    DENIED = "DENIED"

@dataclass
class DecisionConfig:
    # Speaker verification thresholds
    voice_accept: float = 0.15
    voice_repeat: float = 0.10

    # Replay attack detection thresholds
    replay_deny: float = 0.75
    replay_warn: float = 0.60

    # Combined score thresholds
    combined_accept: float = 0.60
    combined_repeat: float = 0.45

def decide(
        speaker_score: float,
        replay_prob: float,
        config: DecisionConfig = DecisionConfig(),
):
    
    if replay_prob >= config.replay_deny:
        return Decision.DENIED, "Replay attack detected"
    
    if replay_prob >= config.replay_warn:
        return Decision.REPEAT, "Potential replay attack detected"
    
    combined_score = (
        0.7 * speaker_score + 0.3 * (1 - replay_prob)
    )

    if speaker_score >= config.voice_accept and combined_score >= config.combined_accept:
        return Decision.VERIFIED, "Speaker verified successfully"
    
    if speaker_score >= config.voice_repeat or combined_score >= config.combined_repeat:
        return Decision.REPEAT, "Uncertain verification, please repeat"
    
    return Decision.DENIED, "Speaker verification failed"
