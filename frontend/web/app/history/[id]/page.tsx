"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Sidebar from "@/components/Sidebar";
import ChatArea from "@/components/ChatArea";
import VerificationToast from "@/components/VerificationToast";
import { Message, Product } from "@/types";

export default function HistoryDetailPage() {
    const router = useRouter();
    const params = useParams<{ id: string }>();
    const sessionId = params.id;

    // Auth state
    const [session, setSession] = useState<any | null>(null);
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // Chat/history state
    const [messages, setMessages] = useState<Message[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [isTyping, setIsTyping] = useState(false);
    const [isConnected, setIsConnected] = useState(false);

    // Voice state (tidak dipakai di history tapi diperlukan oleh ChatArea)
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [speakingRole, setSpeakingRole] = useState<"user" | "agent" | null>(
        null,
    );

    // Status
    const [verifyStatus, setVerifyStatus] = useState("Idle");
    const [roomStatus, setRoomStatus] = useState("Not connected");
    const [score, setScore] = useState<number | null>(null);

    const [verificationResult, setVerificationResult] = useState<{
        status: "VERIFIED" | "REPEAT" | "DENIED" | null;
        score: number | null;
        reason: string | null;
    }>({ status: null, score: null, reason: null });

    const [currentSessionId, setCurrentSessionId] = useState<string | null>(
        null,
    );

    const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL;

    // Cek session saat pertama kali load
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

    // Load logs untuk sessionId dari URL
    useEffect(() => {
        const loadSession = async () => {
            if (!session?.access_token || !SERVER_URL || !sessionId) return;

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

                const allProducts: Product[] = (
                    data.product_cards || []
                ).flatMap((card: any) => card.products || []);

                setMessages(newMessages);
                setProducts(allProducts);
                setIsConnected(false); // pastikan selalu history mode
            } catch (error) {
                console.error("Error loading session:", error);
            }
        };

        loadSession();
    }, [SERVER_URL, session, sessionId]);

    const clearVerificationResult = useCallback(() => {
        setVerificationResult({ status: null, score: null, reason: null });
    }, []);

    const handleSelectSession = async (newSessionId: string) => {
        // Pindah ke URL history baru, data akan di-load oleh useEffect di atas
        router.replace(`/history/${newSessionId}`);
    };

    const handleNewChat = () => {
        router.replace("/");
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
                currentSessionId={currentSessionId || sessionId}
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
                addMessage={() => {}}
                onProductCards={(p) => setProducts(p)}
                setVerifyStatus={setVerifyStatus}
                setRoomStatus={setRoomStatus}
                setScore={setScore}
                setVerificationResult={setVerificationResult}
                isViewingHistory
            />
        </main>
    );
}
