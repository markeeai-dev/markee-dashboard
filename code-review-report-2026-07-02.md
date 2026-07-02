# Code Review Report — Max Effort (working tree)

**Scope:** 34 files across TypeScript/Next.js | **Date:** 2026-07-02

---

## Findings (35 remaining, ranked by severity)

### CRITICAL (8 findings)

1. **All 3 API routes have zero authentication**
   - **File:** app/api/chat/route.ts
   - **Line:** 28
   - **Severity:** CRITICAL
   - **Summary:** POST /api/chat, POST /api/summarize-project, and POST /api/extract-skills process requests without any authentication check. No `supabase.auth.getUser()`, no JWT verification, no session cookie check. Any unauthenticated client can consume AI tokens, write to any conversation, and extract/insert skills.
   - **Failure scenario:** An attacker sends POST requests to all three API endpoints from a script. They consume Gemini/OpenAI API credits, inject messages into other users' conversations, and insert arbitrary skills into the database — all without any credentials.

2. **Extract-skills allows arbitrary author_id impersonation**
   - **File:** app/api/extract-skills/route.ts
   - **Line:** 12
   - **Severity:** CRITICAL
   - **Summary:** The `author_id` field is taken directly from the request body and written to `skill_library` with no verification. Any caller can set `author_id` to any email address, making skills appear to be authored by someone else.
   - **Failure scenario:** Attacker calls POST /api/extract-skills with `author_id: "ceo@company.com"`. The inserted skills appear in the dashboard as if the CEO created them, enabling reputation manipulation and social engineering.

3. **Missing RLS on 7+ critical database tables**
   - **File:** supabase_migration_chat.sql
   - **Line:** 28
   - **Severity:** CRITICAL
   - **Summary:** RLS is only enabled on `conversations` and `messages` tables. Tables `skill_library`, `ai_sessions`, `projects`, `chat_sessions`, `chat_messages`, `ai_licenses`, `ai_usage_stats`, `user_likes`, and `users` have NO RLS policies. Since the app uses the anon key for all client-side Supabase operations, these tables are completely unprotected — any client can read/write all rows.
   - **Failure scenario:** A user opens browser devtools, extracts the public anon key, and directly queries `supabase.from('users').select('*')` to get all user emails, names, and roles. They can also read all `ai_sessions` (including prompt content), all `skill_library` entries, and all `ai_licenses`.

4. **Chat API does not verify ownership of conversationId/sessionId**
   - **File:** app/api/chat/route.ts
   - **Line:** 51
   - **Severity:** CRITICAL
   - **Summary:** The route accepts `conversationId` and `sessionId` from the request body and writes messages without verifying the caller owns those resources. Combined with missing RLS on `chat_messages`, any caller can inject messages into any conversation.
   - **Failure scenario:** Attacker obtains another user's session UUID (via shared link, ID enumeration, or browser history leak) and POSTs to /api/chat with that sessionId. Messages are injected into the victim's conversation, enabling conversation poisoning or social engineering.

5. **Summarize-project does not verify caller has access to projectId**
   - **File:** app/api/summarize-project/route.ts
   - **Line:** 10
   - **Severity:** CRITICAL
   - **Summary:** The endpoint accepts any `projectId` and fetches all WIP skills for that project with no ownership check. Any caller who knows or enumerates a project ID can extract all WIP content including markdown_content and author emails.
   - **Failure scenario:** Attacker enumerates sequential project IDs (1, 2, 3...) via POST /api/summarize-project. Each request returns aggregated WIP content, contributor emails, and token counts for projects the attacker has no affiliation with.

6. **All API routes use anon-key Supabase client without user auth context**
   - **File:** app/api/chat/route.ts
   - **Line:** 5
   - **Severity:** CRITICAL
   - **Summary:** All three API routes create a Supabase client using only `NEXT_PUBLIC_SUPABASE_ANON_KEY`. They never extract the user's auth token from the request headers. This means RLS policies that depend on `auth.jwt()` will see a null/anonymous user, making per-user data isolation impossible even if RLS were added.
   - **Failure scenario:** Even if RLS policies were added to more tables, the API routes would fail to authenticate users because they never forward the Authorization header. This architectural pattern makes it impossible to enforce per-user data isolation in server-side API routes.

