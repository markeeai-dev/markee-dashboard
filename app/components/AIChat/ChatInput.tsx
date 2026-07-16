'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Plus, Folder, X, Send, Search, Square } from 'lucide-react';

export const MODEL_CONFIG: Record<string, string> = {
  'deepseek-v4-flash': 'DeepSeek V4 Flash',
  'gpt-4o-mini': 'GPT-4o Mini',
  'google/gemini-3.5-flash': 'Gemini 3.5 Flash',
  'google/gemini-3.1-flash-lite': 'Gemini 3.1 Lite',
  'openrouter/free': 'Auto (Free)'
};

interface Project {
  id: number;
  name: string;
  type?: 'WIP_GLOBAL' | 'PERSONAL';
}

interface FolderItem {
  id: number;
  name: string;
}

interface TextareaAutosizeProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  maxRows?: number;
  minRows?: number;
}

const TextareaAutosize = React.forwardRef<HTMLTextAreaElement, TextareaAutosizeProps>(
  ({ maxRows = 6, minRows = 1, onChange, value, style, className, ...props }, ref) => {
    const localRef = useRef<HTMLTextAreaElement>(null);
    const combinedRef = (ref || localRef) as React.RefObject<HTMLTextAreaElement>;

    useEffect(() => {
      const textarea = combinedRef.current;
      if (!textarea) return;

      // Reset height to calculate scrollHeight correctly
      textarea.style.height = 'auto';

      // Tính lineHeight từ style của browser
      const computed = window.getComputedStyle(textarea);
      const lineHeight = parseInt(computed.lineHeight) || 16;
      const paddingTop = parseInt(computed.paddingTop) || 8;
      const paddingBottom = parseInt(computed.paddingBottom) || 8;

      const minHeight = minRows * lineHeight + paddingTop + paddingBottom;
      const maxHeight = maxRows * lineHeight + paddingTop + paddingBottom;

      const scrollHeight = textarea.scrollHeight;

      if (scrollHeight > maxHeight) {
        textarea.style.height = `${maxHeight}px`;
        textarea.style.overflowY = 'auto';
      } else if (scrollHeight < minHeight) {
        textarea.style.height = `${minHeight}px`;
        textarea.style.overflowY = 'hidden';
      } else {
        textarea.style.height = `${scrollHeight}px`;
        textarea.style.overflowY = 'hidden';
      }
    }, [value, minRows, maxRows]);

    return (
      <textarea
        ref={combinedRef}
        value={value}
        onChange={onChange}
        style={{ ...style, resize: 'none' }}
        className={className}
        {...props}
      />
    );
  }
);

TextareaAutosize.displayName = 'TextareaAutosize';


interface ChatInputProps {
  inputValue: string;
  setInputValue: (val: string) => void;
  onSendMessage: () => void;
  isGenerating: boolean;
  onStopGeneration?: () => void;
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
  onSummarizeChat?: () => void;
  hasMessages?: boolean;
  stagedFile?: File | null;
  setStagedFile?: (file: File | null) => void;
  isMobileOpen?: boolean;
}

