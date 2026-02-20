"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import VoiceEnrollment from "./VoiceEnrollment";
import { IoMenu, IoEllipsisVertical } from "react-icons/io5";
import { MdModeEdit, MdDelete } from "react-icons/md";
import { PiUserSoundBold } from "react-icons/pi";
import { LuLogOut } from "react-icons/lu";

interface ConversationSession {
    id: string;
    label: string;
    created_at: string;
}

interface SidebarProps {
    isLoggedIn: boolean;
    userEmail: string;
    onLogout: () => void;
    token: string | null;
    setVerifyStatus: (status: string) => void;
    currentSessionId?: string | null;
    onSelectSession?: (sessionId: string) => void;
    onNewChat?: () => void;
}

export default function Sidebar({
    isLoggedIn,
    userEmail,
    onLogout,
    token,
    setVerifyStatus,
    currentSessionId,
    onSelectSession,
    onNewChat,
}: SidebarProps) {
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [showEnrollmentList, setShowEnrollmentList] = useState(false); // Default FALSE
    const [sessions, setSessions] = useState<ConversationSession[]>([]);
    const [loading, setLoading] = useState(true);
    const menuRef = useRef<HTMLDivElement>(null);

    const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL;

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                menuRef.current &&
                !menuRef.current.contains(event.target as Node)
            ) {
                setShowUserMenu(false);
            }
        };

        if (showUserMenu) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () =>
            document.removeEventListener("mousedown", handleClickOutside);
    }, [showUserMenu]);

    // Fetch sessions dari backend
    useEffect(() => {
        if (!isLoggedIn || !token) return;

        let isMounted = true;

        const loadSessions = async () => {
            setLoading(true);
            try {
                const res = await fetch(`${SERVER_URL}/logs/sessions`, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                });

                const data = await res.json();

                if (isMounted && data.status === "OK") {
                    setSessions(data.sessions || []);
                }
            } catch (error) {
                console.error("Error fetching sessions:", error);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        loadSessions();

        return () => {
            isMounted = false;
        };
    }, [isLoggedIn, token, SERVER_URL]);

    // Rename session
    const handleRename = async (sessionId: string, newLabel: string) => {
        if (!token) return;

        try {
            const res = await fetch(
                `${SERVER_URL}/conversation-sessions/${sessionId}/label`,
                {
                    method: "PATCH",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ label: newLabel }),
                },
            );

            const data = await res.json();

            if (data.status === "OK") {
                setSessions((prev) =>
                    prev.map((session) =>
                        session.id === sessionId
                            ? { ...session, label: newLabel }
                            : session,
                    ),
                );
            }
        } catch (error) {
            console.error("Error renaming session:", error);
        }
    };

    // Delete session
    const handleDelete = async (sessionId: string) => {
        if (!token) return;

        try {
            const res = await fetch(
                `${SERVER_URL}/conversation-sessions/${sessionId}`,
                {
                    method: "DELETE",
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                },
            );

            if (res.ok) {
                setSessions((prev) =>
                    prev.filter((session) => session.id !== sessionId),
                );
                if (currentSessionId === sessionId) {
                    onNewChat?.();
                }
            }
        } catch (error) {
            console.error("Error deleting session:", error);
        }
    };

    // Toggle Enrollment List - klik untuk show, klik lagi untuk hide
    const handleEnrollmentListClick = () => {
        setShowUserMenu(false);
        setShowEnrollmentList((prev) => !prev); // TOGGLE!
    };

    return (
        <aside className="w-90 h-screen bg-(--bg-secondary) flex flex-col border-r border-(--border-color)/20">
            {/* Logo Header */}
            <div className="p-6 pb-4">
                <div className="flex items-center gap-3">
                    <Image
                        src="/icons/Happy_Warna.png"
                        alt="Happy"
                        width={32}
                        height={32}
                        style={{ width: "40px", height: "40px" }}
                        className="object-contain"
                    />
                    <h1 className="font-space text-3xl font-bold text-(--text-primary)">
                        Happy
                    </h1>
                </div>
            </div>

            {/* Voice Enrollment Section */}
            <div className="px-6 pb-6">
                <VoiceEnrollment
                    token={token}
                    setVerifyStatus={setVerifyStatus}
                    showEnrollmentList={showEnrollmentList}
                    setShowEnrollmentList={setShowEnrollmentList}
                />
            </div>

            {/* Recents Section */}
            <div className="flex-1 px-6 overflow-hidden flex flex-col">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-medium text-(--text-secondary)">
                        Recents
                    </h2>
                </div>

                {/* Sessions List */}
                <div className="flex-1 overflow-y-auto space-y-1 pr-2">
                    {loading ? (
                        <div className="text-(--text-muted) text-sm py-4">
                            Loading...
                        </div>
                    ) : sessions.length === 0 ? (
                        <div className="text-(--text-muted) text-sm py-4">
                            Belum ada chat
                        </div>
                    ) : (
                        sessions.map((session) => (
                            <SessionItem
                                key={session.id}
                                session={session}
                                isActive={currentSessionId === session.id}
                                onSelect={() => onSelectSession?.(session.id)}
                                onRename={handleRename}
                                onDelete={handleDelete}
                            />
                        ))
                    )}
                </div>
            </div>

            {/* User Section - Bottom */}
            {isLoggedIn && (
                <div
                    className="relative p-4 border-t border-(--border-color)/20"
                    ref={menuRef}>
                    {/* User Menu Popup */}
                    {showUserMenu && (
                        <div
                            className="absolute bottom-full left-4 right-4 mb-2 bg-(--bg-tertiary) 
                                        rounded-lg shadow-lg overflow-hidden animate-fadeIn
                                        border border-(--border-color)/20">
                            {/* Enrollment List - TOGGLE */}
                            <button
                                onClick={handleEnrollmentListClick}
                                className="w-full px-4 py-3 flex items-center gap-3 text-(--text-secondary)
                                           hover:bg-(--bg-card) transition-colors cursor-pointer">
                                <PiUserSoundBold />
                                <span className="text-sm">Enrollment List</span>
                            </button>

                            {/* Log out */}
                            <button
                                onClick={() => {
                                    onLogout();
                                    setShowUserMenu(false);
                                }}
                                className="w-full px-4 py-4 flex items-center gap-3 text-(--text-secondary)
                                           hover:bg-(--bg-card) transition-colors cursor-pointer">
                                <LuLogOut />
                                <span className="text-sm">Log out</span>
                            </button>
                        </div>
                    )}

                    {/* User Info Button */}
                    <button
                        onClick={() => setShowUserMenu(!showUserMenu)}
                        className="w-full flex items-center gap-3 p-2 rounded-lg 
                                   hover:bg-(--bg-tertiary) transition-colors cursor-pointer">
                        <div className="w-10 h-10 rounded-full bg-(--bg-tertiary) flex items-center justify-center">
                            <span className="text-lg">👤</span>
                        </div>
                        <span className="flex-1 text-left text-(--text-primary) text-sm truncate">
                            {userEmail}
                        </span>
                        <IoMenu className="w-5 h-5 mx-2" />
                    </button>
                </div>
            )}
        </aside>
    );
}

