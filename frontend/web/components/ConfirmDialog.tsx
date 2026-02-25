"use client";

// Generic confirmation dialog used for delete, logout, and warning flows.

import { useEffect, useRef } from "react";
import { IoLogOut, IoTrash, IoWarning } from "react-icons/io5";

type DialogType = "delete" | "logout" | "warning";

interface ConfirmDialogProps {
    isOpen: boolean;
    type?: DialogType;
    title: string;
    message: string;
    highlightText?: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
    onCancel: () => void;
    isLoading?: boolean;
}

export default function ConfirmDialog({
    isOpen,
    type = "warning",
    title,
    message,
    highlightText,
    confirmText = "Confirm",
    cancelText = "Cancel",
    onConfirm,
    onCancel,
    isLoading = false,
}: ConfirmDialogProps) {
    const dialogRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === "Escape" && isOpen) {
                onCancel();
            }
        };

        document.addEventListener("keydown", handleEscape);
        return () => document.removeEventListener("keydown", handleEscape);
    }, [isOpen, onCancel]);

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => {
            document.body.style.overflow = "";
        };
    }, [isOpen]);

    if (!isOpen) return null;

    const getIcon = () => {
        switch (type) {
            case "delete":
                return <IoTrash size={28} />;
            case "logout":
                return <IoLogOut size={28} />;
            default:
                return <IoWarning size={28} />;
        }
    };

    const getIconBgColor = () => {
        switch (type) {
            case "delete":
                return "bg-(--accent-primary) text-(--text-primary)";
            case "logout":
                return "bg-(--accent-primary) text-(--text-primary)";
            default:
                return "bg-(--accent-primary) text-yellow-400";
        }
    };

    const getConfirmButtonColor = () => {
        switch (type) {
            case "delete":
                return "bg-red-500 hover:bg-red-600";
            case "logout":
                return "bg-red-500 hover:bg-orange-600";
            default:
                return "bg-[var(--accent-primary)] hover:brightness-110";
        }
    };

    return (
        <div className="fixed inset-0 z-100 flex items-center justify-center">
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onCancel}
            />

            <div
                ref={dialogRef}
                className="relative z-10 w-full max-w-sm mx-4 p-6 rounded-2xl 
                           bg-(--bg-secondary) border border-(--border-color)/20
                           shadow-2xl animate-fadeIn">
                <div className="flex justify-center mb-4">
                    <div
                        className={`w-14 h-14 rounded-full flex items-center justify-center ${getIconBgColor()}`}>
                        {getIcon()}
                    </div>
                </div>

                <h2 className="text-xl font-semibold text-(--text-primary) text-center mb-2">
                    {title}
                </h2>

                <p className="text-sm text-(--text-secondary) text-center mb-6">
                    {message}
                    {highlightText && (
                        <>
                            <span className="font-semibold text-(--text-primary)">
                                {highlightText}
                            </span>
                        </>
                    )}
                </p>

                <div className="flex gap-3">
                    <button
                        onClick={onCancel}
                        disabled={isLoading}
                        className="flex-1 px-4 py-3 rounded-xl font-medium text-sm
                                   bg-(--bg-tertiary) text-(--text-primary)
                                   hover:bg-(--bg-card) transition-all
                                   disabled:opacity-50 disabled:cursor-not-allowed">
                        {cancelText}
                    </button>

                    <button
                        onClick={onConfirm}
                        disabled={isLoading}
                        className={`flex-1 px-4 py-3 rounded-xl font-medium text-sm
                                   text-white transition-all
                                   disabled:opacity-50 disabled:cursor-not-allowed
                                   ${getConfirmButtonColor()}`}>
                        {isLoading ? (
                            <span className="flex items-center justify-center gap-2">
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Loading...
                            </span>
                        ) : (
                            confirmText
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
