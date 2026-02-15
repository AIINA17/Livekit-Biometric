// components/VoiceButton.tsx
'use client';

import Image from 'next/image';

interface VoiceButtonProps {
  isConnected: boolean;
  isSpeaking: boolean;
  onClick: () => void;
}

export default function VoiceButton({
  isConnected,
  isSpeaking,
  onClick,
}: VoiceButtonProps) {
  return (
    <div className="relative">
      {/* Pulse Ring Animation - When Speaking */}
      {isSpeaking && (
        <>
          <div 
            className="absolute inset-0 rounded-full bg-(--accent-primary) 
                       animate-pulse-ring opacity-30"
          />
          <div 
            className="absolute inset-0 rounded-full bg-(--accent-primary) 
                       animate-pulse-ring opacity-20"
            style={{ animationDelay: '0.5s' }}
          />
        </>
      )}

      {/* Mic Button */}
      <button
        onClick={onClick}
        className={`relative w-20 h-20 rounded-full flex items-center justify-center
                    transition-all duration-200 active:scale-95 cursor-pointer
                    ${isSpeaking 
                      ? 'bg-(--text-secondary) border-4 border-(--accent-primary)' 
                      : 'bg-(--text-secondary) border-3 border-(--accent-primary) hover:scale-105 hover:shadow-lg'
                    }`}
      >
        {/* Mic Icon */}
        <Image
          src="/icons/Microphone.png"
          alt="Mic"
          width={35}
          height={35}
          className="object-contain"
        />
      </button>
    </div>
  );
}