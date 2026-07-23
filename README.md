# Resume Studio

[![CI](https://github.com/SuryaRao-19/resume-studio/actions/workflows/ci.yml/badge.svg)](https://github.com/SuryaRao-19/resume-studio/actions/workflows/ci.yml)

Four AI-powered modes — **Build** (streaming), **Check**, **Optimize** (with a
before/after diff), and **Cover letter** — plus markdown-rendered output,
copy-to-clipboard, edit-before-save, and client-side PDF/DOCX export. React
frontend, Express + Prisma backend. All model calls happen on the backend; no
API key ever reaches the browser.

```
Resume/
  backend/    Express + TypeScript + Prisma (Postgres). Ollama or Anthropic.
  frontend/   Vite + React + TypeScript. Talks only to the backend.
  e2e/        Playwright end-to-end tests.
```

## Prerequisites

- Node.js 18+ and npm
- A PostgreSQL database
- An AI provider: **Ollama** (free, local, default) *or* an Anthropic API key

## Setup — zero-cost local run (Ollama + Docker Postgres)

This is the default configuration — no API costs, no key required. It takes you
from a fresh clone to the app running at http://localhost:5173.

```bash
# 0. Clone
git clone https://github.com/SuryaRao-19/resume-studio.git
cd resume-studio

# 1. Postgres in Docker (free)
docker run -d --name resume-pg --restart unless-stopped \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=resume_studio \
  -p 5433:5432 postgres:16-alpine

# 2. Ollama (free local LLM) — install from https://ollama.com, then:
ollama serve          # if not already running as a service
ollama pull llama3    # any chat model works; set OLLAMA_MODEL to match

# 3. Backend
cd backend
cp .env.example .env  # defaults are already set for this setup
npm install && npm run prisma:generate
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5433/resume_studio" npm run prisma:deploy

# (optional, recommended) create a non-superuser role so RLS is enforced:
docker exec -i resume-pg psql -U postgres -d resume_studio -c \
 "CREATE ROLE resume_app LOGIN PASSWORD 'resume_app_pw';
  GRANT USAGE ON SCHEMA public TO resume_app;
  GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO resume_app;"
# then point DATABASE_URL in .env at resume_app@127.0.0.1:5433

npm run dev           # http://localhost:4000

# 4. Frontend (new terminal)
cd frontend && cp .env.example .env
npm install && npm run dev   # http://localhost:5173
```

To use Claude instead, set `AI_PROVIDER=anthropic` and `ANTHROPIC_API_KEY` in
`backend/.env`. Everything else is identical.

> Note: on Windows/Docker, use `127.0.0.1` (not `localhost`) in `DATABASE_URL`
> so Node doesn't resolve to IPv6 `::1` while Docker binds IPv4.

> Port note: the backend defaults to `4000`. If something else is using it,
> set `PORT` in `backend/.env` and `VITE_API_BASE_URL` in `frontend/.env` to a
> free port (e.g. `4001`).

### Run the tests

With the stack running (Postgres, Ollama, backend, frontend):

```bash
# Backend unit tests (Vitest) — no stack required
cd backend && npm test

# End-to-end tests (Playwright) — requires the full stack running.
# Seeds its own magic-link token directly in Postgres, so no manual sign-in.
cd e2e && npm install && npx playwright install chromium && npm run test:e2e
```

## 1. Backend

```bash
cd backend
cp .env.example .env        # then edit .env with real values
npm install
npm run prisma:generate
npm run prisma:deploy       # applies the migration incl. RLS policies
npm run dev                 # http://localhost:4000
```

`.env` values:

| Var                  | Purpose                                             |
| -------------------- | --------------------------------------------------- |
| `ANTHROPIC_API_KEY`  | Anthropic Messages API key (server-side only)       |
| `DATABASE_URL`       | Postgres connection string                          |
| `AUTH_SECRET`        | Long random string used to sign session JWTs        |
| `RATE_LIMIT_PER_HOUR`| AI requests/hour per user/IP (default 20)           |
| `PORT`               | Backend port (default 4000)                         |
| `FRONTEND_ORIGIN`    | Frontend origin, for CORS + magic-link URLs         |
| `COOKIE_SECURE`      | `true` in production (HTTPS)                         |

### Row-level security

The migration enables and **forces** RLS on `resumes` and `resume_reports`.
Policies read `app.current_user_id`, which the app sets per request via
`withUser()`. Run the app with a **non-superuser** Postgres role — superusers
bypass RLS. App-level `user_id` filters are the primary guard; RLS is the
second layer.

### Auth (magic link)

`POST /api/auth/request-link` prints the sign-in link to the backend console in
development. To send real email, replace the `console.log` in
`src/routes/auth.ts` with your email provider's send call — the token/link is
already generated for you.

## 2. Frontend

```bash
cd frontend
cp .env.example .env        # set VITE_API_BASE_URL to the backend URL
npm install
npm run dev                 # http://localhost:5173
```

## API endpoints

| Method | Path                     | Auth | Notes                                    |
| ------ | ------------------------ | ---- | ---------------------------------------- |
| POST   | `/api/auth/request-link` | no   | `{ email }` → magic link                 |
| GET    | `/api/auth/verify`       | no   | `?token=` → sets session cookie          |
| GET    | `/api/auth/me`           | yes  | current session                          |
| POST   | `/api/auth/logout`       | no   | clears session                           |
| POST   | `/api/build`             | yes  | `{ role, tone, history, skills, education }` → `{ resumeText }` |
| POST   | `/api/build/stream`      | yes  | same input; streams the draft as Server-Sent Events |
| POST   | `/api/check`             | yes  | `{ resumeText }` → score/strengths/issues/ats_flags |
| POST   | `/api/optimize`          | yes  | `{ resumeText, jobDescription }` → match report + `tailored_resume` |
| POST   | `/api/cover-letter`      | yes  | `{ resumeText, jobDescription, tone }` → `{ letterText }` |
| POST   | `/api/resumes`           | yes  | save a resume (+ optional `report` for check/optimize) |
| GET    | `/api/resumes`           | yes  | light list of your resumes               |
| GET    | `/api/resumes/:id`       | yes  | full content + latest report (404 if not yours) |
| DELETE | `/api/resumes/:id`       | yes  | delete (404 if not yours)                |

The three AI endpoints are rate limited per user/IP (`RATE_LIMIT_PER_HOUR`).

## Security notes

- The Anthropic key is used only in `backend/src/lib/anthropic.ts`. The frontend
  bundle contains no key and never calls `api.anthropic.com` — verify with:
  ```bash
  cd frontend && npm run build
  grep -r "ANTHROPIC_API_KEY" dist/ ; grep -r "api.anthropic.com" dist/
  ```
  Both greps should return nothing.
- Ownership checks return `404` (not `403`) for resumes that don't exist *or*
  aren't yours, so ids can't be probed.
- Errors never leak stack traces, model output, or DB errors to the client.

## Deployment — 100% free (no credit card)

The whole app can run hosted at **zero cost** by swapping the local Ollama for a
free-tier OpenAI-compatible LLM. Recommended stack:

| Piece    | Host                              | Notes                                   |
| -------- | --------------------------------- | --------------------------------------- |
| Frontend | Cloudflare Pages (or Vercel)      | static build of `frontend/dist/`        |
| Backend  | Render free web service           | uses `render.yaml`; ~50s cold start when idle |
| Postgres | Neon free tier                    | copy its connection string to `DATABASE_URL` |
| LLM      | Groq free tier (OpenAI-compatible)| set `AI_PROVIDER=openai`, `OPENAI_API_KEY` |

Steps:

1. **Neon** — create a free project, copy the pooled connection string.
2. **Groq** — sign up at https://console.groq.com, create an API key (no card).
3. **Backend on Render** — *New > Blueprint*, point at this repo (uses
   `render.yaml`, which builds from `backend/`). Fill the secret env vars it
   asks for: `DATABASE_URL` (Neon), `AUTH_SECRET` (long random string),
   `OPENAI_API_KEY` (Groq), and `FRONTEND_ORIGIN` (set after step 4).
4. **Frontend on Cloudflare Pages** — build command `npm run build`, output
   `frontend/dist`, and set `VITE_API_BASE_URL` to the Render backend URL. Then
   set the backend's `FRONTEND_ORIGIN` to the Pages URL and redeploy.

To use a different free provider instead of Groq, just change `OPENAI_BASE_URL`
and `OPENAI_MODEL` (OpenRouter and Gemini both expose OpenAI-compatible
endpoints — see `backend/.env.example`).

> Heads-up on free tiers: the Render backend sleeps when idle (first request
> after a lull takes ~50s), and the free LLM has per-minute rate limits. Fine
> for a demo/portfolio app. The magic-link sign-in still logs to the server
> console — wire a real email sender in `src/routes/auth.ts` for public use.

### Manual / other hosts

Frontend and backend deploy as **separate services**, wired via env vars:

- **Frontend** (static host — Vercel/Netlify/Cloudflare Pages): build with
  `npm run build` (output in `frontend/dist/`). Set `VITE_API_BASE_URL` to the
  deployed backend URL at build time.
- **Backend** (Node host — Render/Fly/Railway): `npm run build` then
  `npm run start`. Set all backend env vars; run `npm run prisma:deploy` on
  release to apply migrations. Set `FRONTEND_ORIGIN` to the deployed frontend
  origin and `COOKIE_SECURE=true`.

Because the session cookie is cross-site in production, serve both over HTTPS.
For a stricter setup, put both behind one domain (e.g. frontend at `/`, backend
at `/api` via a reverse proxy) so the cookie is first-party.
