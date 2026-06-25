'use client';

export function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-4 py-2">
      <div className="flex items-center gap-1">
        <span className="w-2 h-2 rounded-full bg-markee-primary/40 animate-bounce-dot-1" />
        <span className="w-2 h-2 rounded-full bg-markee-primary/40 animate-bounce-dot-2" />
        <span className="w-2 h-2 rounded-full bg-markee-primary/40 animate-bounce-dot-3" />
      </div>
      <span className="text-[11px] text-markee-sub ml-2">Dang phan hoi...</span>
    </div>
  );
}
