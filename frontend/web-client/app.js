/* ===================== GLOBAL STATE ===================== */
let recorder;
let chunks = [];
let agentReady = false;
let allowUserToSpeak = true;
let conversationHistory = [];

/* ===================== DOM ELEMENTS ===================== */
const statusVerify = document.getElementById("status-verify");
const statusRoom = document.getElementById("status-room");
const joinBtn = document.getElementById("join");
const leaveBtn = document.getElementById("leave");
const scoreDisplay = document.getElementById("score-display");
const agentAnim = document.getElementById("agent-anim");
const chatMessages = document.getElementById("chat-messages");
const chatStatus = document.getElementById("chat-status");

// Auth Elements
const enrollBtn = document.getElementById("enroll");
const enrollLabelInput = document.getElementById("enroll-label");

const loginForm = document.getElementById("login-form");
const logoutBtn = document.getElementById("logout-btn");
const loginBtn = document.getElementById("login-btn");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const signupForm = document.getElementById("signup-form");
const signupEmail = document.getElementById("signup-email");
const signupPassword = document.getElementById("signup-password");

const SERVER_URL = "http://localhost:8000";
const LIVEKIT_URL = "wss://kpina17-lg4g8x6z.livekit.cloud";
const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.APP_CONFIG;

/* ===================== SUPABASE INIT ===================== */
if (!window._supabaseClient) {
    window._supabaseClient = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_ANON_KEY,
    );
}