7. **Client-side admin operations rely solely on missing RLS**
   - **File:** lib/dashboard-supabase.ts
   - **Line:** 619
   - **Severity:** CRITICAL
   - **Summary:** Sensitive admin operations (`updateUserRole`, `approveSkill`, `rejectSkill`, `deleteAILicense`, `updateAILicense`) are called directly from client components using the anon-key Supabase client. With no RLS on these tables, any authenticated user can perform admin actions by calling these functions directly from browser devtools.
   - **Failure scenario:** A regular user opens devtools and calls `updateUserRole(theirId, 'admin')` via the Supabase client. Since the `users` table has no RLS policy restricting UPDATE to admin role, the user escalates to admin.

8. **Gemini API key exposed in URL query string**
   - **File:** app/api/summarize-project/route.ts
   - **Line:** 76
   - **Severity:** CRITICAL
   - **Summary:** The `GEMINI_API_KEY` is interpolated directly into the fetch URL as `?key=${GEMINI_API_KEY}`. The full URL (including the key) can be captured in proxy logs, CDN logs, APM traces, error reports, and network monitoring tools. Same pattern in extract-skills/route.ts:30.
   - **Failure scenario:** A reverse proxy or APM tool logs outbound request URLs. The Gemini API key appears in plaintext in logs accessible to operations staff or compromised by an attacker, enabling unauthorized API usage and billing impact.

### HIGH (15 findings)

9. **toggleSkillVote: non-atomic read-then-write race condition**
   - **File:** lib/dashboard-supabase.ts
   - **Line:** 395
   - **Severity:** HIGH
   - **Summary:** Reads `user_likes` to check if a like exists, then conditionally inserts+increments or deletes+decrements in separate non-atomic steps. Two concurrent toggle calls can both read "no existing like" and both insert, creating duplicate likes and double-incrementing the counter.
   - **Failure scenario:** User double-clicks the like button rapidly. Both calls read `maybeSingle()` → null. Both proceed to insert into `user_likes` and call `increment_like` RPC. Result: 2 like rows for same user+skill, likes_count incremented by 2 instead of 1.

10. **handleSaveSummary: read-modify-write race on master_summary JSON blob**
    - **File:** app/components/RoleDashboard.tsx
    - **Line:** 4216
    - **Severity:** HIGH
    - **Summary:** Reads `selectedProject.master_summary` from stale React state, parses JSON, appends a new SummaryItem, serializes, and writes back. Two concurrent save operations will each read the same base array, append their item, and overwrite — losing one summary.
    - **Failure scenario:** Admin A and Admin B both trigger "Tổng hợp Tri thức" on the same project within seconds. Both read `master_summary = [item1]`. Admin A writes `[item1, itemA]`. Admin B writes `[item1, itemB]`. Final state: `[item1, itemB]` — itemA is lost.

11. **Skill library mutations lack ownership checks (IDOR)**
    - **File:** app/components/RoleDashboard.tsx
    - **Line:** 469
    - **Severity:** HIGH
    - **Summary:** `handleDeleteWip`, `handleMoveWip`, and `handleEditWip` directly call `supabase.from('skill_library').delete()/.update().eq('id', ...)` without verifying the current user is the author. Any user who knows a skill_library row ID can delete, edit, or reassign another user's WIP drafts.
    - **Failure scenario:** User A discovers the numeric ID of User B's WIP draft (IDs are sequential integers, easily enumerable). User A crafts a request that calls supabase delete/update on that ID, destroying or modifying User B's work.

12. **fetchProjects returns ALL projects with no tenant scoping**
    - **File:** lib/dashboard-supabase.ts
    - **Line:** 625
    - **Severity:** HIGH
    - **Summary:** The function queries `supabase.from('projects').select('*')` with no WHERE clause filtering by user or organization. Every project in the system is returned to any caller. Combined with missing RLS, any user can browse all project data.
    - **Failure scenario:** A regular user calls `fetchProjects()` and receives all projects including those from other teams/departments. They can then call `fetchProjectSessions(projectId)` to see all AI session logs (including prompt_content) for any project.

