from fastapi import FastAPI, Depends
from prometheus_fastapi_instrumentator import Instrumentator
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from backend.config import settings
import secrets

security = HTTPBearer()
SECRET_TOKEN = settings.METRICS_BEARER_TOKEN




def setup_observability(app: FastAPI):
    """
    Instruments the FastAPI app with Prometheus metrics.
    This will expose a /metrics endpoint, protected by a bearer token.
    """
    # Create the instrumentator instance first so we can add any custom
    # instrumentations (for debugging or additional metrics) before the
    # middleware is installed.
    instrumentator = Instrumentator()

    # Now instrument the app (installs middleware)
    instrumentator.instrument(app)

    # Expose the /metrics endpoint protected by the verify_token dependency.
    instrumentator.expose(app, endpoint="/metrics", dependencies=[Depends(verify_token)])


def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """
    Verifies the bearer token from the Authorization header.
    """
    if SECRET_TOKEN is None:
        # If the secret token is not configured on the server, it's a server error.
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Metrics token not configured on the server.",
        )
    
    if credentials.scheme != "Bearer" or not secrets.compare_digest(str(credentials.credentials), str(SECRET_TOKEN)):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing bearer token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return credentials
