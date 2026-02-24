// components/MessageBubble.tsx
"use client";

import Image from "next/image";
import { Message } from "@/types";

interface MessageBubbleProps {
  message: Message;
  userName?: string;
}

export default function MessageBubble({
  message,
  userName = "You",
}: MessageBubbleProps) {
  const { role, text } = message;
  const isUser = role === "user";

  return (
    <div
      className={`flex gap-3 animate-fadeIn ${
        isUser ? "justify-end" : "justify-start"
      }`}
    >
      <div className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}>
        <div className="flex items-center gap-2 mb-1">
          {!isUser && (
            <Image
              src="/icons/Happy_Polos.png"
              alt="Happy"
              width={14}
              height={14}
              style={{ width: "auto", height: "auto" }}
              className="opacity-70"
            />
          )}
          <span className="text-sm text-(--text-secondary)">
            {isUser ? userName : "Happy"}
          </span>
        </div>

        <div
          className={`px-4 py-3 rounded-2xl max-w-4xl break-words ${
            isUser
              ? "bg-(--accent-primary) text-(--text-primary) rounded-br-md"
              : "bg-(--bubble-agent) text-(--text-primary) rounded-bl-md"
          }`}
        >
          <p className="text-base leading-relaxed">{text}</p>
        </div>
      </div>
    </div>
  );
}