13. **Conversation/message CRUD operations lack ownership verification (IDOR)**
    - **File:** lib/dashboard-supabase.ts
    - **Line:** 1172
    - **Severity:** HIGH
    - **Summary:** `deleteConversation(id)`, `updateConversationTitle(id, title)`, `fetchMessages(conversationId)`, `deleteChatSession(sessionId)`, and `fetchChatMessages(sessionId)` all operate on resources identified by client-supplied IDs without verifying the authenticated user owns them.
    - **Failure scenario:** Attacker obtains or enumerates a conversation/session UUID belonging to another user. They call `deleteConversation(victimId)` to destroy the victim's chat history, or `fetchMessages(victimConversationId)` to read all messages.

14. **Chat API inserts messages with no idempotency key**
    - **File:** app/api/chat/route.ts
    - **Line:** 51
    - **Severity:** HIGH
    - **Summary:** The POST handler inserts user and assistant messages into `chat_messages`/`messages` tables with no idempotency key, no ON CONFLICT, and no deduplication. If the client retries the request, the user message is inserted again and a new assistant response is generated.
    - **Failure scenario:** User sends a message; the stream starts but the connection drops. The client retries the POST. The user message is now in the DB twice, and two assistant responses are generated and stored.

15. **Extract-skills bulk-inserts with no ON CONFLICT**
    - **File:** app/api/extract-skills/route.ts
    - **Line:** 75
    - **Severity:** HIGH
    - **Summary:** POST handler parses chat via Gemini then bulk-inserts extracted skills into `skill_library` with no idempotency key or ON CONFLICT clause. A retry of the same request inserts the same skills again.
    - **Failure scenario:** Browser extension calls /api/extract-skills, Gemini returns 5 skills, all 5 are inserted. A network timeout causes the extension to retry. Now 10 skills exist — 5 duplicates with identical content.

16. **License creation form has no double-submit guard**
    - **File:** app/components/RoleDashboard.tsx
    - **Line:** 2188
    - **Severity:** HIGH
    - **Summary:** `handleCreateLicense` is called on form submit but the submit button has no disabled state tied to a submitting flag. The `createAILicense` call inserts into `ai_licenses` with no unique constraint on (email, ai_tool, plan_name). Rapid clicks create duplicate license records.
    - **Failure scenario:** Admin opens "Cấp mới Bản quyền AI" modal, fills in form, and double-clicks "Tạo mới". Two identical licenses are created for the same employee+tool+plan.

17. **License expiration date parsed as UTC midnight causes off-by-one-day**
    - **File:** app/components/RoleDashboard.tsx
    - **Line:** 2342
    - **Severity:** HIGH
    - **Summary:** `new Date(lic.expiration_date) < new Date()` compares an HTML date-input value (YYYY-MM-DD, parsed as UTC midnight) against local time. In UTC+7, a license expiring today is parsed as UTC midnight today = 7am local today, so `new Date()` (local afternoon) > expiration, marking it expired prematurely.
    - **Failure scenario:** User in UTC+7 enters expiration_date '2026-07-02'. `new Date('2026-07-02')` = 2026-07-02T00:00:00Z = 2026-07-02T07:00:00+07:00. If current local time is 2026-07-02T14:00:00+07:00, the comparison is TRUE, so the license shows as "Expired" even though it should be valid through the end of today.

18. **updateAILicense status logic uses timezone-mismatched date comparison**
    - **File:** lib/dashboard-supabase.ts
    - **Line:** 903
    - **Severity:** HIGH
    - **Summary:** `new Date(updates.expiration_date) >= new Date()` compares a date-only string (UTC midnight) with local now. A license expiring on the current day will be marked "Active" or not depending on the server's timezone offset, producing inconsistent status assignment.
    - **Failure scenario:** Server in UTC receives expiration_date='2026-07-02'. If server time is 2026-07-02T03:00:00Z, status becomes Active. But if the same request hits a server in UTC+7 at 2026-07-02T14:00:00+07:00, status becomes not-Active. Same input, different results.

