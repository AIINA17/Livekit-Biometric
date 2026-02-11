// components/LiveKitControls.tsx
'use client';

import React, { useEffect } from 'react';
import { useLiveKit } from '@/hooks/useLiveKit';
import { Product } from '@/types';

interface LiveKitControlsProps {
  token: string | null;
  isConnected: boolean;
  setIsConnected: (value: boolean) => void;
  setRoomStatus: (status: string) => void;
  setVerifyStatus: (status: string) => void;
  setScore: (score: number | null) => void;
  setIsAgentSpeaking: (value: boolean) => void;
  addMessage: (role: 'user' | 'assistant', text: string) => void;
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

  /* ================= SYNC STATE ================= */

  useEffect(() => {
    setIsConnected(uiState !== 'IDLE');
  }, [uiState, setIsConnected]);

  useEffect(() => {
    setIsTyping(uiState === 'RECORDING' || uiState === 'VERIFYING');
  }, [uiState, setIsTyping]);

  useEffect(() => {
    // Set agent speaking based on uiState
    setIsAgentSpeaking(uiState === 'CHATTING');
  }, [uiState, setIsAgentSpeaking]);

  /* ================= UI STATUS ================= */

  const getStatusText = () => {
    switch (uiState) {
      case 'LISTENING':
        return 'Menunggu suara...';
      case 'RECORDING':
        return 'Merekam suara...';
      case 'VERIFYING':
        return 'Memverifikasi...';
      case 'CHATTING':
        return 'Terhubung';
      default:
        return 'Tidak terhubung';
    }
  };

  const getStatusColor = () => {
    switch (uiState) {
      case 'CHATTING':
        return 'text-green-500';
      case 'RECORDING':
      case 'VERIFYING':
        return 'text-[var(--accent-primary)]';
      default:
        return 'text-[var(--text-muted)]';
    }
  };

  /* ================= RENDER ================= */

  return (
    <div className="space-y-3">
      {/* Status Display */}
      <div className="flex items-center gap-2">
        <div
          className={`w-2 h-2 rounded-full ${
            uiState === 'CHATTING'
              ? 'bg-green-500'
              : uiState === 'RECORDING' || uiState === 'VERIFYING'
              ? 'bg-[var(--accent-primary)] animate-pulse'
              : 'bg-[var(--text-muted)]'
          }`}
        />
        <span className={`text-sm ${getStatusColor()}`}>{getStatusText()}</span>
      </div>

      {/* Join Button */}
      {!isConnected && (
        <button
          onClick={joinRoom}
          className="w-full px-4 py-3 rounded-full bg-[var(--accent-primary)] 
                     text-white font-medium text-sm
                     hover:brightness-110 active:scale-[0.98]
                     transition-all flex items-center justify-center gap-2"
        >
          <PhoneIcon />
          <span>Mulai Percakapan</span>
        </button>
      )}
    </div>
  );
}

function PhoneIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

/* ============================================
   CARA GANTI STYLE:
   ============================================
   
   1. Status Indicator:
      - Connected: bg-green-500
      - Recording: bg-[var(--accent-primary)] dengan animate-pulse
      - Idle: bg-[var(--text-muted)]
   
   2. Button:
      - Background: bg-[var(--accent-primary)] (#D97757)
      - Shape: rounded-full (pill)
   
   3. Status Text Colors:
      - Connected: text-green-500
      - Recording: text-[var(--accent-primary)]
      - Idle: text-[var(--text-muted)]
*/