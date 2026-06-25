'use client';

import { MODELS, type ModelKey } from './types';

interface Props {
  model: ModelKey;
  onChange: (model: ModelKey) => void;
}

export function ModelSelector({ model, onChange }: Props) {
  return (
    <div className="flex items-center gap-1.5">
      {MODELS.map((m) => (
        <button
          key={m.key}
          type="button"
          onClick={() => m.available && onChange(m.key)}
          disabled={!m.available}
          title={m.available ? m.cost : 'Sap ra mat'}
          className={`relative px-3 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
            model === m.key
              ? 'bg-markee-primary text-white shadow-sm'
              : m.available
                ? 'text-markee-muted hover:bg-markee-bg border border-markee-border'
                : 'text-markee-sub/40 border border-markee-border/50 cursor-not-allowed'
          }`}
        >
          {m.name}
          {!m.available && (
            <span className="absolute -top-1 -right-1 text-[8px] bg-amber-100 text-amber-700 px-1 rounded-full leading-tight">
              Soon
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
