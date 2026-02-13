// components/MessageBubble.tsx
'use client';

import Image from 'next/image';
import { Message } from '@/types';

interface MessageBubbleProps {
  message: Message;
  userName?: string;
}

export default function MessageBubble({ message, userName = 'Username' }: MessageBubbleProps) {
  const { role, text, timestamp } = message;
  const isUser = role === 'user';

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div
      className={`flex gap-3 max-w-[85%] animate-fadeIn ${
        isUser ? 'ml-auto flex-row-reverse' : ''
      }`}
    >
      {/* Avatar - Only for Agent */}
      {!isUser && (
        <div className="shrink-0 w-8 h-8">
          <Image
            src="/icons/Happy_Warna.png"
            alt="Happy"
            width={32}
            height={32}
            className="rounded-full"
          />
        </div>
      )}

      {/* Content */}
      <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
        {/* Name Label */}
        <div className="flex items-center gap-2 mb-1">
          {!isUser && (
            <Image
              src="/icons/Happy_Polos.png"
              alt="Happy"
              width={16}
              height={16}
              style={{ width: 'auto', height: 'auto' }}
              className="opacity-70"
            />
          )}
          <span className="text-sm text-(--text-secondary)">
            {isUser ? userName : 'Happy'}
          </span>
        </div>

        {/* Message Bubble */}
        <div
          className={`px-4 py-3 rounded-2xl max-w-full wrap-break-words ${
            isUser
              ? 'bg-(--bubble-user) text-(--text-primary) rounded-br-md'
              : 'bg-(--bubble-agent) text-(--text-primary) rounded-bl-md'
          }`}
        >
          <p className="text-base leading-relaxed">{text}</p>
        </div>

        {/* Timestamp - Optional */}
        {/* 
        <span className="text-xs text-(--text-muted) mt-1">
          {formatTime(timestamp)}
        </span>
        */}
      </div>
    </div>
  );
}