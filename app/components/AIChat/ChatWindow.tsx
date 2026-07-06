'use client';

import React, { useRef, useEffect, useState } from 'react';
import { Send, Sparkles, User, Laptop, Menu, Plus, X, Folder, BookOpen, Search } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import ChatInput from './ChatInput';

// --- Component phụ cho Khối Code ---
function CodeBlock({ children }: { children: React.ReactNode }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const getText = (node: React.ReactNode): string => {
      if (typeof node === 'string' || typeof node === 'number') {
        return node.toString();
      }
      
      if (Array.isArray(node)) {
        return node.map(getText).join('');
      }
      
      if (React.isValidElement(node)) {
        const element = node as React.ReactElement;
        
        if (element.props && typeof element.props === 'object' && 'children' in element.props) {
          return getText(element.props.children as React.ReactNode);
        }
      }
      
      return '';
    };

    const codeContent = getText(children);
    
    if (codeContent) {
      navigator.clipboard.writeText(codeContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="relative group w-full max-w-full overflow-hidden bg-slate-800 rounded-lg my-2.5 shadow-sm">
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900/50">
        <span className="text-[10px] text-slate-400 font-mono">Code</span>
        <button onClick={handleCopy} className="text-[10px] text-slate-400 hover:text-white transition-colors flex items-center gap-1 opacity-0 group-hover:opacity-100">
          {copied ? 'Đã copy!' : 'Copy'}
        </button>
      </div>
      <div className="overflow-x-auto">
        <pre className="p-3 text-slate-100 font-mono text-[11px] leading-normal w-max min-w-full">
          {children}
        </pre>
      </div>
      {copied && (
        <div className="absolute bottom-2 left-2 bg-slate-700 text-white text-[10px] px-2 py-1 rounded shadow-lg z-10">
        </div>
      )}
    </div>
  );
}

// --- Component Chính ChatWindow ---
interface Message {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  created_at?: string;
}

interface ChatWindowProps {
  messages: Message[];
  inputValue: string;
  setInputValue: (val: string) => void;
  onSendMessage: () => void;
  isGenerating: boolean;
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  onToggleSidebar: () => void;
  disabledModels: Set<string>;
  projects: { id: number; name: string }[];
  departments: { id: number; name: string }[];
  teams: { id: number; name: string; department_id: number }[];
  skills: { id: number; title: string; team_id: number; markdown_content: string }[];
  activeSession: { id: string; title: string; created_at: string; project_id?: number | null } | null;
  onUpdateSessionProject: (sessionId: string, projectId: number | null) => Promise<void>;
  hiddenContext?: { title: string; content: string } | null;
  setHiddenContext?: (val: { title: string; content: string } | null) => void;
  personalFolders?: { id: number; name: string }[];
  pendingKnowledgeProjectName?: string | null;
  onClearPendingKnowledgeProjectName?: () => void;
  onSummarizeChat?: () => void;
  stagedFile?: File | null;
  setStagedFile?: (file: File | null) => void;
}

export default function ChatWindow({
  messages,
  inputValue,
  setInputValue,
  onSendMessage,
  isGenerating,
  selectedModel,
  setSelectedModel,
  onToggleSidebar,
  disabledModels,
  projects,
  departments,
  teams,
  skills,
  activeSession,
  onUpdateSessionProject,
  hiddenContext = null,
  setHiddenContext,
  personalFolders = [],
  pendingKnowledgeProjectName = null,
  onClearPendingKnowledgeProjectName,
  onSummarizeChat,
  stagedFile = null,
  setStagedFile,
}: ChatWindowProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isSkillModalOpen, setIsSkillModalOpen] = useState(false);

  const [selectedDeptId, setSelectedDeptId] = useState<number | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [skillSearchQuery, setSkillSearchQuery] = useState('');

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating]);

  return (
    <div className="flex-1 flex flex-col h-full bg-white min-w-0">
      {/* Header của ChatWindow */}
      <div className="h-14 border-b border-slate-200 px-4 flex items-center justify-between bg-white shrink-0">
        <div className="flex items-center gap-2">
          {/* Nút Hamburger mở ChatSidebar trên Mobile */}
          <button
            type="button"
            onClick={onToggleSidebar}
            className="md:hidden p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
            title="Lịch sử chat"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-bold text-slate-800">Trợ lý Markee AI</span>
          </div>
        </div>
      </div>

      <div className="grow overflow-y-auto p-6 space-y-6 min-w-0">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-markee-primary border border-red-100">
              <Sparkles className="h-6 w-6 animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Trợ lý Trí tuệ Nhân tạo Markee</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Hỗ trợ viết prompt, phân loại SOP, tóm tắt các bản WIP trong dự án hoặc trả lời bất cứ câu hỏi chuyên môn nào của bạn.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6 w-full min-w-0">
            {messages.map((msg, index) => {
              const isUser = msg.role === 'user';
              return (
                <div key={index} className={`flex gap-3.5 w-full min-w-0 ${isUser ? 'justify-end' : 'justify-start'}`}>
                  {!isUser && (
                    <div className="w-8 h-8 rounded-full bg-red-50 border border-red-100 flex items-center justify-center text-markee-primary shrink-0 select-none shadow-3xs">
                      <Laptop className="h-4 w-4" />
                    </div>
                  )}

                  <div className={`max-w-[75%] min-w-0 overflow-hidden rounded-2xl px-4 py-3 text-xs leading-relaxed ${isUser
                    ? 'bg-red-50/50 border border-red-100 text-slate-800 rounded-tr-none'
                    : 'bg-slate-50/50 border border-slate-200 text-slate-800 rounded-tl-none shadow-3xs'
                    }`}>
                    {isUser ? (
                      <p className="whitespace-pre-wrap wrap-break-word">{msg.content.replace(/\n{3,}/g, '\n\n')}</p>
                    ) : (
                      <div className="w-full min-w-0 wrap-break-word prose max-w-none prose-p:my-2 prose-p:leading-relaxed text-xs">
                        <ReactMarkdown
                          components={{
                            p: ({ children }) => <p className="my-2 leading-relaxed wrap-break-word">{children}</p>,
                            pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
                            code: ({ inline, className, children, ...props }: React.ComponentPropsWithoutRef<'code'> & { inline?: boolean }) => {
                              const isInline = inline || !/language-(\w+)/.exec(className || '');
                              return isInline ? (
                                <code className="bg-slate-100 text-red-600 px-1 py-0.5 rounded font-mono text-[11px] wrap-break-word" {...props}>{children}</code>
                              ) : (
                                <code className="font-mono text-[11px]" {...props}>{children}</code>
                              );
                            },
                          }}
                        >
                          {msg.content.replace(/\n{3,}/g, '\n\n')}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>

                  {isUser && (
                    <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 shrink-0 select-none shadow-3xs">
                      <User className="h-4 w-4" />
                    </div>
                  )}
                </div>
              );
            })}

            {isGenerating && (
              <div className="flex gap-3.5 justify-start w-full">
                <div className="w-8 h-8 rounded-full bg-red-50 border border-red-100 flex items-center justify-center text-markee-primary shrink-0 animate-pulse">
                  <Laptop className="h-4 w-4" />
                </div>
                <div className="bg-slate-50/50 border border-slate-200 rounded-2xl rounded-tl-none px-4 py-3.5 flex items-center gap-1.5 shadow-3xs">
                  <span className="w-1.5 h-1.5 bg-markee-primary rounded-full animate-bounce" />
                  <span className="w-1.5 h-1.5 bg-markee-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-markee-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <ChatInput
        inputValue={inputValue}
        setInputValue={setInputValue}
        onSendMessage={onSendMessage}
        isGenerating={isGenerating}
        selectedModel={selectedModel}
        setSelectedModel={setSelectedModel}
        disabledModels={disabledModels}
        hiddenContext={hiddenContext}
        setHiddenContext={setHiddenContext}
        activeSession={activeSession}
        onUpdateSessionProject={onUpdateSessionProject}
        personalFolders={personalFolders}
        projects={projects}
        departments={departments}
        teams={teams}
        skills={skills}
        onOpenSkillModal={() => setIsSkillModalOpen(true)}
        pendingKnowledgeProjectName={pendingKnowledgeProjectName}
        onClearPendingKnowledgeProjectName={onClearPendingKnowledgeProjectName}
        onSummarizeChat={onSummarizeChat}
        hasMessages={messages.length > 0}
        setStagedFile={setStagedFile}
      />

      {/* Modal 2: Chọn Skill dạng Cascading Dropdown */}
      {isSkillModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-3xs animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[500px]">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4 shrink-0">
              <div className="flex items-center gap-2">
                {/* Nút Quay lại */}
                {skillSearchQuery.trim() === '' && selectedDeptId !== null && (
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedTeamId !== null) {
                        setSelectedTeamId(null);
                      } else {
                        setSelectedDeptId(null);
                      }
                    }}
                    className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors mr-1 cursor-pointer flex items-center justify-center border-0 bg-transparent"
                    title="Quay lại"
                  >
                    <span className="text-xs font-bold font-mono">←</span>
                  </button>
                )}
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-markee-primary" />
                  <span>
                    {skillSearchQuery.trim() !== '' ? 'Kết quả tìm kiếm Kỹ năng' :
                     selectedDeptId === null ? 'Chọn Bộ phận' :
                     selectedTeamId === null ? `Nhóm - ${departments.find(d => d.id === selectedDeptId)?.name}` :
                     `Kỹ năng - ${teams.find(t => t.id === selectedTeamId)?.name}`}
                  </span>
                </h3>
              </div>
              <button 
                type="button" 
                onClick={() => {
                  setIsSkillModalOpen(false);
                  setSelectedDeptId(null);
                  setSelectedTeamId(null);
                  setSkillSearchQuery('');
                }}
                className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer border-0 bg-transparent"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tìm kiếm */}
            <div className="relative mb-4 shrink-0">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm kiếm kỹ năng..."
                value={skillSearchQuery}
                onChange={(e) => setSkillSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs text-slate-800 bg-slate-50/50 focus:outline-none focus:border-markee-primary font-medium"
              />
            </div>

            {/* Nội dung danh sách trượt/thay đổi */}
            <div className="flex-1 overflow-y-auto space-y-1.5 min-h-0 pr-1">
              {skillSearchQuery.trim() !== '' ? (
                // Hiển thị trực tiếp kết quả tìm kiếm
                skills.filter(s => s.title.toLowerCase().includes(skillSearchQuery.toLowerCase())).length === 0 ? (
                  <div className="text-center text-xs text-slate-400 py-12">Không tìm thấy kỹ năng nào</div>
                ) : (
                  skills.filter(s => s.title.toLowerCase().includes(skillSearchQuery.toLowerCase())).map(s => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setInputValue(s.markdown_content || '');
                        setIsSkillModalOpen(false);
                        setSelectedDeptId(null);
                        setSelectedTeamId(null);
                        setSkillSearchQuery('');
                      }}
                      className="w-full text-left px-3.5 py-3 text-xs font-semibold text-slate-700 hover:bg-red-50/50 hover:text-markee-primary rounded-xl border border-slate-100 hover:border-red-100 transition-all cursor-pointer block bg-transparent"
                    >
                      {s.title}
                    </button>
                  ))
                )
              ) : selectedDeptId === null ? (
                // BƯỚC 1: Chọn Bộ phận
                departments.length === 0 ? (
                  <div className="text-center text-xs text-slate-400 py-12">Không có bộ phận nào</div>
                ) : (
                  departments.map(dept => (
                    <button
                      key={dept.id}
                      type="button"
                      onClick={() => setSelectedDeptId(dept.id)}
                      className="w-full text-left px-4 py-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded-xl border border-slate-100 hover:border-slate-200 transition-all cursor-pointer flex items-center justify-between bg-transparent"
                    >
                      <span>{dept.name}</span>
                      <span className="text-[10px] text-slate-400 font-bold">➔</span>
                    </button>
                  ))
                )
              ) : selectedTeamId === null ? (
                // BƯỚC 2: Chọn Nhóm
                teams.filter(t => t.department_id === selectedDeptId).length === 0 ? (
                  <div className="text-center text-xs text-slate-400 py-12">Không có nhóm nào trong bộ phận này</div>
                ) : (
                  teams.filter(t => t.department_id === selectedDeptId).map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedTeamId(t.id)}
                      className="w-full text-left px-4 py-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded-xl border border-slate-100 hover:border-slate-200 transition-all cursor-pointer flex items-center justify-between bg-transparent"
                    >
                      <span>{t.name}</span>
                      <span className="text-[10px] text-slate-400 font-bold">➔</span>
                    </button>
                  ))
                )
              ) : (
                // BƯỚC 3: Chọn Kỹ năng
                skills.filter(s => s.team_id === selectedTeamId).length === 0 ? (
                  <div className="text-center text-xs text-slate-400 py-12">Không có kỹ năng nào trong nhóm này</div>
                ) : (
                  skills.filter(s => s.team_id === selectedTeamId).map(s => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setInputValue(s.markdown_content || '');
                        setIsSkillModalOpen(false);
                        setSelectedDeptId(null);
                        setSelectedTeamId(null);
                      }}
                      className="w-full text-left px-3.5 py-3 text-xs font-semibold text-slate-700 hover:bg-red-50/55 hover:text-markee-primary rounded-xl border border-slate-100 hover:border-red-100 transition-all cursor-pointer block bg-transparent"
                    >
                      {s.title}
                    </button>
                  ))
                )
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}