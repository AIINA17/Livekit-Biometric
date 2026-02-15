// components/VoiceEnrollment.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import SoundWave from "./SoundWave";
import Image from "next/image";
import { MdModeEdit, MdDelete } from "react-icons/md";


const ENROLLMENT_TEXTS = [
    "Kami putra dan putri Indonesia, mengaku bertumpah darah yang satu, tanah air Indonesia.",
    "Kami putra dan putri Indonesia, mengaku berbangsa yang satu, bangsa Indonesia.",
    "Kami putra dan putri Indonesia, menjunjung bahasa persatuan, bahasa Indonesia.",
];

const RECORDING_DURATION = 10; // 10 detik

interface VoiceProfile {
    id: string;
    label: string;
    created_at: string;
}

interface VoiceEnrollmentProps {
    token: string | null;
    setVerifyStatus: (status: string) => void;
    showEnrollmentList: boolean;
    setShowEnrollmentList: (show: boolean) => void;
}

export default function VoiceEnrollment({
    token,
    setVerifyStatus,
    showEnrollmentList,
    setShowEnrollmentList,
}: VoiceEnrollmentProps) {
    const [label, setLabel] = useState("");
    const [isRecording, setIsRecording] = useState(false);
    const [enrolledVoices, setEnrolledVoices] = useState<VoiceProfile[]>([
        // Dummy data
        { id: "1", label: "Bambang", created_at: new Date().toISOString() },
    ]);
    const [countdown, setCountdown] = useState(RECORDING_DURATION); // Countdown dari 10
    const [currentTextIndex, setCurrentTextIndex] = useState(0);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingLabel, setEditingLabel] = useState("");

    const recorderRef = useRef<MediaRecorder | null>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const editInputRef = useRef<HTMLInputElement>(null);

    const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL;
    const MAX_ENROLLMENTS = 3;

    // Fetch enrolled voices from backend
    useEffect(() => {
        if (token) {
            fetchEnrolledVoices();
        }
    }, [token]);

    // Focus edit input when editing
    useEffect(() => {
        if (editingId && editInputRef.current) {
            editInputRef.current.focus();
            editInputRef.current.select();
        }
    }, [editingId]);

    const fetchEnrolledVoices = async () => {
        if (!token) return;

        try {
            // TODO: Implement API call to fetch voice profiles
            // const res = await fetch(`${SERVER_URL}/voice-profiles`, {
            //   headers: { 'Authorization': `Bearer ${token}` },
            // });
            // const data = await res.json();
            // setEnrolledVoices(data.profiles || []);
        } catch (error) {
            console.error("Error fetching voice profiles:", error);
        }
    };

    // Start enrollment recording
    const startEnroll = async () => {
        if (!token) {
            alert("Login dulu sebelum enroll");
            return;
        }

        if (!label.trim()) {
            alert("Masukkan nama/label terlebih dahulu");
            return;
        }

        if (enrolledVoices.length >= MAX_ENROLLMENTS) {
            alert(
                "Maksimal 3 voice enrollment. Hapus salah satu untuk menambah baru.",
            );
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: true,
            });
            streamRef.current = stream;

            const recorder = new MediaRecorder(stream, {
                mimeType: "audio/webm;codecs=opus",
            });
            recorderRef.current = recorder;

            const chunks: Blob[] = [];

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunks.push(e.data);
            };

            recorder.onstop = async () => {
                streamRef.current?.getTracks().forEach((t) => t.stop());

                if (timerRef.current) {
                    clearInterval(timerRef.current);
                }

                setIsRecording(false);
                setCountdown(RECORDING_DURATION); // Reset countdown
                setVerifyStatus("Uploading enrollment...");

                const blob = new Blob(chunks, {
                    type: "audio/webm;codecs=opus",
                });
                await uploadEnrollment(blob);
            };

            recorder.start();
            setIsRecording(true);
            setVerifyStatus("Recording... Baca text di bawah dengan jelas");

            // Countdown timer dari 10 ke 0
            setCountdown(RECORDING_DURATION);
            timerRef.current = setInterval(() => {
                setCountdown((prev) => {
                    if (prev <= 1) {
                        // Waktu habis, auto stop
                        stopEnroll();
                        return RECORDING_DURATION;
                    }
                    return prev - 1;
                });
            }, 1000);
        } catch (err) {
            console.error("Enroll error:", err);
            setVerifyStatus("Mic access failed");
            alert("Tidak dapat mengakses microphone");
        }
    };

    // Stop enrollment recording
    const stopEnroll = () => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
        }
        if (recorderRef.current?.state === "recording") {
            recorderRef.current.stop();
        }
    };

    // Upload enrollment to backend
    const uploadEnrollment = async (blob: Blob) => {
        if (!token) return;

        const form = new FormData();
        form.append("label", label);
        form.append("audio", blob, "enroll.webm");

        try {
            const res = await fetch(`${SERVER_URL}/enroll-voice`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                body: form,
            });

            const result = await res.json();

            if (result.status === "OK") {
                setVerifyStatus("Enrollment successful!");
                const newVoice: VoiceProfile = {
                    id: Date.now().toString(),
                    label: label,
                    created_at: new Date().toISOString(),
                };
                setEnrolledVoices((prev) => [...prev, newVoice]);
                setLabel("");
                setCurrentTextIndex(
                    (prev) => (prev + 1) % ENROLLMENT_TEXTS.length,
                );
                // Show enrollment list after successful enrollment
                setShowEnrollmentList(true);
            } else {
                setVerifyStatus("Enrollment failed");
                alert(result.detail || "Enrollment gagal");
            }
        } catch (err) {
            console.error("Upload error:", err);
            setVerifyStatus("Upload failed");
        }
    };

    // Delete voice profile
    const handleDeleteVoice = async (voiceId: string) => {
        if (!token) return;

        if (!confirm("Hapus voice profile ini?")) return;

        try {
            // TODO: Implement API call to delete voice profile
            // await fetch(`${SERVER_URL}/voice-profiles/${voiceId}`, {
            //   method: 'DELETE',
            //   headers: { 'Authorization': `Bearer ${token}` },
            // });

            setEnrolledVoices((prev) => prev.filter((v) => v.id !== voiceId));
            setVerifyStatus("Voice profile deleted");
        } catch (err) {
            console.error("Delete error:", err);
        }
    };

    // Rename voice profile
    const handleRenameVoice = async (voiceId: string, newLabel: string) => {
        if (!token || !newLabel.trim()) return;

        try {
            // TODO: Implement API call to rename voice profile
            // await fetch(`${SERVER_URL}/voice-profiles/${voiceId}`, {
            //   method: 'PATCH',
            //   headers: {
            //     'Authorization': `Bearer ${token}`,
            //     'Content-Type': 'application/json',
            //   },
            //   body: JSON.stringify({ label: newLabel }),
            // });

            setEnrolledVoices((prev) =>
                prev.map((v) =>
                    v.id === voiceId ? { ...v, label: newLabel.trim() } : v,
                ),
            );
            setEditingId(null);
            setEditingLabel("");
        } catch (err) {
            console.error("Rename error:", err);
        }
    };

    // Format countdown as 00:XX
    const formatCountdown = (seconds: number) => {
        const secs = seconds.toString().padStart(2, "0");
        return `00:${secs}`;
    };

    return (
        <div className="space-y-3">
            {/* Label */}
            <label className="block text-sm font-medium text-[var(--text-secondary)]">
                Voice Enrollment
            </label>

            {/* Input */}
            <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Label / Nama Speaker"
                disabled={isRecording}
                className="w-full px-4 py-3 rounded-lg bg-[var(--input-bg)] 
                   text-(--text-primary) text-sm
                   placeholder:text-[var(--text-white-50)]
                   border-none outline-none
                   focus:ring-2 focus:ring-[var(--accent-primary)]/50
                   disabled:opacity-50"
            />

            {/* Enroll / Stop Button */}
            <button
                onClick={isRecording ? stopEnroll : startEnroll}
                disabled={
                    enrolledVoices.length >= MAX_ENROLLMENTS && !isRecording
                }
                className="w-full px-4 py-3 rounded-full font-medium text-sm
                   transition-all flex items-center justify-center gap-2
                   bg-[var(--accent-primary)] text-white 
                   hover:brightness-110 active:scale-[0.98]
                   disabled:opacity-50 disabled:cursor-not-allowed">
                <Image
                    src="/icons/Mic_Enroll.png" // path ke file kamu
                    alt="Mic"
                    width={16}
                    height={16}
                />
                <span>{isRecording ? "Stop Enroll" : "Enroll Voice"}</span>
            </button>

            {/* Recording Panel - Shows ONLY when recording */}
            {isRecording && (
                <div className="mt-4 p-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)]/20 animate-fadeIn">
                    {/* Countdown Timer */}
                    <div className="text-sm text-[var(--text-secondary)] mb-3">
                        {formatCountdown(countdown)}
                    </div>

                    {/* Sound Wave */}
                    <div className="flex justify-center mb-4">
                        <SoundWave />
                    </div>

                    {/* Text to Read */}
                    <div className="text-sm">
                        <span className="text-[var(--text-muted)]">Text:</span>
                        <p className="text-[var(--text-primary)] mt-1 leading-relaxed">
                            {ENROLLMENT_TEXTS[currentTextIndex]}
                        </p>
                    </div>
                </div>
            )}

            {/* Enrollment List Panel - Shows ONLY when showEnrollmentList is true AND not recording */}
            {showEnrollmentList && !isRecording && (
                <div className="mt-4 p-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)]/20 animate-fadeIn">
                    {/* Enrolled Voices List */}
                    {enrolledVoices.length > 0 ? (
                        <div className="space-y-1">
                            {enrolledVoices.map((voice) => (
                                <VoiceItem
                                    key={voice.id}
                                    voice={voice}
                                    isEditing={editingId === voice.id}
                                    editingLabel={editingLabel}
                                    onStartEdit={() => {
                                        setEditingId(voice.id);
                                        setEditingLabel(voice.label);
                                    }}
                                    onCancelEdit={() => {
                                        setEditingId(null);
                                        setEditingLabel("");
                                    }}
                                    onChangeLabel={setEditingLabel}
                                    onSaveEdit={() =>
                                        handleRenameVoice(
                                            voice.id,
                                            editingLabel,
                                        )
                                    }
                                    onDelete={() => handleDeleteVoice(voice.id)}
                                    inputRef={
                                        editingId === voice.id
                                            ? editInputRef
                                            : null
                                    }
                                />
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-[var(--text-muted)] text-center py-2">
                            Belum ada voice enrollment
                        </p>
                    )}

                    {/* Add New Button */}
                    {enrolledVoices.length < MAX_ENROLLMENTS && (
                        <button
                            onClick={startEnroll}
                            disabled={isRecording}
                            className="w-full mt-3 px-4 py-2.5 rounded-lg 
                         bg-[var(--accent-link)] text-white text-sm font-medium
                         hover:brightness-110 transition-all
                         disabled:opacity-30 disabled:cursor-not-allowed">
                            Add new
                        </button>
                    )}

                    {/* Max enrollment message */}
                    {enrolledVoices.length >= MAX_ENROLLMENTS && (
                        <p className="text-xs text-[var(--text-muted)] mt-3 text-center">
                            Maksimal {MAX_ENROLLMENTS} voice enrollment tercapai
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}

/* Voice Item Component */
interface VoiceItemProps {
    voice: { id: string; label: string };
    isEditing: boolean;
    editingLabel: string;
    onStartEdit: () => void;
    onCancelEdit: () => void;
    onChangeLabel: (label: string) => void;
    onSaveEdit: () => void;
    onDelete: () => void;
    inputRef: React.RefObject<HTMLInputElement | null> | null;
}

function VoiceItem({
    voice,
    isEditing,
    editingLabel,
    onStartEdit,
    onCancelEdit,
    onChangeLabel,
    onSaveEdit,
    onDelete,
    inputRef,
}: VoiceItemProps) {
    const [showMenu, setShowMenu] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Close menu when clicking outside
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

    if (isEditing) {
        return (
            <div className="flex items-center gap-2 py-2">
                <input
                    ref={inputRef}
                    type="text"
                    value={editingLabel}
                    onChange={(e) => onChangeLabel(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") onSaveEdit();
                        if (e.key === "Escape") onCancelEdit();
                    }}
                    onBlur={onSaveEdit}
                    className="flex-1 px-3 py-1.5 rounded-lg bg-[var(--bg-tertiary)] 
                     text-[var(--text-primary)] text-sm outline-none
                     border border-[var(--accent-primary)]"
                />
            </div>
        );
    }

    return (
        <div className="relative flex items-center justify-between py-2 group">
            <span className="text-[var(--text-primary)] text-sm">
                {voice.label}
            </span>

            {/* Three dots button */}
            <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-1 rounded hover:bg-[var(--bg-tertiary)] transition-colors">
                <ThreeDotsIcon />
            </button>

            {/* Dropdown Menu */}
            {showMenu && (
                <div
                    ref={menuRef}
                    className="absolute right-0 top-full mt-1 w-32 bg-[var(--bg-tertiary)] 
                     rounded-lg shadow-lg overflow-hidden z-50 animate-fadeIn
                     border border-[var(--border-color)]/20">
                    <button
                        onClick={() => {
                            onStartEdit();
                            setShowMenu(false);
                        }}
                        className="w-full px-4 py-2.5 flex items-center gap-2 text-sm text-[var(--text-primary)]
                       hover:bg-[var(--bg-card)] transition-colors">
                        <RenameIcon />
                        <span>Rename</span>
                    </button>
                    <button
                        onClick={() => {
                            onDelete();
                            setShowMenu(false);
                        }}
                        className="w-full px-4 py-2.5 flex items-center gap-2 text-sm text-red-400
                       hover:bg-[var(--bg-card)] transition-colors">
                        <MdDelete className="w-5 h-5" />
                        <span>Delete</span>
                    </button>
                </div>
            )}
        </div>
    );
}

/* Icons */
function KeyIcon() {
    return (
        <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round">
            <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
        </svg>
    );
}

function ThreeDotsIcon() {
    return (
        <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="text-[var(--text-muted)]">
            <circle cx="12" cy="5" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="12" cy="19" r="2" />
        </svg>
    );
}

function RenameIcon() {
    return (
        <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
        </svg>
    );
}

function DeleteIcon() {
    return (
        <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round">
            <polyline points="3,6 5,6 21,6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
    );
}
