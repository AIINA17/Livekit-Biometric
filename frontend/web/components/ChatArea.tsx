// components/ChatArea.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { FaMicrophone } from "react-icons/fa";
import { IoChatbubblesOutline } from "react-icons/io5";
import { Message, Product } from "@/types";
import MessageBubble from "./MessageBubble";
import ProductCards from "./ProductCards";
import TypingIndicator from "./TypingIndicator";
import SoundWave from "./SoundWave";
import LiveKitControls from "./LiveKitControls";

type ViewMode = "voice" | "chat";

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
    speakingRole: "user" | "agent" | null;
    setSpeakingRole: (role: "user" | "agent" | null) => void;
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
    const [viewMode, setViewMode] = useState<ViewMode>("voice");

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        if (viewMode === "chat") {
            scrollToBottom();
        }
    }, [messages, products, isTyping, viewMode]);

    const hasMessages = messages.length > 0;

    return (
        <div className="flex-1 flex flex-col h-screen bg-[var(--bg-primary)] relative">
            {/* Main Content Area */}
            <div className="flex-1 overflow-y-auto">
                {viewMode === "voice" ? (
                    /* ========== VOICE MODE ========== */
                    <VoiceModeView 
                        isSpeaking={isSpeaking} 
                        products={products}
                    />
                ) : (
                    /* ========== CHAT MODE ========== */
                    <ChatModeView
                        messages={messages}
                        products={products}
                        isTyping={isTyping}
                        messagesEndRef={messagesEndRef}
                    />
                )}
            </div>

            
            <div className="p-1 flex flex-col items-center gap-4">
                
                <ModeToggle 
                    currentMode={viewMode} 
                    onModeChange={setViewMode} 
                />

                {/* LiveKit Controls (Voice Button) */}
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

/* ========================================
   MODE TOGGLE COMPONENT
======================================== */

interface ModeToggleProps {
    currentMode: ViewMode;
    onModeChange: (mode: ViewMode) => void;
}

function ModeToggle({ currentMode, onModeChange }: ModeToggleProps) {
    return (
        <div className="flex items-center gap-1 p-1 rounded-full bg-[var(--bg-tertiary)]">
            {/* Voice Mode Button */}
            <button
                onClick={() => onModeChange("voice")}
                className={`p-2.5 rounded-full transition-all duration-200
                    ${currentMode === "voice"
                        ? "bg-(--accent-primary) text-(--text-primary) shadow-sm"
                        : "text-(--text-muted) hover:text-(--text-secondary)"
                    }`}
                title="Voice Mode"
            >
                <FaMicrophone size={16} />
            </button>

            {/* Chat Mode Button */}
            <button
                onClick={() => onModeChange("chat")}
                className={`p-2.5 rounded-full transition-all duration-200
                    ${currentMode === "chat"
                        ? "bg-(--accent-primary) text-(--text-primary) shadow-sm"
                        : "text-(--text-muted) hover:text-(--text-secondary)"
                    }`}
                title="Chat Mode"
            >
                <IoChatbubblesOutline size={18} />
            </button>
        </div>
    );
}

/* ========================================
   VOICE MODE VIEW
======================================== */

interface VoiceModeViewProps {
    isSpeaking: boolean;
    products: Product[];
}

function VoiceModeView({ isSpeaking, products }: VoiceModeViewProps) {
    return (
        <div className="h-full flex flex-col items-center justify-center p-8">
            {/* Title */}
            <h1 className="font-outfit text-5xl font-bold text-[var(--accent-primary)] mb-4">
                Happy
            </h1>

            <p className="font-space text-xl text-[var(--text-primary)] mb-8">
                Your personal shopping assistant
            </p>

            {/* Happy Mascot */}
            <div className="relative w-56 h-56 mb-6">
                <Image
                    src="/icons/Happy_Warna.png"
                    alt="Happy Mascot"
                    fill
                    className="object-contain"
                    sizes="(max-width: 768px) 100vw, 224px"
                    priority
                />
            </div>

            {/* Sound Wave - Show when speaking */}
            {isSpeaking && (
                <div className="mb-6">
                    <SoundWave />
                </div>
            )}

            {/* Product Cards - Show in voice mode too */}
            {products.length > 0 && (
                <div className="w-full max-w-4xl mt-8 animate-fadeIn">
                    <ProductCards products={products} />
                </div>
            )}
        </div>
    );
}

/* ========================================
   CHAT MODE VIEW
======================================== */

interface ChatModeViewProps {
    messages: Message[];
    products: Product[];
    isTyping: boolean;
    messagesEndRef: React.RefObject<HTMLDivElement | null>;
}

function ChatModeView({ messages, products, isTyping, messagesEndRef }: ChatModeViewProps) {
    if (messages.length === 0 && products.length === 0) {
        // Empty state - no messages yet
        return (
            <div className="h-full flex flex-col items-center justify-center p-8">
                <IoChatbubblesOutline 
                    size={64} 
                    className="text-[var(--text-muted)] mb-4" 
                />
                <p className="text-[var(--text-muted)] text-lg">
                    Belum ada pesan
                </p>
                <p className="text-[var(--text-muted)] text-sm mt-2">
                    Mulai percakapan dengan menekan tombol mic
                </p>
            </div>
        );
    }

    return (
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
    );
}