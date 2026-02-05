// app/page.tsx
'use client';

import { useState } from 'react';
import ControlPanel from '@/components/ControlPanel';
import ChatContainer from '@/components/ChatContainer';
import { Message } from '@/types';

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isConnected, setIsConnected] = useState(false);

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

  return (
    <main className="min-h-screen bg-white p-5">
      <div className="flex gap-6 max-w-[1400px] mx-auto h-[calc(100vh-40px)]">
        <ControlPanel 
          isConnected={isConnected}
          setIsConnected={setIsConnected}
          addMessage={addMessage}
        />
        <ChatContainer 
          messages={messages}
          setMessages={setMessages}
          isConnected={isConnected}
        />
      </div>
    </main>
  );
}