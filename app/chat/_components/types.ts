export type ModelKey = 'claude' | 'gpt4o' | 'mini' | 'gemini';

export interface ModelDef {
  key: ModelKey;
  name: string;
  cost: string;
  available: boolean;
}

export const MODELS: ModelDef[] = [
  { key: 'claude', name: 'Claude Sonnet', cost: '~$0.003/msg', available: false },
  { key: 'gpt4o', name: 'GPT-4o', cost: '~$0.005/msg', available: false },
  { key: 'mini', name: 'GPT-4o mini', cost: '~$0.001/msg', available: false },
  { key: 'gemini', name: 'Gemini 2.0 Flash', cost: 'Mien phi', available: true },
];

export interface Conversation {
  id: string;
  user_id: string;
  title: string;
  project_id: number | null;
  model: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  injected_assets: { id: number; title: string }[];
  created_at: string;
}

export interface InjectedAsset {
  id: number;
  title: string;
  category: string;
  used: number;
}