19. **Hardcoded token cost rate with 1000x discrepancy between files**
    - **File:** lib/dashboard-supabase.ts
    - **Line:** 487
    - **Severity:** HIGH
    - **Summary:** Cost rate 0.015 is hardcoded in 3 locations. `dashboard-supabase.ts` uses `totalTokens * 0.015` while `supabase-queries.ts` uses `(totalTokens / 1000) * 0.015` — a 1000x discrepancy in cost calculation. Admin dashboard shows wildly different cost figures depending on which code path computes them.
    - **Failure scenario:** Admin views cost metrics. One panel shows $150 (correct), another shows $0.15 (wrong by 1000x). Decisions based on incorrect cost data lead to budget misallocation.

20. **Unbounded in-memory fetch when searching skills**
    - **File:** lib/dashboard-supabase.ts
    - **Line:** 253
    - **Severity:** HIGH
    - **Summary:** `fetchApprovedSkills` fetches ALL approved skills from the database (no LIMIT) when a search term is present, then filters in-memory for Vietnamese diacritics. As the skill library grows, this fetches the entire table into server memory on every search.
    - **Failure scenario:** With thousands of skills, a single search request loads the entire table into Node.js memory, causing OOM crashes or severe latency spikes under concurrent search traffic.

21. **No security headers configured in next.config.ts**
    - **File:** next.config.ts
    - **Line:** 3
    - **Severity:** HIGH
    - **Summary:** `next.config.ts` is completely empty — no `headers()` function, no Content-Security-Policy, X-Frame-Options, X-Content-Type-Options, Strict-Transport-Security, Referrer-Policy, or Permissions-Policy. The application serves responses with zero custom security headers.
    - **Failure scenario:** An attacker can embed the dashboard in an iframe for clickjacking, inject inline scripts via XSS without CSP blocking it, or exploit MIME-type sniffing. No HSTS means initial HTTP requests are vulnerable to downgrade attacks.

22. **handleSendMessage: stale closure over status allows double-send**
    - **File:** app/components/AIChat/AIChat.tsx
    - **Line:** 330
    - **Severity:** HIGH
    - **Summary:** The guard `if (status !== 'ready') return` captures `status` from the closure at render time. Two rapid clicks within the same render cycle both see `status==='ready'` because React hasn't re-rendered yet. Both calls invoke `sendMessage`, producing duplicate user messages and two parallel API streams.
    - **Failure scenario:** User clicks Send button twice quickly (or presses Enter then clicks). Both invocations pass the status guard before `useChat` updates status to 'submitted'. Two identical user messages are sent to /api/chat, creating duplicate DB inserts.

23. **doCreateAndSend: concurrent auto-creation of duplicate chat sessions**
    - **File:** app/components/AIChat/AIChat.tsx
    - **Line:** 342
    - **Severity:** HIGH
    - **Summary:** When no `activeSessionId` exists, `handleSendMessage` fires an async `doCreateAndSend` without any concurrency guard. Two rapid sends both see `activeSessionId===null`, both create new sessions, and both send messages — resulting in two sessions with one message each.
    - **Failure scenario:** User opens chat (no session), types a message, and hits Enter twice quickly. Two `chat_sessions` rows are created. User sees two sessions in sidebar, each with one message.

24. **Save summary has no double-submit guard**
    - **File:** app/components/RoleDashboard.tsx
    - **Line:** 5123
    - **Severity:** HIGH
    - **Summary:** The "Xác nhận Lưu" button calls `handleSaveSummary` which reads the existing `master_summary` array, appends a new item, and writes it back. The button has no disabled state during the save. Double-click reads the same base array twice and appends the same summary twice.
    - **Failure scenario:** Admin clicks "Tổng hợp Tri thức Dự án", gets a result, and double-clicks "Xác nhận Lưu". The same summary is appended twice to the `master_summary` JSON array.

### MEDIUM (12 findings)

