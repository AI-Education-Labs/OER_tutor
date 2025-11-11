# Next.js Proxy Removal - Executive Summary

## What Changed

PR #58 removes the Next.js proxy layer (`app/api/*` routes) and makes the frontend call the FastAPI backend (`/api/v1/*`) directly.

**Before**: `Client → Next.js Proxy → FastAPI Backend`  
**After**: `Client → FastAPI Backend`

---

## Key Changes Made by the Proxy

### 1. **Authentication Cookie Management** 🔴 CRITICAL

**Old (Proxy)**:
- Automatically set HttpOnly cookies with access tokens
- Extracted tokens from cookies for protected routes
- Client didn't need to manage tokens

**New (Direct Backend)**:
- Tokens only returned in response body
- Client stores tokens in localStorage
- Client must include `Authorization: Bearer {token}` header manually

**Impact**: Less secure (XSS vulnerability), more client responsibility

---

### 2. **Content Type Flexibility**

**Old (Proxy)**:
- Login accepted both JSON and form data
- Automatically converted between formats

**New (Direct Backend)**:
- Login only accepts `application/x-www-form-urlencoded`
- Client must send correct format

---

### 3. **Response Normalization**

**Old (Proxy)**:
- Normalized chapter responses: `{ chapters: [...] }`
- Wrapped raw text in `{ raw: text }` if JSON parsing failed

**New (Direct Backend)**:
- Returns data as-is from backend
- No automatic normalization

---

### 4. **Error Handling & Fallbacks**

**Old (Proxy)**:
- Provided fallback responses when backend was down
- Normalized error messages
- Could map error codes

**New (Direct Backend)**:
- Direct backend errors to client
- No fallback data
- Client must handle all error cases

---

### 5. **URL Structure**

**Old (Proxy)**: `/api/auth/login`, `/api/flashcards`, `/api/chapters/[id]`  
**New (Direct)**: `/api/v1/auth/token`, `/api/v1/flashcards/list`, `/api/v1/textbooks/[id]/chapters`

---

## Bugs Found in PR #58

### 🐛 Critical Bugs

1. **Flashcard Endpoint Typo**:
   - Frontend: `/api/v1/flashcard/generate` (singular)
   - Backend: `/api/v1/flashcards/generate` (plural)
   - **Fix**: Change frontend to use plural `flashcards`

2. **Flashcard Parameter Mismatch**:
   - Frontend sends: `num_questions`
   - Backend expects: `num_flashcards`
   - **Fix**: Change frontend to use `num_flashcards`

3. **CORS Configuration**:
   - Backend uses `allow_origins=["*"]` which is too permissive
   - **Fix**: Restrict to specific frontend domains

---

## Security Concerns

### Before (Proxy) - More Secure
- ✅ HttpOnly cookies (protected from XSS)
- ✅ SameSite protection (protected from CSRF)
- ✅ Same-origin requests (no CORS issues)
- ✅ Token automatically included in requests

### After (Direct) - Less Secure
- ❌ localStorage tokens (vulnerable to XSS)
- ❌ No automatic protection mechanisms
- ❌ CORS misconfiguration risk
- ❌ Manual token management

**Recommendation**: The PR comment is correct - "the entire frontend would benefit from moving to `set-http-cookies` in the future"

---

## Performance Impact

### Positive
- ✅ Reduced latency (~50-100ms per request)
- ✅ One less network hop
- ✅ Simpler architecture

### Negative
- ❌ No intermediate caching layer
- ❌ More direct connections to backend
- ❌ Higher backend load

---

## Action Items

### Must Fix Before Merge
1. Fix flashcard endpoint: `/flashcard/` → `/flashcards/`
2. Fix parameter name: `num_questions` → `num_flashcards` (for flashcards)
3. Fix CORS: Restrict `allow_origins` to frontend domain(s)
4. Fix `kind` parameter in delete buttons: use `quiz` and `study-guide` consistently

### Should Implement Soon
1. Add HttpOnly cookie support to backend
2. Implement token refresh mechanism
3. Add comprehensive error handling in frontend
4. Add rate limiting to backend
5. Implement request caching strategy

### Consider for Future
1. Add API Gateway for advanced features
2. Implement distributed tracing
3. Add request deduplication
4. Implement session management

---

## Endpoint Mapping Reference

| **Frontend (Old Proxy)** | **Backend (New Direct)** | **Frontend Updated** |
|--------------------------|--------------------------|----------------------|
| `/api/auth/login` | `/api/v1/auth/token` | ✅ Updated |
| `/api/auth/register` | `/api/v1/auth/register` | ✅ Updated |
| `/api/flashcards/generate` | `/api/v1/flashcards/generate` | ⚠️ Typo: `/flashcard/` |
| `/api/flashcards` | `/api/v1/flashcards/list` | ✅ Updated |
| `/api/flashcards/[id]` | `/api/v1/flashcards/[id]` | ✅ Updated |
| `/api/quiz/generate` | `/api/v1/quiz/generate` | ✅ Updated |
| `/api/quizzes` | `/api/v1/quiz/list` | ✅ Updated |
| `/api/quizzes/[id]` | `/api/v1/quiz/[id]` | ✅ Updated |
| `/api/key-concept/generate` | `/api/v1/study-guide/generate` | ✅ Updated |
| `/api/notes` | `/api/v1/study-guide/list` | ⚠️ Wrong endpoint |
| `/api/notes/[id]` | `/api/v1/study-guide/[id]` | ✅ Updated |
| `/api/textbooks` | `/api/v1/textbooks/list` | ✅ Updated |
| `/api/textbooks/add` | `/api/v1/textbooks/add` | ✅ Updated |
| `/api/textbooks/[id]` | `/api/v1/textbooks/[id]` | ✅ Updated |
| `/api/chapters/[id]` | `/api/v1/textbooks/[id]/chapters` | ✅ Updated |
| `/api/user/progress/*` | `/api/v1/progress/*` | ✅ Updated |

---

## Recommendation

**Do Not Merge** until the critical bugs are fixed. The architecture change is sound, but the implementation has several issues that will cause runtime errors.

After fixing bugs:
1. Add security improvements (CORS restriction, CSP headers)
2. Implement comprehensive error handling
3. Add monitoring and logging
4. Consider implementing HttpOnly cookie support in backend

Then the PR can be safely merged.
