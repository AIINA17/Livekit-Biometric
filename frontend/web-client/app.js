<<<<<<< HEAD
//app.js
=======
/* ===================== GLOBAL STATE ===================== */
>>>>>>> origin/main
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
const signupForm = document.getElementById("signup-form");
const signupEmail = document.getElementById("signup-email");
const signupPassword = document.getElementById("signup-password");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const signupForm = document.getElementById("signup-form");
const signupEmail = document.getElementById("signup-email");
const signupPassword = document.getElementById("signup-password");

<<<<<<< HEAD
// Chat elements
const chatMessages = document.getElementById("chat-messages");
const chatStatus = document.getElementById("chat-status");

let agentReady = false;
let conversationHistory = [];
let vadTimeout = null;

const VAD_THRESHOLD = 12;
const SILENCE_DELAY = 1200;
const VAD_MAX_DURATION = 30000; // 30 detik max recording

// SERVER_URL dari .env
const SERVER_URL = "http://localhost:8001";
const LIVEKIT_URL = "wss://kpina17-lg4g8x6z.livekit.cloud";

=======
const SERVER_URL = "http://localhost:8000";
const LIVEKIT_URL = "wss://kpina17-lg4g8x6z.livekit.cloud";
>>>>>>> origin/main
const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.APP_CONFIG;

/* ===================== SUPABASE INIT ===================== */
if (!window._supabaseClient) {
    window._supabaseClient = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_ANON_KEY
    );
}

