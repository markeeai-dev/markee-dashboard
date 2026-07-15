'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Medal } from 'lucide-react';
import {
  fetchPendingSkills,
  fetchAdminOverviewMetrics,
  approveSkill,
  rejectSkill,
  type SkillCard,
  type UserProfile,
} from '@/lib/dashboard-supabase';

// Helper formatNumber
function formatNumber(value: number) {
  return new Intl.NumberFormat('en', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

// Subcomponent: ConfirmationModal
function ConfirmationModal({
  open,
  action,
  title,
  onCancel,
  onConfirm,
  busy,
}: {
  open: boolean;
  action: 'approved' | 'rejected' | null;
  title: string;
  onCancel: () => void;
  onConfirm: () => void;
  busy: boolean;
}) {
  if (!open || !action) return null;

  const isApprove = action === 'approved';
  const actionText = isApprove ? 'phê duyệt' : 'từ chối';
  const buttonClass = isApprove
    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
    : 'bg-markee-primary hover:bg-markee-hover text-white';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-5 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-markee-border bg-white p-6 shadow-2xl">
        <div className={`mb-5 h-1.5 w-16 rounded-full ${isApprove ? 'bg-emerald-600' : 'bg-markee-primary'}`} />
        <h2 className="text-lg font-bold text-markee-text">
          {isApprove ? 'Xác nhận phê duyệt' : 'Xác nhận từ chối'}
        </h2>
        <p className="mt-3 text-sm leading-6 text-markee-muted">
          Bạn có chắc chắn muốn {actionText} kỹ năng <span className="font-semibold text-markee-text">&quot;{title}&quot;</span> không?
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-xl border border-markee-border bg-white px-4 py-2.5 text-sm font-semibold text-markee-text transition-colors hover:bg-markee-bg disabled:opacity-60 cursor-pointer"
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition-colors disabled:opacity-60 cursor-pointer ${buttonClass}`}
          >
            {busy ? 'Đang xử lý...' : 'Xác nhận'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SkillApprovalDashboard({
  profile,
  onSkillModerated,
}: {
  profile: UserProfile;
  onSkillModerated?: () => void;
}) {
  const [pendingSkills, setPendingSkills] = useState<SkillCard[]>([]);
  const [contributors, setContributors] = useState<any[]>([]);
  const [selectedSkillId, setSelectedSkillId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);
  const [pendingAction, setPendingAction] = useState<'approved' | 'rejected' | null>(null);

  const selectedSkill = useMemo(
    () => pendingSkills.find((skill) => skill.id === selectedSkillId) || pendingSkills[0],
    [pendingSkills, selectedSkillId]
  );

  async function loadData() {
    setLoading(true);
    try {
      const [pending, overview] = await Promise.all([
        fetchPendingSkills(),
        fetchAdminOverviewMetrics('all')
      ]);
      setPendingSkills(pending);
      setContributors(overview.contributors || []);
      setSelectedSkillId(pending[0]?.id || null);
    } catch (err) {
      console.error('Error loading skill approval data:', err);
    } finally {
      setLoading(false);
    }
  }

  async function moderateSkill(status: 'approved' | 'rejected') {
    if (!selectedSkill) return;

    setActionBusy(true);
    try {
      if (status === 'approved') {
        await approveSkill(selectedSkill.id);
      } else {
        await rejectSkill(selectedSkill.id);
      }

      if (status === 'approved') {
        const overview = await fetchAdminOverviewMetrics('all');
        setContributors(overview.contributors || []);
        onSkillModerated?.();
      }

      setPendingSkills((skills) => skills.filter((skill) => skill.id !== selectedSkill.id));
      setSelectedSkillId(null);
      setPendingAction(null);
    } catch (err) {
      console.error('Error moderating skill:', err);
    } finally {
      setActionBusy(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  return (
    <main className="mx-auto max-w-7xl space-y-5 p-5">
      <section className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-markee-text">Duyệt kỹ năng</h1>
          <p className="text-xs text-markee-muted">Xin chào {profile.displayName}. Duyệt kỹ năng và theo dõi bảng xếp hạng đóng góp kỹ năng của đội ngũ.</p>
        </div>
      </section>

      {/* Bảng xếp hạng đóng góp kỹ năng */}
      <div className="rounded-xl border border-markee-border bg-white p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-markee-muted">Bảng xếp hạng đóng góp kỹ năng</h3>
        <div className="max-h-80 overflow-y-auto pr-1">
          <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 md:grid-cols-5">
            {contributors.map((person, index) => (
              <div key={person.email} className="rounded-xl border border-markee-border bg-markee-bg p-3 flex flex-col justify-between min-h-22.5 transition-all hover:border-markee-sub">
                <div className="mb-2 flex items-center justify-between">
                  <Medal
                    className={`h-5 w-5 ${index === 0 ? 'text-yellow-500' : index === 1 ? 'text-slate-400' : index === 2 ? 'text-amber-600' : 'text-slate-400'
                      }`}
                  />
                  <span className="text-xs font-bold text-markee-sub">#{index + 1}</span>
                </div>
                <div>
                  <div className="truncate text-sm font-semibold text-markee-text" title={person.name}>{person.name}</div>
                  <div className="mt-1 text-xs text-markee-muted">{person.count} kỹ năng đã duyệt</div>
                </div>
              </div>
            ))}
            {contributors.length === 0 && <div className="col-span-full text-sm text-markee-muted py-4 text-center">Chưa có dữ liệu đóng góp.</div>}
          </div>
        </div>
      </div>

      {/* Danh sách kỹ năng chờ duyệt & preview */}
      <section className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <div className="rounded-lg border border-markee-border bg-white p-4 h-[calc(100vh-200px)] overflow-y-auto">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-markee-muted">Kỹ năng chờ duyệt</h2>
          <div className="space-y-2">
            {loading && <div className="text-xs text-markee-sub animate-pulse">Đang tải...</div>}
            {!loading &&
              pendingSkills.map((skill) => {
                const isExpanded = selectedSkillId === skill.id;
                return (
                  <div
                    key={skill.id}
                    onClick={() => setSelectedSkillId(isExpanded ? null : skill.id)}
                    className={`block w-full rounded-lg border p-3 text-left transition-all cursor-pointer ${isExpanded
                        ? 'border-markee-primary bg-red-50 text-markee-primary font-semibold'
                        : 'border-markee-border bg-markee-bg text-markee-text hover:bg-white'
                      }`}
                  >
                    <div className="truncate text-xs font-semibold">{skill.title}</div>
                    <div className="mt-1 text-xs text-markee-muted">
                      {skill.category || 'Kỹ năng'} · {skill.authorName}
                    </div>

                    {/* Accordion Content for Mobile */}
                    {isExpanded && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="lg:hidden mt-3 pt-3 border-t border-markee-border/60 space-y-3 animate-in slide-in-from-top-2 duration-200"
                      >
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setPendingAction('rejected'); }}
                            disabled={actionBusy}
                            className="rounded-lg bg-markee-primary hover:bg-markee-hover px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60 transition-colors cursor-pointer border-0 shadow-3xs"
                          >
                            Từ chối
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setPendingAction('approved'); }}
                            disabled={actionBusy}
                            className="rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60 transition-colors cursor-pointer border-0 shadow-3xs"
                          >
                            Phê duyệt
                          </button>
                        </div>
                        <pre className="max-h-60 overflow-auto whitespace-pre-wrap rounded-lg border border-markee-border bg-white p-3 text-[10px] leading-5 text-markee-text font-mono font-normal">
                          {skill.markdown_content}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })}
            {!loading && pendingSkills.length === 0 && <div className="text-xs text-markee-sub">Không còn kỹ năng chờ duyệt.</div>}
          </div>
        </div>

        {/* Desktop Preview Panel */}
        <div className="hidden lg:flex rounded-lg border border-markee-border bg-white p-4 h-[calc(100vh-200px)] flex-col">
          {selectedSkill ? (
            <>
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3 shrink-0">
                <div>
                  <h2 className="text-base font-bold text-markee-text">{selectedSkill.title}</h2>
                  <p className="mt-1 text-xs text-markee-muted">
                    {selectedSkill.category || 'Prompt'} · {selectedSkill.authorName}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPendingAction('rejected')}
                    disabled={actionBusy}
                    className="rounded-lg bg-markee-primary hover:bg-markee-hover px-3 py-2 text-xs font-semibold text-white disabled:opacity-60 transition-colors cursor-pointer border-0 shadow-3xs"
                  >
                    Từ chối
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingAction('approved')}
                    disabled={actionBusy}
                    className="rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60 transition-colors cursor-pointer border-0 shadow-3xs"
                  >
                    Phê duyệt
                  </button>
                </div>
              </div>
              <pre className="flex-1 overflow-auto whitespace-pre-wrap rounded-lg border border-markee-border bg-markee-bg p-4 text-xs leading-6 text-markee-text">
                {selectedSkill.markdown_content}
              </pre>
            </>
          ) : (
            <div className="p-8 text-center text-sm text-markee-sub my-auto">Chọn một kỹ năng chờ duyệt để xem trước.</div>
          )}
        </div>
      </section>

      <ConfirmationModal
        open={Boolean(pendingAction)}
        action={pendingAction}
        title={selectedSkill?.title || ''}
        busy={actionBusy}
        onCancel={() => {
          if (!actionBusy) setPendingAction(null);
        }}
        onConfirm={() => {
          if (pendingAction) moderateSkill(pendingAction);
        }}
      />
    </main>
  );
}
