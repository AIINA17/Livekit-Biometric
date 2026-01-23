let recorder;
let chunks = [];

const startBtn = document.getElementById("start");
const stopBtn = document.getElementById("stop");
const statusVerify = document.getElementById("status-verify");
const statusRoom = document.getElementById("status-room");
const joinBtn = document.getElementById("join");
const leaveBtn = document.getElementById("leave");

let agentReady = false;

leaveBtn.onclick = async () => {
    if (window.room) {
        await window.room.disconnect();
        statusRoom.innerText = "❌ Left LiveKit room.";
        leaveBtn.disabled = true;
        joinBtn.disabled = false;
    }
};

// ===================== JOIN ROOM =====================
async function joinRoom() {
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
}

joinBtn.onclick = () => joinRoom();

// ===================== RECORDING & VERIFICATION =====================
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

        if (!result.verified) {
            statusVerify.innerText = "❌ Verifikasi gagal, ulangi bicara";
            return;
        }

        // ✅ VERIFIED
        statusVerify.innerText = "✅ Verifikasi berhasil!";

        if (!window.room) {
            console.warn("Not connected to LiveKit room");
            statusVerify.innerText = "⚠️ Belum terhubung ke room";
            return;
        }

        if (!agentReady) {
            statusVerify.innerText = "⏳ Menunggu agent siap...";
            console.warn("Agent not ready yet, verification not sent.");
            return;
        }

        // Persiapkan data
        const payload = JSON.stringify({
            voice_verified: true,
            score: result.score,
            ts: Date.now(),
        });

        // Encode ke Uint8Array (Best Practice untuk LiveKit)
        const encoder = new TextEncoder();
        const dataBytes = encoder.encode(payload);

        // Kirim Data
        try {
            await window.room.localParticipant.publishData(dataBytes, {
                reliable: true,
            });
            console.log("📤 Voice verification sent to agent:", payload);
        } catch (e) {
            console.error("❌ Failed to publish data:", e);
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

    room.on(LivekitClient.RoomEvent.ParticipantConnected, (participant) => {
        console.log("Participant connected:", participant.identity);

        // 🔥 Anggap agent sudah siap
        agentReady = true;
        statusRoom.innerText = "🤖 Agent siap, silakan verifikasi suara";
    });

    room.on(
        LivekitClient.RoomEvent.DataReceived,
        (payload, participant, kind, topic) => {
            handleAgentCommand(payload);
        },
    );

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
    console.log("Connected to room. Checking existing participants...");

    // Cek apakah sudah ada participant lain (Agent) di dalam room
    if (room.remoteParticipants.size > 0) {
        console.log(
            `Found ${room.remoteParticipants.size} existing participants.`,
        );
        agentReady = true;
        statusRoom.innerText = "🤖 Agent terdeteksi, silakan verifikasi suara";
    }

    const track = await LivekitClient.createLocalAudioTrack();
    await room.localParticipant.publishTrack(track);
}

// ===================== AGENT COMMAND =====================
async function handleAgentCommand(payload) {
    const decoder = new TextDecoder();
    const strData = decoder.decode(payload);

    console.log("📩 DATA FROM AGENT:", strData);

    let msg;
    try {
        msg = JSON.parse(strData);
    } catch (e) {
        console.error("❌ Gagal parse JSON:", e);
        return;
    }

    console.log("📦 ACTION diterima:", msg.action);

    if (msg.action === "START_RECORD") {
        console.log("🎙️ Agent meminta mulai rekam otomatis...");
        // Panggil fungsi recording
        startRecording();
    }

    if (msg.action === "STOP_RECORD") {
        console.log("⏹️ Agent meminta stop rekam...");
        stopRecording();
    }
}

// ===================== RECORDING =====================
async function startRecording() {
    // Cek agar tidak double record
    if (recorder && recorder.state === "recording") {
        console.warn("⚠️ Sedang merekam, perintah diabaikan.");
        return;
    }

    try {
        // Minta akses mic ulang (atau gunakan stream yang sudah ada jika memungkinkan)
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
        });

        recorder = new MediaRecorder(stream);
        chunks = [];

        recorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunks.push(e.data);
        };

        // Saat stop, kirim ke server Python untuk verifikasi
        recorder.onstop = async () => {
            console.log("📤 Rekaman selesai, mengirim ke server verifikasi...");
            await sendForVerification();

            // Matikan track agar lampu mic browser mati (opsional)
            stream.getTracks().forEach((track) => track.stop());
        };

        recorder.start();
        statusVerify.innerText = "🎙️ Merekam (Perintah Agent)...";
        console.log("✅ Recording started by Agent command.");
    } catch (err) {
        console.error("❌ Gagal memulai recording otomatis:", err);
        statusVerify.innerText = "❌ Gagal akses Mic";
    }
}

function stopRecording() {
    if (!recorder || recorder.state !== "recording") return;
    recorder.stop();
}

// ===================== VERIFY =====================
async function sendForVerification() {
    const blob = new Blob(chunks, { type: "audio/wav" });
    const form = new FormData();
    form.append("audio", blob, "voice.wav");

    statusVerify.innerText = "🔍 Verifying...";

    const res = await fetch("http://localhost:8000/verify-voice", {
        method: "POST",
        body: form,
    });

    const result = await res.json();

    statusVerify.innerText = result.verified
        ? "✅ Verified"
        : "❌ Verification failed";

    if (!agentReady) return;

    const payload = JSON.stringify({
        type: "VOICE_RESULT",
        voice_verified: result.verified,
        score: result.score,
        replay_prob: result.replay_prob,
        ts: Date.now(),
    });

    await room.localParticipant.publishData(new TextEncoder().encode(payload), {
        reliable: true,
    });
}
