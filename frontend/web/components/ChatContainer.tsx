// components/ChatContainer.tsx
'use client';

import { useEffect, useRef } from 'react';
import { Message, Product } from '@/types';
import MessageBubble from './MessageBubble';
import ProductCards from './ProductCards';
import TypingIndicator from './TypingIndicator';

interface ChatContainerProps {
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  isConnected: boolean;
  isTyping: boolean;
  products: Product[];
}

export default function ChatContainer({ 
  messages, 
  setMessages,
  isConnected,
  isTyping,
  products,
}: ChatContainerProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, products, isTyping]);

  return (
    <div className="flex-1 bg-zinc-50 border border-gray-200 rounded-xl flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-200 flex items-center gap-3 bg-white">
        <span 
          className={`w-2 h-2 rounded-full transition-all ${
            isConnected 
              ? 'bg-black shadow-[0_0_0_3px_rgba(0,0,0,0.05)]' 
              : 'bg-gray-300'
          }`}
        />
        <h2 className="text-base font-semibold">💬 Percakapan dengan AI Assistant</h2>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
        {messages.length === 0 && products.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-10">
            <div className="text-5xl mb-4 opacity-50">💬</div>
            <div className="text-base font-medium text-gray-600 mb-2">
              Belum ada percakapan
            </div>
            <div className="text-sm text-gray-400">
              Join room dan mulai berbicara dengan AI assistant
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, idx) => (
              <MessageBubble key={idx} message={msg} />
            ))}
            
            {/* Show ProductCards in chat flow */}
            {products.length > 0 && (
              <div className="self-start w-full max-w-[90%] animate-fadeIn">
                <div className="flex gap-3 items-start">
                  {/* Agent Avatar */}
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-base flex-shrink-0 bg-gray-100 border border-gray-200 text-black">
                    🤖
                  </div>
                  
                  {/* Product Cards Container */}
                  <div className="flex-1">
                    <div className="text-[0.7rem] font-semibold uppercase tracking-wider text-gray-500 mb-3">
                      AI Assistant
                    </div>
                    <ProductCards products={products} />
                  </div>
                </div>
              </div>
            )}
            
            {isTyping && <TypingIndicator />}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}