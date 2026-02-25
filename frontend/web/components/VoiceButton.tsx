"use client";

// Circular microphone button reflecting LiveKit connection state.

import Image from "next/image";
import { FaRegStopCircle } from "react-icons/fa";

type ButtonState = "idle" | "connecting" | "connected" | "speaking";

interface VoiceButtonProps {
    state: ButtonState;
    onClick: () => void;
    disabled?: boolean;
}

export default function VoiceButton({
    state,
    onClick,
    disabled = false,
}: VoiceButtonProps) {
    const isActive = state === "connected" || state === "speaking";
    const isConnecting = state === "connecting";
    const isSpeaking = state === "speaking";

    return (
        <div className="relative">
            {isSpeaking && (
                <>
                    <div
                        className="absolute inset-0 rounded-full bg-(--accent-primary)
                       animate-pulse-ring opacity-30"
                    />
                    <div
                        className="absolute inset-0 rounded-full bg-(--accent-primary)
                       animate-pulse-ring opacity-20"
                        style={{ animationDelay: "0.5s" }}
                    />
                </>
            )}

            {isConnecting && (
                <div
                    className="absolute inset-0 rounded-full border-4 border-transparent 
                     border-t-(--accent-primary) animate-spin"
                />
            )}

            <button
                onClick={onClick}
                disabled={disabled}
                className={`relative w-20 h-20 rounded-full flex items-center justify-center
                    transition-all duration-200 cursor-pointer
                    disabled:opacity-50 disabled:cursor-not-allowed
                    ${
                        isActive
                            ? "bg-(--accent-primary) border-4 border-(--accent-primary) active:scale-95"
                            : isConnecting
                              ? "bg-(--text-secondary) border-4 border-(--accent-primary) active:scale-95 animate-pulse-ring"
                              : "bg-(--text-secondary) border-3 border-(--accent-primary) hover:scale-105 hover:shadow-lg active:scale-95"
                    }`}>
                {isConnecting ? (
                    // Loading dots
                    <div className="flex gap-1">
                        <div
                            className="w-2 h-2 bg-white rounded-full animate-bounce"
                            style={{ animationDelay: "0ms" }}
                        />
                        <div
                            className="w-2 h-2 bg-white rounded-full animate-bounce"
                            style={{ animationDelay: "150ms" }}
                        />
                        <div
                            className="w-2 h-2 bg-white rounded-full animate-bounce"
                            style={{ animationDelay: "300ms" }}
                        />
                    </div>
                ) : isActive ? (
                    <FaRegStopCircle className="--text-primary" size={30} />
                ) : (
                    <Image
                        src="/icons/Mic.svg"
                        alt="Mic"
                        width={20}
                        height={20}
                        style={{ width: "60px", height: "60px" }}
                        className="object-contain"
                    />
                )}
            </button>
        </div>
    );
}
