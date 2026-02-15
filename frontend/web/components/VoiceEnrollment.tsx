"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { MdModeEdit, MdDelete } from "react-icons/md";
import { PiMicrophoneStage } from "react-icons/pi";
import { IoEllipsisVertical } from "react-icons/io5";
import SoundWave from "./SoundWave";

const ENROLLMENT_TEXTS = [
    "Kami putra dan putri Indonesia, mengaku bertumpah darah yang satu, tanah air Indonesia.",
    "Kami putra dan putri Indonesia, mengaku berbangsa yang satu, bangsa Indonesia.",
    "Kami putra dan putri Indonesia, menjunjung bahasa persatuan, bahasa Indonesia.",
];

const RECORDING_DURATION = 10;

interface VoiceProfile {
    id: string;
    label: string;
    created_at: string;
}

interface Props {
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
}: Props) {
    const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL;
    const MAX_ENROLLMENTS = 3;

    const [label, setLabel] = useState("");
    const [isRecording, setIsRecording] = useState(false);
    const [enrolledVoices, setEnrolledVoices] = useState<VoiceProfile[]>([]);
    const [countdown, setCountdown] = useState(RECORDING_DURATION);
    const [currentTextIndex, setCurrentTextIndex] = useState(0);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingLabel, setEditingLabel] = useState("");

    const recorderRef = useRef<MediaRecorder | null>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const editInputRef = useRef<HTMLInputElement | null>(null);

    /* =========================
        FETCH ENROLLMENTS
    ========================== */

    const fetchEnrolledVoices = useCallback(async () => {
        if (!token) return;

        try {
            const res = await fetch(`${SERVER_URL}/enrollments`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            const result = await res.json();

            if (result.status === "OK") {
                setEnrolledVoices(result.enrollments || []);
            }
        } catch (err) {
            console.error("Fetch enrollments error:", err);
        }
    }, [token, SERVER_URL]);

    useEffect(() => {
        if (!token) return;

        let isMounted = true;

        (async () => {
            try {
                const res = await fetch(`${SERVER_URL}/enrollments`, {
                    headers: { Authorization: `Bearer ${token}` },
                });

                const result = await res.json();

                if (isMounted && result.status === "OK") {
                    setEnrolledVoices(result.enrollments || []);
                }
            } catch (err) {
                console.error("Initial fetch error:", err);
            }
        })();

        return () => {
            isMounted = false;
        };
    }, [token, SERVER_URL]);

    /* =========================
        ECORDING
    ========================== */

    const stopEnroll = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        if (recorderRef.current?.state === "recording") {
            recorderRef.current.stop();
        }
    };

    const startEnroll = async () => {
        if (!token) return alert("Login dulu sebelum enroll");
        if (!label.trim()) return alert("Masukkan nama terlebih dahulu");
        if (enrolledVoices.length >= MAX_ENROLLMENTS)
            return alert("Maksimal 3 enrollment");

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
                stream.getTracks().forEach((t) => t.stop());
                setIsRecording(false);
                setCountdown(RECORDING_DURATION);

                const blob = new Blob(chunks, {
                    type: "audio/webm;codecs=opus",
                });

                await uploadEnrollment(blob);
            };

            recorder.start();
            setIsRecording(true);
            setVerifyStatus("Recording...");

            timerRef.current = setInterval(() => {
                setCountdown((prev) => {
                    if (prev <= 1) {
                        stopEnroll();
                        return RECORDING_DURATION;
                    }
                    return prev - 1;
                });
            }, 1000);
        } catch (err) {
            console.error(err);
            alert("Mic access failed");
        }
    };

    /* =========================
        UPLOAD
    ========================== */

    const uploadEnrollment = async (blob: Blob) => {
        if (!token) return;

        setVerifyStatus("Uploading enrollment...");

        const form = new FormData();
        form.append("label", label);
        form.append("audio", blob, "enroll.webm");

        try {
            const res = await fetch(`${SERVER_URL}/enroll-voice`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
                body: form,
            });

            const result = await res.json();

            if (result.status === "OK") {
                setVerifyStatus("Enrollment successful!");
                setLabel("");
                setCurrentTextIndex(
                    (prev) => (prev + 1) % ENROLLMENT_TEXTS.length,
                );
                setShowEnrollmentList(true);
                await fetchEnrolledVoices();
            } else {
                alert(result.detail || "Enrollment gagal");
            }
        } catch (err) {
            console.error("Upload error:", err);
        }
    };

    /* =========================
        DELETE
    ========================== */

    const handleDeleteVoice = async (voiceId: string) => {
        if (!token) return;
        if (!confirm("Hapus voice profile ini?")) return;

        try {
            const res = await fetch(`${SERVER_URL}/enrollments/${voiceId}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
            });

            const result = await res.json();

            if (result.status === "OK") {
                await fetchEnrolledVoices();
            } else {
                alert(result.detail || "Delete failed");
            }
        } catch (err) {
            console.error("Delete error:", err);
        }
    };

    /* =========================
       RENAME
    ========================== */

    const handleRenameVoice = async (voiceId: string, newLabel: string) => {
        if (!token || !newLabel.trim()) return;

        try {
            const res = await fetch(`${SERVER_URL}/speakers/${voiceId}/label`, {
                method: "PATCH",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ label: newLabel.trim() }),
            });

            const result = await res.json();

            if (result.status === "OK") {
                await fetchEnrolledVoices();
                setEditingId(null);
            } else {
                alert(result.detail || "Rename failed");
            }
        } catch (err) {
            console.error("Rename error:", err);
        }
    };

    /* =========================
       UI
    ========================== */

    return (
        <div className="space-y-3">
            <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Label / Nama Speaker"
                disabled={isRecording}
                className="w-full px-4 py-3 rounded-lg"
            />

            <button
                onClick={isRecording ? stopEnroll : startEnroll}
                disabled={
                    enrolledVoices.length >= MAX_ENROLLMENTS && !isRecording
                }
                className="w-full px-4 py-3 rounded-xl flex items-center justify-center gap-2 bg-blue-600 text-white">
                <PiMicrophoneStage />
                {isRecording ? "Stop Enroll" : "Enroll Voice"}
            </button>

            {isRecording && (
                <div className="p-4 border rounded-xl">
                    <div>00:{countdown.toString().padStart(2, "0")}</div>
                    <SoundWave />
                    <p>{ENROLLMENT_TEXTS[currentTextIndex]}</p>
                </div>
            )}

            {showEnrollmentList && !isRecording && (
                <div className="p-4 border rounded-xl">
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
                            onCancelEdit={() => setEditingId(null)}
                            onChangeLabel={setEditingLabel}
                            onSaveEdit={() =>
                                handleRenameVoice(voice.id, editingLabel)
                            }
                            onDelete={() => handleDeleteVoice(voice.id)}
                            inputRef={editInputRef}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

/* =========================
   Voice Item
========================= */
interface VoiceItemProps {
    voice: VoiceProfile;
    isEditing: boolean;
    editingLabel: string;
    onStartEdit: () => void;
    onCancelEdit: () => void;
    onChangeLabel: (value: string) => void;
    onSaveEdit: () => void;
    onDelete: () => void;
    inputRef: React.RefObject<HTMLInputElement | null>;
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
    const menuRef = useRef<HTMLDivElement | null>(null);
    const renameRef = useRef<HTMLDivElement | null>(null);

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

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [showMenu]);

    useEffect(() => {
        if (!isEditing) return;

        const handleClickOutside = (event: MouseEvent) => {
            if (
                renameRef.current &&
                !renameRef.current.contains(event.target as Node)
            ) {
                onCancelEdit();
            }
        };

        document.addEventListener("mousedown", handleClickOutside);

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isEditing, onCancelEdit]);

    if (isEditing) {
        return (
            <div ref={renameRef} className="py-2 space-y-2">
                <input
                    ref={inputRef}
                    type="text"
                    value={editingLabel}
                    onChange={(e) => onChangeLabel(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") onSaveEdit();
                        if (e.key === "Escape") onCancelEdit();
                    }}
                    className="w-full px-3 py-2 rounded-lg
                            bg-[#1f1f1f]
                            text-white text-sm
                            border border-blue-500/60
                            focus:ring-2 focus:ring-blue-500/40
                            outline-none"
                />

                <div className="flex justify-end gap-2">
                    <button
                        onClick={onCancelEdit}
                        className="px-3 py-1.5 text-xs font-medium
                                bg-white/10 hover:bg-white/20
                                text-gray-300 rounded-lg transition">
                        Cancel
                    </button>

                    <button
                        onClick={onSaveEdit}
                        disabled={!editingLabel.trim()}
                        className="px-3 py-1.5 text-xs font-medium
                                bg-blue-600 hover:bg-blue-700
                                disabled:opacity-40 disabled:cursor-not-allowed
                                text-white rounded-lg transition">
                        Save
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex justify-between items-center py-2">
            <span>{voice.label}</span>

            <div className="relative">
                <button onClick={() => setShowMenu(!showMenu)}>
                    <IoEllipsisVertical />
                </button>

                {showMenu && (
                    <div
                        ref={menuRef}
                        className="absolute right-0 top-full mt-2 w-36
                                bg-[#1f1f1f]
                                border border-white/10
                                rounded-xl
                                shadow-xl
                                overflow-hidden
                                z-50">
                        <button
                            onClick={() => {
                                onStartEdit();
                                setShowMenu(false);
                            }}
                            className="w-full px-4 py-3 flex items-center gap-3
                                    text-sm text-white
                                    hover:bg-white/10
                                    transition-colors">
                            <MdModeEdit className="w-4 h-4 text-gray-300" />
                            <span>Rename</span>
                        </button>

                        <button
                            onClick={() => {
                                onDelete();
                                setShowMenu(false);
                            }}
                            className="w-full px-4 py-3 flex items-center gap-3
                                        text-sm text-red-400
                                        hover:bg-red-500/15
                                        transition-colors">
                            <MdDelete className="w-4 h-4 text-red-400" />
                            <span>Delete</span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
