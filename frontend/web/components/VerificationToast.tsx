// components/VerificationToast.tsx
"use client";

import { useEffect, useState } from "react";
import { IoCheckmarkCircle, IoCloseCircle, IoWarning } from "react-icons/io5";

type VerificationStatus = "VERIFIED" | "REPEAT" | "DENIED" | null;

interface VerificationToastProps {
  status: VerificationStatus;
  score?: number | null;
  reason?: string | null;
  onClose: () => void;
}

export default function VerificationToast({
  status,
  score,
  reason,
  onClose,
}: VerificationToastProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (status) {
      setIsVisible(true);

      // Auto-hide after 5 seconds
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(onClose, 300);
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [status, onClose]);

  if (!status) return null;

  const config = {
    VERIFIED: {
      icon: <IoCheckmarkCircle size={24} />,
      title: "Voice Verified ✓",
      bgColor: "bg-green-500",
      borderColor: "border-green-400",
    },
    REPEAT: {
      icon: <IoWarning size={24} />,
      title: "Coba Lagi",
      bgColor: "bg-yellow-500",
      borderColor: "border-yellow-400",
    },
    DENIED: {
      icon: <IoCloseCircle size={24} />,
      title: "Verifikasi Gagal",
      bgColor: "bg-red-500",
      borderColor: "border-red-400",
    },
  };

  const currentConfig = config[status];

  const scoreText =
    score !== null && score !== undefined
      ? `Similarity: ${(score * 100).toFixed(1)}%`
      : null;

  const displayReason = reason || getDefaultReason(status);

  return (
    <div
      className={`fixed top-4 right-4 z-50 
                  transform transition-all duration-300 ease-out
                  ${isVisible ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"}`}
    >
      <div
        className={`flex items-start gap-3 px-4 py-3 rounded-xl 
                    ${currentConfig.bgColor} text-white shadow-lg
                    border-l-4 ${currentConfig.borderColor}
                    min-w-75 max-w-100`}
      >
        {/* Icon */}
        <div className="shrink-0 mt-0.5">{currentConfig.icon}</div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">{currentConfig.title}</p>

          {/* Score */}
          {scoreText && (
            <p className="text-xs opacity-90 mt-0.5">{scoreText}</p>
          )}

          {/* Reason */}
          {displayReason && (
            <p className="text-xs opacity-80 mt-1 leading-relaxed">
              {displayReason}
            </p>
          )}
        </div>

        {/* Close Button */}
        <button
          onClick={() => {
            setIsVisible(false);
            setTimeout(onClose, 300);
          }}
          className="shrink-0 p-1 hover:bg-white/20 rounded-full transition-colors"
        >
          <IoCloseCircle size={18} />
        </button>
      </div>
    </div>
  );
}

function getDefaultReason(status: VerificationStatus): string {
  switch (status) {
    case "VERIFIED":
      return "Suara berhasil diverifikasi";
    case "REPEAT":
      return "Suara kurang jelas, silakan ulangi";
    case "DENIED":
      return "Suara tidak dikenali";
    default:
      return "";
  }
}
