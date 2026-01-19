console.log("navigator:", navigator);
console.log("mediaDevices:", navigator.mediaDevices);

let recorder;
let chunks = [];

const startBtn = document.getElementById("start");
const stopBtn = document.getElementById("stop");
const statusEl = document.getElementById("status");

startBtn.onclick = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recorder = new MediaRecorder(stream);
    chunks = [];

    recorder.ondataavailable = (e) => chunks.push(e.data);

    recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: "audio/wav" });

        const form = new FormData();
        form.append("audio", blob, "voice.wav");

        statusEl.innerText = "🔍 Verifying...";

        const res = await fetch("http://localhost:8000/verify-and-token", {
            method: "POST",
            body: form,
        });

        const result = await res.json();
        console.log("VERIFY RESULT:", result);

        if (result.verified && result.token) {
            await joinLiveKitRoom(result.token); // ← SEKARANG AMAN
        } else {
            statusEl.innerText = "❌ Verifikasi gagal, ulangi bicara";
        }
    };

    recorder.start();
    startBtn.disabled = true;
    stopBtn.disabled = false;
    statusEl.innerText = "🎤 Recording...";
};

stopBtn.onclick = () => {
    recorder.stop();
    startBtn.disabled = false;
    stopBtn.disabled = true;
};

async function joinLiveKitRoom(token) {
    console.log("Joining LiveKit room...");

    const room = new LiveKitClient.Room({
        adaptiveStream: true,
        dynacast: true,
    });

    room.on(LiveKitClient.RoomEvent.Connected, () => {
        console.log("Successfully connected to the room");
    });

    await room.connect("wss://kpina17-lg4g8x6z.livekit.cloud", token);

    statusEl.innerText = "✅ Voice verified. Connected.";
    console.log("Connected to room:", room.name);

    await room.localParticipant.enableCameraAndMicrophone(true);
}
