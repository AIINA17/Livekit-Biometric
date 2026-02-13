// components/LiveKitControls.tsx
'use client';

import React, { useEffect } from 'react';
import { useLiveKit } from '@/hooks/useLiveKit';
import { Product } from '@/types';
import VoiceButton from './VoiceButton';
import SoundWave from './SoundWave';

interface LiveKitControlsProps {
  token: string | null;
  isConnected: boolean;
  isSpeaking: boolean;
  setIsSpeaking: (value: boolean) => void;
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
  isSpeaking,
  setIsSpeaking,
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
        return 'text-(--accent-primary)';
      default:
        return 'text-(--text-muted)';
    }
  };

  /* ================= RENDER ================= */

  return (
    <div className="space-y-3 justify-center items-center flex flex-col">  
      {/* Mulai Button */}
      {!isConnected && (
      <VoiceButton 
        isConnected={isConnected}
        isSpeaking={uiState === 'RECORDING'} 
        onClick={joinRoom} 
        />
      )}

      {/* Status Display */}
      <div className="flex items-center justify-center gap-2">
        <div
          className={`w-2 h-2 rounded-full ${
            uiState === 'CHATTING'
              ? 'bg-green-500'
              : uiState === 'RECORDING' || uiState === 'VERIFYING'
              ? 'bg-(--accent-primary) animate-pulse'
              : 'bg-(--text-muted)'
          }`}
        />
        <span className={`text-sm ${getStatusColor()}`}>{getStatusText()}</span>

      </div>
    </div>
  );
}