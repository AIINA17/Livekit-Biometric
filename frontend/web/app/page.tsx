// app/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';
import ChatArea from '@/components/ChatArea';
import AuthCard from '@/components/AuthCard';
import { Message, Product } from '@/types';

export default function Home() {
  // Auth state
  const [session, setSession] = useState<any | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true); // Loading state untuk cek session

  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  
  // Voice state
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingRole, setSpeakingRole] = useState<'user' | 'agent' | null>(null);

  // Status
  const [verifyStatus, setVerifyStatus] = useState("Idle");
  const [roomStatus, setRoomStatus] = useState("Not connected");
  const [score, setScore] = useState<number | null>(null);

  // Check session on mount
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setSession(session);
        setIsLoggedIn(true);
      }
      setIsLoading(false);
    };
    checkSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setIsLoggedIn(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Message handler
  const addMessage = (role: "user" | "assistant", text: string) => {
    if (!text || text.trim() === "") return;
    
    const newMessage: Message = {
      role,
      text: text.trim(),
      timestamp: new Date(),
    };
    
    setMessages((prev) => [...prev, newMessage]);
  };

  // Product handler
  const handleProductCards = (newProducts: Product[]) => {
    setProducts(newProducts);
  };

  // Auth handlers
  const handleLogin = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert(error.message);
      return;
    }

    setSession(data.session);
    setIsLoggedIn(true);
  };

  const handleSignup = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      alert("Signup gagal: " + error.message);
      return;
    }

    if (!data.session) {
      alert("Cek email kamu untuk verifikasi akun");
      return;
    }

    setSession(data.session);
    setIsLoggedIn(true);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setIsLoggedIn(false);
    setMessages([]);
    setProducts([]);
    setIsConnected(false);
  };

  // Loading screen
  if (isLoading) {
    return (
      <main className="h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="text-[var(--text-secondary)]">Loading...</div>
      </main>
    );
  }

  // NOT LOGGED IN - Show Auth Card
  if (!isLoggedIn) {
    return (
      <main className="h-screen bg-[var(--bg-primary)] flex items-center justify-center p-4">
        <AuthCard 
          onLogin={handleLogin}
          onSignup={handleSignup}
        />
      </main>
    );
  }

  // LOGGED IN - Show Main App
  return (
    <main className="h-screen bg-[var(--bg-primary)] flex overflow-hidden">
      {/* Sidebar */}
      <Sidebar
        isLoggedIn={isLoggedIn}
        userEmail={session?.user?.email || ''}
        onLogout={handleLogout}
        token={session?.access_token || null}
        setVerifyStatus={setVerifyStatus}
      />

      {/* Main Chat Area */}
      <ChatArea
        messages={messages}
        products={products}
        isLoggedIn={isLoggedIn}
        token={session?.access_token || null}
        isConnected={isConnected}
        isTyping={isTyping}
        isSpeaking={isSpeaking}
        speakingRole={speakingRole}
        setMessages={setMessages}
        setIsConnected={setIsConnected}
        setIsTyping={setIsTyping}
        setIsSpeaking={setIsSpeaking}
        setSpeakingRole={setSpeakingRole}
        addMessage={addMessage}
        onProductCards={handleProductCards}
        setVerifyStatus={setVerifyStatus}
        setRoomStatus={setRoomStatus}
        setScore={setScore}
      />
    </main>
  );
}