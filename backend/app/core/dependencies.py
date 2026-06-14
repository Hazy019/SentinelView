"""
app/core/dependencies.py — FastAPI dependency injection helpers.
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.core.security import decode_access_token

_bearer = HTTPBearer()


async def require_jwt(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
) -> str:
    """
    Validate Bearer JWT on any protected endpoint.
    Returns the username (subject) on success; raises 401 on failure.
    NEVER logs the token.
    """
    subject = decode_access_token(credentials.credentials)
    if subject is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return subject
