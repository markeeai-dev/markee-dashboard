# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## AGENTS.md override

`AGENTS.md` contains Next.js 16.2 agent rules. This is **not** standard Next.js — APIs, conventions, and file structure differ from training data. Before changing route/page/layout files, read guides in `node_modules/next/dist/docs/`.

Key Next.js rule from docs: if fixing slow client-side navigations, Suspense alone is not enough. You must also export `unstable_instant` from the route.

## Commands

```bash
npm run dev          # Start dev server (defaults to port 3000; -p <port> to override)
npm run build        # Production build (Turbopack + TypeScript + static generation)
npm run start        # Start production server
npm run lint         # Run ESLint (flat config: next/core-web-vitals + typescript)
```

## Environment

Requires `.env.local` with:
```
NEXT_PUBLIC_SUPABASE_URL=<supabase-project-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<supabase-anon-key>
GEMINI_API_KEY=<gemini-api-key>
```

## Architecture

**Single-page SPA dashboard.** One route (`/`) renders `<RoleDashboard />`, which is a 5000+ line monolithic component containing the entire app. All other "pages" are internal tabs managed via `activeTab` state — there is no Next.js file-based routing beyond the root.

**Top-level tabs** (RoleDashboard, line 1809):
| Tab | Access | Component |
|-----|--------|-----------|
| `overview` | Admin only | `AdminOverview` — charts, KPIs, token analytics |
| `library` | All users | `UserDashboard` — skill library with filters, upload, workspace |
| `chat` | All users | `ChatShell` — Gemini 2.0 Flash streaming chat |
| `assets` | All users | Asset management |
| `projects` | Admin only | `ProjectManagement` — project WIPs, members, timelines |
| `users` | Admin only | User management + AI licenses |
| `knowledge_hub` | Admin only | `KnowledgeHubDashboard` — curated knowledge base |

**Layout**: Left sidebar (logo, user avatar, nav tabs) + right content area with header bar. All in `RoleDashboard.tsx` (lines 1853–2034).

### The UserDashboard sub-panel (library tab)

When `activeTab === 'library'`, `<UserDashboard>` renders with its own inner layout:
- **Left filter sidebar** (256px): "Loại tài sản" (skill_type filter) + "Phòng ban" (team_track filter with expandable positions)
- **Right content**: search bar, Library/Workspace toggle tabs, skill cards grid (2-col)

### Data layer

```
lib/
  supabase.ts              Supabase client singleton (anon key, client-side)
  dashboard-supabase.ts    ~1250 lines — ALL data queries, auth, types, CRUD
  supabase-queries.ts      Legacy queries + mock data (TeamTable, charts, author maps)
  org-structure.ts         Department tracks + positions constants (single source of truth)
```

**Supabase is the only backend.** There is no separate API server. The `app/api/` routes are Next.js Route Handlers used for:
- `POST /api/chat` — Gemini 2.0 Flash streaming chat (`ai` SDK + `@ai-sdk/google`)
- `POST /api/extract-skills` — Gemini extracts structured skills from raw chat (used by browser extension)
- `POST /api/summarize-project` — Gemini summarizes all WIP skills for a project

### Auth flow

Google OAuth via `supabase.auth.signInWithOAuth()` (in `dashboard-supabase.ts:signInWithGoogle()`). No password auth. User profile from `getCurrentUserProfile()` merges Supabase auth user + `users` table record. Role is `"admin" | "user"`.

### Skill library data model

Core table: `skill_library` (in Supabase). Key columns:
- `status`: `pending` | `approved` | `rejected`
- `skill_type`: `workflow` | `context_pack` | `wip` (WIP is always filtered out of library views)
- `team_track`: organizational department (e.g. `"Track 1: SI Delivery"`)
- `author_id`: user email

Library views always filter `status=approved` and exclude `skill_type=wip`. Workspace shows the current user's own skills across all statuses, plus their WIP items.

### Organizational structure

Defined in `lib/org-structure.ts`. Five department tracks, each with 8-9 positions. Used as the single source of truth for:
- Sidebar filter UI (`DEPARTMENT_TRACKS` for rendering)
- Track-to-display-label mapping (`mapTrackDisplayToDbValue`)
- Count aggregation (`ALL_TRACK_DB_VALUES` for known-tracks filtering)

### Styling

Tailwind CSS v4 with `@tailwindcss/postcss`. Custom design tokens are Tailwind classes: `text-markee-primary`, `bg-markee-bg`, `border-markee-border`, `text-markee-muted`, `text-markee-text`, `text-markee-sub`, `shadow-red-100`. Primary brand color is red (`#E3000F`).

### Key patterns

- All components are client components (`'use client'`) — this is a browser-rendered SPA
- State management is React `useState`/`useEffect` — no external state library
- Pagination is cursor-based: `page` (0-indexed) × `PAGE_SIZE` (6-8 items), `hasMore` boolean
- File has blanket eslint-disable directives at the top — suppress specific warnings at line level instead
- Module path alias: `@/*` → project root
