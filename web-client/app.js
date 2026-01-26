let recorder;
let chunks = [];

const statusVerify = document.getElementById("status-verify");
const statusRoom = document.getElementById("status-room");
const joinBtn = document.getElementById("join");
const leaveBtn = document.getElementById("leave");
const scoreDisplay = document.getElementById("score-display");
const agentAnim = document.getElementById("agent-anim");

let agentReady = false;

const VAD_THRESHOLD = 15; // Ambang batas volume (0-255)
const SILENCE_DELAY = 1500; // Berapa lama diam (ms) sebelum rekaman berhenti otomatis

// SERVER_URL dari .env 

// ===================== JOIN ROOM =====================
async function joinRoom() {
    try {
        const res = await fetch(`${SERVER_URL}/join-token`, {
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

// ===================== LEAVE ROOM =====================
leaveBtn.onclick = async () => {
    if (window.room) {
        await window.room.disconnect();
        statusRoom.innerText = "❌ Left LiveKit room.";
        leaveBtn.disabled = true;
        joinBtn.disabled = false;
    }
};

// ===================== LIVEKIT ROOM =====================
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

            // Logika Animasi: Deteksi suara dari track agent
            const audioContext = new AudioContext();
            const source = audioContext.createMediaStreamSource(
                new MediaStream([track.mediaStreamTrack]),
            );
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);

            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);

            function checkVolume() {
                analyser.getByteFrequencyData(dataArray);
                let sum = 0;
                for (let i = 0; i < bufferLength; i++) sum += dataArray[i];
                let average = sum / bufferLength;

                // Jika ada suara di atas ambang batas, tampilkan animasi
                agentAnim.style.display = average > 5 ? "block" : "none";
                requestAnimationFrame(checkVolume);
            }
            checkVolume();

            audioElement
                .play()
                .catch((e) => console.error("Audio play error:", e));
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
        // startRecording();
        startVADRecording();
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
        console.warn("⏸️ Sedang merekam, perintah diabaikan.");
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

    const res = await fetch(`${SERVER_URL}/verify-voice`, {
        method: "POST",
        body: form,
    });

    const result = await res.json();

    scoreDisplay.style.display = "block";
    const percentScore = (result.score * 100).toFixed(2); // Asumsi score 0.0 - 1.0
    scoreDisplay.innerText = `📊 Similarity Score: ${percentScore}%`;
    scoreDisplay.style.color = result.verified ? "#10b981" : "#ef4444";

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

// ===================== VAD RECORDING =====================
async function startVADRecording() {
    if (recorder && recorder.state === "recording") return;

    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
        });
        const audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        recorder = new MediaRecorder(stream);
        chunks = [];
        let isSpeaking = false;
        let silenceStart = performance.now();

        recorder.ondataavailable = (e) => chunks.push(e.data);
        recorder.onstop = async () => {
            statusVerify.innerText = "📤 Mengirim rekaman...";
            await sendForVerification();
            stream.getTracks().forEach((t) => t.stop());
            audioContext.close();
        };

        function checkAudio() {
            if (recorder.state !== "recording" && isSpeaking === false) {
                analyser.getByteFrequencyData(dataArray);
                let sum = dataArray.reduce((a, b) => a + b, 0);
                let average = sum / bufferLength;

                // DETEKSI MULAI BICARA
                if (average > VAD_THRESHOLD) {
                    console.log("🗣️ Suara terdeteksi! Mulai merekam...");
                    isSpeaking = true;
                    recorder.start();
                    statusVerify.innerText = "🎙️ Sedang mendengarkan...";
                }
            } else if (isSpeaking) {
                analyser.getByteFrequencyData(dataArray);
                let sum = dataArray.reduce((a, b) => a + b, 0);
                let average = sum / bufferLength;

                // DETEKSI SELESAI BICARA
                if (average < VAD_THRESHOLD) {
                    if (performance.now() - silenceStart > SILENCE_DELAY) {
                        console.log("🤫 User diam. Berhenti merekam.");
                        recorder.stop();
                        return; // Berhenti looping
                    }
                } else {
                    silenceStart = performance.now(); // Reset timer jika ada suara lagi
                }
            }
            requestAnimationFrame(checkAudio);
        }

        statusVerify.innerText = "🎧 Silakan bicara untuk verifikasi...";
        checkAudio();
    } catch (err) {
        console.error("VAD Error:", err);
        statusVerify.innerText = "❌ Gagal akses Mic";
    }
}
