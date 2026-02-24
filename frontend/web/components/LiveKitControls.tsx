// components/LiveKitControls.tsx
"use client";

import React, { useEffect } from "react";
import { useLiveKit } from "@/hooks/useLiveKit";
import { Product } from "@/types";
import VoiceButton from "./VoiceButton";

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
  const {
    toggleRoom,
    uiState,
    isConnected: hookIsConnected,
    isAgentSpeaking,
  } = useLiveKit({
    token,
    onMessage: addMessage,
    onProductCards,
    onVerifyStatus: setVerifyStatus,
    onRoomStatus: setRoomStatus,
    onScore: setScore,
  });

  useEffect(() => {
    setIsConnected(hookIsConnected);
  }, [hookIsConnected, setIsConnected]);

  useEffect(() => {
    setIsTyping(uiState === "RECORDING" || uiState === "VERIFYING");
  }, [uiState, setIsTyping]);

  useEffect(() => {
    setIsAgentSpeaking(isAgentSpeaking);
  }, [isAgentSpeaking, setIsAgentSpeaking]);

  const getButtonState = ():
    | "idle"
    | "connecting"
    | "connected"
    | "speaking" => {
    switch (uiState) {
      case "IDLE":
        return "idle";
      case "CONNECTING":
        return "connecting";
      case "RECORDING":
      case "LISTENING":
        return "speaking";
      case "CHATTING":
      case "VERIFYING":
        return "connected";
      default:
        return "idle";
    }
  };

  const getStatusText = () => {
    switch (uiState) {
      case "CONNECTING":
        return "Menghubungkan...";
      case "LISTENING":
        return "Menunggu suara...";
      case "RECORDING":
        return "Merekam suara...";
      case "VERIFYING":
        return "Memverifikasi...";
      case "CHATTING":
        return "Terhubung dengan Happy";
      default:
        return "Klik untuk mulai";
    }
  };

  const getStatusColor = () => {
    switch (uiState) {
      case "CHATTING":
        return "text-green-500";
      case "RECORDING":
      case "VERIFYING":
      case "LISTENING":
        return "text-[var(--accent-primary)]";
      case "CONNECTING":
        return "text-yellow-500";
      default:
        return "text-[var(--text-muted)]";
    }
  };

  return (
    <div className="space-y-4 justify-center items-center flex flex-col">
      {/* Voice Button - Always visible, changes based on state */}
      <VoiceButton state={getButtonState()} onClick={toggleRoom} />

      {/* Status Display */}
      <div className="flex items-center justify-center gap-2">
        <div
          className={`w-2 h-2 rounded-full ${
            uiState === "CHATTING"
              ? "bg-green-500"
              : uiState === "RECORDING" ||
                  uiState === "VERIFYING" ||
                  uiState === "LISTENING"
                ? "bg-(--accent-primary) animate-pulse"
                : uiState === "CONNECTING"
                  ? "bg-yellow-500 animate-pulse"
                  : "bg-(--text-muted)"
          }`}
        />
        <span className={`text-sm ${getStatusColor()}`}>{getStatusText()}</span>
      </div>
    </div>
  );
}
