// components/ChatArea.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { FaMicrophone } from "react-icons/fa";
import {
    IoChatbubblesOutline,
    IoChevronForward,
    IoChevronBack,
} from "react-icons/io5";
import { HiShoppingBag } from "react-icons/hi2";
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
    setVerificationResult: (result: {
        status: "VERIFIED" | "REPEAT" | "DENIED" | null;
        score: number | null;
        reason: string | null;
    }) => void;
    isViewingHistory?: boolean;
}

export default function ChatArea({
    messages,
    isConnected,
    setIsConnected,
    isTyping,
    setIsTyping,
    products,
    isSpeaking,
    setIsSpeaking,
    token,
    addMessage,
    onProductCards,
    setVerifyStatus,
    setRoomStatus,
    setScore,
    setVerificationResult,
    isViewingHistory = false,
}: ChatAreaProps) {
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [viewMode, setViewMode] = useState<ViewMode>("voice");
    const [isProductSidebarOpen, setIsProductSidebarOpen] = useState(true);

    const isHistoryMode = messages.length > 0 && !isConnected;

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        if (viewMode === "chat" || isHistoryMode) {
            scrollToBottom();
        }
    }, [messages, isTyping, viewMode, isHistoryMode]);

    return (
        <div className="flex-1 flex h-screen bg-(--bg-primary) overflow-hidden">
            {/* ====== LEFT: Main Content Area ====== */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Scrollable content */}
                <div className="flex-1 overflow-y-auto">
                    {isHistoryMode ? (
                        <HistoryModeView
                            messages={messages}
                            isTyping={isTyping}
                            messagesEndRef={messagesEndRef}
                        />
                    ) : viewMode === "voice" ? (
                        <VoiceModeView isSpeaking={isSpeaking} />
                    ) : (
                        <ChatModeView
                            messages={messages}
                            isTyping={isTyping}
                            messagesEndRef={messagesEndRef}
                        />
                    )}
                </div>

                {!isHistoryMode && (
                    <div className="p-1 flex flex-col items-center gap-4 border-t border-(--bg-tertiary)">
                        <ModeToggle
                            currentMode={viewMode}
                            onModeChange={setViewMode}
                        />
                        <LiveKitControls
                            token={token}
                            isConnected={isConnected}
                            setIsConnected={setIsConnected}
                            setRoomStatus={setRoomStatus}
                            setVerifyStatus={setVerifyStatus}
                            setScore={setScore}
                            setVerificationResult={setVerificationResult}
                            setIsAgentSpeaking={setIsSpeaking}
                            addMessage={addMessage}
                            onProductCards={onProductCards}
                            setIsTyping={setIsTyping}
                        />
                    </div>
                )}
            </div>

            <ProductSidebar
                products={products}
                isOpen={isProductSidebarOpen}
                onToggle={() => setIsProductSidebarOpen((prev) => !prev)}
            />
        </div>
    );
}

interface ProductSidebarProps {
    products: Product[];
    isOpen: boolean;
    onToggle: () => void;
}

function ProductSidebar({ products, isOpen, onToggle }: ProductSidebarProps) {
    const hasProducts = products.length > 0;

    if (!hasProducts) return null;

    return (
        <div className="relative flex">
            {/* Sidebar Content */}
            <div
                className={`
          flex flex-col border-l border-(--bg-tertiary) bg-(--bg-secondary)
          transition-all duration-300 ease-in-out
          ${isOpen ? "w-80 opacity-100" : "w-0 opacity-0 overflow-hidden border-l-0"}
        `}>
                {isOpen && (
                    <>
                        {/* Header */}
                        <button
                            onClick={onToggle}
                            className="w-full p-4 border-b border-(--bg-tertiary)
                        flex items-center justify-between
                        hover:bg--(--bg-tertiary) transition-colors cursor-pointer">
                            <div className="flex items-center gap-2 text-sm font-medium text-(--text-primary)">
                                <HiShoppingBag
                                    size={18}
                                    className="text-(--accent-primary)"
                                />
                                <span>{products.length} Produk</span>
                            </div>
                            <IoChevronForward
                                size={16}
                                className="text-(--text-muted)"
                            />
                        </button>

                        {/* Products */}
                        <div className="flex-1 overflow-y-auto p-3">
                            <ProductCards products={products} />
                        </div>
                    </>
                )}
            </div>

            {/* Collapsed indicator (when closed but has products) */}
            {!isOpen && hasProducts && (
                <div
                    onClick={onToggle}
                    className="w-12 h-full flex flex-col items-center justify-center
                     border-l border-(--bg-tertiary) bg-(--bg-secondary)
                     cursor-pointer hover:bg-(--bg-tertiary) transition-colors">
                    <HiShoppingBag
                        size={20}
                        className="text-(--accent-primary)"
                    />
                    <span className="text-xs text-(--text-muted) writing-mode-vertical">
                        {products.length}
                    </span>
                </div>
            )}
        </div>
    );
}