/* ============================================
   SESSION ITEM WITH DROPDOWN
   ============================================ */

interface SessionItemProps {
    session: ConversationSession;
    isActive: boolean;
    onSelect: () => void;
    onRename: (sessionId: string, newLabel: string) => void;
    onDelete: (sessionId: string) => void;
}

function SessionItem({
    session,
    isActive,
    onSelect,
    onRename,
    onDelete,
}: SessionItemProps) {
    const [showMenu, setShowMenu] = useState(false);
    const [isRenaming, setIsRenaming] = useState(false);
    const [newLabel, setNewLabel] = useState(session.label);
    const menuRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                menuRef.current &&
                !menuRef.current.contains(event.target as Node)
            ) {
                setShowMenu(false);
            }
        };

        if (showMenu) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () =>
            document.removeEventListener("mousedown", handleClickOutside);
    }, [showMenu]);

    useEffect(() => {
        if (isRenaming && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isRenaming]);

    const handleRenameSubmit = () => {
        if (newLabel.trim() && newLabel !== session.label) {
            onRename(session.id, newLabel.trim());
        } else {
            setNewLabel(session.label);
        }
        setIsRenaming(false);
    };

    const handleDeleteClick = () => {
        if (confirm("Hapus chat ini?")) {
            onDelete(session.id);
        }
        setShowMenu(false);
    };

    return (
        <div className="relative group">
            {isRenaming ? (
                <input
                    ref={inputRef}
                    type="text"
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    onBlur={handleRenameSubmit}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") handleRenameSubmit();
                        if (e.key === "Escape") {
                            setNewLabel(session.label);
                            setIsRenaming(false);
                        }
                    }}
                    className="w-full px-3 py-2.5 rounded-lg bg-(--bg-tertiary) 
                               text-(--text-primary) text-sm outline-none
                               border border-(--accent-primary)"
                />
            ) : (
                <div
                    onClick={onSelect}
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-sm cursor-pointer
                               transition-colors flex items-center justify-between group
                               ${
                                   isActive
                                       ? "bg-(--bg-tertiary) text-(--text-primary)"
                                       : "text-(--text-primary) hover:bg-(--bg-tertiary)"
                               }`}>
                    <span className="truncate flex-1 pr-2">
                        {session.label}
                    </span>

                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowMenu(!showMenu);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-3 rounded hover:bg-(--bg-card)
                                   transition-opacity">
                        <IoEllipsisVertical />
                    </button>
                </div>
            )}

            {showMenu && (
                <div
                    ref={menuRef}
                    className="absolute right-0 top-full mt-1 w-40 bg-(--bg-tertiary) 
                               rounded-lg shadow-lg overflow-hidden z-50 animate-fadeIn
                               border border-(--border-color)/20">
                    <button
                        onClick={() => {
                            setIsRenaming(true);
                            setShowMenu(false);
                        }}
                        className="w-full px-4 py-2.5 flex items-center gap-3 text-sm text-(--text-primary)
                                   hover:bg-(--bg-card) transition-colors">
                        <MdModeEdit />
                        <span>Rename</span>
                    </button>
                    <button
                        onClick={handleDeleteClick}
                        className="w-full px-4 py-2.5 flex items-center gap-3 text-sm text-(--text-primary)
                                   hover:bg-(--bg-card) transition-colors">
                        <MdDelete />
                        <span>Delete</span>
                    </button>
                </div>
            )}
        </div>
    );
}
