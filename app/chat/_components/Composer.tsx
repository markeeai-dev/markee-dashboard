'use client';

import { Send } from 'lucide-react';
import { useRef, useCallback } from 'react';

interface Props {
  input: string;
  isLoading: boolean;
  onInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
}

const HINTS = [
  'Phan tich doi thu canh tranh cho [san pham]',
  'Viet proposal cho khach hang [ten]',
  'Bao cao tuan team [ten team]',
  'Email follow-up cho [khach hang]',
];

export function Composer({ input, isLoading, onInputChange, onSubmit, onInputValueChange }: Props & { onInputValueChange?: (v: string) => void }) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 100)}px`;
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    onInputChange(e);
    onInputValueChange?.(e.target.value);
    autoResize();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !isLoading) {
        onSubmit(e as unknown as React.FormEvent);
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
        }
      }
    }
  }

  function applyHint(hint: string) {
    const el = textareaRef.current;
    if (!el) return;
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      'value'
    )?.set;
    nativeInputValueSetter?.call(el, hint);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    onInputValueChange?.(hint);
    autoResize();
    el.focus();
  }

  return (
    <div className="p-4 bg-white border-t border-markee-border">
      <div className="flex flex-wrap gap-1.5 mb-3">
        {HINTS.map((hint) => (
          <button
            key={hint}
            type="button"
            onClick={() => applyHint(hint)}
            className="text-[10px] px-2.5 py-1 rounded-full bg-markee-bg text-markee-muted hover:bg-markee-border/50 hover:text-markee-text transition-colors cursor-pointer truncate max-w-[220px]"
          >
            {hint}
          </button>
        ))}
      </div>

      <form onSubmit={onSubmit} className="flex items-end gap-2">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Nhap message... (Enter gui, Shift+Enter xuong dong)"
            rows={1}
            className="w-full resize-none rounded-xl border border-markee-border bg-markee-bg/50 px-4 py-2.5 text-sm text-markee-text placeholder:text-markee-sub focus:outline-none focus:border-markee-primary/40 focus:ring-1 focus:ring-markee-primary/10 transition-all"
          />
        </div>
        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          className="shrink-0 w-9 h-9 flex items-center justify-center rounded-xl bg-markee-primary text-white hover:bg-markee-hover disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>

      <div className="flex items-center justify-between mt-2">
        <span className="text-[10px] text-markee-sub">
          Model: <span className="font-semibold text-markee-primary">Gemini 2.0 Flash</span>
        </span>
        <span className="text-[10px] text-markee-sub">Mien phi</span>
      </div>
    </div>
  );
}
