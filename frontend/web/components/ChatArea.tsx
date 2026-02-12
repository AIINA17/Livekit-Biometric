// components/ChatArea.tsx
'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import { Message, Product } from '@/types';
import MessageBubble from './MessageBubble';
import ProductCards from './ProductCards';
import TypingIndicator from './TypingIndicator';
import VoiceButton from './VoiceButton';
import SoundWave from './SoundWave';
import LiveKitControls from './LiveKitControls';

interface ChatAreaProps {
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  isConnected: boolean;
  setIsConnected: (value: boolean) => void;
  isTyping: boolean;
  setIsTyping: (value: boolean) => void;
  products: Product[];
  isLoggedIn: boolean;
  isSpeaking: boolean;
  setIsSpeaking: (value: boolean) => void;
  speakingRole: 'user' | 'agent' | null;
  setSpeakingRole: (role: 'user' | 'agent' | null) => void;
  token: string | null;
  addMessage: (role: "user" | "assistant", text: string) => void;
  onProductCards: (products: Product[]) => void;
  setVerifyStatus: (status: string) => void;
  setRoomStatus: (status: string) => void;
  setScore: (score: number | null) => void;
}

export default function ChatArea({
  messages,
  setMessages,
  isConnected,
  setIsConnected,
  isTyping,
  setIsTyping,
  products,
  isLoggedIn,
  isSpeaking,
  setIsSpeaking,
  speakingRole,
  setSpeakingRole,
  token,
  addMessage,
  onProductCards,
  setVerifyStatus,
  setRoomStatus,
  setScore,
}: ChatAreaProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, products, isTyping]);

  const hasMessages = messages.length > 0 || products.length > 0;

  return (
    <div className="flex-1 flex flex-col h-screen bg-[var(--bg-primary)]">
      {/* Chat Messages Area */}
      <div className="flex-1 overflow-y-auto">
        {!hasMessages ? (
          /* Welcome Screen */
          <WelcomeScreen isSpeaking={isSpeaking} />
        ) : (
          /* Messages List */
          <div className="max-w-4xl mx-auto p-6 space-y-4">
            {messages.map((msg, idx) => (
              <MessageBubble key={idx} message={msg} />
            ))}

            {products.length > 0 && (
              <div className="animate-fadeIn">
                <ProductCards products={products} />
              </div>
            )}

            {isTyping && <TypingIndicator />}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Bottom Section - Voice Button & Controls */}
      <div className="p-6 flex flex-col items-center gap-4">

        {/* LiveKit Controls */}
        <LiveKitControls
          token={token}
          isSpeaking={isSpeaking}
          isConnected={isConnected}
          setIsSpeaking={setIsSpeaking}
          setIsConnected={setIsConnected}
          setRoomStatus={setRoomStatus}
          setVerifyStatus={setVerifyStatus}
          setScore={setScore}
          setIsAgentSpeaking={setIsSpeaking}
          addMessage={addMessage}
          onProductCards={onProductCards}
          setIsTyping={setIsTyping}
        />
      </div>
    </div>
  );
}

/* Welcome Screen Component */
function WelcomeScreen({ isSpeaking }: { isSpeaking: boolean }) {
  return (
    <div className="h-full flex flex-col items-center justify-center p-8">
      <h1 className="font-outfit text-5xl font-bold text-[var(--accent-primary)] mb-4">
        Happy
      </h1>
      
      <p className="font-space text-xl text-[var(--text-primary)] mb-12">
        Your personal shopping assistant
      </p>

      <div className="relative w-48 h-48 mb-8">
        <Image
          src="/icons/Happy_Warna.png"
          alt="Happy Mascot"
          fill
          className="object-contain"
          priority
        />
      </div>

      {isSpeaking && (
        <div className="mb-6">
          <SoundWave />
        </div>
      )}
    </div>
  );
}