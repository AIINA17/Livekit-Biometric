// ========== components/MessageBubble.tsx ==========
'use client';

import { Message } from '@/types';

interface MessageBubbleProps {
  message: Message;
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const { role, text, timestamp } = message;
  
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('id-ID', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div className={`flex gap-3 max-w-[80%] animate-fadeIn ${
      role === 'user' ? 'self-end flex-row-reverse' : 'self-start'
    }`}>
      {/* Avatar */}
      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-base flex-shrink-0 ${
        role === 'user' 
          ? 'bg-black text-white' 
          : 'bg-gray-100 border border-gray-200 text-black'
      }`}>
        {role === 'user' ? '👤' : '🤖'}
      </div>

      {/* Content */}
      <div className={`flex flex-col gap-1 ${
        role === 'user' ? 'items-end' : 'items-start'
      }`}>
        {/* Role */}
        <div className="text-[0.7rem] font-semibold uppercase tracking-wider text-gray-500 mb-1">
          {role === 'user' ? 'You' : 'AI Assistant'}
        </div>

        {/* Bubble */}
        <div className={`px-4 py-3 rounded-2xl max-w-full break-words ${
          role === 'user'
            ? 'bg-black text-white rounded-br'
            : 'bg-gray-100 text-gray-900 border border-gray-200 rounded-bl'
        }`}>
          <div className="text-[0.95rem] leading-relaxed font-normal">
            {text}
          </div>
        </div>

        {/* Timestamp */}
        <div className="text-[0.7rem] text-gray-400 mt-1">
          {formatTime(timestamp)}
        </div>
      </div>
    </div>
  );
}