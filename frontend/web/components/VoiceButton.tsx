// components/VoiceButton.tsx
'use client';

import Image from 'next/image';
import { FaRegStopCircle } from "react-icons/fa";

type ButtonState = 'idle' | 'connecting' | 'connected' | 'speaking';

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
  
  const isActive = state === 'connected' || state === 'speaking';
  const isConnecting = state === 'connecting';
  const isSpeaking = state === 'speaking';

  return (
    <div className="relative">
      
      {/* Main Button */}
      <button
        onClick={onClick}
        disabled={disabled}
        className={`relative w-20 h-20 rounded-full flex items-center justify-center
                    transition-all duration-200 cursor-pointer
                    disabled:opacity-50 disabled:cursor-not-allowed
                    ${isActive 
                      ? 'bg-(--accent-primary) border-4 border-(--accent-primary) active:scale-95' 
                      : isConnecting
                        ? 'bg-(--text-secondary) border-4 border-(--accent-primary) active:scale-95 animate-pulse-ring'
                        : 'bg-(--text-secondary) border-3 border-(--accent-primary) hover:scale-105 hover:shadow-lg active:scale-95'
                    }`}
      >
        
        {isConnecting ? (
          // Loading dots
          <div className="flex gap-1">
            <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        ) : isActive ? (
          
          <FaRegStopCircle className="--text-primary" size={30} />
        ) : (
          // Mic icon when idle
          <Image
            src="/icons/Microphone.png"
            alt="Mic"
            width={35}
            height={35}
            style={{ width: 'auto', height: 'auto' }}
            className="object-contain"
          />
        )}
      </button>

      {/* Label under button */}
      <p className="text-center text-xs text-[var(--text-muted)] mt-2">
        {isConnecting && 'Connecting...'}
        {state === 'idle' && 'Tap to start'}
        {state === 'connected' && 'Tap to end'}
        {state === 'speaking' && 'Listening...'}
      </p>
    </div>
  );
}
