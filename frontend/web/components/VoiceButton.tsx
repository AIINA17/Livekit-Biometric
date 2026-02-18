// components/VoiceButton.tsx
'use client';

import Image from 'next/image';

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
      {/* Pulse Ring Animation - When Speaking */}
      {isSpeaking && (
        <>
          <div 
            className="absolute inset-0 rounded-full bg-[var(--accent-primary)] 
                       animate-pulse-ring opacity-30"
          />
          <div 
            className="absolute inset-0 rounded-full bg-[var(--accent-primary)] 
                       animate-pulse-ring opacity-20"
            style={{ animationDelay: '0.5s' }}
          />
        </>
      )}

      {/* Connecting spinner ring */}
      {isConnecting && (
        <div 
          className="absolute inset-0 rounded-full border-4 border-transparent 
                     border-t-[var(--accent-primary)] animate-spin"
        />
      )}

      {/* Main Button */}
      <button
        onClick={onClick}
        disabled={disabled}
        className={`relative w-20 h-20 rounded-full flex items-center justify-center
                    transition-all duration-200 cursor-pointer
                    disabled:opacity-50 disabled:cursor-not-allowed
                    ${isActive 
                      ? 'bg-[var(--accent-primary)] border-4 border-[var(--accent-primary)] active:scale-95' 
                      : isConnecting
                        ? 'bg-[var(--text-secondary)] border-4 border-[var(--accent-primary)] opacity-70'
                        : 'bg-[var(--text-secondary)] border-3 border-[var(--accent-primary)] hover:scale-105 hover:shadow-lg active:scale-95'
                    }`}
      >
        {/* Icon changes based on state */}
        {isConnecting ? (
          // Loading dots
          <div className="flex gap-1">
            <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        ) : isActive ? (
          // Stop icon when connected
          <StopIcon />
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

/* Stop Icon */
function StopIcon() {
  return (
    <svg 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="white"
    >
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}