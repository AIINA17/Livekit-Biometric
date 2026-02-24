//app/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import Sidebar from "@/components/Sidebar";
import ChatArea from "@/components/ChatArea";
import AuthCard from "@/components/AuthCard";
import VerificationToast from "@/components/VerificationToast";
import { Message, Product } from "@/types";

type VerificationStatus = "VERIFIED" | "REPEAT" | "DENIED" | null;

export default function Home() {
    // Auth state
    const [session, setSession] = useState<any | null>(null);
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // Chat state
    const [messages, setMessages] = useState<Message[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const [isTyping, setIsTyping] = useState(false);
    const [products, setProducts] = useState<Product[]>([]);

    // Voice state
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [speakingRole, setSpeakingRole] = useState<"user" | "agent" | null>(
        null,
    );

    // Status
    const [verifyStatus, setVerifyStatus] = useState("Idle");
    const [roomStatus, setRoomStatus] = useState("Not connected");
    const [score, setScore] = useState<number | null>(null);

    // ✅ VERIFICATION TOAST STATE
    const [verificationResult, setVerificationResult] = useState<{
        status: VerificationStatus;
        score: number | null;
        reason: string | null;
    }>({ status: null, score: null, reason: null });

    // ✅ SESSION/CONVERSATION STATE
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(
        null,
    );

    const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL;

    // Check session on mount
    useEffect(() => {
        const checkSession = async () => {
            const {
                data: { session },
            } = await supabase.auth.getSession();
            if (session) {
                setSession(session);
                setIsLoggedIn(true);
            }
            setIsLoading(false);
        };
        checkSession();

        // Listen for auth changes
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
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

    const handleProductCards = (newProducts: Product[]) => {
        setProducts(newProducts);
    };

    // ✅ VERIFICATION RESULT HANDLER
    const handleVerificationResult = useCallback(
        (
            status: VerificationStatus,
            score: number | null,
            reason: string | null,
        ) => {
            setVerificationResult({ status, score, reason });
        },
        [],
    );

    const clearVerificationResult = useCallback(() => {
        setVerificationResult({ status: null, score: null, reason: null });
    }, []);

    const handleSelectSession = async (sessionId: string) => {
        if (!session?.access_token || !SERVER_URL) return;
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
            if (!res.ok) return;
            const data = await res.json();

            const newMessages: Message[] = (data.logs || []).map(
                (log: any) => ({
                    role: log.role,
                    text: log.content,
                    timestamp: new Date(log.created_at),
                }),
            );

            const allProducts: Product[] = (data.product_cards || []).flatMap(
                (card: any) => card.products || [],
            );

            setMessages(newMessages);
            setProducts(allProducts);
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
        setCurrentSessionId(null);
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

    // LOGGED IN - Show Main App
    return (
        <main className="h-screen bg-(--bg-primary) flex overflow-hidden">
            {/* ✅ VERIFICATION TOAST */}
            <VerificationToast
                status={verificationResult.status}
                score={verificationResult.score}
                reason={verificationResult.reason}
                onClose={clearVerificationResult}
            />

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
                onVerificationResult={handleVerificationResult}
            />
        </main>
    );
  }

  // LOGGED IN - Show Main App
  return (
    <main className="h-screen bg-(--bg-primary) flex overflow-hidden">
      {/* ✅ VERIFICATION TOAST */}
      <VerificationToast
        status={verificationResult.status}
        score={verificationResult.score}
        reason={verificationResult.reason}
        onClose={clearVerificationResult}
      />

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