<<<<<<< HEAD
// ===================== CHAT FUNCTIONS - NEW LAYOUT =====================
function addMessage(role, text, timestamp = new Date()) {
    // Jangan tambahkan pesan kosong
    if (!text || text.trim() === "") return;

    // Remove empty state if exists
    const emptyState = chatMessages.querySelector(".empty-state");
    if (emptyState) {
        emptyState.remove();
    }

    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${role}`; // Tambahkan class role untuk styling

    const avatar = document.createElement("div");
    avatar.className = `message-avatar ${role}-avatar`;
    avatar.textContent = role === "user" ? "👤" : "🤖";

    const content = document.createElement("div");
    content.className = "message-content";

    const roleSpan = document.createElement("div");
    roleSpan.className = "message-role";
    roleSpan.textContent = role === "user" ? "You" : "AI Assistant";

    const bubble = document.createElement("div");
    bubble.className = "message-bubble";

    const textDiv = document.createElement("div");
    textDiv.className = "message-text";
    textDiv.textContent = text;

    const timestampDiv = document.createElement("div");
    timestampDiv.className = "message-timestamp";
    timestampDiv.textContent = formatTimestamp(timestamp);

    bubble.appendChild(textDiv);

    content.appendChild(roleSpan);
    content.appendChild(bubble);
    content.appendChild(timestampDiv);

    messageDiv.appendChild(avatar);
    messageDiv.appendChild(content);

    chatMessages.appendChild(messageDiv);
    
    // Auto scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // Save to history
    conversationHistory.push({ role, text, timestamp });

    // LOG HANYA SAAT PESAN SELESAI (FINAL)
    console.log(`[${role.toUpperCase()}]: ${text}`);
}

function showTypingIndicator() {
    // Cek apakah sudah ada typing indicator
    if (document.getElementById("typing-indicator")) return;

    const typingDiv = document.createElement("div");
    typingDiv.className = "message assistant typing-message";
    typingDiv.id = "typing-indicator";

    const avatar = document.createElement("div");
    avatar.className = "message-avatar assistant-avatar";
    avatar.textContent = "🤖";

    const content = document.createElement("div");
    content.className = "message-content";

    const roleSpan = document.createElement("div");
    roleSpan.className = "message-role";
    roleSpan.textContent = "AI Assistant";

    const bubble = document.createElement("div");
    bubble.className = "message-bubble";

    const typingIndicator = document.createElement("div");
    typingIndicator.className = "typing-indicator";
    typingIndicator.innerHTML = `
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
    `;

    bubble.appendChild(typingIndicator);

    content.appendChild(roleSpan);
    content.appendChild(bubble);

    typingDiv.appendChild(avatar);
    typingDiv.appendChild(content);

    chatMessages.appendChild(typingDiv);
=======
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
>>>>>>> origin/main
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function hideTypingIndicator() {
<<<<<<< HEAD
    const typingIndicator = document.getElementById("typing-indicator");
    if (typingIndicator) {
        typingIndicator.remove();
    }
}

function formatTimestamp(date) {
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    return `${hours}:${minutes}`;
}

function updateChatStatus(isActive) {
    if (isActive) {
        chatStatus.classList.add("active");
    } else {
        chatStatus.classList.remove("active");
    }
}

// ===================== PRODUCT CARDS DISPLAY =====================
function addProductCards(products) {
    console.log("🎨 addProductCards called with:", products);
    
    if (!products || products.length === 0) {
        console.warn("⚠️ No products to display");
        return;
    }

    // Remove empty state if exists
    const emptyState = chatMessages.querySelector(".empty-state");
    if (emptyState) {
        emptyState.remove();
    }

    // Create wrapper
    const wrapper = document.createElement("div");
    wrapper.className = "product-cards-wrapper";

    // Header
    const header = document.createElement("div");
    header.className = "product-cards-header";
    header.innerHTML = `
        <span class="product-cards-header-text">🛍️ ${products.length} Produk Ditemukan</span>
    `;
    wrapper.appendChild(header);

    // Grid container
    const grid = document.createElement("div");
    grid.className = "product-cards-grid";

    products.forEach((product, index) => {
        console.log(`  - Product ${index + 1}:`, product.name);
        
        const card = document.createElement("div");
        card.className = "product-card";
        card.onclick = () => {
            window.open(`https://dummy-ecommerce-tau.vercel.app/product/${product.id}`, '_blank');
        };

        // Stock status
        let stockClass = 'in-stock';
        let stockText = '✓ Tersedia';
        if (product.stock === 0) {
            stockClass = 'out-of-stock';
            stockText = '✗ Habis';
        } else if (product.stock <= 5) {
            stockClass = 'low-stock';
            stockText = `⚠ ${product.stock} unit`;
        }

        card.innerHTML = `
            <img class="product-image" 
                 src="${product.image_url || `https://picsum.photos/seed/${product.id}/300/300`}" 
                 alt="${product.name}"
                 loading="lazy">
            <div class="product-info">
                <span class="product-category">${product.category || 'Produk'}</span>
                <div class="product-name">${product.name}</div>
                <div class="product-meta">
                    <span class="product-price">Rp ${(product.price || 0).toLocaleString('id-ID')}</span>
                    <span class="product-rating">⭐ ${product.rating || 0}</span>
                </div>
                <div class="product-stock ${stockClass}">${stockText}</div>
            </div>
        `;

        grid.appendChild(card);
    });

    wrapper.appendChild(grid);
    chatMessages.appendChild(wrapper);

    // Auto scroll
    chatMessages.scrollTop = chatMessages.scrollHeight;

    console.log(`✅ Successfully displayed ${products.length} product cards`);
}


// ===================== LOGIN =====================
loginForm.onsubmit = async (e) => {
    e.preventDefault();

    const email = emailInput.value;
    const password = passwordInput.value;

    const { data, error } = await window._supabaseClient.auth.signInWithPassword({
        email,
        password,
    });

    if (error) {
        alert(error.message);
        return;
    }

    window.supabaseToken = data.session.access_token;
    console.log("✅ Login berhasil");
    logoutBtn.disabled = false;
    loginBtn.disabled = true;
=======
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
>>>>>>> origin/main
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
<<<<<<< HEAD

    const email = signupEmail.value;
    const password = signupPassword.value;

    const { data, error } =
        await window._supabaseClient.auth.signUp({
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
            updateChatStatus(true);
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
        updateChatStatus(false);
        
        // Cleanup saat disconnect
        if (recorder && recorder.state === "recording") {
            recorder.stop();
        }
        if (vadTimeout) {
            clearTimeout(vadTimeout);
        }
    }
=======
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
>>>>>>> origin/main
};

async function joinLiveKitRoom(token) {
<<<<<<< HEAD
    console.log("🔌 Joining LiveKit room...");

=======
>>>>>>> origin/main
    const room = new LivekitClient.Room({
        adaptiveStream: true,
        dynacast: true,
    });
    window.room = room;

    room.on(LivekitClient.RoomEvent.Connected, () => {
<<<<<<< HEAD
        console.log("✅ Connected to LiveKit room");
        statusRoom.innerText = "✅ Connected to LiveKit room.";
    });

    room.on(LivekitClient.RoomEvent.Disconnected, () => {
        console.log("❌ Disconnected from room");
        statusRoom.innerText = "❌ Disconnected from LiveKit room.";
        updateChatStatus(false);
        
        // Cleanup saat disconnect
        if (recorder && recorder.state === "recording") {
            recorder.stop();
        }
        if (vadTimeout) {
            clearTimeout(vadTimeout);
        }
    });

    room.on(LivekitClient.RoomEvent.ParticipantConnected, (participant) => {
        console.log("👤 Participant joined:", participant.identity);
=======
        statusRoom.innerText = "✅ Connected";
        updateChatStatus(true);
    });

    room.on(LivekitClient.RoomEvent.ParticipantConnected, () => {
>>>>>>> origin/main
        agentReady = true;
        statusRoom.innerText = "🤖 Agent siap";
    });

<<<<<<< HEAD
    // ===================== DATA CHANNEL - IMPROVED =====================
    room.on(LivekitClient.RoomEvent.DataReceived, (payload, participant, kind, topic) => {
        console.log("📦 Raw data received");
        console.log("  - Participant:", participant?.identity);
        console.log("  - Topic:", topic);
        console.log("  - Payload size:", payload?.byteLength);

        if (!payload || payload.byteLength === 0) {
            console.warn("⚠️ Received empty payload");
            return;
        }

        // Process all data regardless of topic (to handle both VOICE_CMD and PRODUCT_DATA)
        handleAgentCommand(payload, topic);
    });

    // ===================== AUDIO TRACK SUBSCRIPTION =====================
    room.on(LivekitClient.RoomEvent.TrackSubscribed, (track, publication, participant) => {
        if (track.kind === LivekitClient.Track.Kind.Audio) {
            const audioElement = track.attach();
            document.body.appendChild(audioElement);

            // Audio visualization
            const audioContext = new AudioContext();
            const source = audioContext.createMediaStreamSource(
                new MediaStream([track.mediaStreamTrack])
=======
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
>>>>>>> origin/main
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
<<<<<<< HEAD
            checkVolume();

            audioElement.play().catch((e) => console.error("Audio play error:", e));
=======
            updateAnim();
            audioEl.play();
>>>>>>> origin/main
        }
    });

    // ===================== TRANSCRIPTION EVENTS =====================
    room.on(LivekitClient.RoomEvent.TranscriptionReceived, (transcriptions, participant, publication) => {
        transcriptions.forEach(segment => {
            // Hanya proses jika final dan ada text
            if (segment.final && segment.text && segment.text.trim() !== "") {
                const isAgent = participant && (
                    participant.identity === "agent" || 
                    participant.identity.includes("agent") ||
                    participant.sid !== room.localParticipant.sid
                );
                
                if (isAgent) {
                    hideTypingIndicator();
                    addMessage("assistant", segment.text.trim());
                } else {
                    addMessage("user", segment.text.trim());
                }
            } 
            // Tampilkan typing indicator untuk interim transcript agent saja
            else if (!segment.final && segment.text) {
                const isAgent = participant && participant.sid !== room.localParticipant.sid;
                if (isAgent) {
                    showTypingIndicator();
                }
            }
        });
    });

    await room.connect(LIVEKIT_URL, token);
<<<<<<< HEAD
    console.log("Connected to room. Checking existing participants...");

    if (room.remoteParticipants.size > 0) {
        console.log(`✅ Found ${room.remoteParticipants.size} existing participant(s)`);
        agentReady = true;
        statusRoom.innerText = "🤖 Agent terdeteksi, silakan verifikasi suara";
    }

    // Publish local audio track
=======
>>>>>>> origin/main
    const track = await LivekitClient.createLocalAudioTrack();
    await room.localParticipant.publishTrack(track);

    console.log("✅ Setup complete");
}

<<<<<<< HEAD
// ===================== AGENT COMMAND - IMPROVED =====================
async function handleAgentCommand(payload, topic) {
    console.log("🔍 handleAgentCommand called");
    console.log("  - Topic:", topic);
    
    const decoder = new TextDecoder();
    const strData = decoder.decode(payload);

    // Validasi payload
    if (!strData || strData.trim().length < 2) {
        console.warn("⚠️ Ignoring empty/invalid agent payload");
        return;
    }

    const clean = strData.trim();
    console.log("📩 DATA FROM AGENT (first 200 chars):", clean.substring(0, 200));

    // Pastikan JSON valid
    if (clean[0] !== "{") {
        console.warn("⚠️ Non-JSON agent payload ignored");
        return;
    }

    let msg;
    try {
        msg = JSON.parse(clean);
        console.log("✅ JSON parsed successfully");
        console.log("  - Type:", msg.type);
        console.log("  - Keys:", Object.keys(msg));
    } catch (e) {
        console.error("❌ JSON parse failed:", e.message);
        console.error("RAW:", clean.substring(0, 500));
        return;
    }

    // ========== HANDLE PRODUCT CARDS ==========
    if (msg.type === "PRODUCT_CARDS") {
        console.log("🛍️ PRODUCT_CARDS detected!");
        
        if (msg.products && Array.isArray(msg.products)) {
            console.log(`📦 Received ${msg.products.length} products`);
            console.log("  - Sample product:", msg.products[0]);
            
            // Call addProductCards
            addProductCards(msg.products);
        } else {
            console.error("❌ Invalid products data:", msg.products);
        }
        return;
=======
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
>>>>>>> origin/main
    }

    // ========== HANDLE VOICE_CMD ==========
    if (msg.type === "VOICE_CMD" || msg.action) {
        console.log("📦 VOICE_CMD detected - Action:", msg.action);

        if (msg.action === "START_RECORD") {
            console.log("🔵 Starting VAD recording...");
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
        return;
    }

    // ========== HANDLE OTHER MESSAGE TYPES ==========
    if (msg.type === "AGENT_MESSAGE" && msg.text) {
        hideTypingIndicator();
        addMessage("assistant", msg.text);
        return;
    }
    
    if (msg.type === "AGENT_THINKING") {
        showTypingIndicator();
        return;
    }
    
    if (msg.type === "TRANSCRIPTION" && msg.text && msg.text.trim() !== "") {
        if (msg.role === "user") {
            addMessage("user", msg.text);
        } else if (msg.role === "assistant") {
            hideTypingIndicator();
            addMessage("assistant", msg.text);
        }
        return;
    }

    console.log("ℹ️ Unhandled message type:", msg.type);
}

/* ===================== VAD RECORDING ===================== */
async function startVADRecording() {
    if (recorder?.state === "recording") return;
    try {
<<<<<<< HEAD
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        recorder = new MediaRecorder(stream);
=======
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

>>>>>>> origin/main
        chunks = [];

        let silenceStart = null;
        const SILENCE_DELAY = 800; // ms jeda sebelum stop
        const START_THRESHOLD = 0.015;
        const STOP_THRESHOLD = 0.01;

        recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);

        recorder.onstop = async () => {
<<<<<<< HEAD
            console.log("📤 Rekaman selesai, mengirim ke server verifikasi...");
            await sendForVerification();
            stream.getTracks().forEach((track) => track.stop());
        };

        recorder.start();
        statusVerify.innerText = "🎙️ Merekam...";
        console.log("✅ Recording started by Agent command.");
=======
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
>>>>>>> origin/main
    } catch (err) {
        console.error("VAD Error:", err);
    }
}

function stopRecording() {
    if (recorder?.state === "recording") recorder.stop();
}

/* ===================== VERIFY ===================== */
async function sendForVerification() {
<<<<<<< HEAD
    // Validasi token sebelum request
=======
>>>>>>> origin/main
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

<<<<<<< HEAD
        statusVerify.innerText = result.verified ? "✅ Verified" : "❌ Verification failed";

        // Pastikan room dan agent ready sebelum kirim
        if (!agentReady || !window.room) {
            console.warn("⚠️ Agent not ready, skipping data send");
            return;
        }

        const payload = JSON.stringify({
            type: "VOICE_RESULT",
            voice_verified: result.verified,
            decision: result.status,
            score: result.score,
            spoof_prob: result.spoof_prob,
            ts: Date.now(),
        });

        await window.room.localParticipant.publishData(
            new TextEncoder().encode(payload),
            { reliable: true }
        );

        console.log("📤 Sent verification result to agent");
=======
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
>>>>>>> origin/main
    } catch (err) {
        console.error("❌ Verification error:", err);
        statusVerify.innerText = `❌ Error: ${err.message}`;
    }
}

<<<<<<< HEAD
// ===================== VAD RECORDING (IMPROVED) =====================
async function startVADRecording() {
    console.log("🎯 startVADRecording() called");

    if (recorder && recorder.state === "recording") {
        console.warn("⚠️ Recording already in progress");
        return;
    }

    try {
        console.log("🎤 Requesting microphone access...");
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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

        let isRecording = false;
        let silenceStart = null;
        let checkInterval = null;

        // Tuning parameters
        const START_THRESHOLD = 0.01;
        const STOP_THRESHOLD = 0.005;
        const SILENCE_DELAY_MS = 1200;
        const MAX_DURATION = 6000;

        recorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
                chunks.push(e.data);
                console.log(`📦 Data chunk received: ${e.data.size} bytes`);
            }
        };

        recorder.onstop = async () => {
            console.log("🛑 Recording stopped");
            console.log(`📊 Total chunks: ${chunks.length}`);

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
            analyser.getByteTimeDomainData(buffer);

            // Calculate RMS
            let sum = 0;
            for (let i = 0; i < buffer.length; i++) {
                const v = (buffer[i] - 128) / 128;
                sum += v * v;
            }
            const rms = Math.sqrt(sum / buffer.length);

            // Log RMS every 30 frames for debugging
            frameCount++;
            if (frameCount % 30 === 0) {
                console.log(`📊 RMS: ${rms.toFixed(4)} | Recording: ${isRecording}`);
            }

            // START RECORDING
            if (!isRecording && rms > START_THRESHOLD) {
                console.log(`🎙️ Voice detected (RMS: ${rms.toFixed(4)}) → START`);
                recorder.start();
                isRecording = true;
                silenceStart = null;
                statusVerify.innerText = "🎙️ Mendengarkan...";
            }

            // STOP RECORDING
            if (isRecording) {
                if (rms < STOP_THRESHOLD) {
                    if (!silenceStart) {
                        silenceStart = performance.now();
                        console.log(`🤫 Silence detected (RMS: ${rms.toFixed(4)})`);
                    }

                    const silenceDuration = performance.now() - silenceStart;
                    if (silenceDuration > SILENCE_DELAY_MS) {
                        console.log(`✅ Silence duration: ${silenceDuration.toFixed(0)}ms → STOP`);
                        recorder.stop();
                        return;
                    }
                } else {
                    // Voice detected again
                    if (silenceStart) {
                        console.log(`🎙️ Voice resumed (RMS: ${rms.toFixed(4)})`);
                    }
                    silenceStart = null;
                }
            }

            // HARD STOP
            const elapsed = performance.now() - startTime;
            if (elapsed > MAX_DURATION) {
                console.warn(`⏱️ Max duration (${MAX_DURATION}ms) reached → FORCE STOP`);
                if (recorder.state === "recording") {
                    recorder.stop();
                }
                return;
            }

            checkInterval = requestAnimationFrame(check);
        }

        statusVerify.innerText = "🎧 Silakan bicara...";
        console.log("👂 Starting VAD check loop...");
        check();

        console.log("✅ VAD recording setup complete!");
    } catch (err) {
        console.error("❌ Failed to start VAD recording:", err);
        console.error("Error details:", err.message);
        console.error("Error stack:", err.stack);
        statusVerify.innerText = "❌ Mic access failed: " + err.message;
    }
}

// ===================== ENROLLMENT =====================
=======
/* ===================== ENROLLMENT ===================== */
>>>>>>> origin/main
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
<<<<<<< HEAD
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorderEnroll = new MediaRecorder(stream);
=======
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
        });
        const recorderEnroll = new MediaRecorder(stream, {
            mimeType: "audio/webm;codecs=opus",
        });
>>>>>>> origin/main
        let enrollChunks = [];

        recorderEnroll.ondataavailable = (e) => {
            if (e.data.size > 0) enrollChunks.push(e.data);
        };

<<<<<<< HEAD
        recorderEnroll.onstop = async () => {
            stream.getTracks().forEach((t) => t.stop());
=======
        const label = enrollLabelInput.value.trim();
        if (!label) {
            alert("Masukkan label suara untuk enrollment");
            return;
        }
>>>>>>> origin/main

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
<<<<<<< HEAD
    console.log("🔄 Session restored");

    loginBtn.disabled = true;
    logoutBtn.disabled = false;
}

restoreSession();
=======
    loginBtn.disabled = true;
    logoutBtn.disabled = false;
})();
>>>>>>> origin/main
