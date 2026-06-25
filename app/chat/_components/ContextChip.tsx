'use client';

import { Paperclip } from 'lucide-react';

interface Props {
  assetId: number;
  assetTitle: string;
}

export function ContextChip({ assetTitle }: Props) {
  return (
    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-[10px] text-blue-700 font-medium">
      <Paperclip className="w-2.5 h-2.5" />
      <span className="truncate max-w-[120px]">{assetTitle}</span>
    </div>
  );
}
