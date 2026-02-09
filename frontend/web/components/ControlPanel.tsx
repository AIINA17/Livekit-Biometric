// components/ControlPanel.tsx
"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import LiveKitControls from "./LiveKitControls";
import AuthForms from "./AuthForms";
import VoiceEnrollment from "./VoiceEnrollment";
import StatusDisplay from "./StatusDisplay";
import { Product } from "@/types";

interface ControlPanelProps {
    isConnected: boolean;
    setIsConnected: (value: boolean) => void;
    addMessage: (role: "user" | "assistant", text: string) => void;
    onProductCards: (products: Product[]) => void;
    setIsTyping: (value: boolean) => void;
}

export default function ControlPanel({
    isConnected,
    setIsConnected,
    addMessage,
    onProductCards,
    setIsTyping,
}: ControlPanelProps) {
    const [session, setSession] = useState<any | null>(null);

    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [verifyStatus, setVerifyStatus] = useState("🎧 Status: Idle");
    const [roomStatus, setRoomStatus] = useState(
        "🌐 Status room: Not connected",
    );
    const [score, setScore] = useState<number | null>(null);
    const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);

    const handleLogin = async (email: string, password: string) => {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            alert(error.message);
            return;
        }

        setSession(data.session);

        setIsLoggedIn(true);
        setVerifyStatus("🔐 Login berhasil");
        console.log("✅ Login berhasil");
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        setSession(null);
        setIsLoggedIn(false);
        setVerifyStatus("👋 Logout berhasil");
        console.log("👋 User logged out");
    };

    const handleSignup = async (email: string, password: string) => {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
        });

        if (error) {
            alert("❌ Signup gagal: " + error.message);
            return;
        }

        if (!data.session) {
            alert("📧 Cek email kamu untuk verifikasi akun");
            return;
        }

        setSession(data.session);
        setIsLoggedIn(true);
        setVerifyStatus("✅ Signup & login berhasil");
        console.log("✅ Signup success:", data);
    };

    return (
        <div className="bg-white border border-gray-200 rounded-xl w-[380px] p-6 flex flex-col gap-6 overflow-y-auto">
            <h2 className="text-base font-semibold tracking-tight">
                🎙️ Voice Verification
            </h2>

            <AuthForms
                isLoggedIn={isLoggedIn}
                onLogin={handleLogin}
                onLogout={handleLogout}
                onSignup={handleSignup}
            />

            <LiveKitControls
                token={session?.access_token || null}
                isConnected={isConnected}
                setIsConnected={setIsConnected}
                setRoomStatus={setRoomStatus}
                setVerifyStatus={setVerifyStatus}
                setScore={setScore}
                setIsAgentSpeaking={setIsAgentSpeaking}
                addMessage={addMessage}
                onProductCards={onProductCards}
                setIsTyping={setIsTyping}
            />

            <VoiceEnrollment
                token={session?.access_token || null}
                setVerifyStatus={setVerifyStatus}
            />

            {isAgentSpeaking && (
                <div className="text-center mb-4">
                    <div className="flex justify-center items-center gap-1 h-8 mb-1">
                        {[...Array(5)].map((_, i) => (
                            <div
                                key={i}
                                className="w-1 h-2.5 bg-black rounded animate-wave"
                                style={{ animationDelay: `${i * 0.1}s` }}
                            />
                        ))}
                    </div>
                    <small className="text-gray-500 text-xs">
                        Agent sedang berbicara...
                    </small>
                </div>
            )}

            <StatusDisplay
                verifyStatus={verifyStatus}
                roomStatus={roomStatus}
                score={score}
            />

            <footer className="text-gray-400 text-xs text-center border-t border-gray-100 pt-5 mt-auto">
                Voice Auth Demo • LiveKit
            </footer>
        </div>
    );
}
