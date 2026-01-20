let recorder;
let chunks = [];

const startBtn = document.getElementById("start");
const stopBtn = document.getElementById("stop");
const statusVerify = document.getElementById("status-verify");
const statusRoom = document.getElementById("status-room");
const joinBtn = document.getElementById("join");
const leaveBtn = document.getElementById("leave");

leaveBtn.onclick = async () => {
    if (window.room) {
        await window.room.disconnect();
        statusRoom.innerText = "❌ Left LiveKit room.";
        leaveBtn.disabled = true;
        joinBtn.disabled = false;
    }
};

joinBtn.onclick = async () => {
    try {
        const res = await fetch("http://localhost:8000/join-token", {
            method: "POST",
        });

        const data = await res.json();
        console.log("JOIN TOKEN:", data);

        if (data.token) {
            await joinLiveKitRoom(data.token);
            statusRoom.innerText = "✅ Joined room, menunggu agent...";
            joinBtn.disabled = true;
            leaveBtn.disabled = false;
        } else {
            statusRoom.innerText = "❌ Gagal mendapatkan token.";
        }
    } catch (err) {
        console.error(err);
        statusRoom.innerText = "❌ Server tidak bisa diakses.";
    }
};

startBtn.onclick = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recorder = new MediaRecorder(stream);
    chunks = [];

    recorder.ondataavailable = (e) => chunks.push(e.data);

    recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: "audio/wav" });

        const form = new FormData();
        form.append("audio", blob, "voice.wav");

        statusVerify.innerText = "🔍 Verifying...";

        const res = await fetch("http://localhost:8000/verify-voice", {
            method: "POST",
            body: form,
        });

        const result = await res.json();
        console.log("VERIFY RESULT:", result);

        if (result.verified) {
            statusVerify.innerText = "✅ Verifikasi berhasil!";
        } else {
            statusVerify.innerText = "❌ Verifikasi gagal, ulangi bicara";
        }
    };

    recorder.start();
    startBtn.disabled = true;
    stopBtn.disabled = false;
    statusVerify.innerText = "🎤 Recording...";
};

stopBtn.onclick = () => {
    recorder.stop();
    startBtn.disabled = false;
    stopBtn.disabled = true;
};

async function joinLiveKitRoom(token) {
    console.log("Joining LiveKit room...");

    const room = new LivekitClient.Room({
        adaptiveStream: true,
        dynacast: true,
        videoCaptureDefaults: {
            resolution: LivekitClient.VideoPresets.h720.resolution,
        },
    });

    window.room = room;

    room.on(LivekitClient.RoomEvent.Connected, () => {
        console.log("Successfully connected to the room");
        statusRoom.innerText = "✅ Connected to LiveKit room.";
    });

    room.on(LivekitClient.RoomEvent.Disconnected, () => {
        console.log("Disconnected from the room");
        statusRoom.innerText = "❌ Disconnected from LiveKit room.";
    });

    room.on("trackSubscribed", (track) => {
        if (track.kind === "audio") {
            const audioElement = track.attach();
            document.body.appendChild(audioElement);
            audioElement.play().catch((e) => {
                console.error("Error playing audio track:", e);
            });
        }
    });

    await room.connect("wss://kpina17-lg4g8x6z.livekit.cloud", token);

    const track = await LivekitClient.createLocalAudioTrack();
    await room.localParticipant.publishTrack(track);
}
