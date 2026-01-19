from speechbrain.pretrained import SpeakerRecognition


class SpeakerVerifier:
    def __init__(self, device="cpu"):
        self.model = SpeakerRecognition.from_hparams(
            source="speechbrain/spkrec-ecapa-voxceleb",
            savedir="pretrained_models/spkrec-ecapa-voxceleb",
            run_opts={"device": device},
        )

    def verify(self, live, enroll):
        score, _ = self.model.verify_files(live, enroll)
        return float(score.item())
