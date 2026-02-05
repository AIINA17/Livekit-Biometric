// components/LiveKitControls.tsx
'use client';

import { useState } from 'react';
import { useLiveKit } from '@/hooks/useLiveKit';
import { Product } from '@/types';
import ProductCards from './ProductCards';

interface LiveKitControlsProps {
  token: string | null;
  isConnected: boolean;
  setIsConnected: (value: boolean) => void;
  setRoomStatus: (status: string) => void;
  setVerifyStatus: (status: string) => void;
  setScore: (score: number | null) => void;
  setIsAgentSpeaking: (value: boolean) => void;
  addMessage: (role: "user" | "assistant", text: string) => void;
}

export default function LiveKitControls({
  token,
  isConnected,
  setIsConnected,
  setRoomStatus,
  setVerifyStatus,
  setScore,
  setIsAgentSpeaking,
  addMessage,
}: LiveKitControlsProps) {
  const [products, setProducts] = useState<Product[]>([]);

  const { joinRoom, leaveRoom } = useLiveKit({
    token,
    onMessage: addMessage,
    onProductCards: setProducts,
    onVerifyStatus: setVerifyStatus,
    onRoomStatus: setRoomStatus,
    onScore: setScore,
    onAgentSpeaking: setIsAgentSpeaking,
  });

  return (
    <>
      <div className="flex flex-col gap-2">
        <div className="text-[0.8rem] font-semibold text-gray-500 uppercase tracking-wide mb-1">
          LiveKit Room
        </div>
        <div className="flex gap-2.5">
          <button
            onClick={joinRoom}
            disabled={isConnected}
            className="flex-1 px-3 py-3 rounded-lg border border-gray-200 bg-white text-gray-900 font-semibold text-sm hover:bg-gray-50 hover:border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-all cursor-pointer"
          >
            Join Room
          </button>
          <button
            onClick={leaveRoom}
            disabled={!isConnected}
            className="flex-1 px-3 py-3 rounded-lg border border-red-200 text-red-500 font-semibold text-sm hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-all"
          >
            Leave
          </button>
        </div>
      </div>

      {/* Product Cards - Show inline if any */}
      {products.length > 0 && (
        <div className="mt-4">
          <ProductCards products={products} />
        </div>
      )}
    </>
  );
}