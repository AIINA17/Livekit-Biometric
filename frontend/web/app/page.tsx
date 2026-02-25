"use client";

// Main authenticated chat page for the voice shopping assistant.

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import ChatArea from "@/components/ChatArea";
import Sidebar from "@/components/Sidebar";
import VerificationToast from "@/components/VerificationToast";
import { supabase } from "@/lib/supabase";
import { Message, Product } from "@/types";

type VerificationStatus = "VERIFIED" | "REPEAT" | "DENIED" | null;

export default function Home() {
    const router = useRouter();

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

    const [verificationResult, setVerificationResult] = useState<{
        status: VerificationStatus;
        score: number | null;
        reason: string | null;
    }>({ status: null, score: null, reason: null });

    const [currentSessionId, setCurrentSessionId] = useState<string | null>(
        null,
    );

    const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL;

    useEffect(() => {
        const checkSession = async () => {
            const {
                data: { session },
            } = await supabase.auth.getSession();

            if (session) {
                setSession(session);
                setIsLoggedIn(true);
            } else {
                setIsLoggedIn(false);
                router.replace("/login");
            }

            setIsLoading(false);
        };

        checkSession();

        // Listen for auth changes
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            const loggedIn = !!session;
            setIsLoggedIn(loggedIn);

            if (!loggedIn) {
                router.replace("/login");
            }
        });

        return () => subscription.unsubscribe();
    }, [router]);

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

    const clearVerificationResult = useCallback(() => {
        setVerificationResult({ status: null, score: null, reason: null });
    }, []);

    const handleSelectSession = (sessionId: string) => {
        setCurrentSessionId(sessionId);
        router.push(`/history/${sessionId}`);
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
        router.replace("/login");
    };

    if (isLoading) {
        return (
            <main className="h-screen bg-(--bg-primary) flex items-center justify-center">
                <div className="text-(--text-secondary)">Loading...</div>
            </main>
        );
    }

    if (!isLoggedIn) {
        return (
            <main className="h-screen bg-(--bg-primary) flex items-center justify-center">
                <div className="text-(--text-secondary)">
                    Redirecting to login...
                </div>
            </main>
        );
    }

    return (
        <main className="h-screen bg-(--bg-primary) flex overflow-hidden">
            <VerificationToast
                status={verificationResult.status}
                score={verificationResult.score}
                reason={verificationResult.reason}
                onClose={clearVerificationResult}
            />

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
                setVerificationResult={setVerificationResult}
            />
        </main>
    );
}
