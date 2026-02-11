"use client";

import React, { useEffect } from "react";
import { useLiveKit } from "@/hooks/useLiveKit";
import { Product } from "@/types";

interface LiveKitControlsProps {
    token: string | null;

    isConnected: boolean;
    setIsConnected: (value: boolean) => void;

    setRoomStatus: (status: string) => void;
    setVerifyStatus: (status: string) => void;
    setScore: (score: number | null) => void;
    setIsAgentSpeaking: (value: boolean) => void;

    addMessage: (role: "user" | "assistant", text: string) => void;
    onProductCards: (products: Product[]) => void;

    setIsTyping: (value: boolean) => void;
}

export default function LiveKitControls({
    token,
    isConnected,
    setIsConnected,
    setRoomStatus,
    setVerifyStatus,
    setScore,
    setIsAgentSpeaking,
    addMessage,
    onProductCards,
    setIsTyping,
}: LiveKitControlsProps) {
    const { joinRoom, uiState } = useLiveKit({
        token,
        onMessage: addMessage,
        onProductCards,
        onVerifyStatus: setVerifyStatus,
        onRoomStatus: setRoomStatus,
        onScore: setScore,
    });

    /* ================= SINKRON STATE ================= */

    useEffect(() => {
        // simple: connected kalau sudah chatting / listening / recording
        setIsConnected(uiState !== "IDLE");
    }, [uiState, setIsConnected]);

    useEffect(() => {
        setIsTyping(uiState === "RECORDING" || uiState === "VERIFYING");
    }, [uiState, setIsTyping]);

    /* ================= UI LABEL ================= */

    const renderStatus = () => {
        switch (uiState) {
            case "LISTENING":
                return "🎧 Menunggu suara";
            case "RECORDING":
                return "🎙️ Merekam suara…";
            case "VERIFYING":
                return "🔍 Memverifikasi suara…";
            case "CHATTING":
                return "💬 Chat aktif";
            default:
                return "⏳ Idle";
        }
    };

    /* ================= RENDER ================= */

    return (
        <div className="flex flex-col gap-2">
            <div className="text-[0.8rem] font-semibold text-gray-500 uppercase tracking-wide mb-1">
                LiveKit Room
            </div>

            <div className="text-sm text-gray-700 mb-1">
                Status: <span className="font-semibold">{renderStatus()}</span>
            </div>

            <div className="flex gap-2.5">
                <button
                    onClick={joinRoom}
                    disabled={isConnected}
                    className="flex-1 px-3 py-3 rounded-lg border border-gray-200 bg-white text-gray-900 font-semibold text-sm hover:bg-gray-50 hover:border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed">
                    Join Room
                </button>
            </div>
        </div>
    );
}
