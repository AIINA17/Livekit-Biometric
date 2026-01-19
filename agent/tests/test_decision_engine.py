from services.decision_engine import DecisionEngine

engine = DecisionEngine()

# Simulasi replay attack
for _ in range(4):
    engine.update(replay=0.8)
    print(engine.decision())
