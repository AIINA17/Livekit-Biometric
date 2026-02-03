let recorder;
let chunks = [];

const statusVerify = document.getElementById("status-verify");
const statusRoom = document.getElementById("status-room");
const joinBtn = document.getElementById("join");
const leaveBtn = document.getElementById("leave");
const scoreDisplay = document.getElementById("score-display");
const agentAnim = document.getElementById("agent-anim");
const enrollBtn = document.getElementById("enroll");
const loginForm = document.getElementById("login-form");
const logoutBtn = document.getElementById("logout-btn");
const loginBtn = document.getElementById("login-btn");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");

let agentReady = false;
let vadTimeout = null;
let allowUserToSpeak = false;

const VAD_THRESHOLD = 12;
const SILENCE_DELAY = 800;

// SERVER_URL dari .env
const SERVER_URL = "http://localhost:8000";
const LIVEKIT_URL = "wss://kpina17-lg4g8x6z.livekit.cloud"; // Bisa dipindah ke config

const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.APP_CONFIG;

if (!window._supabaseClient) {
    window._supabaseClient = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_ANON_KEY,
    );
}

// ===================== LOGIN =====================

loginForm.onsubmit = async (e) => {
    e.preventDefault();

    const email = emailInput.value;
    const password = passwordInput.value;

    const { data, error } =
        await window._supabaseClient.auth.signInWithPassword({
            email,
            password,
        });

    if (error) {
        alert(error.message);
        return;
    }

    window.supabaseToken = data.session.access_token;
    console.log("✅ Login berhasil, token:", window.supabaseToken);
    logoutBtn.disabled = false;
    loginBtn.disabled = true;
    statusVerify.innerText = "🔓 Login berhasil";
};

// ===================== LOGOUT =====================
logoutBtn.onclick = async () => {
    await window._supabaseClient.auth.signOut();

    window.supabaseToken = null;

    loginBtn.disabled = false;
    logoutBtn.disabled = true;

    statusVerify.innerText = "👋 Logout berhasil";
    console.log("👋 User logged out");
};

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

        // Cleanup saat disconnect
        if (recorder && recorder.state === "recording") {
            recorder.stop();
        }
        if (vadTimeout) {
            clearTimeout(vadTimeout);
        }
    });

    room.on(LivekitClient.RoomEvent.ParticipantConnected, (participant) => {
        console.log("Participant connected:", participant.identity);

        agentReady = true;
        statusRoom.innerText = "🤖 Agent siap, silakan verifikasi suara";
    });

    room.on(
        LivekitClient.RoomEvent.DataReceived,
        (payload, participant, kind, topic) => {
            // The SDK often passes (payload, participant, kind, topic)
            // instead of a single 'packet' object depending on the version.

            console.log("📦 Data received from:", participant?.identity);

            if (!payload || payload.byteLength === 0) {
                console.warn("⚠️ Received empty payload");
                return;
            }

            // Use the 'topic' argument directly if provided by the emitter
            if (topic !== "VOICE_CMD") return;

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

                agentAnim.style.display = average > 5 ? "block" : "none";
                requestAnimationFrame(checkVolume);
            }
            checkVolume();

            audioElement
                .play()
                .catch((e) => console.error("Audio play error:", e));
        }
    });

    await room.connect(LIVEKIT_URL, token);
    console.log("Connected to room. Checking existing participants...");

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

    // 🔥 FIX PALING PENTING
    if (!strData || strData.trim().length < 2) {
        console.warn("⚠️ Ignoring empty/invalid agent payload");
        return;
    }

    const clean = strData.trim();
    console.log("📩 DATA FROM AGENT:", clean);

    // Pastikan JSON beneran
    if (clean[0] !== "{") {
        console.warn("⚠️ Non-JSON agent payload ignored:", clean);
        return;
    }

    let msg;
    try {
        msg = JSON.parse(clean);
    } catch (e) {
        console.error("❌ JSON parse failed");
        console.error("RAW:", clean);
        return;
    }

    if (msg.type !== "VOICE_CMD") return;

    console.log("📦 ACTION diterima:", msg.action);

    if (msg.action === "START_RECORD") {
        console.log("🔵 Calling startVADRecording()...");
        try {
            await startVADRecording();
        } catch (err) {
            console.error("❌ Error starting VAD recording:", err);
            console.error("Stack trace:", err.stack);
        }
    } else if (msg.action === "STOP_RECORD") {
        stopRecording();
        console.log("✅ Recording stopped by Agent command.");
    }

    if (msg.action === "READY_FOR_USER") {
        allowUserToSpeak = true;
        statusVerify.innerText = "🎧 Silakan bicara untuk verifikasi...";
    }
}

