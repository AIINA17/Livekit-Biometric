from voiceverification.core.decision_engine import Decision, decide, build_decision_config
from voiceverification.core.user_profile import UserProfile


user = UserProfile(
    n_samples=10,
    mean_score=0.56,
    std_score=0.04,
    mean_replay=0.12
)

speaker_score = 0.5
replay_prob = 0.60

config = build_decision_config(user)

decision, reason = decide(
    speaker_score,
    replay_prob,
    config
)

print(config)
print(decision, reason)