interface ModeToggleProps {
    currentMode: ViewMode;
    onModeChange: (mode: ViewMode) => void;
}

function ModeToggle({ currentMode, onModeChange }: ModeToggleProps) {
    return (
        <div className="flex items-center gap-2 p-1 mt-3 rounded-full bg-(--bg-tertiary)">
            <button
                onClick={() => onModeChange("voice")}
                className={`p-2.5 rounded-full transition-all duration-200
                    ${
                        currentMode === "voice"
                            ? "bg-(--accent-primary) text-(--text-primary) shadow-sm"
                            : "text-(--text-muted) hover:text-(--text-secondary) cursor-pointer"
                    }`}
                title="Voice Mode">
                <FaMicrophone size={16} />
            </button>

            <button
                onClick={() => onModeChange("chat")}
                className={`p-2.5 rounded-full transition-all duration-200
                    ${
                        currentMode === "chat"
                            ? "bg-(--accent-primary) text-(--text-primary) shadow-sm"
                            : "text-(--text-muted) hover:text-(--text-secondary) cursor-pointer"
                    }`}
                title="Chat Mode">
                <IoChatbubblesOutline size={20} />
            </button>
        </div>
    );
}

interface VoiceModeViewProps {
    isSpeaking: boolean;
}

function VoiceModeView({ isSpeaking }: VoiceModeViewProps) {
    return (
        <div className="h-full flex flex-col items-center justify-center p-8">
            <h1 className="font-outfit text-5xl font-bold text-(--accent-primary) mb-4">
                Happy
            </h1>

            <p className="font-space text-xl text-(--text-primary) mb-8">
                Your personal shopping assistant
            </p>

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

            {isSpeaking && (
                <div className="mb-6">
                    <SoundWave />
                </div>
            )}
        </div>
    );
}

interface ChatModeViewProps {
    messages: Message[];
    isTyping: boolean;
    messagesEndRef: React.RefObject<HTMLDivElement | null>;
}

function ChatModeView({
    messages,
    isTyping,
    messagesEndRef,
}: ChatModeViewProps) {
    if (messages.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-8">
                <IoChatbubblesOutline
                    size={64}
                    className="text-(--text-muted) mb-4"
                />
                <p className="text-(--text-muted) text-lg">Belum ada pesan</p>
                <p className="text-(--text-muted) text-sm mt-2">
                    Mulai percakapan dengan menekan tombol mic
                </p>
            </div>
        );
    }

    return (
        <div className="w-full px-6 py-4 space-y-4">
            {messages.map((msg, idx) => (
                <MessageBubble key={idx} message={msg} />
            ))}

            {isTyping && <TypingIndicator />}

            <div ref={messagesEndRef} />
        </div>
    );
}

interface HistoryModeViewProps {
    messages: Message[];
    isTyping: boolean;
    messagesEndRef: React.RefObject<HTMLDivElement | null>;
}

function HistoryModeView({
    messages,
    isTyping,
    messagesEndRef,
}: HistoryModeViewProps) {
    return (
        <div className="h-full flex flex-col">
            {/* History Header */}
            <div className="p-4 border-b border-(--bg-tertiary) bg-(--bg-secondary)">
                <div className="flex items-center gap-2 text-sm text-(--text-secondary)">
                    <IoChatbubblesOutline size={16} />
                    <span>Chat History</span>
                    <span className="text-(--text-muted)">
                        • {messages.length} pesan
                    </span>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto">
                <div className="w-full px-6 py-4 space-y-4">
                    {messages.map((msg, idx) => (
                        <MessageBubble key={idx} message={msg} />
                    ))}

                    {isTyping && <TypingIndicator />}

                    <div ref={messagesEndRef} />
                </div>
            </div>
        </div>
    );
}
