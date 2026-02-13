'use client';

export default function TypingIndicator() {
  return (
    <div className="flex gap-3 self-start max-w-[80%] animate-fadeIn">
      
      <div className="w-9 h-9 rounded-full flex items-center justify-center text-base flex-shrink-0 bg-gray-100 border border-gray-200 text-black">
        🤖
      </div>

      
      <div className="flex flex-col gap-1 items-start">
        <div className="text-[0.7rem] font-semibold uppercase tracking-wider text-gray-500 mb-1">
          AI Assistant
        </div>

        <div className="px-4 py-3 rounded-2xl bg-gray-100 border border-gray-200 rounded-bl">
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-typing"
                style={{ animationDelay: `${i * 0.2}s` }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}