25. **Multiple data-fetching functions return empty defaults on all Supabase errors**
    - **File:** lib/dashboard-supabase.ts
    - **Line:** 231
    - **Severity:** MEDIUM
    - **Summary:** 20+ functions follow the same pattern: catch Supabase error → console.error → return [], {}, or null. Errors are completely swallowed from the caller's perspective. Dashboard shows "no data" instead of an error state, masking DB outages.
    - **Failure scenario:** Supabase is down or RLS policy blocks reads. Dashboard shows "no data" instead of an error state, misleading admins into thinking there are zero sessions/tokens/skills rather than a system failure.

26. **AIChat session loading silently swallows errors**
    - **File:** app/components/AIChat/AIChat.tsx
    - **Line:** 127
    - **Severity:** MEDIUM
    - **Summary:** The `loadSessions` function catches all errors with only `console.error`. If Supabase fails, the user sees an empty chat history with no error message, believing they have no conversations rather than a system failure.
    - **Failure scenario:** Supabase auth token expires or DB is unreachable. Chat sidebar shows "Chưa có phiên chat nào" (no chat sessions) instead of an error, misleading the user.

27. **loadUserLogs: pagination race via stale page closure**
    - **File:** app/components/RoleDashboard.tsx
    - **Line:** 4125
    - **Severity:** MEDIUM
    - **Summary:** `loadUserLogs` computes `nextPage` from the `page` state variable captured in closure. Rapid "Tải thêm" clicks both read the same `page` value before either setState completes, causing the same page to be fetched twice and appended as duplicates.
    - **Failure scenario:** User clicks "Tải thêm hoạt động" twice rapidly. Both calls read page=0, compute nextPage=1, fetch page 1, and append the same 20 items. User sees 40 log entries with 20 duplicates.

28. **MyAssetsView: dual useEffect causes double-fetch on every refreshKey change**
    - **File:** app/components/RoleDashboard.tsx
    - **Line:** 2890
    - **Severity:** MEDIUM
    - **Summary:** Two separate useEffects both depend on `[profile.email, refreshKey]`. When `refreshKey` increments, BOTH effects fire, triggering two concurrent `loadData()` calls. The second useEffect also sets up a duplicate Supabase realtime subscription on every refreshKey change.
    - **Failure scenario:** User clicks "Tôi đã tự gia hạn". refreshKey increments. Two `loadData()` calls fire simultaneously. Additionally, two realtime channels are active briefly, compounding redundant fetches.

29. **UserDashboard.loadInitialData: no request cancellation on rapid filter changes**
    - **File:** app/components/RoleDashboard.tsx
    - **Line:** 579
    - **Severity:** MEDIUM
    - **Summary:** useEffect depends on 8 state variables. Changing filters rapidly fires concurrent `loadInitialData` calls with no AbortController. Slow earlier requests can resolve after faster later ones, overwriting fresh data with stale results.
    - **Failure scenario:** User clicks Track 1, then Track 2, then Track 3 quickly. Three `loadInitialData` calls fire. Track 3 response arrives first. Track 1 response arrives last and overwrites with Track 1 data. UI shows Track 3 filter selected but Track 1 data.

30. **handleCreateProject: Enter key bypasses isCreating guard**
    - **File:** app/components/RoleDashboard.tsx
    - **Line:** 5008
    - **Severity:** MEDIUM
    - **Summary:** The project name input's `onKeyDown` handler calls `handleCreateProject()` directly on Enter without checking the `isCreating` flag. While the button is properly disabled during creation, the Enter key path bypasses this guard.
    - **Failure scenario:** User types a project name and presses Enter rapidly. Each Enter keystroke calls `handleCreateProject()` before `isCreating` is set, creating duplicate projects.

31. **formatChartDate can display wrong day for date-only strings**
    - **File:** lib/dashboard-supabase.ts
    - **Line:** 500
    - **Severity:** MEDIUM
    - **Summary:** `formatChartDate(value)` does `new Date(value)` where value is an ISO date string sliced to YYYY-MM-DD. `new Date('2026-06-26')` is parsed as UTC midnight. `Intl.DateTimeFormat('vi-VN')` then formats it in local time. In any timezone west of UTC (e.g., Americas), this will display the previous day.
    - **Failure scenario:** dailyMap key is '2026-06-26'. In UTC-5 (US Eastern), this formats as June 25 19:00 → displays '25/06' instead of '26/06'. Chart x-axis labels show wrong dates.

