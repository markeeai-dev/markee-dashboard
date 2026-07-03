'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Plus, Folder, X, Send, Search } from 'lucide-react';

interface Project {
  id: number;
  name: string;
}

interface FolderItem {
  id: number;
  name: string;
}

interface ChatInputProps {
  inputValue: string;
  setInputValue: (val: string) => void;
  onSendMessage: () => void;
  isGenerating: boolean;
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  disabledModels: Set<string>;
  hiddenContext: { title: string; content: string } | null;
  setHiddenContext?: (ctx: { title: string; content: string } | null) => void;
  activeSession: { id: string; project_id?: number | null } | null;
  onUpdateSessionProject: (sessionId: string, projectId: number | null) => Promise<void>;
  personalFolders: FolderItem[];
  projects: Project[];
  departments: { id: number; name: string }[];
  teams: { id: number; name: string; department_id: number }[];
  skills: { id: number; title: string; team_id: number; markdown_content: string }[];
  hideProjectSelector?: boolean;
  onOpenSkillModal?: () => void;
  pendingKnowledgeProjectName?: string | null;
  onClearPendingKnowledgeProjectName?: () => void;
}

export default function ChatInput({
  inputValue,
  setInputValue,
  onSendMessage,
  isGenerating,
  selectedModel,
  setSelectedModel,
  disabledModels,
  hiddenContext,
  setHiddenContext,
  activeSession,
  onUpdateSessionProject,
  personalFolders,
  projects,
  departments,
  teams,
  skills,
  hideProjectSelector = false,
  onOpenSkillModal,
  pendingKnowledgeProjectName = null,
  onClearPendingKnowledgeProjectName,
}: ChatInputProps) {
  const [isPlusMenuOpen, setIsPlusMenuOpen] = useState(false);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [projectSearchQuery, setProjectSearchQuery] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const searchParams = useSearchParams();
  const sessionIdParam = searchParams?.get('session_id');
  const isNewChatMode = !sessionIdParam && (!activeSession || activeSession.id === 'pending');

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [inputValue]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSendMessage();
    }
  };

  const handleInjectKnowledge = (title: string, content: string) => {
    if (setHiddenContext) {
      setHiddenContext({ title, content });
    }
    setIsPlusMenuOpen(false);
  };

  return (
    <div className="border-t border-slate-100 p-4 shrink-0 bg-white relative">
      {/* Plus Menu Popover */}
      {isPlusMenuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsPlusMenuOpen(false)} />
          <div className="absolute left-4 bottom-16 z-50 w-52 bg-white border border-slate-200 rounded-2xl shadow-xl py-1.5 animate-in slide-in-from-bottom-2 duration-200">
            {!hideProjectSelector && (
              <button
                type="button"
                onClick={() => {
                  setIsProjectModalOpen(true);
                  setIsPlusMenuOpen(false);
                }}
                className="w-full text-left px-4 py-2.5 text-xs text-slate-700 hover:text-slate-900 hover:bg-slate-50 font-semibold flex items-center justify-between cursor-pointer bg-transparent border-0 transition-colors"
              >
                <span>Liên kết Dự án</span>
                <span className="text-[10px] text-slate-400 font-bold">➔</span>
              </button>
            )}

            {onOpenSkillModal && (
              <button
                type="button"
                onClick={() => {
                  onOpenSkillModal();
                  setIsPlusMenuOpen(false);
                }}
                className="w-full text-left px-4 py-2.5 text-xs text-slate-700 hover:text-slate-900 hover:bg-slate-50 font-semibold flex items-center justify-between cursor-pointer bg-transparent border-0 transition-colors"
              >
                <span>Thêm Skill</span>
                <span className="text-[10px] text-slate-400 font-bold">➔</span>
              </button>
            )}

            {/* Tri thức từ Skills Library */}
            <div className="border-t border-slate-100 my-1" />
            <div className="px-4 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Tái sử dụng nhanh
            </div>
            <div className="max-h-40 overflow-y-auto">
              {skills.map((skill) => (
                <button
                  key={skill.id}
                  type="button"
                  onClick={() => handleInjectKnowledge(skill.title, skill.markdown_content)}
                  className="w-full text-left px-4 py-2 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-medium truncate cursor-pointer bg-transparent border-0 transition-colors block text-left"
                  title={skill.title}
                >
                  📄 {skill.title}
                </button>
              ))}
              {skills.length === 0 && (
                <div className="px-4 py-2 text-[10px] text-slate-400">Không có skill được duyệt</div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Hidden Context Badge (Only render in new chat creation mode) */}
      {isNewChatMode && hiddenContext && (
        <div className="max-w-4xl mx-auto mb-2 flex items-center gap-2">
          <div className="inline-flex items-center gap-1.5 bg-indigo-50 border border-indigo-100 text-indigo-800 text-[11px] font-semibold px-2.5 py-1 rounded-xl shadow-3xs max-w-full">
            <span>🧠 Tri thức:</span>
            <span className="truncate max-w-[200px] md:max-w-md font-bold">{hiddenContext.title}</span>
            <button
              type="button"
              onClick={() => setHiddenContext && setHiddenContext(null)}
              className="hover:bg-indigo-100 p-0.5 rounded-full cursor-pointer ml-1 flex items-center justify-center border-0 bg-transparent text-indigo-500 hover:text-indigo-800 transition-colors font-bold text-[10px]"
              title="Gỡ tri thức này"
            >
              ✕
            </button>
          </div>
          
          {pendingKnowledgeProjectName && (
            <div className="inline-flex items-center gap-1.5 bg-rose-50 border border-rose-100 text-rose-800 text-[11px] font-semibold px-2.5 py-1 rounded-xl shadow-3xs max-w-full">
              <span>📁 Dự án:</span>
              <span className="truncate max-w-[150px] md:max-w-xs font-bold">{pendingKnowledgeProjectName}</span>
              <button
                type="button"
                onClick={() => onClearPendingKnowledgeProjectName && onClearPendingKnowledgeProjectName()}
                className="hover:bg-rose-100 p-0.5 rounded-full cursor-pointer ml-1 flex items-center justify-center border-0 bg-transparent text-rose-500 hover:text-rose-800 transition-colors font-bold text-[10px]"
                title="Gỡ dự án tri thức"
              >
                ✕
              </button>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 max-w-4xl mx-auto border border-slate-200 focus-within:border-markee-primary rounded-2xl bg-slate-50 p-2 transition-all relative">
        {/* Nút icon Plus */}
        <button
          type="button"
          onClick={() => setIsPlusMenuOpen(!isPlusMenuOpen)}
          className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 transition-colors shrink-0 cursor-pointer border-0 bg-transparent"
          title="Thêm..."
        >
          <Plus className="h-4 w-4" />
        </button>

        {/* Badge Dự án đang chọn */}
        {isNewChatMode && !hideProjectSelector && activeSession?.project_id && (
          <div className="flex items-center gap-1 bg-slate-200/70 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-lg shadow-3xs max-w-[150px] truncate shrink-0 border border-slate-200/80">
            <Folder className="w-3 h-3 text-slate-500 shrink-0" />
            <span className="truncate">
              {(personalFolders.find(p => p.id === activeSession.project_id) || projects.find(p => p.id === activeSession.project_id))?.name || 'Dự án'}
            </span>
            <button
              type="button"
              onClick={() => onUpdateSessionProject(activeSession.id, null)}
              className="hover:bg-slate-300/80 p-0.5 rounded-full cursor-pointer ml-1 flex items-center justify-center border-0 bg-transparent text-slate-500 hover:text-slate-800 transition-colors"
              title="Gỡ khỏi Dự án"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </div>
        )}

        {/* Khung nhập Text */}
        <textarea
          ref={textareaRef}
          rows={1}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Hỏi đáp về tri thức dự án hoặc SOP..."
          className="flex-1 resize-none border-0 bg-transparent text-xs text-slate-800 focus:ring-0 focus:outline-none p-2 leading-relaxed max-h-40 min-h-9 outline-none"
        />

        {/* Dropdown chọn Model */}
        <select
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
          className="text-xs bg-slate-100 border-none rounded p-1.5 text-slate-700 outline-none focus:ring-1 focus:ring-markee-primary cursor-pointer shrink-0 max-w-[140px] truncate"
        >
          <option value="claude-haiku-4-5-20251001" disabled={disabledModels.has('claude-haiku-4-5-20251001')}>
            Claude 4.5 Haiku {disabledModels.has('claude-haiku-4-5-20251001') && '(Lỗi)'}
          </option>
          <option value="gpt-4o-mini" disabled={disabledModels.has('gpt-4o-mini')}>
            GPT-4o Mini {disabledModels.has('gpt-4o-mini') && '(Lỗi)'}
          </option>
          <option value="google/gemini-3.5-flash" disabled={disabledModels.has('google/gemini-3.5-flash')}>
            Gemini 3.5 Flash {disabledModels.has('google/gemini-3.5-flash') && '(Lỗi)'}
          </option>
          <option value="google/gemini-3.1-flash-lite" disabled={disabledModels.has('google/gemini-3.1-flash-lite')}>
            Gemini 3.1 Lite {disabledModels.has('google/gemini-3.1-flash-lite') && '(Lỗi)'}
          </option>
          <option value="openrouter/free" disabled={disabledModels.has('openrouter/free')}>
            Auto (Free) {disabledModels.has('openrouter/free') && '(Lỗi)'}
          </option>
        </select>

        {/* Nút Send */}
        <button
          type="button"
          disabled={!inputValue.trim() || isGenerating}
          onClick={onSendMessage}
          className="rounded-xl bg-markee-primary hover:bg-markee-hover disabled:bg-slate-200 text-white p-2.5 transition-colors cursor-pointer disabled:cursor-not-allowed shrink-0 shadow-sm border-0 flex items-center justify-center"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>

      {/* Modal 1: Chọn Dự án */}
      {!hideProjectSelector && isProjectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-3xs animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <Folder className="w-4 h-4 text-markee-primary" />
                <span>Liên kết phiên chat vào Dự án</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsProjectModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer border-0 bg-transparent"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tìm kiếm */}
            <div className="relative mb-3.5">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm kiếm dự án..."
                value={projectSearchQuery}
                onChange={(e) => setProjectSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs text-slate-800 bg-slate-50/50 focus:outline-none focus:border-markee-primary font-medium"
              />
            </div>

            {/* Danh sách */}
            <div className="max-h-60 overflow-y-auto space-y-1 pr-1">
              {personalFolders.filter(p => p.name.toLowerCase().includes(projectSearchQuery.toLowerCase())).length === 0 ? (
                <div className="text-center text-xs text-slate-400 py-6">Không tìm thấy thư mục nào</div>
              ) : (
                personalFolders.filter(p => p.name.toLowerCase().includes(projectSearchQuery.toLowerCase())).map(p => {
                  const isSelected = activeSession?.project_id === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={async () => {
                        if (activeSession) {
                          await onUpdateSessionProject(activeSession.id, p.id);
                        }
                        setIsProjectModalOpen(false);
                      }}
                      className={`w-full text-left px-3.5 py-2.5 text-xs rounded-xl flex items-center justify-between font-semibold transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-red-50 text-markee-primary border border-red-100'
                          : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900 border border-transparent bg-transparent'
                      }`}
                    >
                      <span className="truncate">{p.name}</span>
                      {isSelected && <span className="text-[10px] bg-red-100 text-markee-primary px-1.5 py-0.5 rounded-full font-bold">Đang chọn</span>}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
