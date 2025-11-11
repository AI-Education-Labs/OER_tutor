# Langfuse Migration Guide

## Quick Start Implementation

This guide provides step-by-step instructions for migrating from LangSmith to Langfuse for the OER_tutor project.

---

## Prerequisites

- Python 3.13+ environment
- Backend virtual environment activated
- Access to Langfuse account (https://cloud.langfuse.com)

---

## Step 1: Setup Langfuse Account

1. Visit https://cloud.langfuse.com
2. Sign up (free, no credit card required)
3. Create a new project: "OER_tutor"
4. Navigate to **Project Settings → API Keys**
5. Click **Create API Keys**
6. Save both keys securely:
   - Public Key: `pk-lf-...`
   - Secret Key: `sk-lf-...`

---

## Step 2: Install Dependencies

```bash
# Activate your virtual environment first
source venv/bin/activate  # macOS/Linux
# or
venv\Scripts\activate  # Windows

# Install Langfuse
pip install langfuse>=2.0.0

# Update requirements.txt
echo "langfuse>=2.0.0" >> backend/requirements.txt
```

---

## Step 3: Update Configuration Files

### 3.1 Update `backend/config.py`

Replace LangSmith configuration with Langfuse:

```python
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional
from pathlib import Path

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(Path(__file__).resolve().parent / ".env"),
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    SECRET_KEY: str = "your-secret-key"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 50000
    
    # Database settings
    MONGO_URI: str = ""
    MONGO_DB_NAME: str = ""

    # AWS settings
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""

    # S3 settings
    S3_BUCKET: str = ""
    S3_REGION: str = ""

    # LLM / Providers
    OPENAI_API_KEY: str = None

    # Qdrant settings
    QDRANT_KEY: Optional[str] = None

    # Langfuse Observability Settings
    LANGFUSE_PUBLIC_KEY: Optional[str] = None
    LANGFUSE_SECRET_KEY: Optional[str] = None
    LANGFUSE_HOST: str = "https://cloud.langfuse.com"
    LANGFUSE_ENABLED: bool = True

    NAME: Optional[str] = "EC2v2"


settings = Settings()
```

### 3.2 Update `backend/.env.example`

```bash
# See the dotenv file in Discord for values
OPENAI_API_KEY=VALUE

MONGO_URI=VALUE
MONGO_DB_NAME=VALUE

# AWS ENV VARIABLES
AWS_ACCESS_KEY_ID=VALUE
AWS_SECRET_ACCESS_KEY=VALUE

S3_REGION=us-west-2
S3_BUCKET=VALUE

# Langfuse Observability Configuration
# Sign up at https://cloud.langfuse.com for free tier (50k traces/month)
# See docs/langfuse-migration-guide.md for setup instructions
LANGFUSE_ENABLED=true
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_HOST=https://cloud.langfuse.com

# For self-hosted Langfuse, change LANGFUSE_HOST to your instance URL

# Optional: Legacy fields (can be removed if not needed)
NAME=""
QDRANT_KEY=
```

### 3.3 Update your local `.env`

Copy the API keys from Langfuse to your local `.env` file:

```bash
cd backend
cp .env.example .env  # if .env doesn't exist
# Then edit .env and add your actual keys
```

---

## Step 4: Create Observability Helper Module

Create a new file `backend/observability.py`:

```python
"""
Observability and tracing configuration for LLM operations.

This module provides helper functions to configure Langfuse tracing
for LangChain LLM operations.
"""

from typing import Optional, List
from langfuse.callback import CallbackHandler
from backend.config import settings
import logging

logger = logging.getLogger(__name__)


def get_langfuse_handler() -> Optional[CallbackHandler]:
    """
    Returns a Langfuse callback handler if observability is enabled and configured.
    
    Returns:
        CallbackHandler if configured and enabled, None otherwise
    """
    if not settings.LANGFUSE_ENABLED:
        logger.debug("Langfuse tracing is disabled")
        return None
    
    if not settings.LANGFUSE_PUBLIC_KEY or not settings.LANGFUSE_SECRET_KEY:
        logger.warning(
            "Langfuse is enabled but API keys are not configured. "
            "Tracing will be disabled. Please set LANGFUSE_PUBLIC_KEY and "
            "LANGFUSE_SECRET_KEY in your .env file."
        )
        return None
    
    try:
        handler = CallbackHandler(
            public_key=settings.LANGFUSE_PUBLIC_KEY,
            secret_key=settings.LANGFUSE_SECRET_KEY,
            host=settings.LANGFUSE_HOST
        )
        logger.info(f"Langfuse tracing enabled: {settings.LANGFUSE_HOST}")
        return handler
    except Exception as e:
        logger.error(f"Failed to initialize Langfuse handler: {e}")
        return None


def get_callbacks() -> List:
    """
    Returns a list of callback handlers for LLM operations.
    
    Returns:
        List of callback handlers (empty list if none configured)
    """
    callbacks = []
    
    langfuse_handler = get_langfuse_handler()
    if langfuse_handler:
        callbacks.append(langfuse_handler)
    
    return callbacks
```

---

## Step 5: Update LLM Initialization Code

### 5.1 Update `backend/routes/chat.py`

Add the import at the top of the file:

```python
from backend.observability import get_callbacks
```

Then update all three LLM initialization points:

**Location 1: Summary LLM (around line 96)**

```python
summary_llm = ChatOpenAI(
    model="gpt-5-mini",
    temperature=0,
    tags=["summary-updater"],
    reasoning_effort="low",
    callbacks=get_callbacks()  # Add this line
)
```

**Location 2: Streaming Chat LLM (around line 288)**

```python
llm = ChatOpenAI(
    model="gpt-5-mini",
    temperature=0,
    streaming=True,
    tags=["Chatter"],
    reasoning_effort="minimal",
    callbacks=get_callbacks()  # Add this line
)
```

**Location 3: Branch Detector LLM (around line 309)**

```python
detector_llm = ChatOpenAI(
    model="gpt-5-mini",
    temperature=0,
    tags=["branch-detector"],
    reasoning_effort="low",
    callbacks=get_callbacks()  # Add this line
)
```

### 5.2 Update `backend/tools.py`

Add the import at the top of the file:

```python
from backend.observability import get_callbacks
```

Then update both tool LLM initializations:

**Location 1: Query Generator Tool (around line 66)**

```python
@tool
def query_generator_tool(user_message: str) -> str:
    """
    Generates a query based on the user's message.
    This tool can be used to improve the queries for the retriever.
    """
    llm = ChatOpenAI(
        temperature=0.0,
        model="gpt-3.5-turbo",
        callbacks=get_callbacks()  # Add this line
    )
    prompt = f"""
    You are a helpful assistant that turns a student's question into a focused search query to retrieve relevant textbook content.
    
    Question: {user_message}
    
    Only return the search query, do not explain it.
    """
    response = llm.invoke(prompt)
    return response.content.strip()
```

**Location 2: Stay On Topic Tool (around line 134)**

```python
@tool
def stay_on_topic_tool(overall_conversation: str) -> str:
    """
    Checks if the overall conversation is in line with the generated guided learning plan.
    Move the topic back on track if it is not.
    """
    llm = ChatOpenAI(
        temperature=0.0,
        model="gpt-4o-mini",
        callbacks=get_callbacks()  # Add this line
    )
    prompt = f"""
    You are a helpful assistant that checks if the overall conversation is in line with the generated guided learning plan.

    Guided learning plan: {guided_learning_plan}
    
    Overall conversation: {overall_conversation}
    
    return with instructions to reach guided learning path.
    """
    response = llm.invoke(prompt)
    return response.content.strip()
```

---

## Step 6: Testing

### 6.1 Start the Backend

```bash
# From project root
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

Check the logs for:
```
INFO:backend.observability:Langfuse tracing enabled: https://cloud.langfuse.com
```

If you see this, tracing is configured correctly!

### 6.2 Test Chat Functionality

1. Start the frontend: `pnpm run dev`
2. Navigate to http://localhost:3000
3. Login and open a chat
4. Send a few messages
5. Check the Langfuse dashboard (https://cloud.langfuse.com)

### 6.3 Verify Traces in Langfuse

You should see:
- **Traces** for each chat interaction
- **Tags**: "Chatter", "summary-updater", "branch-detector"
- **Input/Output**: Full conversation history
- **Metadata**: Model names, tokens, costs
- **Latency**: Response times

### 6.4 Test Scenarios

Try these scenarios to verify all traces appear:

1. **Basic Chat**: Send a simple question
2. **RAG Retrieval**: Ask about textbook content
3. **Tool Usage**: Trigger textbook retriever
4. **Summary Generation**: Multiple messages should trigger summary update
5. **Branch Detection**: Ask an off-topic question

---

## Step 7: Update Documentation

Update `docs/development.md` to replace the LangSmith section:

```markdown
### Configuring Langfuse (LLM Observability)

Langfuse is an open-source LLM observability platform for tracing, monitoring, and debugging LLM applications.

#### Setup Instructions

1. **Create Account**
   - Go to https://cloud.langfuse.com
   - Sign up (free tier: 50,000 traces/month)
   - Create a new project: "OER_tutor"

2. **Get API Keys**
   - Navigate to Project Settings → API Keys
   - Click "Create API Keys"
   - Save both the Public Key and Secret Key

3. **Configure Backend**
   - Copy your keys to `backend/.env`:
     ```bash
     LANGFUSE_ENABLED=true
     LANGFUSE_PUBLIC_KEY=pk-lf-your_key_here
     LANGFUSE_SECRET_KEY=sk-lf-your_key_here
     LANGFUSE_HOST=https://cloud.langfuse.com
     ```

4. **Restart Backend**
   ```bash
   uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
   ```

5. **Verify Tracing**
   - Send test messages through the chat
   - Check the Langfuse dashboard for traces
   - Look for tags: "Chatter", "summary-updater", "branch-detector"

#### Disable Tracing

To disable tracing (useful for local development):

```bash
# In backend/.env
LANGFUSE_ENABLED=false
```

#### Self-Hosted Langfuse

For production, you can self-host Langfuse:

1. Follow: https://langfuse.com/docs/deployment/self-host
2. Update `LANGFUSE_HOST` in `.env` to your instance URL

#### Troubleshooting

**Issue: No traces appearing**
- Check `LANGFUSE_ENABLED=true` in `.env`
- Verify API keys are correct
- Check backend logs for errors
- Ensure `langfuse` package is installed

**Issue: Authentication errors**
- Regenerate API keys in Langfuse dashboard
- Update keys in `.env`
- Restart backend

**Issue: Traces delayed**
- Langfuse batches traces for performance
- Wait 30-60 seconds for traces to appear
- Check network connectivity

#### Additional Resources

- Langfuse Docs: https://langfuse.com/docs
- LangChain Integration: https://langfuse.com/docs/integrations/langchain
- Discord Community: https://discord.gg/7NXusRtqYU
```

---

## Step 8: Production Deployment

### Environment Variables

Ensure these are set in your production environment:

```bash
LANGFUSE_ENABLED=true
LANGFUSE_PUBLIC_KEY=<production_public_key>
LANGFUSE_SECRET_KEY=<production_secret_key>
LANGFUSE_HOST=https://cloud.langfuse.com
```

### Monitoring

1. **Set up alerts** in Langfuse for:
   - High error rates
   - Increased latency
   - Cost spikes

2. **Monitor trace volume**:
   - Free tier: 50,000 traces/month
   - Average: ~1,600 traces/day
   - Monitor dashboard for usage

3. **Review traces regularly**:
   - Check for errors
   - Optimize slow operations
   - Review cost trends

---

## Rollback Plan

If you encounter issues and need to rollback:

### Quick Disable (No Code Changes)

```bash
# In backend/.env
LANGFUSE_ENABLED=false
```

Restart the backend. Tracing will be disabled, but the app continues working normally.

### Complete Rollback (Revert Code)

If you need to completely remove Langfuse:

1. Revert code changes:
   ```bash
   git revert <commit_hash>
   ```

2. Uninstall package:
   ```bash
   pip uninstall langfuse
   ```

3. Remove from requirements.txt:
   ```bash
   # Remove line: langfuse>=2.0.0
   ```

---

## Advanced Features

### Custom Metadata

Add custom metadata to traces:

```python
from langfuse.callback import CallbackHandler

handler = CallbackHandler(
    public_key=settings.LANGFUSE_PUBLIC_KEY,
    secret_key=settings.LANGFUSE_SECRET_KEY,
    metadata={
        "environment": "production",
        "version": "1.0.0",
        "user_id": user_id  # Dynamic metadata
    }
)
```

### Session Tracking

Track user sessions:

```python
handler = CallbackHandler(
    public_key=settings.LANGFUSE_PUBLIC_KEY,
    secret_key=settings.LANGFUSE_SECRET_KEY,
    session_id=session_id  # Use your session_id
)
```

### User Tracking

Associate traces with users:

```python
handler = CallbackHandler(
    public_key=settings.LANGFUSE_PUBLIC_KEY,
    secret_key=settings.LANGFUSE_SECRET_KEY,
    user_id=user_id  # Track per user
)
```

### Custom Tags

Add dynamic tags:

```python
llm = ChatOpenAI(
    model="gpt-4o",
    tags=["chat", f"user-{user_id}", "production"],
    callbacks=get_callbacks()
)
```

---

## Cost Estimation

### Free Tier Capacity

- **Traces**: 50,000/month
- **Retention**: 30 days
- **Team Members**: Unlimited
- **All Features**: Included

### Estimated Usage for OER_tutor

Assuming:
- 100 active users/month
- 20 chat messages/user
- 3 LLM calls/message (chat + tools + summary)

**Monthly traces**: 100 × 20 × 3 = 6,000 traces/month

**Verdict**: Comfortably within free tier (12% utilization)

### Scaling Considerations

- **500 users**: 30,000 traces/month (60% utilization)
- **1,000 users**: 60,000 traces/month (needs Team plan: ~$99/month)
- **Self-hosting**: Unlimited traces (infrastructure costs only)

---

## FAQ

### Q: Does Langfuse slow down my app?

No. Traces are sent asynchronously in batches. Typical overhead: <5ms per LLM call.

### Q: What if Langfuse is down?

The callback handler fails silently. Your app continues working normally without tracing.

### Q: Can I use both Langfuse and LangSmith?

Yes, you can add both callback handlers:

```python
callbacks = [langfuse_handler, langsmith_handler]
```

However, this doubles overhead and isn't recommended.

### Q: How do I export my data?

Langfuse provides export APIs. See: https://langfuse.com/docs/api

### Q: Can I delete sensitive data?

Yes, you can delete specific traces or configure data retention policies in the dashboard.

### Q: Does Langfuse support other LLM providers?

Yes, it works with OpenAI, Anthropic, Cohere, Azure OpenAI, and any LangChain-compatible provider.

---

## Troubleshooting

### Error: "langfuse module not found"

```bash
pip install langfuse>=2.0.0
```

### Error: "Invalid API key"

1. Verify keys in Langfuse dashboard
2. Check `.env` file has correct keys
3. Ensure no extra spaces in keys
4. Regenerate keys if needed

### Error: "Connection timeout"

1. Check internet connectivity
2. Verify `LANGFUSE_HOST` is correct
3. Check firewall settings
4. Try self-hosted instance if behind firewall

### Traces not appearing

1. Wait 30-60 seconds (batching delay)
2. Check `LANGFUSE_ENABLED=true`
3. Verify API keys are set
4. Check backend logs for errors
5. Test with simple trace:
   ```python
   from langfuse import Langfuse
   client = Langfuse()
   client.trace(name="test")
   ```

### High latency

1. Ensure async mode is enabled (default)
2. Check network latency to Langfuse servers
3. Consider self-hosted instance for lower latency
4. Batch size can be adjusted in handler config

---

## Support

### Langfuse Support

- **Documentation**: https://langfuse.com/docs
- **Discord**: https://discord.gg/7NXusRtqYU
- **GitHub Issues**: https://github.com/langfuse/langfuse/issues
- **Email**: support@langfuse.com

### Project Support

- **Internal Docs**: `docs/llm-observability-research.md`
- **Development Guide**: `docs/development.md`
- **Discord**: Check your team Discord for help

---

## Checklist

Use this checklist to track your migration:

- [ ] Create Langfuse account
- [ ] Generate API keys
- [ ] Install langfuse package
- [ ] Update requirements.txt
- [ ] Update backend/config.py
- [ ] Update backend/.env.example
- [ ] Create backend/observability.py
- [ ] Update backend/routes/chat.py (3 locations)
- [ ] Update backend/tools.py (2 locations)
- [ ] Test locally
- [ ] Verify traces in dashboard
- [ ] Update docs/development.md
- [ ] Deploy to staging
- [ ] Deploy to production
- [ ] Monitor for issues
- [ ] Remove old LangSmith references (optional)

---

**Document Version**: 1.0  
**Last Updated**: 2025-11-11  
**Estimated Time**: 4-5 hours (including testing)  
**Difficulty**: Low  
**Status**: Ready for Implementation
