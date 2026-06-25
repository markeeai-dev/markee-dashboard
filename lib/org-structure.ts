// lib/org-structure.ts
// Centralized organizational structure: Departments (Phòng ban) and their Positions (Vị trí)
// Single source of truth for all department/position references across the app.

export interface DepartmentPosition {
  id: string; // e.g. "dev-backend"
  label: string; // e.g. "Lập trình viên Backend"
}

export interface DepartmentTrack {
  trackNumber: number; // 1-5
  dbValue: string; // exact match for team_track column: "Track 1: SI Delivery"
  displayLabel: string; // full label with description: "Track 1: SI Delivery (System/SOC)"
  shortLabel: string; // Vietnamese compact label: "SI Delivery"
  positions: DepartmentPosition[];
}

export const DEPARTMENT_TRACKS: DepartmentTrack[] = [
  {
    trackNumber: 1,
    dbValue: "Track 1: SI Delivery",
    displayLabel: "Track 1: SI Delivery (System/SOC)",
    shortLabel: "SI Delivery",
    positions: [
      { id: "si-director", label: "Giám đốc SI Delivery" },
      { id: "si-soc-analyst", label: "Chuyên viên SOC Analyst" },
      { id: "si-system-engineer", label: "Kỹ sư Hệ thống (System Engineer)" },
      { id: "si-cybersecurity", label: "Chuyên viên An ninh mạng (Cybersecurity)" },
      { id: "si-deployment", label: "Kỹ sư Triển khai (Deployment Engineer)" },
      { id: "si-infosec-monitor", label: "Chuyên viên Giám sát ATTT (InfoSec Monitor)" },
      { id: "si-sysadmin", label: "Quản trị viên Hệ thống (SysAdmin)" },
      { id: "si-incident-responder", label: "Chuyên viên Ứng cứu Sự cố (Incident Responder)" },
    ],
  },
  {
    trackNumber: 2,
    dbValue: "Track 2: Marketing",
    displayLabel: "Track 2: Marketing (SEO/Ads)",
    shortLabel: "Marketing",
    positions: [
      { id: "mkt-director", label: "Giám đốc Marketing" },
      { id: "mkt-seo", label: "Chuyên viên SEO" },
      { id: "mkt-ads", label: "Chuyên viên Google Ads" },
      { id: "mkt-content", label: "Chuyên viên Content Marketing" },
      { id: "mkt-social", label: "Chuyên viên Social Media" },
      { id: "mkt-analyst", label: "Chuyên viên Phân tích Marketing (Marketing Analyst)" },
      { id: "mkt-email", label: "Chuyên viên Email Marketing" },
      { id: "mkt-designer", label: "Thiết kế Đồ họa Marketing (Marketing Designer)" },
    ],
  },
  {
    trackNumber: 3,
    dbValue: "Track 3: Dev + DevOps",
    displayLabel: "Track 3: Dev + DevOps (SaaS)",
    shortLabel: "Dev + DevOps",
    positions: [
      { id: "dev-tech-lead", label: "Trưởng nhóm Kỹ thuật (Tech Lead)" },
      { id: "dev-backend", label: "Lập trình viên Backend" },
      { id: "dev-frontend", label: "Lập trình viên Frontend" },
      { id: "dev-fullstack", label: "Lập trình viên Fullstack" },
      { id: "dev-devops", label: "Kỹ sư DevOps" },
      { id: "dev-cloud", label: "Kỹ sư Cloud / Infrastructure" },
      { id: "dev-network", label: "Kỹ sư Mạng (Network Engineer)" },
      { id: "dev-qa", label: "Chuyên viên QA / QC (Tester)" },
      { id: "dev-appsec", label: "Kỹ sư Bảo mật Ứng dụng (AppSec)" },
    ],
  },
  {
    trackNumber: 4,
    dbValue: "Track 4: AI Team",
    displayLabel: "Track 4: AI Team (Products)",
    shortLabel: "AI Team",
    positions: [
      { id: "ai-lead", label: "Trưởng nhóm AI (AI Lead)" },
      { id: "ai-ml-engineer", label: "Kỹ sư Machine Learning" },
      { id: "ai-prompt-engineer", label: "Kỹ sư Prompt Engineering" },
      { id: "ai-data-scientist", label: "Chuyên viên Khoa học Dữ liệu (Data Scientist)" },
      { id: "ai-data-engineer", label: "Kỹ sư Dữ liệu (Data Engineer)" },
      { id: "ai-mlops", label: "Kỹ sư MLOps" },
      { id: "ai-tester", label: "Chuyên viên Kiểm thử AI (AI Tester)" },
      { id: "ai-product-manager", label: "Quản lý Sản phẩm AI (AI Product Manager)" },
    ],
  },
  {
    trackNumber: 5,
    dbValue: "Track 5: Sales",
    displayLabel: "Track 5: Sales (Closing)",
    shortLabel: "Sales",
    positions: [
      { id: "sales-director", label: "Giám đốc Kinh doanh (Sales Director)" },
      { id: "sales-ae", label: "Chuyên viên Kinh doanh (Account Executive)" },
      { id: "sales-bdr", label: "Chuyên viên Phát triển KD (BDR/SDR)" },
      { id: "sales-solutions", label: "Chuyên viên Tư vấn Giải pháp (Solutions Consultant)" },
      { id: "sales-csm", label: "Chuyên viên Chăm sóc Khách hàng (CSM)" },
      { id: "sales-partnership", label: "Quản lý Đối tác (Partnership Manager)" },
      { id: "sales-team-lead", label: "Trưởng nhóm Sales (Sales Team Lead)" },
      { id: "sales-bidding", label: "Chuyên viên Đấu thầu / Báo giá" },
    ],
  },
];

/** Flat array of all recognized track dbValues, for use in queries and counts */
export const ALL_TRACK_DB_VALUES: string[] = DEPARTMENT_TRACKS.map((t) => t.dbValue);

/** Get positions for a given track DB value */
export function getPositionsByTrack(trackDbValue: string): DepartmentPosition[] {
  const track = DEPARTMENT_TRACKS.find((t) => t.dbValue === trackDbValue);
  return track?.positions ?? [];
}

/** Map a UI display label (or "Tất cả"/"Khác") to its DB team_track value */
export function mapTrackDisplayToDbValue(display: string): string {
  if (display === "Tất cả") return "";
  if (display === "Khác") return "Khác";
  const track = DEPARTMENT_TRACKS.find((t) => t.displayLabel === display);
  return track?.dbValue ?? display;
}
