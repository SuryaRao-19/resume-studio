# Resume Studio — Complete Build Documentation

Five documents, in build order: **PRD → Technical Architecture → Security & Access → Frontend Specification → Feature Ticket List.**

---

# 01. Product Requirements Document

## Problem statement
Job seekers write resumes with no reliable feedback loop. They don't know if a bullet point is strong, whether their resume will survive an ATS parser, or how well it matches a specific job posting. Career coaches and professional resume writers are expensive and slow. Generic templates don't adapt to the person's actual experience or the job they're applying to.

## Target users
- **Primary**: Active job seekers (new grads through mid-career professionals) applying to multiple roles and needing fast, personalized feedback.
- **Secondary**: Career changers who have relevant experience but struggle to translate it into resume language for a new field.
- Typical user: moderately tech-comfortable, applying under time pressure, frustrated by generic advice ("use action verbs") that doesn't tell them *what to change*.

## Product vision
The fastest way to go from "messy notes" to "resume that gets past the filter and impresses the reader" — for any role, without hiring a coach.

## Core features

| Feature | Description | Priority |
|---|---|---|
| Builder | Turn rough notes/work history into a structured, ATS-friendly resume draft | must-have |
| Checker | Score an existing resume, list strengths/issues, flag ATS formatting risks | must-have |
| Optimizer | Compare a resume against a specific job description; return match score, missing keywords, tailored rewrite suggestions | must-have |
| Export to Word/PDF | Download the drafted or optimized resume as a formatted file | nice-to-have |
| Version history | Save multiple resume versions per user, tagged by target job | nice-to-have |
| Cover letter generator | Generate a matching cover letter from the same inputs | nice-to-have |

## App flow
1. User lands on the tool and picks a mode via tabs: Build, Check, or Optimize.
2. **Build**: user enters target role, work history notes, skills, education, tone → clicks "Draft resume" → sees generated draft.
3. **Check**: user pastes an existing resume → clicks "Check resume" → sees score, strengths, issues, ATS flags.
4. **Optimize**: user pastes resume + job description → clicks "Optimize" → sees match score, matched/missing keywords, rewrite suggestions, tailored summary.
5. (Future) user can save/export any output.

## Success metrics
- % of sessions that complete a generation (click Draft/Check/Optimize and receive output)
- Average resume score improvement between a user's first Check and a later Check of a revised version
- Time from landing to first generated output (target: under 60 seconds)
- Return usage rate (user runs Optimize against a second job description)

## What we are NOT building in v1
- Account system / login (v1 is stateless, single-session)
- Resume parsing from uploaded PDF/DOCX (v1 is paste-text only)
- Multi-page resume design/templating (v1 outputs plain text, formatting is a v2 concern)
- Job board integration or auto-apply
- Human reviewer marketplace

---

# 02. Technical Architecture Document

## Tech stack
- **Frontend**: Single-page HTML/CSS/vanilla JS (current implementation). For a v2 productized app: React + Vite, deployed as a static SPA.
- **AI layer**: Anthropic Messages API (`claude-sonnet-4-6`), called client-side in the current artifact version; for production, calls should be proxied through a backend (see Security doc — never expose API keys client-side in a real deployment).
- **Backend (v2, if adding accounts/saved resumes)**: Node.js + Express, or a serverless function layer (Cloudflare Workers / Vercel Functions).
- **Database (v2)**: PostgreSQL (Supabase or Neon) for user accounts and saved resume versions.
- **Hosting**: Static frontend on Vercel/Netlify/Cloudflare Pages; backend functions co-located.
- **Auth (v2)**: Email + magic link, or Google OAuth, via Supabase Auth or Clerk.

## File & folder structure (v2 production layout)
```
resume-studio/
  frontend/
    src/
      components/
        BuilderTab.jsx
        CheckerTab.jsx
        OptimizerTab.jsx
        ScoreBar.jsx
        KeywordChip.jsx
      lib/
        api.js            # wraps backend calls, never calls Anthropic directly
      App.jsx
      main.jsx
    index.html
    package.json
  backend/
    src/
      routes/
        build.ts           # POST /api/build
        check.ts           # POST /api/check
        optimize.ts        # POST /api/optimize
      lib/
        anthropicClient.ts # holds API key server-side only
        rateLimiter.ts
        promptTemplates.ts
      server.ts
    package.json
    .env.example
  README.md
```

## Database schema (v2 — only needed once accounts/saving are added)

**users**
| field | type | notes |
|---|---|---|
| id | uuid, PK | |
| email | text, unique | |
| created_at | timestamptz | |

**resumes**
| field | type | notes |
|---|---|---|
| id | uuid, PK | |
| user_id | uuid, FK → users.id | |
| title | text | user-given label, e.g. "PM resume — fintech" |
| content | text | latest resume body |
| mode_origin | text | one of `build`, `check`, `optimize` |
| created_at | timestamptz | |
| updated_at | timestamptz | |

