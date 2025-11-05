---
applyTo: **
---

# OER_tutor Agent Guide
## Architecture
- **Stack** Next.js 15 App Router frontend in app/, FastAPI+Beanie backend in backend/, linked through cookie auth via the /api rewrite.
- **Routing** Next.js rewrites /api/* to ${NEXT_PUBLIC_API_BASE_URL}/api/v1/* (see next.config.mjs); keep frontend calls relative so the proxy and cookies work.
- **State** MongoDB models live in backend/db/models.py and register through initDb() in backend/db/mongo_service.py during FastAPI lifespan startup.
- **LLM Services** LangChain/LangGraph workflows (backend/graph.py, backend/tools.py, backend/features/chat) orchestrate tutoring flows and expect OpenAI keys set in backend/.env.
- **Infrastructure** AWS SAM template.yaml deploys backend as Lambda container with S3-backed textbook assets; avoid breaking env var names used there.
## Backend
- **Entry point** backend/main.py wires routers under /api/v1, applies custom OpenAPI, initializes Mongo, and enables permissive CORS for dev.
- **Domain layout** Each feature keeps pydantic request/response models in backend/features/*/models.py and logic in service.py, while backend/routes/* exposes HTTP endpoints.
- **Authentication** Use backend/features/auth/service.hash_password() + validate_cookie_token() for any auth flow; login issues HTTPOnly cookie, so new routes must Depend on validate_cookie_token.
- **Data models** Beanie Documents (User, Textbook, UserConversation, UserQuiz, UserFlashcards) live in backend/db/models.py; add new documents here and register in initDb().
- **Storage/S3** backend/db/s3_service.py centralizes presigned URL generation; reuse helpers instead of calling boto3 directly so Lambda creds and regions stay consistent.
## Frontend
- **Providers** Root layout wraps pages with AuthProvider from hooks/use-auth.tsx and Toaster; new components needing auth must consume useAuth() inside client code.
- **Auth client** use-auth.tsx posts form-urlencoded credentials to /api/auth/login and refreshes status via credentials:"include"; keep this pattern for cookie-based auth.
- **Study flow** components/study-interface.tsx expects textbook metadata from /api/textbooks/:id with chapters array and PDF links; update backend responses carefully to preserve these fields.
- **Library** components/textbook-library.tsx fetches /api/textbooks/list on mount and handles 401 by prompting login; maintain consistent JSON shape (textbooks array with id/title/author/subject/cover).
- **UI system** Shared UI primitives live under components/ui/ and assume Tailwind classes configured in tailwind.config.ts and styles/globals.css.
## Workflows
- **Frontend dev** From repo root run npm install --legacy-peer-deps then npm run dev (relies on .env with NEXT_PUBLIC_API_BASE_URL pointing at backend).
- **Backend dev** Use Python 3.13, create venv, pip install -r backend/requirements.txt, then uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000 from repo root.
- **Concurrent run** Optionally run both with two terminals; package.json script dev:all exists but lacks host argument, so prefer manual commands.
- **E2E tests** Playwright tests live in tests/e2e; run npm run test:e2e after npm install and npx playwright install.
- **Env files** Copy .env.example to .env at repo root (frontend) and backend/.env.example to backend/.env for keys, Mongo URI, and S3 settings.
## Conventions & Gotchas
- **API versions** Frontend assumes /api/v1 responses; when adding endpoints keep version prefix and align pydantic response_model with actual payload.
- **Error handling** Custom 422 handler returns {"detail": "Inproper request format."}; ensure new validation errors respect this simplified shape.
- **Cookie security** Login currently sets secure=False for local dev; leave TODO note intact and avoid toggling unless configuring HTTPS.
- **Timing attacks** auth.login hashes passwords even for missing users and compares with hmac.compare_digest; preserve that flow when refactoring.
- **Deployment** AWS template reads secrets from Secrets Manager keys (MONGO_URI, S3_BUCKET, etc.); keep naming consistent when adding config knobs.
