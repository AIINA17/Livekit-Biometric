// ========== components/VoiceEnrollment.tsx ==========
"use client";

import { useState } from "react";

interface VoiceEnrollmentProps {
    token: string | null;
    setVerifyStatus: (status: string) => void;
}

export default function VoiceEnrollment({
    token,
    setVerifyStatus,
}: VoiceEnrollmentProps) {
    const [label, setLabel] = useState("");

    const handleEnroll = async () => {
        if (!token) {
            alert("Login dulu sebelum enroll");
            return;
        }

        setVerifyStatus("🎙️ Recording for enrollment...");

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: true,
            });
            const recorder = new MediaRecorder(stream);
            const chunks: Blob[] = [];

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunks.push(e.data);
            };

            recorder.onstop = async () => {
                stream.getTracks().forEach((t) => t.stop());

                const blob = new Blob(chunks, { type: "audio/wav" });
                const form = new FormData();

                form.append("label", label);
                form.append("audio", blob, "enroll.wav");

                setVerifyStatus("📤 Uploading enrollment...");

                try {
                    const res = await fetch(
                        `${process.env.NEXT_PUBLIC_SERVER_URL}/enroll-voice`,
                        {
                            method: "POST",
                            headers: {
                                Authorization: `Bearer ${token}`,
                            },
                            body: form,
                        },
                    );

                    if (!res.ok) {
                        throw new Error(
                            `HTTP ${res.status}: ${res.statusText}`,
                        );
                    }

                    const result = await res.json();

                    if (result.status === "OK") {
                        setVerifyStatus("✅ Enrollment successful");
                    } else {
                        setVerifyStatus("❌ Enrollment failed");
                        console.error(result);
                    }
                } catch (err) {
                    console.error("Enroll upload error:", err);
                    setVerifyStatus(`❌ Upload failed: ${err}`);
                }
            };

            recorder.start();
            setVerifyStatus("🎙️ Speak clearly for enrollment...");
            setTimeout(() => recorder.stop(), 4000);
        } catch (err) {
            console.error("Enroll error:", err);
            setVerifyStatus("❌ Mic access failed");
        }
    };

    return (
        <div className="flex flex-col gap-2">
            <div className="text-[0.8rem] font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Voice Enrollment
            </div>
            <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Label / Nama Speaker"
                className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-black"
            />
            <button
                onClick={handleEnroll}
                className="w-full px-3 py-3 rounded-lg bg-black text-white font-semibold text-sm hover:bg-gray-800 active:scale-[0.98] transition-all cursor-pointer">
                🎤 Enroll Voice
            </button>
        </div>
    );
}