/* ===================== CHAT UI ===================== */
function addMessage(role, text, timestamp = new Date()) {
    if (!text || !text.trim()) return;

    chatMessages.querySelector(".empty-state")?.remove();

    const msg = document.createElement("div");
    msg.className = `message ${role}`;

    msg.innerHTML = `
        <div class="message-avatar ${role}-avatar">${role === "user" ? "👤" : "🤖"}</div>
        <div class="message-content">
            <div class="message-role">${role === "user" ? "You" : "AI Assistant"}</div>
            <div class="message-bubble">
                <div class="message-text">${text}</div>
            </div>
            <div class="message-timestamp">${formatTimestamp(timestamp)}</div>
        </div>
    `;

    chatMessages.appendChild(msg);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function showTypingIndicator() {
    if (document.getElementById("typing-indicator")) return;
    const div = document.createElement("div");
    div.id = "typing-indicator";
    div.className = "message assistant typing-message";
    div.innerHTML = `<div class="message-avatar assistant-avatar">🤖</div>
                    <div class="message-bubble">
                        <div class="typing-indicator">
                            <div class="typing-dot">    </div>
                            <div class="typing-dot">    </div>
                            <div class="typing-dot">    </div>
                        </div>
                    </div>`;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function hideTypingIndicator() {
    document.getElementById("typing-indicator")?.remove();
}

function formatTimestamp(date) {
    return `${date.getHours().toString().padStart(2, "0")}:${date
        .getMinutes()
        .toString()
        .padStart(2, "0")}`;
}

function updateChatStatus(active) {
    chatStatus.classList.toggle("active", active);
}

/* ===================== PRODUCT CARDS ===================== */
function addProductCards(products = []) {
    if (!products.length) return;

    const wrapper = document.createElement("div");
    wrapper.className = "product-cards-wrapper";

    wrapper.innerHTML = `
        <div class="product-cards-header">
            🛍️ ${products.length} Produk Ditemukan
        </div>
        <div class="product-cards-grid">
            ${products
                .map(
                    (p) => `
                <div class="product-card" onclick="window.open('https://dummy-ecommerce-tau.vercel.app/product/${p.id}','_blank')">
                    <img src="${p.image_url || `https://picsum.photos/seed/${p.id}/300/300`}">
                    <div class="product-info">
                        <span class="product-category">${p.category || "Produk"}</span>
                        <div class="product-name">${p.name}</div>
                        <div class="product-meta">
                            <span>Rp ${(p.price || 0).toLocaleString("id-ID")}</span>
                            <span>⭐ ${p.rating || 0}</span>
                        </div>
                    </div>
                </div>`,
                )
                .join("")}
        </div>
    `;

    chatMessages.appendChild(wrapper);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

//* ===================== AUTH ===================== */
// ===================== LOGIN =====================
loginForm.onsubmit = async (e) => {
    e.preventDefault();
    const { data, error } =
        await window._supabaseClient.auth.signInWithPassword({
            email: emailInput.value,
            password: passwordInput.value,
        });
    if (error) return alert(error.message);
    window.supabaseToken = data.session.access_token;
    loginBtn.disabled = true;
    logoutBtn.disabled = false;
    statusVerify.innerText = "🔐 Login berhasil";
};

// ===================== LOGOUT =====================
logoutBtn.onclick = async () => {
    await window._supabaseClient.auth.signOut();
    window.supabaseToken = null;
    loginBtn.disabled = false;
    logoutBtn.disabled = true;
    statusVerify.innerText = "👋 Logout berhasil";
};

// ===================== SIGNUP =====================
signupForm.onsubmit = async (e) => {
    e.preventDefault();
    const { data, error } = await window._supabaseClient.auth.signUp({
        email: signupEmail.value,
        password: signupPassword.value,
    });
    if (error) return alert(error.message);
    if (!data.session) return alert("📧 Cek email untuk verifikasi");
    window.supabaseToken = data.session.access_token;
    loginBtn.disabled = true;
    logoutBtn.disabled = false;
};

/* ===================== LIVEKIT ===================== */
joinBtn.onclick = async () => {
    const res = await fetch(`${SERVER_URL}/join-token`, { method: "POST" });
    const data = await res.json();
    if (!data.token) return alert("Token gagal");
    await joinLiveKitRoom(data.token);
};

async function joinLiveKitRoom(token) {
    const room = new LivekitClient.Room({
        adaptiveStream: true,
        dynacast: true,
    });
    window.room = room;

    room.on(LivekitClient.RoomEvent.Connected, () => {
        statusRoom.innerText = "✅ Connected";
        updateChatStatus(true);
    });

    room.on(LivekitClient.RoomEvent.ParticipantConnected, () => {
        agentReady = true;
        statusRoom.innerText = "🤖 Agent siap";
    });

    room.on(LivekitClient.RoomEvent.DataReceived, (payload, p, k, topic) => {
        if (!payload || !payload.byteLength) return;
        handleAgentCommand(payload, topic);
    });

    room.on(LivekitClient.RoomEvent.TrackSubscribed, (track) => {
        if (track.kind === "audio") {
            const audioEl = track.attach();
            document.body.appendChild(audioEl);

            // Re-aktivasi Animasi Bergerak (dari app-lamaa.js)
            const audioCtx = new AudioContext();
            const source = audioCtx.createMediaStreamSource(
                new MediaStream([track.mediaStreamTrack]),
            );
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);

            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);

            function updateAnim() {
                analyser.getByteFrequencyData(dataArray);
                let sum = 0;
                for (let i = 0; i < bufferLength; i++) sum += dataArray[i];
                let avg = sum / bufferLength;
                agentAnim.style.display = avg > 5 ? "block" : "none";
                requestAnimationFrame(updateAnim);
            }
            updateAnim();
            audioEl.play();
        }
    });

    await room.connect(LIVEKIT_URL, token);
    const track = await LivekitClient.createLocalAudioTrack();
    await room.localParticipant.publishTrack(track);
}

/* ===================== AGENT COMMAND ===================== */
async function handleAgentCommand(payload, topic) {
    const data = new TextDecoder().decode(payload).trim();
    if (!data || data[0] !== "{") return;

    try {
        const msg = JSON.parse(data);
        if (msg.type === "PRODUCT_CARDS") return addProductCards(msg.products);
        if (msg.type === "AGENT_THINKING") return showTypingIndicator();
        if (msg.type === "AGENT_MESSAGE") {
            hideTypingIndicator();
            return addMessage("assistant", msg.text);
        }

        if (msg.type === "VOICE_CMD" || msg.action) {
            if (msg.action === "READY_FOR_USER") {
                allowUserToSpeak = true;
            }

            if (msg.action === "START_RECORD") {
                console.log("🔄 Agent memicu rekaman ulang (Retry)...");
                allowUserToSpeak = true;
                chunks = []; // Reset chunks untuk rekaman baru
                statusVerify.innerText =
                    "🎙️ Menunggu suara untuk verifikasi ulang...";
                await startVADRecording();
            }

            if (msg.action === "STOP_RECORD") {
                stopRecording();
                allowUserToSpeak = false;
            }
        }
        if (msg.type === "USER_MESSAGE") {
            return addMessage("user", msg.text);
        }
    } catch (e) {
        console.error("Parse error", e);
    }
}

/* ===================== VAD RECORDING ===================== */
async function startVADRecording() {
    if (recorder?.state === "recording") return;
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
        });
        const ctx = new AudioContext();
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 2048;
        src.connect(analyser);

        recorder = new MediaRecorder(stream, {
            mimeType: "audio/webm;codecs=opus",
        });

        chunks = [];

        let silenceStart = null;
        const SILENCE_DELAY = 800; // ms jeda sebelum stop
        const START_THRESHOLD = 0.015;
        const STOP_THRESHOLD = 0.01;

        recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);

        recorder.onstop = async () => {
            stream.getTracks().forEach((t) => t.stop());
            ctx.close();
            if (chunks.length > 0) {
                await sendForVerification();
            } else {
                console.warn("No audio recorded.");
                statusVerify.innerText =
                    "❌ No audio detected. Please try again.";
            }
        };

        const buf = new Uint8Array(analyser.fftSize);

        function checkVAD() {
            if (!allowUserToSpeak) return requestAnimationFrame(checkVAD);

            analyser.getByteTimeDomainData(buf);
            let sum = 0;
            for (let i = 0; i < buf.length; i++) {
                const v = (buf[i] - 128) / 128;
                sum += v * v;
            }
            const rms = Math.sqrt(sum / buf.length);

            // START rekaman jika suara keras
            if (rms > START_THRESHOLD && recorder.state !== "recording") {
                console.log("VAD: Start recording");
                recorder.start();
                silenceStart = null;
                statusVerify.innerText = "🎙️ Recording...";
            }

            // STOP rekaman dengan delay diam
            if (recorder.state === "recording") {
                if (rms < STOP_THRESHOLD) {
                    if (!silenceStart) silenceStart = performance.now();
                    if (performance.now() - silenceStart > SILENCE_DELAY) {
                        recorder.stop();
                        return; // Berhenti loop
                    }
                } else {
                    silenceStart = null; // Reset jika ada suara lagi
                }
            }
            requestAnimationFrame(checkVAD);
        }
        checkVAD();
    } catch (err) {
        console.error("VAD Error:", err);
    }
}

