# PR #58 - Bugs That Must Be Fixed

This document lists specific bugs found in PR #58 that must be fixed before merging.

## Critical Bugs

### 1. Flashcard Generation Endpoint Typo

**File**: `components/flashcard-panel.tsx`  
**Line**: ~225

**Current (Incorrect)**:
```typescript
const resp = await fetch(`${backendUrl}/api/v1/flashcard/generate`, {
```

**Should Be**:
```typescript
const resp = await fetch(`${backendUrl}/api/v1/flashcards/generate`, {
```

**Reason**: Backend route is `/api/v1/flashcards/generate` (plural), not singular.

---

### 2. Flashcard Generation Parameter Name

**File**: `components/flashcard-panel.tsx`  
**Line**: ~228-234

**Current (Incorrect)**:
```typescript
body: JSON.stringify({
  context,
  hint: focusHint,
  num_questions: numCards,  // ❌ Wrong parameter name
  chapter: selectedChapterId,
  textbook_id: textbookId,
}),
```

**Should Be**:
```typescript
body: JSON.stringify({
  context,
  hint: focusHint,
  num_flashcards: numCards,  // ✅ Correct parameter name
  chapter: selectedChapterId,
  textbook_id: textbookId,
}),
```

**Reason**: Backend expects `num_flashcards`, not `num_questions`. See `backend/routes/flashcards.py`:
```python
class FlashcardRequest(BaseModel):
    context: str
    textbook_id: str
    chapter: str
    num_flashcards: int  # Backend expects this
    hint: str
```

---

### 3. Study Guide List Endpoint

**File**: `components/key-concepts-panel.tsx`  
**Line**: ~130

**Current (Incorrect)**:
```typescript
const resp = await fetch(`${backendUrl}/api/v1/studyguide/list`, {
```

**Should Be**:
```typescript
const resp = await fetch(`${backendUrl}/api/v1/study-guide/list`, {
```

**Reason**: Backend route uses hyphenated `study-guide`, not single word. See `backend/main.py`:
```python
api_router.include_router(study_guide_router, prefix="/study-guide", tags=["study-guide"])
```

---

### 4. MenuButton Type Definitions

**File**: `components/flashcard-panel.tsx`  
**Line**: ~35

**Current**:
```typescript
function MenuButton({ id, kind, item, onOptimisticRemove, onFailureRestore }: { 
  id: string; 
  kind: "flashcards" | "quiz" | "study-guide";  // ✅ Correct
  // ...
})
```

**File**: `components/quiz-panel.tsx`  
**Line**: ~39

**Current (Incorrect)**:
```typescript
function MenuButton({ id, kind, item, onOptimisticRemove, onFailureRestore }: { 
  id: string; 
  kind: "flashcards" | "quiz" | "notes";  // ❌ Should be "study-guide"
  // ...
})
```

**Should Be**:
```typescript
function MenuButton({ id, kind, item, onOptimisticRemove, onFailureRestore }: { 
  id: string; 
  kind: "flashcards" | "quiz" | "study-guide";  // ✅ Correct
  // ...
})
```

**Reason**: Backend uses `study-guide`, not `notes`. Inconsistent type definitions will cause TypeScript errors.

---

### 5. CORS Configuration (Security Issue)

**File**: `backend/main.py`  
**Line**: ~50-56

**Current (Insecure)**:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # ❌ Too permissive!
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**Should Be**:
```python
# Get allowed origins from environment variable
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,  # ✅ Restricted to specific domains
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)
```

**Reason**: `allow_origins=["*"]` with `allow_credentials=True` is a security vulnerability. Should restrict to specific frontend domain(s).

---

## Verification Steps

After fixing these bugs, verify with:

1. **Test Flashcard Generation**:
   ```bash
   # Start backend
   cd backend && python main.py
   
   # Test endpoint exists
   curl -X POST http://localhost:8000/api/v1/flashcards/generate \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer <token>" \
     -d '{"context":"","hint":"","num_flashcards":5,"chapter":"1","textbook_id":"test"}'
   ```

2. **Test Study Guide List**:
   ```bash
   curl http://localhost:8000/api/v1/study-guide/list \
     -H "Authorization: Bearer <token>"
   ```

3. **Check TypeScript Compilation**:
   ```bash
   npm run build
   # Should complete without type errors
   ```

4. **Test CORS Configuration**:
   ```bash
   # Should reject requests from unauthorized origins
   curl -X OPTIONS http://localhost:8000/api/v1/textbooks/list \
     -H "Origin: http://malicious-site.com" \
     -v
   ```

---

## Summary

**Total Critical Bugs**: 5
- 3 endpoint/parameter name bugs
- 1 type definition inconsistency  
- 1 security misconfiguration

**Estimated Fix Time**: 15-30 minutes

**Risk if Not Fixed**:
- Flashcard generation will fail (400/422 errors)
- Study guide list will fail (404 errors)
- TypeScript may have type inconsistencies
- Security vulnerability with CORS

**Recommendation**: Fix all bugs before merging to any environment (dev, staging, or production).