32. **getPeriodStart uses server-local new Date() for analytics window boundaries**
    - **File:** lib/dashboard-supabase.ts
    - **Line:** 494
    - **Severity:** MEDIUM
    - **Summary:** `getPeriodStart()` creates `new Date()` (server local time), subtracts days, sets hours to 0/0/0/0 in server-local timezone. If the server runs in UTC but users are in UTC+7, the "7d" window starts at UTC midnight 6 days ago, which is 7am Vietnam-time — misaligning the analytics window.
    - **Failure scenario:** Server in UTC, user in UTC+7. User clicks "7 ngày" at 2026-07-02T14:00+07:00. `getPeriodStart('7d')` returns 2026-06-26T00:00:00Z = 2026-06-26T07:00:00+07:00. User expects data from midnight June 26 Vietnam-time, but gets data from 7am June 26, losing 7 hours of data.

33. **Multiple setTimeout callbacks lack cleanup on component unmount**
    - **File:** app/components/RoleDashboard.tsx
    - **Line:** 459
    - **Severity:** MEDIUM
    - **Summary:** `showWipToast`, `handleDeleteWip` animation, `handleMoveWip` animation, and 5+ other locations use `setTimeout` to update state without storing the timer ID or cleaning up in useEffect. If the component unmounts before the timeout fires, React logs a warning and the state update is silently dropped.
    - **Failure scenario:** User triggers a WIP delete, then immediately navigates away. The 500ms setTimeout fires after unmount, calling `setWips` on an unmounted component.

34. **Upload Asset modal is a non-functional stub**
    - **File:** app/components/RoleDashboard.tsx
    - **Line:** 564
    - **Severity:** MEDIUM
    - **Summary:** `handleUploadSubmit` just closes the modal and clears state without sending data anywhere. The form collects title, type, project, and content but discards everything on submit. This is a broken user flow that appears functional but performs no action.
    - **Failure scenario:** Users click "Upload Asset", fill in the form, click submit, and nothing happens — their content is silently discarded.

35. **Hardcoded fallback API base URL in chat route**
    - **File:** app/api/chat/route.ts
    - **Line:** 12
    - **Severity:** MEDIUM
    - **Summary:** The OpenAI-compatible client has a hardcoded fallback URL: `process.env.SHOPAIKEY_BASE_URL || 'https://api.shopaikey.com/v1'`. If the env var is unset, traffic silently routes to this hardcoded third-party endpoint.
    - **Failure scenario:** In a staging/DR environment where env vars are not configured, API traffic (including potentially sensitive prompts and user data) is sent to an unintended third-party endpoint.

---

## Summary

| Severity | Count | Key impact |
|---|---|---|
| CRITICAL | 8 | All API routes are completely unauthenticated; any unauthenticated client can consume AI credits, inject messages into other users' conversations, impersonate authors, and read/write all database tables via the public anon key. |
| HIGH | 15 | Race conditions create duplicate likes/messages/sessions/licenses; IDOR vulnerabilities allow any user to delete/edit other users' data; timezone bugs cause licenses to show as expired prematurely; 1000x cost calculation discrepancy misleads admins. |
| MEDIUM | 12 | Silent error swallowing masks system failures; stale closure races cause duplicate data; pagination races create duplicate log entries; unmounted component state updates; non-functional upload modal. |

### Notable non-bug findings (not counted in 35)

- 15 of 20 recent commits lack conventional commit prefixes (feat:/fix:/chore:)
- 9 `any` type usages bypass TypeScript safety across chart components and API routes
- 91 console.error statements in production code with no structured logging
- Broad eslint-disable directives suppress entire categories of linting in RoleDashboard.tsx (5138 lines)
- Default avatar color '#E3000F' hardcoded in 8+ locations instead of extracted to a constant
- Hardcoded external URLs (logo, Google Drive) should be environment variables
- Six exported helper functions in dashboard-supabase.ts are never called (dead code)
- supabase-queries.ts exports functions never imported anywhere — fully dead code with mock data
- SkillLibraryRow interface missing `session_tokens` and `project_id` fields used in WIP mapping functions
- Hardcoded mock author mappings in supabase-queries.ts return stale data for real users

