"use client";

import { useRef, useCallback, useState } from "react";
import { Room, RoomEvent, Track, createLocalAudioTrack } from "livekit-client";
import { VerificationResult, Product } from "@/types";

type UiState = "IDLE" | "LISTENING" | "RECORDING" | "VERIFYING" | "CHATTING";
import { supabase } from "@/lib/supabase";

interface UseLiveKitProps {
    token: string | null;
    onMessage: (role: "user" | "assistant", text: string) => void;
    onVerifyStatus: (status: string) => void;
    onRoomStatus: (status: string) => void;
    onScore: (score: number | null) => void;
    onProductCards?: (products: Product[]) => void;
}

export function useLiveKit({
    token,
    onMessage,
    onVerifyStatus,
    onRoomStatus,
    onScore,
    onProductCards,
}: UseLiveKitProps) {
    const roomRef = useRef<Room | null>(null);

    const recorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const rafRef = useRef<number | null>(null);

    const [uiState, setUiState] = useState<UiState>("IDLE");

    const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL!;
    const LIVEKIT_URL = process.env.NEXT_PUBLIC_LIVEKIT_URL!;

    /* ================= JOIN ROOM ================= */

    const joinRoom = useCallback(async () => {
        onRoomStatus("⏳ Connecting…");
        
        const res = await fetch(`${SERVER_URL}/join-token`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ room: "mainroom" }),
        });

        const { token: lkToken } = await res.json();

        const room = new Room({ adaptiveStream: true, dynacast: true });
        roomRef.current = room;

        room.on(RoomEvent.Connected, () => {
            onRoomStatus("✅ Connected");
            setUiState("CHATTING");
        });

        room.on(RoomEvent.DataReceived, (payload, _, __, topic) => {
            handleAgentData(payload, topic);
        });

        room.on(RoomEvent.TrackSubscribed, (track) => {
            if (track.kind === Track.Kind.Audio) {
                const el = track.attach();
                document.body.appendChild(el);
                el.play().catch(() => {});
            }
        });

        await room.connect(LIVEKIT_URL, lkToken);

        const micTrack = await createLocalAudioTrack();
        await room.localParticipant.publishTrack(micTrack);
    }, []);

    /* ================= AGENT DATA ================= */

    const handleAgentData = (payload: Uint8Array, topic?: string) => {
        const text = new TextDecoder().decode(payload).trim();
        if (!text.startsWith("{")) return;

        const msg = JSON.parse(text);

        if (msg.type === "VOICE_CMD" && msg.action === "START_RECORD") {
            startVADRecording();
            return;
        }

        if (msg.type === "PRODUCT_CARDS") {
            onProductCards?.(msg.products);
            return;
        }

        if (msg.type === "AGENT_MESSAGE") {
            onMessage("assistant", msg.text);
            return;
        }

        if (msg.type === "USER_MESSAGE") {
            onMessage("user", msg.text);
        }
    };

    /* ================= VAD RECORD (VERIF ONLY) ================= */

    const startVADRecording = async () => {
        if (recorderRef.current) return;
        if (!token) {
            onVerifyStatus("❌ Login dulu sebelum verifikasi");
            return;
        }

        setUiState("LISTENING");
        onVerifyStatus("🎧 Silakan bicara...");

        const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
        });
        const audioCtx = new AudioContext();

        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 2048;
        source.connect(analyser);

        const buffer = new Uint8Array(analyser.fftSize);

        const recorder = new MediaRecorder(stream, {
            mimeType: "audio/webm;codecs=opus",
        });

        recorderRef.current = recorder;
        chunksRef.current = [];

        let recording = false;
        let silenceStart: number | null = null;

        const START = 0.015;
        const STOP = 0.01;
        const SILENCE_MS = 800;

        recorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunksRef.current.push(e.data);
        };

        recorder.onstop = async () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            recorderRef.current = null;

            stream.getTracks().forEach((t) => t.stop());
            audioCtx.close();

            if (!chunksRef.current.length) return;

            setUiState("VERIFYING");
            onVerifyStatus("🔍 Memverifikasi suara...");

            await sendForVerification(
                new Blob(chunksRef.current, {
                    type: "audio/webm;codecs=opus",
                }),
            );
        };

        const loop = () => {
            analyser.getByteTimeDomainData(buffer);
            let sum = 0;
            for (let i = 0; i < buffer.length; i++) {
                const v = (buffer[i] - 128) / 128;
                sum += v * v;
            }
            const rms = Math.sqrt(sum / buffer.length);

            if (!recording && rms > START) {
                recorder.start();
                recording = true;
                setUiState("RECORDING");
            }

            if (recording) {
                if (rms < STOP) {
                    silenceStart ??= performance.now();
                    if (performance.now() - silenceStart > SILENCE_MS) {
                        recorder.stop();
                        return;
                    }
                } else {
                    silenceStart = null;
                }
            }

            rafRef.current = requestAnimationFrame(loop);
        };

        loop();
    };

    /* ================= VERIFY ================= */

    const sendForVerification = async (blob: Blob) => {
        const session = await supabase.auth.getSession();
        const accessToken = session.data.session?.access_token;

        if (!accessToken) {
            onVerifyStatus("❌ Login dulu sebelum verifikasi");
            return;
        }
        const form = new FormData();
        form.append("audio", blob, "voice.webm");

        const res = await fetch(`${SERVER_URL}/verify-voice`, {
            method: "POST",
            headers: { Authorization: `Bearer ${accessToken}` },
            body: form,
        });

        const result: VerificationResult = await res.json();
        onScore(result.score ?? null);

        await roomRef.current?.localParticipant.publishData(
            new TextEncoder().encode(
                JSON.stringify({
                    decision: result.status,
                    score: result.score,
                    ts: Date.now(),
                }),
            ),
            { reliable: true, topic: "VOICE_RESULT" },
        );

        setUiState("CHATTING");
    };

    return {
        joinRoom,
        uiState,
    };
}