function stopRecording() {
    if (recorder?.state === "recording") recorder.stop();
}

/* ===================== VERIFY ===================== */
async function sendForVerification() {
    if (!window.supabaseToken) {
        console.error("❌ No auth token available");
        return;
    }

    const blob = new Blob(chunks, { type: "audio/webm;codecs=opus" });
    const form = new FormData();
    form.append("audio", blob);

    statusVerify.innerText = "🔍 Sedang memverifikasi...";

    try {
        const res = await fetch(`${SERVER_URL}/verify-voice`, {
            method: "POST",
            headers: { Authorization: `Bearer ${window.supabaseToken}` },
            body: form,
        });

        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

        // --- FIX: Deklarasikan 'result' di sini ---
        const result = await res.json();
        console.log("📊 Verification result:", result);

        // Update skor di UI
        scoreDisplay.style.display = "block";
        const percentScore = (result.score * 100).toFixed(2);
        scoreDisplay.innerText = `📊 Score: ${percentScore}%`;

        // Kirim hasil ke Agent agar agent.py bisa memicu retry_verification()
        if (window.room) {
            const verifPayload = JSON.stringify({
                decision: result.verified ? "VERIFIED" : "DENIED",
                score: result.score,
                ts: Date.now(),
            });

            await window.room.localParticipant.publishData(
                new TextEncoder().encode(verifPayload),
                { reliable: true },
            );
            console.log(
                "📤 Sent verification result to agent:",
                result.verified ? "VERIFIED" : "DENIED",
            );
        }

        statusVerify.innerText = result.verified
            ? "✅ Terverifikasi"
            : "❌ Gagal, mencoba ulang...";
    } catch (err) {
        console.error("❌ Verification error:", err);
        statusVerify.innerText = `❌ Error: ${err.message}`;
    }
}

/* ===================== ENROLLMENT ===================== */
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
        const recorderEnroll = new MediaRecorder(stream, {
            mimeType: "audio/webm;codecs=opus",
        });
        let enrollChunks = [];

        recorderEnroll.ondataavailable = (e) => {
            if (e.data.size > 0) enrollChunks.push(e.data);
        };

        const label = enrollLabelInput.value.trim();
        if (!label) {
            alert("Masukkan label suara untuk enrollment");
            return;
        }

        recorderEnroll.onstop = async () => {
            stream.getTracks().forEach((t) => t.stop());

            const blob = new Blob(enrollChunks, { type: "audio/webm" });
            const form = new FormData();
            form.append("audio", blob, "enroll.webm");
            form.append("label", label);

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

/* ===================== RESTORE SESSION ===================== */
(async function restoreSession() {
    const { data } = await window._supabaseClient.auth.getSession();
    if (!data.session) return;
    window.supabaseToken = data.session.access_token;
    loginBtn.disabled = true;
    logoutBtn.disabled = false;
})();
