// components/ChatContainer.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { Message, Product } from '@/types';
import MessageBubble from './MessageBubble';
import ProductCards from './ProductCards';
import TypingIndicator from './TypingIndicator';

interface ChatContainerProps {
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  isConnected: boolean;
}

export default function ChatContainer({ 
  messages, 
  setMessages,
  isConnected 
}: ChatContainerProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [isTyping, setIsTyping] = useState(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, products, isTyping]);

  // Expose setProducts to parent via global
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).chatAddProducts = setProducts;
      (window as any).chatSetTyping = setIsTyping;
    }
  }, []);

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
            
            {products.length > 0 && <ProductCards products={products} />}
            
            {isTyping && <TypingIndicator />}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}