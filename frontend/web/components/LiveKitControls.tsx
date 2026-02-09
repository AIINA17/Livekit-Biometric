// components/LiveKitControls.tsx
'use client';

import React from 'react';
import { useLiveKit } from '@/hooks/useLiveKit';

interface LiveKitControlsProps {
  token: string | null;
  isConnected: boolean;
  setIsConnected: (value: boolean) => void;
  setRoomStatus: (status: string) => void;
  setVerifyStatus: (status: string) => void;
  setScore: (score: number | null) => void;
  setIsAgentSpeaking: (value: boolean) => void;
  addMessage: (role: "user" | "assistant", text: string) => void;
  onProductCards: (products: any[]) => void;
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
  const { joinRoom, leaveRoom, isTyping } = useLiveKit({
    token,
    onMessage: addMessage,
    onProductCards: onProductCards,
    onVerifyStatus: setVerifyStatus,
    onRoomStatus: setRoomStatus,
    onScore: setScore,
    onAgentSpeaking: setIsAgentSpeaking,
  });

  // Update parent typing state when useLiveKit typing state changes
  React.useEffect(() => {
    setIsTyping(isTyping);
  }, [isTyping, setIsTyping]);

  return (
    <div className="flex flex-col gap-2">
      <div className="text-[0.8rem] font-semibold text-gray-500 uppercase tracking-wide mb-1">
        LiveKit Room
      </div>
      <div className="flex gap-2.5">
        <button
          onClick={joinRoom}
          disabled={isConnected}
          className="flex-1 px-3 py-3 rounded-lg border border-gray-200 bg-white text-gray-900 font-semibold text-sm hover:bg-gray-50 hover:border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-all cursor-pointer"
        >
          Join Room
        </button>
        <button
          onClick={leaveRoom}
          disabled={!isConnected}
          className="flex-1 px-3 py-3 rounded-lg border border-red-200 text-red-500 font-semibold text-sm hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-all"
        >
          Leave
        </button>
      </div>
    </div>
  );
}