**resume_reports**
| field | type | notes |
|---|---|---|
| id | uuid, PK | |
| resume_id | uuid, FK → resumes.id | |
| type | text | `check` or `optimize` |
| score | integer | 0–100 |
| report_json | jsonb | full structured output (strengths, issues, keywords, etc.) |
| job_description | text, nullable | only set for `optimize` reports |
| created_at | timestamptz | |

v1 (current artifact) has no database — all state lives in the browser session and is discarded on refresh.

## Environment & config (v2)
- `ANTHROPIC_API_KEY` — server-side only, never sent to the browser.
- `DATABASE_URL` — Postgres connection string.
- `AUTH_SECRET` — session/JWT signing secret.
- `RATE_LIMIT_PER_IP` — requests per hour, e.g. `20`.
- Never hardcode any of the above; load via `.env` locally and the hosting provider's secret manager in production.

---

# 03. Security & Access Document

## Authentication method
- v1: none — anonymous, stateless tool.
- v2: email magic link (no passwords to manage/leak) or Google OAuth, via a managed auth provider (Supabase Auth / Clerk) rather than hand-rolled auth.

## User roles & permissions
| Role | Can do | Cannot do |
|---|---|---|
| Anonymous (v1) | Use Build/Check/Optimize in-session | Save, retrieve past resumes |
| Registered user (v2) | Save resumes, view own history, delete own resumes, run all three modes | View or modify another user's resumes |
| Admin (v2, internal only) | View aggregate usage metrics | Access individual users' resume content without cause |

## Row-level security
- Every `resumes` and `resume_reports` row is scoped to `user_id`.
- All queries must filter by the authenticated user's id — enforced at the database layer (Postgres RLS policies), not just in application code, so a bug in one endpoint can't leak another user's data.
- Resume content is personal data (career history, sometimes contact info) — treat it with the same care as PII even though it isn't financial data.

## Error handling
| Failure | Response |
|---|---|
| Anthropic API down / times out | Show "Something went wrong. Try again." — never expose raw error text or stack traces to the user |
| Model returns malformed JSON (Check/Optimize) | Attempt to parse; on failure show "Could not parse a report. Try again." rather than crashing the panel |
| Empty required field (e.g. no resume pasted) | Inline message telling the user what's missing; do not call the API |
| Rate limit exceeded | Clear message: "You've hit the hourly limit — try again in a few minutes" |
| Payment/quota exhausted on backend (v2) | Fail gracefully with a generic "Service temporarily unavailable" — never surface billing details to end users |

## Edge cases to handle before launch
- Extremely long paste (e.g. a 10-page resume or full job posting) — truncate or warn before sending, since `max_tokens` and input size are bounded.
- Resume/job description pasted with copy-paste artifacts (weird whitespace, bullet characters, tabs) — normalize before sending to the model.
- User submits non-resume text (e.g. random text) to Check — the model should still respond gracefully rather than erroring, but the resulting low score is expected/correct behavior, not a bug.
- Rapid repeated clicks on "Draft/Check/Optimize" — disable the button while a request is in flight to avoid duplicate API calls.
- API key exposure: the current single-file artifact calls the Anthropic API directly from client-side JS. This is acceptable only inside the sandboxed artifact environment where the key is injected server-side by the host and never visible to the page. **If this app is ever deployed as a standalone website, all Anthropic API calls must move behind a backend endpoint** — a client-exposed API key is a critical vulnerability, not an edge case to defer.

---

# 04. Frontend Specification Document

## Color palette
Editorial/paper theme, distinct per light/dark mode.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--paper` | `#F6F3EC` | `#22261F` | page/background |
| `--ink` | `#1F2620` | `#EDE8DA` | primary text |
| `--ink-soft` | `#4A5147` | `#B9B29B` | secondary/meta text |
| `--rule` | `#C9C2AE` | `#454A3B` | hairline borders |
| `--rule-strong` | `#9B927A` | `#5C6350` | emphasized borders |
| `--signal` | `#B4562B` | `#E28855` | accent (score bar, active tab, kicker) |
| `--good` / `--good-bg` | `#3E6B4C` / `#E3EEE3` | `#8FC49E` / `#25332A` | strengths, matched keywords |
| `--bad` / `--bad-bg` | `#A23B2E` / `#F4E1DC` | `#E28776` / `#3A2622` | issues, missing keywords |

## Typography
- **Body/display**: Georgia (serif) — gives the tool an "editorial document" feel appropriate to resumes.
- **Labels/meta/kicker**: Courier New (monospace), uppercase, letter-spacing 0.05–0.12em — used for tab labels, field labels, score meta, chips. Creates a typewriter/form-field contrast against the serif body.
- **Sizes**: title 22px/500, section headers 15px/500, body/output 14–14.5px/1.55–1.7 line height, meta/labels 11–12px.

