// app/page.tsx
'use client';

import { useState } from 'react';
import ControlPanel from '@/components/ControlPanel';
import ChatContainer from '@/components/ChatContainer';
import { Message, Product } from '@/types';

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);

  const addMessage = (role: "user" | "assistant", text: string) => {
    if (!text || text.trim() === "") return;
    
    const newMessage: Message = {
      role,
      text: text.trim(),
      timestamp: new Date(),
    };
    
    setMessages((prev) => [...prev, newMessage]);
    console.log(`[${role.toUpperCase()}]: ${text}`);
  };

  const handleProductCards = (newProducts: Product[]) => {
    console.log('🛍️ Received products for chat:', newProducts);
    setProducts(newProducts);
  };

  return (
    <main className="min-h-screen bg-white p-5">
      <div className="flex gap-6 max-w-[1400px] mx-auto h-[calc(100vh-40px)]">
        <ControlPanel 
          isConnected={isConnected}
          setIsConnected={setIsConnected}
          addMessage={addMessage}
          onProductCards={handleProductCards}
          setIsTyping={setIsTyping}
        />
        <ChatContainer 
          messages={messages}
          setMessages={setMessages}
          isConnected={isConnected}
          isTyping={isTyping}
          products={products}
        />
      </div>
    </main>
  );
}