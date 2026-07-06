'use client';

import React, { useState } from 'react';
import { Folder, Plus, Send, MessageSquare, Edit3, Calendar, BookOpen, X, Search } from 'lucide-react';
import ChatInput from './ChatInput';

interface FolderItem {
  id: number;
  name: string;
}

interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  project_id?: number | null;
}

interface Project {
  id: number;
  name: string;
  type?: 'WIP_GLOBAL' | 'PERSONAL';
  created_by?: string | null;
}

interface ProjectDetailViewProps {
  folderId: number;
  personalFolders: FolderItem[];
  sessions: ChatSession[];
  onSelectSession: (id: string) => void;
  onRenameFolder: (id: number, name: string) => Promise<void>;
  onCreateSessionAndSend: (content: string, projectId: number) => Promise<void>;
  // ChatInput / metadata props
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  disabledModels: Set<string>;
  hiddenContext: { title: string; content: string } | null;
  setHiddenContext?: (ctx: { title: string; content: string } | null) => void;
  projects: Project[];
  departments: { id: number; name: string }[];
  teams: { id: number; name: string; department_id: number }[];
  skills: { id: number; title: string; team_id: number; markdown_content: string }[];
  stagedFile?: File | null;
  setStagedFile?: (file: File | null) => void;
}