## Component styles
- **Tabs**: flat text buttons, active tab underlined in `--signal`, 2px bottom border.
- **Inputs/textareas**: 1px `--rule` border, 4px radius, `--paper` background, focus state switches border to `--signal`.
- **Primary button**: solid `--ink` background, `--paper` text, 4px radius, no shadow.
- **Score display**: large number (44px/500) + horizontal bar (`--rule` track, `--signal` fill, animated width transition).
- **Keyword chips**: small monospace pills — green (`--good-bg`/`--good`) for matched, red (`--bad-bg`/`--bad`) for missing.
- **Lists**: strengths use green bullet markers, issues/flags use red bullet markers.

## Spacing & layout
- Container: single card, 12px radius, hairline border, max content width governed by host (680px reference).
- Two-column grid (`1fr 1fr`, 1.25rem gap) for Build and Optimize input panels; collapses to one column under 640px.
- Section vertical rhythm: 1rem field spacing, 1.25rem dividers between input and output areas.

## API & integrations
**Anthropic Messages API** (`https://api.anthropic.com/v1/messages`)
- Model: `claude-sonnet-4-6`, `max_tokens: 1600`.
- **Build**: system prompt instructs plain-text resume generation; user message carries role/tone/history/skills/education. Response: raw resume text.
- **Check**: system prompt demands strict JSON output — `{score, strengths[], issues[], ats_flags[]}`. Response parsed and rendered as score bar + lists.
- **Optimize**: system prompt demands strict JSON — `{match_score, matched_keywords[], missing_keywords[], rewrite_suggestions[], tailored_summary}`. Response parsed and rendered as score bar + keyword chips + suggestion list + summary block.
- All responses are parsed defensively (strip markdown fences, `try/catch` JSON.parse) with a user-facing fallback message on failure.
- **v2 addition**: export endpoint that takes final resume text and returns a formatted .docx (server-side, using a docx-generation library), and optionally a save endpoint that writes to the `resumes` table.

---

# 05. Feature Ticket List

*(Derived from the PRD above — one ticket per buildable unit of work.)*

### Must-have (v1 — already built in the current artifact)
1. **Tabbed shell** — Build/Check/Optimize tab switcher, single active panel visible at a time.
   - *Acceptance*: clicking a tab shows only that panel's content; state in other panels is preserved.
2. **Build panel** — form (role, history, skills, education, tone) + "Draft resume" button + output area.
   - *Acceptance*: clicking Draft with history filled sends a request and renders plain-text resume output; empty history shows an inline prompt instead of calling the API.
3. **Check panel** — resume paste box + "Check resume" button + score/strengths/issues/ATS-flags output.
   - *Acceptance*: valid resume text returns a 0–100 score, at least 3 strengths, at least 3 issues; malformed model output shows a graceful fallback message, not a crash.
4. **Optimize panel** — resume + job description paste boxes + "Optimize" button + match score/keyword chips/rewrite suggestions/tailored summary output.
   - *Acceptance*: both fields required before the call fires; output renders matched (green) and missing (red) keyword chips plus a pasteable tailored summary.
5. **Loading & error states** — every action shows a loading message while in flight and a plain-language error message on failure.
   - *Acceptance*: no raw error objects or stack traces ever reach the UI.

### Should-have (v2)
6. **Move API calls behind a backend proxy** — depends on ticket 3/4/2 existing; blocks any public deployment.
   - *Acceptance*: browser network tab shows requests only to our own domain, never to `api.anthropic.com` directly; API key is not present anywhere in client-side code or network traffic.
7. **Export resume to .docx/PDF** — depends on Build/Optimize output existing.
   - *Acceptance*: clicking Export downloads a correctly formatted file matching the on-screen text.
8. **Rate limiting** — depends on backend proxy (ticket 6).
   - *Acceptance*: after N requests/hour from one IP/session, further requests return the rate-limit message instead of calling the model.

### Nice-to-have (v2+)
9. **Accounts + saved resume versions** — depends on ticket 6 (backend must exist first).
   - *Acceptance*: a logged-in user can save a resume, see it in a list, reopen and re-edit it; a different logged-in user cannot see it.
10. **Cover letter generator** — depends on Build/Optimize inputs being reusable.
    - *Acceptance*: given the same resume + job description inputs, produces a distinct cover-letter output in a new panel/tab.
11. **PDF/DOCX resume upload with parsing** — depends on ticket 7's formatting knowledge being available for round-tripping.
    - *Acceptance*: uploading a real-world resume file extracts clean text into the Check/Optimize paste boxes with no manual retyping.