function stopRecording() {
    if (!recorder || recorder.state !== "recording") return;
    recorder.stop();
    allowUserToSpeak = false;
}

// ===================== VERIFY =====================
async function sendForVerification() {
    // 🔧 FIX: Validasi token sebelum request
    if (!window.supabaseToken) {
        console.error("❌ No auth token available");
        statusVerify.innerText = "❌ Login dulu sebelum verifikasi";
        return;
    }

    const blob = new Blob(chunks, { type: "audio/wav" });
    const form = new FormData();
    form.append("audio", blob, "voice.wav");

    statusVerify.innerText = "🔍 Verifying...";

    try {
        const res = await fetch(`${SERVER_URL}/verify-voice`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${window.supabaseToken}`,
            },
            body: form,
        });

        if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }

        const result = await res.json();
        console.log("📊 Verification result:", result);

        scoreDisplay.style.display = "block";
        const percentScore = (result.score * 100).toFixed(2);
        scoreDisplay.innerText = `📊 Similarity Score: ${percentScore}%`;
        scoreDisplay.style.color = result.verified ? "#10b981" : "#ef4444";

        statusVerify.innerText = result.verified
            ? "✅ Verified"
            : "❌ Verification failed";

        // 🔧 FIX: Pastikan room dan agent ready sebelum kirim
        if (!agentReady || !window.room) {
            console.warn("⚠️ Agent not ready, skipping data send");
            return;
        }

        const payload = JSON.stringify({
            type: "VOICE_RESULT",
            voice_verified: result.verified,
            decision: result.status, // Dari server: "VERIFIED", "DENIED", "REPEAT"
            score: result.score,
            spoof_prob: result.spoof_prob, // 🔧 FIX: sudah benar
            ts: Date.now(),
        });

        await window.room.localParticipant.publishData(
            new TextEncoder().encode(payload),
            { reliable: true },
        );

        console.log("📤 Sent verification result to agent");
    } catch (err) {
        console.error("❌ Verification error:", err);
        statusVerify.innerText = `❌ Error: ${err.message}`;
    }
}

// ===================== VAD RECORDING =====================
async function startVADRecording() {
    console.log("🎯 startVADRecording() called");

    if (recorder && recorder.state === "recording") {
        console.warn("⚠️ Recording already in progress");
        return;
    }

    try {
        console.log("🎤 Requesting microphone access...");
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
        });
        console.log("✅ Microphone access granted");

        const audioContext = new AudioContext();
        console.log("✅ AudioContext created");

        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        source.connect(analyser);
        console.log("✅ Audio analyser connected");

        const buffer = new Uint8Array(analyser.fftSize);

        recorder = new MediaRecorder(stream);
        chunks = [];
        console.log("✅ MediaRecorder initialized");

        let silenceStart = null;
        let checkInterval = null;

        // === TUNING PARAM ===
        const START_THRESHOLD = 0.01; // mulai ngomong (LOWERED for testing)
        const STOP_THRESHOLD = 0.008; // dianggap diam (LOWERED for testing)
        const SILENCE_DELAY = 700; // ms
        const MAX_RECORD_MS = 5000; // ms

        recorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
                chunks.push(e.data);
                console.log(`📦 Data chunk received: ${e.data.size} bytes`);
            }
        };

        recorder.onstop = async () => {
            console.log("🛑 Recording stopped");

            allowUserToSpeak = false;

            // Stop the check loop
            if (checkInterval) {
                cancelAnimationFrame(checkInterval);
            }

            // Verify voice
            if (chunks.length > 0) {
                console.log("✅ Sending for verification...");
                await sendForVerification();
            } else {
                console.warn("⚠️ No audio data recorded");
                statusVerify.innerText = "⚠️ Tidak ada suara terdeteksi";
            }

            // Cleanup
            stream.getTracks().forEach((t) => t.stop());
            audioContext.close();
        };

        const startTime = performance.now();
        let frameCount = 0;

        function check() {
            if (!allowUserToSpeak) {
                checkInterval = requestAnimationFrame(check);
                return;
            }

            analyser.getByteTimeDomainData(buffer);

            // === RMS ===
            let sum = 0;
            for (let i = 0; i < buffer.length; i++) {
                const v = (buffer[i] - 128) / 128;
                sum += v * v;
            }
            const rms = Math.sqrt(sum / buffer.length);

            // Log RMS every 30 frames (~0.5 seconds) for debugging
            frameCount++;
            if (frameCount % 30 === 0) {
                console.log(
                    `📊 Recording: ${recorder?.state === "recording"} | Threshold: ${START_THRESHOLD}`,
                );
            }

            // === START ===
            if (
                recorder?.state !== "recording" &&
                rms > START_THRESHOLD &&
                allowUserToSpeak
            ) {
                console.log(
                    `🎙️ Voice detected (RMS: ${rms.toFixed(4)}) → START`,
                );
                recorder.start();
                silenceStart = null;
                statusVerify.innerText = "🎙️ Mendengarkan...";
            }

            // === STOP ===
            if (recorder?.state === "recording" && allowUserToSpeak) {
                if (rms < STOP_THRESHOLD) {
                    if (!silenceStart) {
                        silenceStart = performance.now();
                        console.log(
                            `🤫 Silence detected (RMS: ${rms.toFixed(4)})`,
                        );
                    }

                    const silenceDuration = performance.now() - silenceStart;
                    if (silenceDuration > SILENCE_DELAY) {
                        console.log(
                            `✅ Silence duration: ${silenceDuration.toFixed(0)}ms → STOP`,
                        );
                        recorder.stop();
                        return; // Exit check loop
                    }
                } else {
                    // Voice detected again, reset silence timer
                    if (silenceStart) {
                        console.log(
                            `🎙️ Voice resumed (RMS: ${rms.toFixed(4)})`,
                        );
                    }
                    silenceStart = null;
                }
            }
            checkInterval = requestAnimationFrame(check);
        }

        statusVerify.innerText = "🎧 Silakan bicara...";
        console.log("👂 Starting VAD check loop...");
        check();

        console.log("✅ VAD recording setup complete!");

        setTimeout(() => {
            if (recorder?.state === "recording") {
                console.warn("⏰ Max record duration reached → FORCE STOP");
                recorder.stop();
            }
        }, MAX_RECORD_MS);
    } catch (err) {
        console.error("❌ Failed to start VAD recording:", err);
        console.error("Error details:", err.message);
        console.error("Error stack:", err.stack);
        statusVerify.innerText = "❌ Mic access failed: " + err.message;
    }
}

// ===================== ENROLLMENT =====================
enrollBtn.onclick = async () => {
    if (!window.supabaseToken) {
        alert("Login dulu sebelum enroll");
        return;
    }

    statusVerify.innerText = "🎙️ Recording for enrollment...";
    await startEnrollRecording();
};

async function startEnrollRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
        });
        const recorderEnroll = new MediaRecorder(stream);
        let enrollChunks = [];

        recorderEnroll.ondataavailable = (e) => {
            if (e.data.size > 0) enrollChunks.push(e.data);
        };

        recorderEnroll.onstop = async () => {
            recorderEnroll.stream.getTracks().forEach((t) => t.stop());

            const blob = new Blob(enrollChunks, { type: "audio/wav" });
            const form = new FormData();
            form.append("audio", blob, "enroll.wav");

            statusVerify.innerText = "📤 Uploading enrollment...";

            try {
                const res = await fetch(`${SERVER_URL}/enroll-voice`, {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${window.supabaseToken}`,
                    },
                    body: form,
                });

                if (!res.ok) {
                    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
                }

                const result = await res.json();

                if (result.status === "OK") {
                    statusVerify.innerText = "✅ Enrollment successful";
                } else {
                    statusVerify.innerText = "❌ Enrollment failed";
                    console.error(result);
                }
            } catch (err) {
                console.error("Enroll upload error:", err);
                statusVerify.innerText = `❌ Upload failed: ${err.message}`;
            }
        };

        recorderEnroll.start();
        statusVerify.innerText = "🎙️ Speak clearly for enrollment...";

        setTimeout(() => recorderEnroll.stop(), 4000);
    } catch (err) {
        console.error("Enroll error:", err);
        statusVerify.innerText = "❌ Mic access failed";
    }
}

async function restoreSession() {
    const { data } = await window._supabaseClient.auth.getSession();

    if (!data.session) return;

    window.supabaseToken = data.session.access_token;
    console.log("🔄 Session restored, token refreshed");

    loginBtn.disabled = true;
    logoutBtn.disabled = false;
}

restoreSession();

// ===================== SIGNUP =====================
const signupForm = document.getElementById("signup-form");
const signupEmail = document.getElementById("signup-email");
const signupPassword = document.getElementById("signup-password");


signupForm.onsubmit = async (e) => {
    e.preventDefault();

    const email = signupEmail.value;
    const password = signupPassword.value;

    const { data, error } = await window._supabaseClient.auth.signUp({
        email,
        password,
    });

    if (error) {
        alert("❌ Signup gagal: " + error.message);
        return;
    }
    // Kalau email confirmation ON
    if (!data.session) {
        alert("📧 Cek email kamu untuk verifikasi akun");
        return;
    }

    // Kalau email confirmation OFF
    window.supabaseToken = data.session.access_token;

    loginBtn.disabled = true;
    logoutBtn.disabled = false;

    statusVerify.innerText = "✅ Signup & login berhasil";
    console.log("✅ Signup success:", data);
};
