// components/Sidebar.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import VoiceEnrollment from './VoiceEnrollment';

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
  const [showLogoutMenu, setShowLogoutMenu] = useState(false);
  const [sessions, setSessions] = useState<ConversationSession[]>([]);
  const [loading, setLoading] = useState(true);

  const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL;

  // Fetch sessions dari backend
  useEffect(() => {
    if (isLoggedIn && token) {
      fetchSessions();
    }
  }, [isLoggedIn, token]);

  const fetchSessions = async () => {
    if (!token) return;
    
    setLoading(true);
    try {
      
      const res = await fetch(`${SERVER_URL}/logs/sessions`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await res.json();
      
      if (data.status === 'OK') {
        setSessions(data.sessions || []);
      }
    } catch (error) {
      console.error('Error fetching sessions:', error);
    }
    setLoading(false);
  };

  // Rename session
  const handleRename = async (sessionId: string, newLabel: string) => {
    if (!token) return;

    try {
      const res = await fetch(`${SERVER_URL}/conversation-sessions/${sessionId}/label`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ label: newLabel }),
      });

      const data = await res.json();

      if (data.status === 'OK') {
        setSessions(prev =>
          prev.map(session =>
            session.id === sessionId ? { ...session, label: newLabel } : session
          )
        );
      }
    } catch (error) {
      console.error('Error renaming session:', error);
    }
  };

  // Delete session
  const handleDelete = async (sessionId: string) => {
    if (!token) return;

    try {
      const res = await fetch(`${SERVER_URL}/conversation-sessions/${sessionId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (res.ok) {
        setSessions(prev => prev.filter(session => session.id !== sessionId));
        // If deleted session is current, clear it
        if (currentSessionId === sessionId) {
          onNewChat?.();
        }
      }
    } catch (error) {
      console.error('Error deleting session:', error);
    }
  };

  return (
    <aside className="w-[360px] h-screen bg-[var(--bg-secondary)] flex flex-col border-r border-[var(--border-color)]/20">
      {/* Logo Header */}
      <div className="p-6 pb-4">
        <div className="flex items-center gap-3">
          <Image
            src="/icons/Happy_Polos.png"
            alt="Happy"
            width={40}
            height={40}
            className="object-contain"
          />
          <h1 className="font-space text-3xl font-bold text-[var(--text-primary)]">
            Happy
          </h1>
        </div>
      </div>

      {/* Voice Enrollment Section */}
      <div className="px-6 pb-6">
        <VoiceEnrollment
          token={token}
          setVerifyStatus={setVerifyStatus}
        />
      </div>

      {/* Recents Section */}
      <div className="flex-1 px-6 overflow-hidden flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-[var(--text-secondary)]">
            Recents
          </h2>
        </div>
        
        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto space-y-1 pr-2">
          {loading ? (
            <div className="text-[var(--text-muted)] text-sm py-4">
              Loading...
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-[var(--text-muted)] text-sm py-4">
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
        <div className="relative p-4 border-t border-[var(--border-color)]/20">
          {/* Logout Menu Popup */}
          {showLogoutMenu && (
            <div className="absolute bottom-full left-4 right-4 mb-2 bg-[var(--bg-tertiary)] 
                            rounded-lg shadow-lg overflow-hidden animate-fadeIn">
              <button
                onClick={() => {
                  onLogout();
                  setShowLogoutMenu(false);
                }}
                className="w-full px-4 py-3 flex items-center gap-3 text-[var(--text-primary)]
                           hover:bg-[var(--bg-card)] transition-colors"
              >
                <LogoutIcon />
                <span className="text-base">Log out</span>
              </button>
            </div>
          )}

          {/* User Info */}
          <button
            onClick={() => setShowLogoutMenu(!showLogoutMenu)}
            className="w-full flex items-center gap-3 p-2 rounded-lg 
                       hover:bg-[var(--bg-tertiary)] transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center">
              <span className="text-lg">👤</span>
            </div>
            <span className="flex-1 text-left text-[var(--text-primary)] text-sm truncate">
              {userEmail}
            </span>
            <MenuIcon />
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

function SessionItem({ session, isActive, onSelect, onRename, onDelete }: SessionItemProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newLabel, setNewLabel] = useState(session.label);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  // Focus input when renaming
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
    if (confirm('Hapus chat ini?')) {
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
            if (e.key === 'Enter') handleRenameSubmit();
            if (e.key === 'Escape') {
              setNewLabel(session.label);
              setIsRenaming(false);
            }
          }}
          className="w-full px-3 py-2.5 rounded-lg bg-[var(--bg-tertiary)] 
                     text-[var(--text-primary)] text-sm outline-none
                     border border-[var(--accent-primary)]"
        />
      ) : (
        <div
          onClick={onSelect}
          className={`w-full text-left px-3 py-2.5 rounded-lg text-sm cursor-pointer
                     transition-colors flex items-center justify-between group
                     ${isActive 
                       ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]' 
                       : 'text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
                     }`}
        >
          <span className="truncate flex-1 pr-2">{session.label}</span>
          
          {/* Three Dots Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-[var(--bg-card)]
                       transition-opacity"
          >
            <ThreeDotsIcon />
          </button>
        </div>
      )}

      {/* Dropdown Menu */}
      {showMenu && (
        <div
          ref={menuRef}
          className="absolute right-0 top-full mt-1 w-40 bg-[var(--bg-tertiary)] 
                     rounded-lg shadow-lg overflow-hidden z-50 animate-fadeIn
                     border border-[var(--border-color)]/20"
        >
          <button
            onClick={() => {
              setIsRenaming(true);
              setShowMenu(false);
            }}
            className="w-full px-4 py-2.5 flex items-center gap-3 text-sm text-[var(--text-primary)]
                       hover:bg-[var(--bg-card)] transition-colors"
          >
            <RenameIcon />
            <span>Rename</span>
          </button>
          <button
            onClick={handleDeleteClick}
            className="w-full px-4 py-2.5 flex items-center gap-3 text-sm text-red-400
                       hover:bg-[var(--bg-card)] transition-colors"
          >
            <DeleteIcon />
            <span>Delete</span>
          </button>
        </div>
      )}
    </div>
  );
}

/* ============================================
   ICONS
   ============================================ */

function LogoutIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16,17 21,12 16,7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="7,8 12,3 17,8" />
      <polyline points="7,16 12,21 17,16" />
    </svg>
  );
}

function ThreeDotsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="5" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="12" cy="19" r="2" />
    </svg>
  );
}

function RenameIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3,6 5,6 21,6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}