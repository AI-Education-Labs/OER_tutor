# Codebase Audit — OER Tutor (TextbookAI)

**Date:** 2026-03-18
**Branch audited:** Dev
**Stack:** Next.js 15 (App Router) + FastAPI + MongoDB + OpenAI + AWS Lambda

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Critical — Fix Immediately](#critical--fix-immediately)
3. [High Priority — Fix Soon](#high-priority--fix-soon)
4. [Medium Priority — Next Sprint](#medium-priority--next-sprint)
5. [Low Priority — Technical Debt](#low-priority--technical-debt)
6. [Architecture Overview & Observations](#architecture-overview--observations)

---

## Executive Summary

This codebase is a functional AI-powered tutoring platform built during a senior capstone. The architecture (Next.js + FastAPI + MongoDB + AWS Lambda) is sound, but the rapid learning-while-building approach left significant technical debt. The most urgent issues are **security vulnerabilities in the backend** (password hashing, CORS, token expiration, unprotected routes) and **the build pipeline silently ignoring all TypeScript and ESLint errors**. Fixing the critical and high-priority items below will make the platform substantially more production-ready.

---

## Critical — Fix Immediately

### ~~1. SHA-256 Used for Password Hashing~~ DONE

Replaced with `bcrypt.hashpw()` / `bcrypt.checkpw()`. Added gradual migration: legacy SHA-256 hashes are auto-detected and re-hashed with bcrypt on next login. New registrations use bcrypt only.

---

### ~~2. Wildcard CORS with Credentials Enabled~~ DONE

Added `ALLOWED_ORIGINS` env var to `config.py` (defaults to `http://localhost:3000`). `main.py` now parses it into a list for the CORS middleware. Production sets the real frontend URL via environment variable.

---

### ~~3. Build Pipeline Ignores All Errors~~ DONE

Removed both `eslint.ignoreDuringBuilds` and `typescript.ignoreBuildErrors` from `next.config.mjs`. Fixed all resulting build errors (async params type, ref type annotation). Also deleted 27 unused scaffolded shadcn/ui components and installed missing `next-themes` dependency.

---

### ~~4. Default Secret Key for JWT Signing~~ DONE

Changed `SECRET_KEY` default to `""`. Added startup validation in `on_startup` that raises `RuntimeError` if `SECRET_KEY` is empty or still the old default. Also validates `MONGO_URI` and `OPENAI_API_KEY`.

---

### ~~5. JWT Token Expiration Set to ~34 Days~~ DONE

Reduced `ACCESS_TOKEN_EXPIRE_MINUTES` from 50000 (~34 days) to 10080 (7 days). Existing tokens with the old expiration will naturally expire.

---

### ~~6. Unprotected Textbook Routes~~ DONE

Added `view_type: str = "public"` field to the `Textbook` model. All 3 unprotected routes now use `validate_access_token_optional` and return 401 for non-public textbooks when no token is provided. Public textbooks remain accessible without auth. Removed the TODO comment.

---

### ~~7. Inconsistent JWT Claim Reading~~ DONE

Removed duplicate `"user_id"` claim from token creation. Both `validate_access_token` and `validate_access_token_optional` now read from `"sub"` consistently.

---

## High Priority — Fix Soon

### 8. No Rate Limiting on AI Endpoints

The `/flashcards/generate`, `/quiz/generate`, `/study-guide/generate`, and `/chat` endpoints all call the OpenAI API with no rate limiting. A single user (or bot) can run up the OpenAI bill.

**Fix:** Add per-user rate limiting via middleware (e.g., `slowapi`) or at the API Gateway level.

---

### 9. No Centralized API Client (Frontend)

Every component builds its own `fetch()` call with `process.env.NEXT_PUBLIC_API_BASE_URL`, manually attaches the token from `localStorage`, and handles errors differently (or not at all). This pattern is repeated in at least 10 components.

**Fix:** Create a single `lib/api.ts` client that handles base URL, auth headers, error parsing, and token refresh in one place. All components call this client.

---

### 10. 50+ Console.log Statements in Production Code

Debug logging is scattered across nearly every component and route handler:

| Location | Approx. count |
|---|---|
| `components/ai-chat-panel.tsx` | ~40 (many with `[v0]` prefix) |
| `components/study-interface.tsx` | ~15 |
| `components/pdf-viewer.tsx` | ~10 |
| `backend/routes/chat.py` | ~10 |
| `backend/features/auth/service.py` | ~8 |
| `backend/routes/textbooks.py` | ~6 |
| Various other files | ~15 |

**Fix:** Remove all `console.log` / `print()` debug statements. For backend, use the existing `logger` from `logging`. For frontend, use a wrapper that is silent in production.

---

### 11. No Backend Unit or Integration Tests

There are zero Python test files. The only tests are Playwright E2E tests, and those:
- Make real OpenAI API calls (costs money, flaky)
- Use hardcoded credentials (`username: 'coda2'`, `password: 'codacoda'`)
- Are not run in CI (no workflow step for them)
- Have multiple TODO comments acknowledging these problems

**Fix:** Add pytest tests for auth, routes, and services. Mock the OpenAI client. Add a CI step.

---

### 12. CI/CD Pipeline Has No Quality Gates

Both GitHub Actions workflows (`deploy-fastapi-dev.yml`, `deploy-fastapi-main.yml`):
- Run no linting
- Run no tests
- Run no type checking
- Run no security scanning
- Build and deploy directly on push

**Fix:** Add lint, test, and type-check steps before the Docker build. Fail the pipeline on errors.

---

### ~~13. Regex Injection in Textbook Search~~ DONE

User-supplied query is now escaped with `re.escape()` before passing to MongoDB `$regex`. The `code` field exact match is unchanged.

---

### ~~14. `dangerouslySetInnerHTML` Without Sanitization~~ DONE

Added `DOMPurify.sanitize()` to `utils/markdown.tsx` and `components/key-concepts-panel.tsx`. Installed `dompurify` as a dependency.

---

### 15. No Health Check Endpoint

There is no `/health` or `/ready` endpoint in the FastAPI app. The Lambda has no way to report its health, and monitoring tools have nothing to ping.

**Fix:** Add a simple `GET /health` that returns `200 OK` and optionally checks the MongoDB connection.

---

### ~~16. Unreachable Code After `uvicorn.run()`~~ DONE

Moved `ensure_mongo_connection()` into the `@app.on_event("startup")` handler. Removed the unreachable `asyncio.run()` call and unused `asyncio` import.

---

### ~~17. Triple `load_dotenv` Import/Call~~ DONE

Removed two duplicate `load_dotenv` imports and the unconditional call. Only the Lambda-aware conditional block remains.

---

### ~~18. Deprecated `datetime.utcnow()`~~ DONE

Replaced all `datetime.utcnow()` with `datetime.now(timezone.utc)` in `auth/service.py` and `routes/chat.py`.

---

## Medium Priority — Next Sprint

### 19. Duplicate `MenuButton` Component

The same `MenuButton` component is copy-pasted (with minor variations) in three files:
- `components/flashcard-panel.tsx`
- `components/quiz-panel.tsx`
- `components/key-concepts-panel.tsx`

**Fix:** Extract to `components/ui/menu-button.tsx` and import.

---

### 20. Oversized Components

| Component | Lines | Suggested split |
|---|---|---|
| `study-interface.tsx` | ~942 | Extract panel layout, tool routing, header |
| `tutor-panel.tsx` | ~752 | Extract dialogue tree, progress tracker, chat section |
| `ai-chat-panel.tsx` | ~730 | Extract message list, input area, streaming logic |

These are hard to test, review, and maintain. Break each into focused sub-components.

---

### 21. Magic Numbers and Strings Everywhere

Examples:
- Tab widths: `160px`, `32px`, `35px` (hardcoded in `tab-group.tsx`)
- Toast delay: `1000000` ms (in `use-toast.ts`)
- Invite code length: `6` (in `routes/courses.py` and `routes/textbooks.py`)
- DB fetch limits: `50`, `100`, `200`, `5000` (various route files)
- Session storage keys: `"ai-chat-messages"`, `"current_session_id"`, etc.
- API prefix: `"/api/v1/"` repeated in every fetch call

**Fix:** Extract to a `constants/` file (frontend) and a `constants.py` (backend).

---

### 22. `any` Types in TypeScript

Found in:
- `ai-chat-panel.tsx` — `body: any`
- `flashcard-panel.tsx` — `previousDecks: any[]`, `doc: any`
- `quiz-panel.tsx` — `item: any`
- `key-concepts-panel.tsx` — `previousNotes: any[]`
- `study-interface.tsx` — `textbookData: any`

**Fix:** Define proper interfaces in `types/` and replace `any` usages.

---

### 23. LocalStorage Used as Auth Token Store

Access tokens are stored in `localStorage` and read with `localStorage.getItem("access_token")` in 10+ locations. `localStorage` is accessible to any JS on the page, making it an XSS target.

**Fix:** Consider `httpOnly` cookies for token storage. At minimum, centralize all token access into a single `lib/auth.ts` so the storage mechanism can be swapped later.

---

### 24. Inconsistent Error Handling Across Panels

- Some panels show `<Alert>` components on error
- Others silently fail or show a toast
- Some catch blocks are empty: `catch {}`
- Backend returns mixed status codes (`500` for client errors in some places)

**Fix:** Define a standard error-handling strategy for both frontend (error boundaries + consistent UI) and backend (consistent error response schema).

---

### 25. Missing Loading / Error States

Several components have no loading skeleton or error UI:
- `textbook-library.tsx` — no loading skeleton for the book grid
- `tutor-panel.tsx` — placeholder dots instead of proper loading state
- Multiple panels have no "empty state" when there's no data

**Fix:** Add `<Skeleton>` components for loading and a shared `<EmptyState>` component.

---

### 26. N+1 Query in Course Listing

**File:** `backend/routes/courses.py:89-103`

For each course, `get_enrollment_count()` is called individually. With many courses, this creates N+1 database round trips.

**Fix:** Use a MongoDB aggregation pipeline with `$lookup` to fetch enrollment counts in a single query.

---

### 27. No Database Migration System

Indexes are created on app startup via `ensure_course_indexes()`. There is no versioned migration system, so schema changes are ad-hoc and risky.

**Fix:** Adopt a migration tool (e.g., `mongomigrate` or a simple numbered-scripts approach) to version schema changes.

---

### 28. Duplicate and Conflicting Dependencies

**File:** `backend/requirements.txt`

- Both `PyPDF2==3.0.1` AND `pypdf==6.1.0` are installed (PyPDF2 is the legacy name)
- Multiple LangGraph packages that may conflict
- 136 total dependencies — large attack surface

**Fix:** Remove `PyPDF2` (use `pypdf` only). Audit and remove unused packages. Pin versions in a lockfile.

---

### 29. Deprecated GitHub Actions Versions

Both workflows use outdated action versions:
- `actions/checkout@v3` (current: v4)
- `aws-actions/configure-aws-credentials@v2` (current: v4)
- `appleboy/lambda-action@v0.2.0` (very old)

**Fix:** Update to latest versions to get security patches and features.

---

### 30. Hardcoded AWS Resource Names in CI

Both workflow files hardcode the AWS account ID, ECR repository name, and Lambda function names. If the infrastructure changes, the workflows break.

**Fix:** Move these to GitHub Secrets or read from CloudFormation outputs.

---

## Low Priority — Technical Debt

### 31. Dead / Commented-Out Code

- `ai-chat-panel.tsx:202-204` — commented-out `useEffect`
- `study-interface.tsx:418-423` — commented-out `fetch` with `keepalive`
- `study-interface.tsx:555-556` — TODO for unimplemented split functionality
- `tutor-panel.tsx:745` — unused "progress" tab
- `flashcard-panel.tsx:112-114` — commented-out default selection
- ~~`backend/main.py:83-84` — unreachable code after `uvicorn.run()`~~ (fixed in item 16)

**Fix:** Remove dead code. Convert TODOs to GitHub issues so they're tracked.

---

### 32. Inconsistent Naming Conventions

Frontend mixes `camelCase` and `snake_case` for the same concepts:
- `textbookId` vs `chapter_id` vs `chapterId`
- `selectedChapterId` vs `activeChapterId`

Backend API returns `snake_case` but frontend sometimes expects `camelCase`.

**Fix:** Standardize: `camelCase` in frontend, `snake_case` in backend. Transform at the API client boundary.

---

### 33. Missing Accessibility

- Buttons without `aria-label` attributes
- Error states that rely only on color
- Modals that don't trap focus
- No skip-to-content link

**Fix:** Run an accessibility audit (axe-core or Lighthouse) and fix high-impact issues.

---

### 34. PDF Viewer Performance

`pdf-viewer.tsx` renders all pages to canvas without virtualization. For large textbooks, this creates excessive DOM nodes and memory usage.

**Fix:** Implement virtualized rendering (only render visible pages + a small buffer).

---

### 35. State Management Complexity

Several components have 10+ `useState` declarations managing related state. No `useReducer` is used anywhere, even for complex state machines (e.g., `tutor-panel.tsx` dialogue trees).

**Fix:** Refactor complex state into `useReducer` or a lightweight state management solution.

---

### 36. Hardcoded Title in Study Interface

**File:** `components/study-interface.tsx:592`

The title "Research Methods in Psychology" is hardcoded instead of using the textbook's actual title from `textbookData`.

**Fix:** Replace with `textbookData.title` or equivalent.

---

### 37. No Structured Backend Logging

The backend uses `print()` for most debug output and has `logging.basicConfig(level=logging.INFO)` configured but rarely used. Lambda logs are harder to search and parse without structured (JSON) logging.

**Fix:** Replace `print()` with `logger.info/debug/error()`. Consider a JSON formatter for Lambda CloudWatch logs.

---

### 38. SAM Template Resource Limits

**File:** `template.yaml`

- Lambda timeout: 30 seconds (may be too short for LLM calls)
- Memory: 1024 MB (may be insufficient for PDF processing + LLM)
- No Dead Letter Queue for failed invocations
- No reserved concurrency limits

**Fix:** Increase timeout to 60-120s for AI endpoints. Add a DLQ. Set concurrency limits to control costs.

---

## Architecture Overview & Observations

### What's Working Well

- **Clean separation** of frontend and backend with clear API boundaries
- **App Router** usage in Next.js is modern and appropriate
- **Radix UI + Tailwind** is a solid component/styling foundation
- **Centralized color system** via CSS variables (recently implemented)
- **AWS Lambda deployment** with SAM is cost-effective for variable traffic
- **Langfuse instrumentation** for LLM observability is forward-thinking
- **MongoDB async driver** with proper connection pooling pattern

### Architecture Diagram

```
┌─────────────────────────────────┐
│        Next.js Frontend         │
│  (App Router, Radix UI, TW)    │
│         Port 3000               │
└──────────┬──────────────────────┘
           │ fetch /api/v1/*
           ▼
┌─────────────────────────────────┐
│       FastAPI Backend           │
│   (AWS Lambda via Mangum)       │
│         Port 8000               │
├──────────┬──────────┬───────────┤
│  MongoDB │  OpenAI  │    S3     │
│  (Atlas) │  (GPT)   │  (PDFs)  │
└──────────┴──────────┴───────────┘
```

### Suggested Priority Order

~~1. **Security hardening** (items 1-7) — DONE~~
~~2. **Enable build errors** (item 3) — DONE~~
3. **Centralize API client & auth** (items 9, 23) — Reduces duplication and improves security
4. **Add backend tests + CI gates** (items 11, 12) — Catches regressions
5. **Rate limiting** (item 8) — Protects the OpenAI budget
6. **Clean up console.log/print** (item 10) — Quick win for professionalism
7. **Everything else** — Prioritize by what's blocking feature work