export default function ProjectDetailView({
  folderId,
  personalFolders,
  sessions,
  onSelectSession,
  onRenameFolder,
  onCreateSessionAndSend,
  selectedModel,
  setSelectedModel,
  disabledModels,
  hiddenContext,
  setHiddenContext,
  projects,
  departments,
  teams,
  skills,
  stagedFile = null,
  setStagedFile,
}: ProjectDetailViewProps) {
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [folderNameInput, setFolderNameInput] = useState('');

  // Skill Selector Modal states inside Project Detail
  const [isSkillModalOpen, setIsSkillModalOpen] = useState(false);
  const [selectedDeptId, setSelectedDeptId] = useState<number | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [skillSearchQuery, setSkillSearchQuery] = useState('');

  const matchedProject = projects.find(p => p.id === folderId);
  const isGlobal = matchedProject?.type === 'WIP_GLOBAL';
  const currentFolder = personalFolders.find(f => f.id === folderId) || matchedProject;
  const folderName = currentFolder?.name || 'Thư mục không xác định';

  const folderSessions = sessions.filter(s => s.project_id === folderId);

  const handleSend = async () => {
    const content = inputValue.trim();
    if (!content || isSending) return;
    
    setIsSending(true);
    try {
      await onCreateSessionAndSend(content, folderId);
      setInputValue('');
    } catch (err) {
      console.error('Error starting session in project:', err);
    } finally {
      setIsSending(false);
    }
  };

  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderNameInput.trim()) return;
    await onRenameFolder(folderId, folderNameInput.trim());
    setIsEditingName(false);
  };

  const handleStartNewChat = async () => {
    if (isSending) return;
    setIsSending(true);
    try {
      await onCreateSessionAndSend('Cuộc trò chuyện mới', folderId);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex-1 bg-white flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="border-b border-slate-100 px-8 py-5 flex items-center justify-between shrink-0 bg-slate-50/40">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center text-markee-primary shrink-0 shadow-3xs">
            <Folder className="w-5 h-5" />
          </div>
          {isEditingName ? (
            <form onSubmit={handleRenameSubmit} className="flex items-center gap-2">
              <input
                type="text"
                value={folderNameInput}
                onChange={e => setFolderNameInput(e.target.value)}
                className="px-2.5 py-1 border border-slate-200 rounded-lg text-sm text-slate-800 font-bold focus:outline-none focus:border-slate-400"
                autoFocus
              />
              <button type="submit" className="text-xs bg-markee-primary hover:bg-markee-hover text-white px-2.5 py-1 rounded-lg font-bold cursor-pointer">Lưu</button>
              <button type="button" onClick={() => setIsEditingName(false)} className="text-xs text-slate-500 hover:text-slate-700 px-2.5 py-1 rounded-lg border border-slate-200 cursor-pointer">Hủy</button>
            </form>
          ) : (
            <div>
              <h1 className="text-base font-bold text-slate-800 flex items-center gap-1.5">
                <span>{folderName}</span>
                {!isGlobal && (
                  <button
                    type="button"
                    onClick={() => {
                      setFolderNameInput(folderName);
                      setIsEditingName(true);
                    }}
                    className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition-colors border-0 bg-transparent cursor-pointer"
                    title="Đổi tên thư mục"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                )}
              </h1>
              <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                {isGlobal ? 'Dự án chung' : 'Dự án cá nhân'} chứa {folderSessions.length} đoạn hội thoại
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Body Container */}
      <div className="flex-1 overflow-y-auto p-8 space-y-8 flex flex-col justify-between">
        {/* Quick Input Bar (Top) */}
        <div className="w-full max-w-4xl mx-auto space-y-2 shrink-0 relative z-50">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1 text-center">Bắt đầu trò chuyện trong dự án này</h2>
          <div className="border border-slate-200 rounded-2xl bg-white shadow-sm">
            <ChatInput
              inputValue={inputValue}
              setInputValue={setInputValue}
              onSendMessage={handleSend}
              isGenerating={isSending}
              selectedModel={selectedModel}
              setSelectedModel={setSelectedModel}
              disabledModels={disabledModels}
              hiddenContext={hiddenContext}
              setHiddenContext={setHiddenContext}
              activeSession={null}
              onUpdateSessionProject={async () => {}}
              personalFolders={personalFolders}
              projects={projects}
              departments={departments}
              teams={teams}
              skills={skills}
              hideProjectSelector={true}
              onOpenSkillModal={() => setIsSkillModalOpen(true)}
              setStagedFile={setStagedFile}
            />
          </div>
        </div>

        {/* Sessions List (Bottom) */}
        <div className="max-w-4xl mx-auto w-full space-y-3 flex-1 mt-8">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">Các phiên trò chuyện đã tạo</h2>
          
          {folderSessions.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-slate-200 rounded-2xl bg-slate-50/20">
              <MessageSquare className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-slate-400 font-bold">Chưa có phiên trò chuyện nào trong dự án này</p>
            </div>
          ) : (
            <div className="space-y-2">
              {folderSessions.map(sess => (
                <div
                  key={sess.id}
                  onClick={() => onSelectSession(sess.id)}
                  className="flex items-center justify-between border border-slate-100 hover:border-slate-200 rounded-xl p-4 bg-white hover:bg-slate-50/50 shadow-3xs hover:shadow-xs transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 group-hover:text-slate-600 transition-colors shrink-0">
                      <MessageSquare className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-slate-700 truncate group-hover:text-slate-900">
                        {sess.title}
                      </h4>
                      <div className="flex items-center gap-1.5 mt-1 text-[9px] text-slate-400 font-semibold">
                        <Calendar className="w-3 h-3" />
                        <span>Tạo ngày {new Date(sess.created_at).toLocaleDateString('vi-VN')}</span>
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition-all font-bold pr-2">Mở chat ➔</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal: Chọn Skill dạng Cascading Dropdown */}
      {isSkillModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-3xs animate-in fade-in duration-200 animate-in duration-200">
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

            {/* Nội dung danh sách */}
            <div className="flex-1 overflow-y-auto space-y-1.5 min-h-0 pr-1">
              {skillSearchQuery.trim() !== '' ? (
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
                departments.length === 0 ? (
                  <div className="text-center text-xs text-slate-400 py-12">Không có bộ phận nào</div>
                ) : (
                  departments.map(dept => (
                    <button
                      key={dept.id}
                      type="button"
                      onClick={() => setSelectedDeptId(dept.id)}
                      className="w-full text-left px-4 py-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded-xl border border-slate-100 hover:border-slate-200 transition-all cursor-pointer flex items-center justify-between bg-transparent font-semibold"
                    >
                      <span>{dept.name}</span>
                      <span className="text-[10px] text-slate-400 font-bold">➔</span>
                    </button>
                  ))
                )
              ) : selectedTeamId === null ? (
                teams.filter(t => t.department_id === selectedDeptId).length === 0 ? (
                  <div className="text-center text-xs text-slate-400 py-12">Không có nhóm nào trong bộ phận này</div>
                ) : (
                  teams.filter(t => t.department_id === selectedDeptId).map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedTeamId(t.id)}
                      className="w-full text-left px-4 py-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded-xl border border-slate-100 hover:border-slate-200 transition-all cursor-pointer flex items-center justify-between bg-transparent font-semibold"
                    >
                      <span>{t.name}</span>
                      <span className="text-[10px] text-slate-400 font-bold">➔</span>
                    </button>
                  ))
                )
              ) : (
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
