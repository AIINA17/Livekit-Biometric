"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import Sidebar from "@/components/Sidebar";
import ChatArea from "@/components/ChatArea";
import AuthCard from "@/components/AuthCard";
import { Message, Product } from "@/types";
import { Session } from "@supabase/supabase-js";

interface SessionLog {
    role: "user" | "assistant";
    content: string;
    created_at: string;
    product_cards?: string | null;
}

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

  // ✅ SESSION/CONVERSATION STATE - ADDED
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  
  const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL;

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

    // Product handler
    const handleProductCards = (newProducts: Product[]) => {
        setProducts(newProducts);
    };
    
    setMessages((prev) => [...prev, newMessage]);
  };

  // Product handler
  const handleProductCards = (newProducts: Product[]) => {
    setProducts(newProducts);
  };

  // ✅ SESSION HANDLERS - ADDED
  const handleSelectSession = async (sessionId: string) => {
    if (!session?.access_token || !SERVER_URL) return;

    console.log('📂 Loading session:', sessionId);
    setCurrentSessionId(sessionId);

    try {
      const res = await fetch(`${SERVER_URL}/logs/sessions/${sessionId}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!res.ok) {
        console.error('Failed to load session logs:', res.status);
        return;
      }

      const data = await res.json();
      console.log('📥 Loaded logs:', data.logs?.length || 0);

      // Parse logs into messages and products
      const newMessages: Message[] = [];
      let newProducts: Product[] = [];

      data.logs?.forEach((log: any) => {
        // Check if product_cards column has data
        if (log.product_cards) {
          try {
            const products = JSON.parse(log.product_cards);
            newProducts = products; // Use latest products
            console.log('🛍️ Loaded products from DB:', products.length);
          } catch (e) {
            console.error('Failed to parse product_cards:', e);
          }
        } else {
          // Regular text message
          newMessages.push({
            role: log.role,
            text: log.content,
            timestamp: new Date(log.created_at),
          });
        }
      });

      setMessages(newMessages);
      setProducts(newProducts);

    } catch (error) {
      console.error('Error loading session:', error);
    }
  };

  const handleNewChat = () => {
    setCurrentSessionId(null);
    setMessages([]);
    setProducts([]);
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

    // ✅ SESSION HANDLERS - ADDED
    const handleSelectSession = async (sessionId: string) => {
        if (!session?.access_token || !SERVER_URL) return;

        console.log("📂 Loading session:", sessionId);
        setCurrentSessionId(sessionId);

        try {
            const res = await fetch(
                `${SERVER_URL}/logs/sessions/${sessionId}`,
                {
                    headers: {
                        Authorization: `Bearer ${session.access_token}`,
                    },
                },
            );

            if (!res.ok) {
                console.error("Failed to load session logs:", res.status);
                return;
            }

            const data = await res.json();
            console.log("📥 Loaded logs:", data.logs?.length || 0);

            // Parse logs into messages and products
            const newMessages: Message[] = [];
            let newProducts: Product[] = [];

            const logs: SessionLog[] = data.logs || [];

            logs.forEach((log) => {
                if (log.product_cards) {
                    try {
                        const products = JSON.parse(
                            log.product_cards,
                        ) as Product[];
                        newProducts = products;
                    } catch (e) {
                        console.error("Failed to parse product_cards:", e);
                    }
                } else {
                    newMessages.push({
                        role: log.role,
                        text: log.content,
                        timestamp: new Date(log.created_at),
                    });
                }
            });

            setMessages(newMessages);
            setProducts(newProducts);
        } catch (error) {
            console.error("Error loading session:", error);
        }
    };

    const handleNewChat = () => {
        setCurrentSessionId(null);
        setMessages([]);
        setProducts([]);
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
        setCurrentSessionId(null); // ✅ Clear session on logout
    };

    // Loading screen
    if (isLoading) {
        return (
            <main className="h-screen bg-(--bg-primary) flex items-center justify-center">
                <div className="text-(--text-secondary)">Loading...</div>
            </main>
        );
    }

    // NOT LOGGED IN - Show Auth Card
    if (!isLoggedIn) {
        return (
            <main className="h-screen bg-(--bg-primary) flex items-center justify-center p-4">
                <AuthCard onLogin={handleLogin} onSignup={handleSignup} />
            </main>
        );
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
    setCurrentSessionId(null); // ✅ Clear session on logout
  };

  // Loading screen
  if (isLoading) {
    return (
        <main className="h-screen bg-(--bg-primary) flex overflow-hidden">
            {/* Sidebar */}
            <Sidebar
                isLoggedIn={isLoggedIn}
                userEmail={session?.user?.email || ""}
                onLogout={handleLogout}
                token={session?.access_token || null}
                setVerifyStatus={setVerifyStatus}
                currentSessionId={currentSessionId}
                onSelectSession={handleSelectSession}
                onNewChat={handleNewChat}
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
        currentSessionId={currentSessionId}
        onSelectSession={handleSelectSession}
        onNewChat={handleNewChat}
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
