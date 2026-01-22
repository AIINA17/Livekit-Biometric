/**
 * Happy AI Assistant - Web Client
 * Displays real-time voice verification scores from agent
 */

// ================= DOM ELEMENTS =================
const joinBtn = document.getElementById("join");
const leaveBtn = document.getElementById("leave");
const statusRoom = document.getElementById("statusRoom");
const verificationScore = document.getElementById("verificationScore");
const verificationStatus = document.getElementById("verificationStatus");
const scoreBar = document.getElementById("scoreBar");
const connectionDot = document.getElementById("connectionDot");
const connectionText = document.getElementById("connectionText");

// ================= STATE =================
let room = null;

// ================= CONFIG =================
const CONFIG = {
    serverUrl: "http://localhost:8000",
    livekitUrl: "wss://kpina17-lg4g8x6z.livekit.cloud",
};

// ================= UI HELPERS =================
function updateVerificationDisplay(data) {
    const score = data.score; // Already in percentage from agent
    const verified = data.verified;
    
    // Update score text
    verificationScore.textContent = `${score.toFixed(1)}%`;
    
    // Update classes based on verification result
    verificationScore.className = `verification-score ${verified ? 'verified' : 'denied'}`;
    
    // Update status badge
    verificationStatus.textContent = verified ? '✅ Terverifikasi' : '❌ Tidak Dikenali';
    verificationStatus.className = `verification-status ${verified ? 'verified' : 'denied'}`;
    
    // Update progress bar
    scoreBar.style.width = `${Math.min(score, 100)}%`;
    scoreBar.className = `score-bar ${verified ? 'verified' : 'denied'}`;
    
    console.log(`🔊 Verification updated: ${score.toFixed(1)}% - ${verified ? 'VERIFIED' : 'DENIED'}`);
}

function resetVerificationDisplay() {
    verificationScore.textContent = '--%';
    verificationScore.className = 'verification-score pending';
    verificationStatus.textContent = 'Menunggu...';
    verificationStatus.className = 'verification-status pending';
    scoreBar.style.width = '0%';
    scoreBar.className = 'score-bar';
}

function setConnected(connected) {
    connectionDot.className = `connection-dot ${connected ? 'connected' : ''}`;
    connectionText.textContent = connected ? 'Connected' : 'Disconnected';
}

// ================= LIVEKIT CONNECTION =================
async function joinLiveKitRoom(token) {
    console.log("🔌 Connecting to LiveKit...");
    
    room = new LivekitClient.Room({
        adaptiveStream: true,
        dynacast: true,
    });
    
    // Store globally for leave button
    window.room = room;
    
    // ===== EVENT: Connected =====
    room.on(LivekitClient.RoomEvent.Connected, () => {
        console.log("✅ Connected to room:", room.name);
        statusRoom.textContent = "Connected - Waiting for agent...";
        setConnected(true);
    });
    
    // ===== EVENT: Disconnected =====
    room.on(LivekitClient.RoomEvent.Disconnected, () => {
        console.log("❌ Disconnected from room");
        statusRoom.textContent = "Disconnected";
        setConnected(false);
        resetVerificationDisplay();
        
        joinBtn.disabled = false;
        leaveBtn.disabled = true;
    });
    
    // ===== EVENT: Participant Connected =====
    room.on(LivekitClient.RoomEvent.ParticipantConnected, (participant) => {
        console.log("👤 Participant joined:", participant.identity);
        if (participant.identity.includes('agent')) {
            statusRoom.textContent = "Connected - Agent ready!";
        }
    });
    
    // ===== EVENT: Track Subscribed (Audio) =====
    room.on(LivekitClient.RoomEvent.TrackSubscribed, (track, publication, participant) => {
        console.log(`🎵 Track subscribed: ${track.kind} from ${participant.identity}`);
        
        if (track.kind === "audio") {
            const audioElement = track.attach();
            audioElement.id = `audio-${participant.identity}`;
            document.body.appendChild(audioElement);
            audioElement.play().catch((e) => {
                console.error("Error playing audio:", e);
            });
        }
    });
    
    // ===== EVENT: Data Received (Verification Results) =====
    room.on(LivekitClient.RoomEvent.DataReceived, (payload, participant) => {
        try {
            const message = new TextDecoder().decode(payload);
            const data = JSON.parse(message);
            
            console.log("📨 Data received:", data);
            
            // Handle voice verification data
            if (data.type === "voice_verification") {
                updateVerificationDisplay(data);
            }
        } catch (e) {
            // Not JSON or parse error, ignore
            console.log("📨 Raw data received:", payload);
        }
    });
    
    // ===== CONNECT =====
    try {
        await room.connect(CONFIG.livekitUrl, token);
        console.log("✅ Connected to room:", room.name);
        
        // Publish local audio track
        const audioTrack = await LivekitClient.createLocalAudioTrack({
            echoCancellation: true,
            noiseSuppression: true,
        });
        await room.localParticipant.publishTrack(audioTrack);
        console.log("🎤 Local audio published");
        
    } catch (error) {
        console.error("❌ Connection error:", error);
        statusRoom.textContent = "Connection failed: " + error.message;
        setConnected(false);
        joinBtn.disabled = false;
        leaveBtn.disabled = true;
    }
}

// ================= BUTTON HANDLERS =================
joinBtn.onclick = async () => {
    joinBtn.disabled = true;
    statusRoom.textContent = "Getting token...";
    
    try {
        const res = await fetch(`${CONFIG.serverUrl}/join-token`, {
            method: "POST",
        });
        
        const data = await res.json();
        console.log("🎫 Token received:", data);
        
        if (data.token) {
            statusRoom.textContent = "Connecting...";
            await joinLiveKitRoom(data.token);
            leaveBtn.disabled = false;
        } else {
            statusRoom.textContent = "Failed to get token";
            joinBtn.disabled = false;
        }
    } catch (err) {
        console.error("❌ Error:", err);
        statusRoom.textContent = "Server error: " + err.message;
        joinBtn.disabled = false;
    }
};

leaveBtn.onclick = async () => {
    if (room) {
        await room.disconnect();
        room = null;
        window.room = null;
    }
    
    statusRoom.textContent = "Left room";
    setConnected(false);
    resetVerificationDisplay();
    
    joinBtn.disabled = false;
    leaveBtn.disabled = true;
};

// ================= INIT =================
console.log("🚀 Happy AI Client initialized");
console.log("📡 Server:", CONFIG.serverUrl);
console.log("🔊 LiveKit:", CONFIG.livekitUrl);