### Verification notes

- Finding 1: Read all 3 API route files (109+151+92 lines), confirmed zero auth checks in any route.
- Finding 2: Read extract-skills/route.ts:12, confirmed `author_id` taken directly from request body.
- Finding 3: Read supabase_migration_chat.sql (64 lines), confirmed RLS only on conversations/messages tables.
- Finding 4: Read chat/route.ts:51, confirmed no ownership check on sessionId/conversationId.
- Finding 5: Read summarize-project/route.ts:10, confirmed no ownership check on projectId.
- Finding 6: Read all 3 API routes, confirmed all use `NEXT_PUBLIC_SUPABASE_ANON_KEY` without forwarding auth.
- Finding 7: Read dashboard-supabase.ts:619, confirmed `updateUserRole` callable from client with no RLS.
- Finding 8: Read summarize-project/route.ts:76 and extract-skills/route.ts:30, confirmed API key in URL.
- Finding 9: Read dashboard-supabase.ts:395-421, confirmed non-atomic SELECT→INSERT/DELETE pattern.
- Finding 10: Read RoleDashboard.tsx:4216-4239, confirmed read-modify-write on master_summary.
- Finding 11: Read RoleDashboard.tsx:469, confirmed delete/update by ID without ownership check.
- Finding 12: Read dashboard-supabase.ts:625, confirmed fetchProjects returns all rows.
- Finding 13: Read dashboard-supabase.ts:1172-1199, confirmed CRUD by ID without ownership check.
- Finding 14: Read chat/route.ts:51-97, confirmed inserts with no idempotency.
- Finding 15: Read extract-skills/route.ts:75, confirmed bulk insert with no ON CONFLICT.
- Finding 16: Read RoleDashboard.tsx:2188, confirmed no disabled state on submit button.
- Finding 17: Read RoleDashboard.tsx:2342, confirmed UTC midnight vs local time comparison.
- Finding 18: Read dashboard-supabase.ts:903, confirmed timezone-mismatched date comparison.
- Finding 19: Read dashboard-supabase.ts:487 and supabase-queries.ts:61-62, confirmed 1000x discrepancy.
- Finding 20: Read dashboard-supabase.ts:253, confirmed unbounded fetch for search.
- Finding 21: Read next.config.ts (7 lines), confirmed empty config with no security headers.
- Finding 22: Read AIChat.tsx:330-335, confirmed stale closure guard.
- Finding 23: Read AIChat.tsx:342-374, confirmed no concurrency guard on session creation.
- Finding 24: Read RoleDashboard.tsx:5123, confirmed no disabled state on save button.
- Finding 25: Read dashboard-supabase.ts:231, confirmed silent error swallowing pattern.
- Finding 26: Read AIChat.tsx:127, confirmed silent error swallowing.
- Finding 27: Read RoleDashboard.tsx:4125, confirmed pagination race.
- Finding 28: Read RoleDashboard.tsx:2890, confirmed dual useEffect.
- Finding 29: Read RoleDashboard.tsx:579, confirmed no AbortController.
- Finding 30: Read RoleDashboard.tsx:5008, confirmed Enter key bypasses guard.
- Finding 31: Read dashboard-supabase.ts:500, confirmed UTC midnight parsing.
- Finding 32: Read dashboard-supabase.ts:494, confirmed server-local timezone.
- Finding 33: Read RoleDashboard.tsx:459, confirmed setTimeout without cleanup.
- Finding 34: Read RoleDashboard.tsx:564, confirmed non-functional stub.
- Finding 35: Read chat/route.ts:12, confirmed hardcoded fallback URL.

### Out of scope (for follow-up)

- Dependency CVE scanning (use `cso` or a dedicated SCA tool)
- Accessibility and i18n completeness
- Performance/load testing
- Test coverage gaps (no test files found in the project)
- Third-party dependency version pinning
- Image optimization (no-img-element eslint disable)
