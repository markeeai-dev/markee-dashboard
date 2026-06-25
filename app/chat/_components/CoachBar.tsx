'use client';

interface Props {
  input: string;
  visible: boolean;
}

const KEYWORDS_CONTEXT = ['khach', 'cong ty', 'team', 'du an', 'project', 'san pham', 'product', 'markee', 'khách', 'công ty', 'dự án', 'sản phẩm'];
const KEYWORDS_OBJECTIVE = ['muc tieu', 'output', 'format', 'viet', 'tao', 'phan tich', 'tong hop', 'de xuat', 'mục tiêu', 'viết', 'tạo', 'phân tích', 'tổng hợp', 'đề xuất'];
const KEYWORDS_SPECIFIC = ['vi sao', 'nhu the nao', 'cach', 'giai phap', 'so lieu', 'data', 'vi du', 'buoc', 'vì sao', 'như thế nào', 'cách', 'giải pháp', 'số liệu', 'ví dụ', 'bước'];

export function CoachBar({ input, visible }: Props) {
  if (!visible || input.length < 5) return null;

  const clean = input.toLowerCase();

  const lenScore = clean.length > 30 ? 20 : Math.round((clean.length / 30) * 20);
  const contextScore = KEYWORDS_CONTEXT.some((k) => clean.includes(k)) ? 20 : 0;
  const objectiveScore = KEYWORDS_OBJECTIVE.some((k) => clean.includes(k)) ? 20 : 0;
  const specificScore = KEYWORDS_SPECIFIC.some((k) => clean.includes(k)) ? 20 : 0;
  const detailScore = clean.length > 100 ? 20 : Math.round((clean.length / 100) * 20);

  const total = lenScore + contextScore + objectiveScore + specificScore + detailScore;

  const missing: string[] = [];
  if (lenScore < 15) missing.push('Cần dài hơn');
  if (contextScore === 0) missing.push('Thiếu bối cảnh');
  if (objectiveScore === 0) missing.push('Chưa rõ mục tiêu');
  if (specificScore === 0) missing.push('Cần cụ thể hơn');
  if (detailScore < 10) missing.push('Cần chi tiết hơn');

  const strengths: string[] = [];
  if (lenScore >= 18) strengths.push('Độ dài tốt');
  if (contextScore > 0) strengths.push('Có bối cảnh');
  if (objectiveScore > 0) strengths.push('Mục tiêu rõ ràng');
  if (specificScore > 0) strengths.push('Cụ thể');

  const colorClass =
    total >= 80 ? 'text-emerald-600' : total >= 50 ? 'text-amber-600' : 'text-red-500';

  return (
    <div className="px-4 pt-2 pb-3 border-t border-markee-border/60 bg-markee-bg/30 transition-all duration-300 ease-out">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-[10px] font-semibold text-markee-sub uppercase tracking-wider">AI Coach</span>
        <span className={`text-xs font-bold ${colorClass}`}>{total}/100</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {missing.slice(0, 3).map((m) => (
          <span key={m} className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
            {m}
          </span>
        ))}
        {strengths.slice(0, 3).map((s) => (
          <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}
