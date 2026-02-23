"use client";

interface StatusDisplayProps {
  verifyStatus: string;
  roomStatus: string;
  score: number | null;
}

export default function StatusDisplay({
  verifyStatus,
  roomStatus,
  score,
}: StatusDisplayProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-[0.8rem] font-semibold text-gray-500 uppercase tracking-wide mb-1">
        Status Verifikasi
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-3 text-sm text-gray-700">
        {verifyStatus}
      </div>

      {score !== null && (
        <div className="bg-white border border-black rounded-lg px-3 py-3 text-sm text-black font-semibold">
          📊 Similarity Score: {(score * 100).toFixed(2)}%
        </div>
      )}

      <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-3 text-xs text-gray-600 opacity-80">
        {roomStatus}
      </div>
    </div>
  );
}