export default function ChatInput({
  inputValue,
  setInputValue,
  onSendMessage,
  isGenerating,
  onStopGeneration,
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
  onSummarizeChat,
  hasMessages = false,
  stagedFile = null,
  setStagedFile,
  isMobileOpen = false,
}: ChatInputProps) {
  const [isPlusMenuOpen, setIsPlusMenuOpen] = useState(false);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [projectSearchQuery, setProjectSearchQuery] = useState('');
  
  // Local state render pill ngay lập tức - không phụ thuộc prop chain
  const [stagedFileLocal, setStagedFileLocal] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // KHÔNG dùng fileInputRef nữa - dùng global DOM ID để tránh mất ref khi dropdown unmount

  // Đồng bộ local state file đính kèm từ prop cha truyền xuống
  useEffect(() => {
    setStagedFileLocal(stagedFile);
  }, [stagedFile]);

  // Quản lý tạo preview Base64 bằng FileReader để vượt qua lỗi CSP
  useEffect(() => {
    if (stagedFileLocal && stagedFileLocal.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(stagedFileLocal);
    } else {
      setPreviewUrl(null);
    }
  }, [stagedFileLocal]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    console.log('=== ĐÃ CHỌN FILE ===', file); // Bắt buộc giữ dòng log này
    if (file) {
      setStagedFileLocal(file);
      // Gọi callback báo lên AIChat (nếu có prop setStagedFile truyền xuống)
      if (typeof setStagedFile === 'function') setStagedFile(file);
    }
    e.target.value = ''; // Reset để chọn lại được
  };

  const handleClearStagedFile = () => {
    setStagedFileLocal(null);
    if (typeof setStagedFile === 'function') setStagedFile(null);
  };

  const searchParams = useSearchParams();
  const sessionIdParam = searchParams?.get('session_id');
  const isNewChatMode = !sessionIdParam && (!activeSession || activeSession.id === 'pending');

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf("image") !== -1) {
        const file = item.getAsFile();
        if (file) {
          console.log('=== ĐÃ DÁN ẢNH ===', file);
          setStagedFileLocal(file);
          if (typeof setStagedFile === 'function') {
            setStagedFile(file);
          }
          e.preventDefault();
          break;
        }
      }
    }
  };



  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Wrapper gửi tin: dọn sạch file pill TRƯỚC khi gọi API
  const handleSend = () => {
    // Xóa file pill ngay lập tức để UX phản hồi tức thì
    setStagedFileLocal(null);
    if (typeof setStagedFile === 'function') setStagedFile(null);
    const domInput = document.getElementById('global-hidden-file-input') as HTMLInputElement | null;
    if (domInput) domInput.value = '';
    // Gọi hàm gửi tin nhắn của AIChat
    onSendMessage();
  };

  const handleInjectKnowledge = (title: string, content: string) => {
    if (setHiddenContext) {
      setHiddenContext({ title, content });
    }
    setIsPlusMenuOpen(false);
  };

  return (
    <div className={`border-t border-slate-100 p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] shrink-0 bg-white relative transition-all ${isMobileOpen ? 'z-0 shadow-none pointer-events-none' : 'z-10'}`}>
      {/* INPUT FILE: Đặt ngoài cùng với global ID, KHÔNG nằm trong dropdown */}
      <input
        id="global-hidden-file-input"
        type="file"
        onChange={handleFileChange}
        accept=".txt,.html,.csv,.json,.md,.js,.tsx"
        className="hidden"
      />
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

            <button
              type="button"
              onClick={() => {
                // Vanilla DOM: dùng ID thay vì ref để tránh mất ràng buộc khi dropdown unmount
                document.getElementById('global-hidden-file-input')?.click();
                setIsPlusMenuOpen(false);
              }}
              className="w-full text-left px-4 py-2.5 text-xs text-slate-700 hover:text-slate-900 hover:bg-slate-50 font-semibold flex items-center justify-between cursor-pointer bg-transparent border-0 transition-colors"
            >
              <span>📎 Đính kèm File</span>
              <span className="text-[10px] text-slate-400 font-bold">➔</span>
            </button>

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

      {/* Hidden Context Badge (Render in both new chat and old chat modes) */}
      {hiddenContext && (
        <div className="max-w-4xl mx-auto mb-2 flex items-center gap-2">
          <div className="inline-flex items-center gap-1.5 bg-purple-50 border border-purple-100 text-purple-700 text-[10px] font-bold px-2.5 py-1 rounded-lg shadow-3xs max-w-full">
            <span>💬 Trí thức:</span>
            <span className="truncate max-w-[200px] md:max-w-md font-bold">{hiddenContext.title}</span>
            <button
              type="button"
              onClick={() => {
                if (setHiddenContext) setHiddenContext(null);
                if (onClearPendingKnowledgeProjectName) onClearPendingKnowledgeProjectName();
                if (activeSession && onUpdateSessionProject) {
                  onUpdateSessionProject(activeSession.id, null);
                }
              }}
              className="hover:bg-purple-100 p-0.5 rounded-full cursor-pointer ml-1 flex items-center justify-center border-0 bg-transparent text-purple-400 hover:text-purple-700 transition-colors font-bold text-[10px]"
              title="Gỡ tri thức này"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Khung chat bọc ngoài cùng kiểu Google Gemini */}
      <div className="flex flex-col border border-slate-200 focus-within:border-markee-primary rounded-3xl bg-white p-3 shadow-sm max-w-4xl mx-auto transition-all relative">
        
        {/* Phần trên: Hiển thị File đính kèm / Preview ảnh (Nếu có) */}
        {stagedFileLocal && (
          <div className="flex items-center gap-2 mb-2.5 shrink-0 px-1">
            {stagedFileLocal.type.startsWith('image/') && previewUrl ? (
              <div className="relative group h-16 w-16 rounded-xl overflow-hidden border border-slate-200 shadow-3xs bg-white flex items-center justify-center shrink-0">
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="h-full w-full object-cover"
                />
                <button
                  type="button"
                  onClick={handleClearStagedFile}
                  className="absolute top-1 right-1 bg-black/60 hover:bg-black text-white p-1 rounded-full cursor-pointer transition-colors border-0 flex items-center justify-center"
                  title="Xóa ảnh"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-xl shadow-3xs max-w-full">
                <span>📎 {stagedFileLocal.name}</span>
                <button
                  type="button"
                  onClick={handleClearStagedFile}
                  className="hover:bg-slate-200 p-0.5 rounded-full cursor-pointer ml-1 flex items-center justify-center border-0 bg-transparent text-slate-400 hover:text-slate-700 transition-colors"
                  title="Gỡ file này"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* TẦNG 2: TEXTAREA (Phủ kín 100% chiều ngang, đứng riêng một hàng) */}
        <TextareaAutosize
          ref={textareaRef as any}
          minRows={1}
          maxRows={6}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder="Hỏi đáp về tri thức dự án hoặc SOP..."
          className="w-full border-none bg-transparent outline-none resize-none text-base md:text-sm py-1 px-1 m-0 leading-normal"
        />

        {/* TẦNG 3: TOOLBAR DƯỚI ĐÁY (Nút bấm nằm trên hàng riêng phía dưới) */}
        <div className="flex flex-row justify-between items-center mt-2 pt-1">
          {/* Bên Trái: Nút Plus & Badge Dự án */}
          <div className="flex flex-row items-center gap-2">
            <button
              type="button"
              onClick={() => setIsPlusMenuOpen(!isPlusMenuOpen)}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors shrink-0 cursor-pointer border-0 bg-transparent h-9 w-9 flex items-center justify-center"
              title="Thêm..."
            >
              <Plus className="h-4 w-4" />
            </button>

            {isNewChatMode && !hideProjectSelector && activeSession?.project_id && (
              <div className="flex items-center gap-1 bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-1.5 rounded-lg shadow-3xs max-w-[150px] truncate shrink-0 border border-slate-200/80">
                <Folder className="w-3 h-3 text-slate-500 shrink-0" />
                <span className="truncate">
                  {(personalFolders.find(p => p.id === activeSession.project_id) || projects.find(p => p.id === activeSession.project_id))?.name || 'Dự án'}
                </span>
                <button
                  type="button"
                  onClick={() => onUpdateSessionProject(activeSession.id, null)}
                  className="hover:bg-slate-200 p-0.5 rounded-full cursor-pointer ml-1 flex items-center justify-center border-0 bg-transparent text-slate-500 hover:text-slate-800 transition-colors"
                  title="Gỡ khỏi Dự án"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            )}
          </div>

          {/* Bên Phải: Cụm Model + Nút Send */}
          <div className="flex flex-row items-center gap-2">
            {/* Button Tổng hợp Chat (Chỉ hiện khi có messages) */}
            {hasMessages && onSummarizeChat && (
              <button
                type="button"
                onClick={onSummarizeChat}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold transition-all cursor-pointer border-0 outline-none shrink-0"
                title="Tổng hợp nội dung cuộc trò chuyện"
              >
                <span>📝</span>
                <span className="hidden sm:inline">Tổng hợp</span>
              </button>
            )}
            
            {/* Dropdown chọn Model */}
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="text-base md:text-xs bg-slate-100 border-none rounded-xl p-2 text-slate-900 outline-none focus:ring-1 focus:ring-markee-primary cursor-pointer shrink-0 max-w-35 truncate"
            >
              {Object.entries(MODEL_CONFIG).map(([key, name]) => (
                <option key={key} value={key} disabled={disabledModels.has(key)}>
                  {name} {disabledModels.has(key) && '(Lỗi)'}
                </option>
              ))}
            </select>

            {/* Nút Send / Stop */}
            {isGenerating ? (
              <button
                type="button"
                onClick={onStopGeneration}
                className="rounded-xl bg-red-600 hover:bg-red-700 text-white p-2.5 transition-colors cursor-pointer shrink-0 shadow-sm border-0 flex items-center justify-center animate-pulse"
                title="Dừng tạo câu trả lời"
              >
                <Square className="h-4 w-4 fill-current" />
              </button>
            ) : (
              <button
                type="button"
                disabled={!inputValue.trim()}
                onClick={handleSend}
                className="rounded-xl bg-markee-primary hover:bg-markee-hover disabled:bg-slate-200 text-white p-2.5 transition-colors cursor-pointer disabled:cursor-not-allowed shrink-0 shadow-sm border-0 flex items-center justify-center"
              >
                <Send className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
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
              {projects.filter(p => p.name.toLowerCase().includes(projectSearchQuery.toLowerCase())).length === 0 ? (
                <div className="text-center text-xs text-slate-400 py-6">Không tìm thấy thư mục/dự án nào</div>
              ) : (
                projects.filter(p => p.name.toLowerCase().includes(projectSearchQuery.toLowerCase())).map(p => {
                  const isSelected = activeSession?.project_id === p.id;
                  const isGlobalProject = p.type === 'WIP_GLOBAL';
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
                      <span className="truncate flex items-center gap-1.5">
                        <span>{isGlobalProject ? '🌐' : '📁'}</span>
                        <span className="truncate">{p.name}</span>
                        {isGlobalProject && <span className="text-[9px] bg-slate-100 text-slate-500 px-1 rounded font-normal">Chung</span>}
                      </span>
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
