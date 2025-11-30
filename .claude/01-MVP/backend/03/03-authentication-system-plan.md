# Task 3: Core Authentication System - Implementation Plan

**Document Version**: 1.0
**Created**: 2025-11-21
**Status**: Ready for Implementation
**Estimated Duration**: 4-5 hours
**Priority**: Critical Path
**Dependencies**: Task 2 (Database Design & Schema) - COMPLETED

---

## Table of Contents
1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Architecture Overview](#architecture-overview)
4. [Subtask Breakdown](#subtask-breakdown)
5. [Implementation Order](#implementation-order)
6. [File Structure](#file-structure)
7. [Testing Strategy](#testing-strategy)
8. [Security Checklist](#security-checklist)
9. [Integration Points](#integration-points)
10. [Common Pitfalls](#common-pitfalls)

---

## Overview

### Objectives
Implement a secure, production-ready authentication system for the Learn Greek Easy application that supports:
- Email/password registration and login
- JWT-based token authentication (access + refresh tokens)
- Token refresh and revocation
- Session management with database-backed refresh tokens
- Google OAuth integration (placeholder for future implementation)
- Protected endpoint middleware
- Rate limiting on authentication endpoints

### Success Criteria
- All 6 authentication endpoints functional and tested
- Password hashing with bcrypt (cost factor 12)
- JWT tokens with proper expiry (30 min access, 30 days refresh)
- Refresh token stored in database with revocation capability
- Authentication middleware protecting endpoints
- Rate limiting preventing brute force attacks
- Unit tests achieving 90%+ coverage

---

## Prerequisites

### Environment Setup Verified
- PostgreSQL container running (via docker-compose)
- Database migrations applied (Task 2 completed)
- Poetry environment configured with dependencies:
  - `passlib[bcrypt]` - Password hashing
  - `bcrypt` - Bcrypt algorithm
  - `python-jose[cryptography]` - JWT token generation
  - `python-multipart` - Form data parsing

### Database Models Available
- `User` model with password_hash, email, google_id fields
- `UserSettings` model for user preferences
- `RefreshToken` model for token storage and revocation
- All models tested and operational

### Pydantic Schemas Available
- `UserCreate` - Registration with password validation
- `UserLogin` - Login credentials
- `UserResponse` - Public user data
- `UserProfileResponse` - User with settings
- `TokenResponse` - JWT token response
- `TokenRefresh` - Refresh token request
- `TokenPayload` - JWT payload structure

### Configuration Available
- JWT settings in `config.py`:
  - `jwt_secret_key` (must be changed in production)
  - `jwt_algorithm` (HS256)
  - `jwt_access_token_expire_minutes` (30)
  - `jwt_refresh_token_expire_days` (30)
  - `bcrypt_rounds` (12)
- CORS settings configured
- Rate limiting configuration ready

---

## Architecture Overview

### Authentication Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                     REGISTRATION FLOW                            │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  POST /api/v1/auth/register                                      │
│  ┌──────────────────────────┐                                   │
│  │ 1. Validate request data │                                   │
│  │    - Email format        │                                   │
│  │    - Password strength   │                                   │
│  │    - Full name present   │                                   │
│  └──────────┬───────────────┘                                   │
│             ↓                                                    │
│  ┌──────────────────────────┐                                   │
│  │ 2. Check email uniqueness│                                   │
│  │    - Query users table   │                                   │
│  │    - Raise if exists     │                                   │
│  └──────────┬───────────────┘                                   │
│             ↓                                                    │
│  ┌──────────────────────────┐                                   │
│  │ 3. Hash password (bcrypt)│                                   │
│  │    - Cost factor: 12     │                                   │
│  │    - Salt auto-generated │                                   │
│  └──────────┬───────────────┘                                   │
│             ↓                                                    │
│  ┌──────────────────────────┐                                   │
│  │ 4. Create User + Settings│                                   │
│  │    - Insert into users   │                                   │
│  │    - Insert settings row │                                   │
│  │    - Transaction wrapped │                                   │
│  └──────────┬───────────────┘                                   │
│             ↓                                                    │
│  ┌──────────────────────────┐                                   │
│  │ 5. Generate JWT tokens   │                                   │
│  │    - Access token (30min)│                                   │
│  │    - Refresh token (30d) │                                   │
│  └──────────┬───────────────┘                                   │
│             ↓                                                    │
│  ┌──────────────────────────┐                                   │
│  │ 6. Store refresh token   │                                   │
│  │    - Insert to DB        │                                   │
│  │    - User association    │                                   │
│  └──────────┬───────────────┘                                   │
│             ↓                                                    │
│  ┌──────────────────────────┐                                   │
│  │ 7. Return tokens + user  │                                   │
│  │    - TokenResponse       │                                   │
│  │    - Set httpOnly cookie │                                   │
│  └──────────────────────────┘                                   │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                        LOGIN FLOW                                │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  POST /api/v1/auth/login                                         │
│  ┌──────────────────────────┐                                   │
│  │ 1. Validate credentials  │                                   │
│  │    - Email format        │                                   │
│  │    - Password present    │                                   │
│  └──────────┬───────────────┘                                   │
│             ↓                                                    │
│  ┌──────────────────────────┐                                   │
│  │ 2. Query user by email   │                                   │
│  │    - Eager load settings │                                   │
│  │    - Check is_active     │                                   │
│  └──────────┬───────────────┘                                   │
│             ↓                                                    │
│  ┌──────────────────────────┐                                   │
│  │ 3. Verify password hash  │                                   │
│  │    - bcrypt.verify()     │                                   │
│  │    - Constant-time comp. │                                   │
│  └──────────┬───────────────┘                                   │
│             ↓                                                    │
│  ┌──────────────────────────┐                                   │
│  │ 4. Generate JWT tokens   │                                   │
│  │    - Access token (30min)│                                   │
│  │    - Refresh token (30d) │                                   │
│  └──────────┬───────────────┘                                   │
│             ↓                                                    │
│  ┌──────────────────────────┐                                   │
│  │ 5. Store refresh token   │                                   │
│  │    - Insert to DB        │                                   │
│  │    - Revoke old tokens?  │                                   │
│  └──────────┬───────────────┘                                   │
│             ↓                                                    │
│  ┌──────────────────────────┐                                   │
│  │ 6. Return tokens + user  │                                   │
│  │    - TokenResponse       │                                   │
│  │    - Set httpOnly cookie │                                   │
│  └──────────────────────────┘                                   │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                    TOKEN REFRESH FLOW                            │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  POST /api/v1/auth/refresh                                       │
│  ┌──────────────────────────┐                                   │
│  │ 1. Extract refresh token │                                   │
│  │    - From request body   │                                   │
│  │    - Or from cookie      │                                   │
│  └──────────┬───────────────┘                                   │
│             ↓                                                    │
│  ┌──────────────────────────┐                                   │
│  │ 2. Verify JWT signature  │                                   │
│  │    - Decode token        │                                   │
│  │    - Validate expiry     │                                   │
│  └──────────┬───────────────┘                                   │
│             ↓                                                    │
│  ┌──────────────────────────┐                                   │
│  │ 3. Check DB token exists │                                   │
│  │    - Query refresh_tokens│                                   │
│  │    - Verify not revoked  │                                   │
│  └──────────┬───────────────┘                                   │
│             ↓                                                    │
│  ┌──────────────────────────┐                                   │
│  │ 4. Get user by token     │                                   │
│  │    - Join with user      │                                   │
│  │    - Check is_active     │                                   │
│  └──────────┬───────────────┘                                   │
│             ↓                                                    │
│  ┌──────────────────────────┐                                   │
│  │ 5. Generate new tokens   │                                   │
│  │    - New access token    │                                   │
│  │    - New refresh token   │                                   │
│  └──────────┬───────────────┘                                   │
│             ↓                                                    │
│  ┌──────────────────────────┐                                   │
│  │ 6. Rotate refresh token  │                                   │
│  │    - Delete old token    │                                   │
│  │    - Insert new token    │                                   │
│  └──────────┬───────────────┘                                   │
│             ↓                                                    │
│  ┌──────────────────────────┐                                   │
│  │ 7. Return new tokens     │                                   │
│  │    - TokenResponse       │                                   │
│  │    - Set httpOnly cookie │                                   │
│  └──────────────────────────┘                                   │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                      PROTECTED ENDPOINT FLOW                     │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  GET /api/v1/auth/me (or any protected endpoint)                │
│  ┌──────────────────────────┐                                   │
│  │ 1. Extract access token  │                                   │
│  │    - Authorization header│                                   │
│  │    - Bearer <token>      │                                   │
│  └──────────┬───────────────┘                                   │
│             ↓                                                    │
│  ┌──────────────────────────┐                                   │
│  │ 2. Verify JWT signature  │                                   │
│  │    - Decode token        │                                   │
│  │    - Validate expiry     │                                   │
│  │    - Extract user_id     │                                   │
│  └──────────┬───────────────┘                                   │
│             ↓                                                    │
│  ┌──────────────────────────┐                                   │
│  │ 3. Get user from DB      │                                   │
│  │    - Query by user_id    │                                   │
│  │    - Eager load settings │                                   │
│  │    - Check is_active     │                                   │
│  └──────────┬───────────────┘                                   │
│             ↓                                                    │
│  ┌──────────────────────────┐                                   │
│  │ 4. Inject user to request│                                   │
│  │    - FastAPI dependency  │                                   │
│  │    - Available in route  │                                   │
│  └──────────┬───────────────┘                                   │
│             ↓                                                    │
│  ┌──────────────────────────┐                                   │
│  │ 5. Execute route handler │                                   │
│  │    - User available      │                                   │
│  │    - Process request     │                                   │
│  └──────────┬───────────────┘                                   │
│             ↓                                                    │
│  ┌──────────────────────────┐                                   │
│  │ 6. Return response       │                                   │
│  │    - UserProfileResponse │                                   │
│  └──────────────────────────┘                                   │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                         LOGOUT FLOW                              │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  POST /api/v1/auth/logout                                        │
│  ┌──────────────────────────┐                                   │
│  │ 1. Authenticate user     │                                   │
│  │    - Use dependency      │                                   │
│  │    - Verify access token │                                   │
│  └──────────┬───────────────┘                                   │
│             ↓                                                    │
│  ┌──────────────────────────┐                                   │
│  │ 2. Get refresh token     │                                   │
│  │    - From request body   │                                   │
│  │    - Or revoke all       │                                   │
│  └──────────┬───────────────┘                                   │
│             ↓                                                    │
│  ┌──────────────────────────┐                                   │
│  │ 3. Delete refresh token  │                                   │
│  │    - Delete from DB      │                                   │
│  │    - Or delete all user  │                                   │
│  │      tokens (logout all) │                                   │
│  └──────────┬───────────────┘                                   │
│             ↓                                                    │
│  ┌──────────────────────────┐                                   │
│  │ 4. Clear cookies         │                                   │
│  │    - Unset refresh cookie│                                   │
│  └──────────┬───────────────┘                                   │
│             ↓                                                    │
│  ┌──────────────────────────┐                                   │
│  │ 5. Return success        │                                   │
│  │    - 200 OK              │                                   │
│  └──────────────────────────┘                                   │
└──────────────────────────────────────────────────────────────────┘
```

### Component Architecture

```
src/
├── api/
│   └── v1/
│       ├── __init__.py
│       └── auth.py                    # Authentication router (NEW)
├── core/
│   ├── __init__.py
│   ├── exceptions.py                  # Already exists
│   ├── logging.py                     # Already exists
│   ├── security.py                    # Password & JWT utilities (NEW)
│   └── dependencies.py                # Auth dependencies (NEW)
├── services/
│   ├── __init__.py
│   └── auth_service.py                # Auth business logic (NEW)
├── db/
│   ├── models.py                      # Already exists (User, RefreshToken)
│   ├── session.py                     # Already exists
│   └── dependencies.py                # Already exists (get_db)
├── schemas/
│   └── user.py                        # Already exists (all auth schemas)
└── main.py                            # Update to include auth router
```

---

## Subtask Breakdown

### Subtask 03.01: Implement Password Hashing with bcrypt ✅ COMPLETED
**Status**: ✅ COMPLETED (2025-11-24)
**Actual Duration**: 30 minutes
**Priority**: Critical (foundation for all auth)
**File**: `src/core/security.py`

**Completion Summary**:
- Files: security.py (8.5 KB), test_security.py (13 KB), verify_password_security.py (2.9 KB)
- Tests: 35/35 passed, 100% coverage
- Security: bcrypt cost factor 12, $2b$ variant, auto-salt, constant-time comparison
- Detailed plan: [03.01-password-hashing-detailed-plan.md](./03.01-password-hashing-detailed-plan.md)

#### Implementation Steps

1. **Create security utility module** (`src/core/security.py`)
   - Import `passlib` with bcrypt context
   - Configure bcrypt with cost factor from settings

2. **Implement password hashing functions**
   ```python
   from passlib.context import CryptContext
   from src.config import settings

   # Create bcrypt context
   pwd_context = CryptContext(
       schemes=["bcrypt"],
       deprecated="auto",
       bcrypt__rounds=settings.bcrypt_rounds  # 12 from config
   )

   def hash_password(password: str) -> str:
       """Hash password using bcrypt (cost factor 12)."""
       return pwd_context.hash(password)

   def verify_password(plain_password: str, hashed_password: str) -> bool:
       """Verify password against hash (constant-time comparison)."""
       return pwd_context.verify(plain_password, hashed_password)
   ```

3. **Add password strength validation** (optional helper)
   ```python
   def validate_password_strength(password: str) -> tuple[bool, str]:
       """
       Validate password meets strength requirements.

       Requirements:
       - Minimum 8 characters
       - At least one letter
       - At least one digit

       Returns:
           (is_valid, error_message)
       """
       if len(password) < 8:
           return False, "Password must be at least 8 characters"
       if not any(char.isalpha() for char in password):
           return False, "Password must contain at least one letter"
       if not any(char.isdigit() for char in password):
           return False, "Password must contain at least one digit"
       return True, ""
   ```

4. **Test password hashing**
   - Verify hash generation produces different hashes for same password
   - Verify password verification works correctly
   - Verify incorrect passwords fail verification
   - Verify cost factor is applied (hash should be slow ~200-300ms)

#### Acceptance Criteria
- [x] `hash_password()` generates bcrypt hashes with cost factor 12
- [x] `verify_password()` correctly validates passwords
- [x] Verification uses constant-time comparison (timing attack resistant)
- [x] Unit tests pass with 100% coverage

---

### Subtask 03.02: Create JWT Token Generation and Validation ✅ COMPLETED
**Status**: ✅ COMPLETED (2025-11-25)
**Actual Duration**: 60 minutes
**Priority**: Critical
**File**: `src/core/security.py` (continued)

**Completion Summary**:
- Files: security.py (542 lines), test_jwt_tokens.py (450+ lines), verify_jwt_tokens.py (165 lines)
- Tests: 28/28 passed, 100% coverage
- Security: HS256, token type validation, confused deputy attack prevention
- Detailed plan: [03.02-jwt-token-management-plan.md](./03.02-jwt-token-management-plan.md)
- QA Report: [../../qa/03.02-jwt-token-verification.md](../../qa/03.02-jwt-token-verification.md)

#### Implementation Steps

1. **Add JWT utility functions to security module**
   ```python
   from datetime import datetime, timedelta
   from typing import Optional
   from uuid import UUID

   from jose import JWTError, jwt
   from src.config import settings
   from src.core.exceptions import TokenExpiredException, TokenInvalidException

   def create_access_token(user_id: UUID) -> tuple[str, datetime]:
       """
       Create JWT access token.

       Returns:
           (token_string, expiration_datetime)
       """
       now = datetime.utcnow()
       expires_at = now + timedelta(minutes=settings.jwt_access_token_expire_minutes)

       payload = {
           "sub": str(user_id),  # Subject: user ID
           "exp": expires_at,     # Expiration
           "iat": now,            # Issued at
           "type": "access"       # Token type
       }

       token = jwt.encode(
           payload,
           settings.jwt_secret_key,
           algorithm=settings.jwt_algorithm
       )

       return token, expires_at

   def create_refresh_token(user_id: UUID) -> tuple[str, datetime]:
       """
       Create JWT refresh token.

       Returns:
           (token_string, expiration_datetime)
       """
       now = datetime.utcnow()
       expires_at = now + timedelta(days=settings.jwt_refresh_token_expire_days)

       payload = {
           "sub": str(user_id),
           "exp": expires_at,
           "iat": now,
           "type": "refresh"
       }

       token = jwt.encode(
           payload,
           settings.jwt_secret_key,
           algorithm=settings.jwt_algorithm
       )

       return token, expires_at

   def verify_token(token: str, token_type: str = "access") -> UUID:
       """
       Verify JWT token and extract user_id.

       Args:
           token: JWT token string
           token_type: "access" or "refresh"

       Returns:
           User ID (UUID)

       Raises:
           TokenExpiredException: Token has expired
           TokenInvalidException: Token is invalid
       """
       try:
           payload = jwt.decode(
               token,
               settings.jwt_secret_key,
               algorithms=[settings.jwt_algorithm]
           )

           # Verify token type
           if payload.get("type") != token_type:
               raise TokenInvalidException(
                   detail=f"Invalid token type, expected {token_type}"
               )

           # Extract user_id
           user_id_str = payload.get("sub")
           if not user_id_str:
               raise TokenInvalidException(detail="Token missing subject")

           return UUID(user_id_str)

       except JWTError as e:
           if "expired" in str(e).lower():
               raise TokenExpiredException()
           raise TokenInvalidException(detail=str(e))
   ```

2. **Add token extraction helper**
   ```python
   from fastapi import HTTPException, status
   from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

   security_scheme = HTTPBearer(auto_error=False)

   def extract_token_from_header(
       credentials: Optional[HTTPAuthorizationCredentials]
   ) -> str:
       """
       Extract JWT token from Authorization header.

       Args:
           credentials: HTTPBearer credentials

       Returns:
           Token string

       Raises:
           UnauthorizedException: No token provided
       """
       if not credentials:
           raise UnauthorizedException(detail="No authentication token provided")

       return credentials.credentials
   ```

3. **Test JWT functions**
   - Verify access token generation with correct expiry (30 min)
   - Verify refresh token generation with correct expiry (30 days)
   - Verify token verification extracts correct user_id
   - Verify expired tokens raise TokenExpiredException
   - Verify invalid tokens raise TokenInvalidException
   - Verify token type validation works

#### Acceptance Criteria
- [x] `create_access_token()` generates valid JWT with 30min expiry
- [x] `create_refresh_token()` generates valid JWT with 30day expiry
- [x] `verify_token()` correctly validates and extracts user_id
- [x] Token expiration is properly validated
- [x] Token type (access vs refresh) is validated
- [x] Unit tests pass with 100% coverage

---

### Subtask 03.03: Implement User Registration Endpoint ✅ COMPLETED
**Status**: ✅ COMPLETED (2025-11-25)
**Actual Duration**: 80 minutes
**Priority**: Critical
**Files**:
- `src/services/auth_service.py` (NEW) - 245 lines
- `src/api/v1/auth.py` (NEW) - Auth router with registration, login, refresh, logout endpoints
- `src/api/__init__.py`, `src/api/v1/__init__.py` - Package initialization
- `src/services/__init__.py` - Service layer initialization

**Completion Summary**:
- Files: auth_service.py (245 lines), auth.py (router with 4 endpoints), test files, verification script
- Features: User registration with atomic transactions (User + UserSettings + RefreshToken)
- Bonus Endpoints: login, refresh tokens, logout (beyond task scope)
- Security: Race condition handling with IntegrityError, password hashing integration (task 03.01), JWT tokens (task 03.02)
- Tests: Unit tests (registration, duplicate email), integration tests (API endpoints)
- Verification: scripts/verify_registration.py - ALL CHECKS PASSED
- QA Report: [../../qa/task-03.03-verification.md](../../qa/task-03.03-verification.md)
- Verdict: READY FOR PRODUCTION

#### Implementation Steps

1. **Create auth service** (`src/services/auth_service.py`)
   ```python
   from uuid import UUID

   from sqlalchemy import select
   from sqlalchemy.ext.asyncio import AsyncSession

   from src.core.exceptions import EmailAlreadyExistsException
   from src.core.security import hash_password3
   from src.db.models import User, UserSettings
   from src.schemas.user import UserCreate

   class AuthService:
       """Authentication service for user management."""

       def __init__(self, db: AsyncSession):
           self.db = db

       async def register_user(self, user_data: UserCreate) -> User:
           """
           Register a new user.

           Args:
               user_data: User registration data

           Returns:
               Created User model

           Raises:
               EmailAlreadyExistsException: Email already registered
           """
           # Check if email already exists
           result = await self.db.execute(
               select(User).where(User.email == user_data.email)
           )
           existing_user = result.scalar_one_or_none()

           if existing_user:
               raise EmailAlreadyExistsException(email=user_data.email)

           # Hash password
           password_hash = hash_password(user_data.password)

           # Create user
           user = User(
               email=user_data.email,
               password_hash=password_hash,
               full_name=user_data.full_name,
               is_active=True,
               is_superuser=False
           )

           self.db.add(user)
           await self.db.flush()  # Get user.id

           # Create default user settings
           settings = UserSettings(
               user_id=user.id,
               daily_goal=20,
               email_notifications=True
           )

           self.db.add(settings)
           await self.db.commit()
           await self.db.refresh(user)

           return user
   ```

2. **Create auth router** (`src/api/v1/auth.py`)
   ```python
   from fastapi import APIRouter, Depends, status
   from sqlalchemy.ext.asyncio import AsyncSession

   from src.core.security import create_access_token, create_refresh_token
   from src.db.dependencies import get_db
   from src.db.models import RefreshToken, User
   from src.schemas.user import TokenResponse, UserCreate, UserResponse
   from src.services.auth_service import AuthService

   router = APIRouter()

   @router.post(
       "/register",
       response_model=TokenResponse,
       status_code=status.HTTP_201_CREATED,
       summary="Register new user",
       description="Create a new user account with email and password"
   )
   async def register(
       user_data: UserCreate,
       db: AsyncSession = Depends(get_db)
   ) -> TokenResponse:
       """
       Register a new user and return authentication tokens.

       - **email**: Valid email address (unique)
       - **password**: Minimum 8 characters, at least one letter and one digit
       - **full_name**: User's full name

       Returns JWT access token and refresh token.
       """
       # Create user
       auth_service = AuthService(db)
       user = await auth_service.register_user(user_data)

       # Generate tokens
       access_token, access_expires = create_access_token(user.id)
       refresh_token, refresh_expires = create_refresh_token(user.id)

       # Store refresh token in database
       db_refresh_token = RefreshToken(
           user_id=user.id,
           token=refresh_token,
           expires_at=refresh_expires
       )
       db.add(db_refresh_token)
       await db.commit()

       # Return tokens
       return TokenResponse(
           access_token=access_token,
           refresh_token=refresh_token,
           token_type="bearer",
           expires_in=settings.jwt_access_token_expire_minutes * 60
       )
   ```

3. **Update main.py to include auth router**
   ```python
   # In src/main.py, add:
   from src.api.v1.auth import router as auth_router

   app.include_router(
       auth_router,
       prefix=f"{settings.api_v1_prefix}/auth",
       tags=["authentication"]
   )
   ```

4. **Test registration endpoint**
   - Test successful registration with valid data
   - Test duplicate email rejection
   - Test password validation
   - Test user settings auto-creation
   - Test token generation and storage

#### Acceptance Criteria
- [x] `POST /api/v1/auth/register` endpoint functional
- [x] Email uniqueness validated
- [x] Password hashed before storage
- [x] UserSettings automatically created
- [x] JWT tokens returned in response
- [x] Refresh token stored in database
- [x] Returns 201 Created on success
- [x] Returns 422 on validation error (duplicate email, weak password)

---

### Subtask 03.04: Implement Email/Password Login Endpoint ✅ COMPLETED
**Status**: ✅ COMPLETED (2025-11-26)
**Actual Duration**: 4 hours (verification, enhancement, testing, documentation)
**Priority**: Critical
**Files**:
- `src/services/auth_service.py` (enhanced with login tracking and audit logging)
- `src/api/v1/auth.py` (enhanced with IP tracking)
- `src/db/models.py` (added last_login_at, last_login_ip fields)
- `alembic/versions/20251126_1831_*_add_last_login_fields.py` (migration)

**Completion Summary**:
- Core login functionality was already implemented in Task 03.03
- Enhanced with last_login_at and last_login_ip tracking
- Added comprehensive audit logging (INFO for success, WARNING for failures)
- Created verification script: scripts/verify_login.py
- Created comprehensive test suite: tests/unit/services/test_auth_service_login_fixed.py (16 tests)
- Manual testing via Swagger UI - all scenarios verified
- QA Report: [../../qa/task-03.04-verification.md](../../qa/task-03.04-verification.md)
- Verdict: **READY FOR PRODUCTION**

#### Implementation Steps

1. **Add login method to AuthService**
   ```python
   # In src/services/auth_service.py, add:

   from src.core.exceptions import InvalidCredentialsException
   from src.core.security import verify_password
   from src.schemas.user import UserLogin

   async def authenticate_user(self, credentials: UserLogin) -> User:
       """
       Authenticate user with email and password.

       Args:
           credentials: Login credentials

       Returns:
           User model if authenticated

       Raises:
           InvalidCredentialsException: Invalid email or password
       """
       # Query user by email (eager load settings)
       result = await self.db.execute(
           select(User)
           .where(User.email == credentials.email)
           .options(selectinload(User.settings))
       )
       user = result.scalar_one_or_none()

       # User not found or password is None (OAuth user)
       if not user or not user.password_hash:
           raise InvalidCredentialsException()

       # Verify password
       if not verify_password(credentials.password, user.password_hash):
           raise InvalidCredentialsException()

       # Check if user is active
       if not user.is_active:
           raise InvalidCredentialsException(
               detail="Account is inactive"
           )

       return user
   ```

2. **Add login endpoint to router**
   ```python
   # In src/api/v1/auth.py, add:

   from src.schemas.user import UserLogin

   @router.post(
       "/login",
       response_model=TokenResponse,
       summary="Login with email and password",
       description="Authenticate user and return JWT tokens"
   )
   async def login(
       credentials: UserLogin,
       db: AsyncSession = Depends(get_db)
   ) -> TokenResponse:
       """
       Authenticate user with email and password.

       - **email**: Registered email address
       - **password**: User password

       Returns JWT access token and refresh token.
       """
       # Authenticate user
       auth_service = AuthService(db)
       user = await auth_service.authenticate_user(credentials)

       # Generate tokens
       access_token, access_expires = create_access_token(user.id)
       refresh_token, refresh_expires = create_refresh_token(user.id)

       # Store refresh token in database
       db_refresh_token = RefreshToken(
           user_id=user.id,
           token=refresh_token,
           expires_at=refresh_expires
       )
       db.add(db_refresh_token)
       await db.commit()

       # Return tokens
       return TokenResponse(
           access_token=access_token,
           refresh_token=refresh_token,
           token_type="bearer",
           expires_in=settings.jwt_access_token_expire_minutes * 60
       )
   ```

3. **Test login endpoint**
   - Test successful login with valid credentials
   - Test invalid email rejection
   - Test invalid password rejection
   - Test inactive user rejection
   - Test OAuth user (no password) rejection
   - Test token generation and storage

#### Acceptance Criteria
- [x] `POST /api/v1/auth/login` endpoint functional
- [x] Email/password validation works
- [x] Inactive users cannot login
- [x] OAuth users (no password) cannot login via email/password
- [x] JWT tokens returned in response
- [x] Refresh token stored in database
- [x] Returns 200 OK on success
- [x] Returns 401 Unauthorized on invalid credentials
- [x] Last login timestamp updated (enhancement)
- [x] Login attempts logged for security (enhancement)
- [x] Client IP tracked (enhancement)

---

### Subtask 03.05: Implement Token Refresh Endpoint ✅ COMPLETED
**Status**: ✅ COMPLETED (2025-11-29)
**Actual Duration**: 60 minutes
**Priority**: Critical
**Files**:
- `src/services/auth_service.py` (updated with token rotation)
- `src/api/v1/auth.py` (updated with proper exception handling)
- `tests/unit/services/test_auth_service_refresh.py` (NEW - 11 tests)
- `scripts/verify_refresh.py` (NEW - verification script)

**Completion Summary**:
- Token rotation implemented (delete old, create new)
- User validation (is_active, user existence)
- Proper exception handling (TokenExpiredException vs TokenInvalidException)
- 11/11 unit tests passing, 100% coverage
- QA verified: READY FOR PRODUCTION
- Detailed plan: [03.05-token-refresh-endpoint-plan.md](./03.05-token-refresh-endpoint-plan.md)

#### Implementation Steps

1. **Add refresh token method to AuthService**
   ```python
   # In src/services/auth_service.py, add:

   from datetime import datetime

   from src.core.security import verify_token, create_access_token, create_refresh_token

   async def refresh_access_token(
       self,
       refresh_token_str: str
   ) -> tuple[str, str, User]:
       """
       Refresh access token using refresh token.

       Args:
           refresh_token_str: Refresh token string

       Returns:
           (new_access_token, new_refresh_token, user)

       Raises:
           TokenExpiredException: Refresh token expired
           TokenInvalidException: Refresh token invalid or revoked
       """
       # Verify JWT signature and extract user_id
       user_id = verify_token(refresh_token_str, token_type="refresh")

       # Check if refresh token exists in database (not revoked)
       result = await self.db.execute(
           select(RefreshToken)
           .where(RefreshToken.token == refresh_token_str)
           .where(RefreshToken.user_id == user_id)
       )
       db_token = result.scalar_one_or_none()

       if not db_token:
           raise TokenInvalidException(
               detail="Refresh token not found or has been revoked"
           )

       # Check if token is expired (double check)
       if db_token.expires_at < datetime.utcnow():
           # Delete expired token
           await self.db.delete(db_token)
           await self.db.commit()
           raise TokenExpiredException(detail="Refresh token has expired")

       # Get user
       result = await self.db.execute(
           select(User)
           .where(User.id == user_id)
           .options(selectinload(User.settings))
       )
       user = result.scalar_one_or_none()

       if not user or not user.is_active:
           raise InvalidCredentialsException(detail="User not found or inactive")

       # Generate new tokens
       new_access_token, _ = create_access_token(user.id)
       new_refresh_token, new_refresh_expires = create_refresh_token(user.id)

       # Rotate refresh token (delete old, insert new)
       await self.db.delete(db_token)
       new_db_token = RefreshToken(
           user_id=user.id,
           token=new_refresh_token,
           expires_at=new_refresh_expires
       )
       self.db.add(new_db_token)
       await self.db.commit()

       return new_access_token, new_refresh_token, user
   ```

2. **Add refresh endpoint to router**
   ```python
   # In src/api/v1/auth.py, add:

   from src.schemas.user import TokenRefresh

   @router.post(
       "/refresh",
       response_model=TokenResponse,
       summary="Refresh access token",
       description="Get a new access token using a refresh token"
   )
   async def refresh_token(
       token_data: TokenRefresh,
       db: AsyncSession = Depends(get_db)
   ) -> TokenResponse:
       """
       Refresh expired access token.

       - **refresh_token**: Valid refresh token

       Returns new access token and new refresh token (token rotation).
       """
       auth_service = AuthService(db)

       new_access, new_refresh, user = await auth_service.refresh_access_token(
           token_data.refresh_token
       )

       return TokenResponse(
           access_token=new_access,
           refresh_token=new_refresh,
           token_type="bearer",
           expires_in=settings.jwt_access_token_expire_minutes * 60
       )
   ```

3. **Test refresh endpoint**
   - Test successful refresh with valid token
   - Test refresh token rotation (old token invalidated)
   - Test expired refresh token rejection
   - Test revoked refresh token rejection
   - Test invalid refresh token rejection
   - Test inactive user rejection

#### Acceptance Criteria
- [x] `POST /api/v1/auth/refresh` endpoint functional
- [x] Refresh token verified against database
- [x] New access + refresh tokens generated
- [x] Old refresh token deleted (rotation)
- [x] Expired tokens rejected
- [x] Revoked tokens rejected
- [x] Returns 200 OK on success
- [x] Returns 401 Unauthorized on invalid/expired token

---

### Subtask 03.06: Create Google OAuth Flow (Placeholder)
**Duration**: 30 minutes
**Priority**: Low (future feature)
**Files**:
- `src/services/auth_service.py` (update)
- `src/api/v1/auth.py` (update)

#### Implementation Steps

1. **Add OAuth placeholder method to AuthService**
   ```python
   # In src/services/auth_service.py, add:

   async def authenticate_google(
       self,
       google_token: str
   ) -> User:
       """
       Authenticate user with Google OAuth token.

       Args:
           google_token: Google OAuth token

       Returns:
           User model (creates if not exists)

       Raises:
           NotImplementedError: OAuth not yet implemented
       """
       # TODO (Future): Implement Google OAuth
       # 1. Verify google_token with Google API
       # 2. Extract user info (email, name, google_id)
       # 3. Check if user exists (by google_id or email)
       # 4. Create user if not exists (no password_hash)
       # 5. Return user
       raise NotImplementedError("Google OAuth not yet implemented")
   ```

2. **Add OAuth placeholder endpoint**
   ```python
   # In src/api/v1/auth.py, add:

   from pydantic import BaseModel

   class GoogleAuthRequest(BaseModel):
       """Google OAuth token request."""
       token: str

   @router.post(
       "/google",
       response_model=TokenResponse,
       summary="Login with Google (Coming Soon)",
       description="Authenticate using Google OAuth (not yet implemented)",
       include_in_schema=settings.feature_google_oauth  # Hide if disabled
   )
   async def google_login(
       auth_data: GoogleAuthRequest,
       db: AsyncSession = Depends(get_db)
   ) -> TokenResponse:
       """
       Authenticate with Google OAuth.

       **Note**: This endpoint is not yet implemented.

       - **token**: Google OAuth token from frontend

       Returns JWT access token and refresh token.
       """
       auth_service = AuthService(db)
       user = await auth_service.authenticate_google(auth_data.token)

       # Generate tokens (same as login/register)
       access_token, _ = create_access_token(user.id)
       refresh_token, refresh_expires = create_refresh_token(user.id)

       # Store refresh token
       db_refresh_token = RefreshToken(
           user_id=user.id,
           token=refresh_token,
           expires_at=refresh_expires
       )
       db.add(db_refresh_token)
       await db.commit()

       return TokenResponse(
           access_token=access_token,
           refresh_token=refresh_token,
           token_type="bearer",
           expires_in=settings.jwt_access_token_expire_minutes * 60
       )
   ```

3. **Document OAuth implementation plan**
   - Add TODO comments with implementation steps
   - Reference Google OAuth documentation
   - Note: Feature flag `feature_google_oauth` in config

#### Acceptance Criteria
- [ ] `POST /api/v1/auth/google` endpoint exists but returns 501 Not Implemented
- [ ] Endpoint hidden in docs if feature flag disabled
- [ ] Clear TODO comments for future implementation
- [ ] OAuth flow documented in code comments

---

### Subtask 03.07: Implement /auth/me Endpoint (Get Current User) ✅ COMPLETED
**Status**: ✅ COMPLETED (2025-11-29)
**Actual Duration**: 45 minutes
**Priority**: Critical
**Files**:
- `src/core/dependencies.py` (NEW - get_current_user, get_current_superuser, get_current_user_optional)
- `src/api/v1/auth.py` (updated with GET /me endpoint)
- `src/core/__init__.py` (updated with exports)
- `tests/unit/core/test_dependencies.py` (NEW - 21 tests)
- `scripts/verify_auth_me.py` (NEW - verification script)

**Completion Summary**:
- Created reusable authentication dependencies for all protected endpoints
- GET /api/v1/auth/me returns UserProfileResponse with settings
- 21/21 unit tests passing, 100% coverage
- QA verified: READY FOR PRODUCTION
- Detailed plan: [03.07-auth-me-endpoint-plan.md](./03.07-auth-me-endpoint-plan.md)

#### Implementation Steps

1. **Create authentication dependencies** (`src/core/dependencies.py`)
   ```python
   """FastAPI dependencies for authentication and authorization."""

   from typing import Optional
   from uuid import UUID

   from fastapi import Depends
   from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
   from sqlalchemy import select
   from sqlalchemy.ext.asyncio import AsyncSession
   from sqlalchemy.orm import selectinload

   from src.core.exceptions import UnauthorizedException, UserNotFoundException
   from src.core.security import verify_token
   from src.db.dependencies import get_db
   from src.db.models import User

   security_scheme = HTTPBearer(auto_error=False)

   async def get_current_user(
       credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
       db: AsyncSession = Depends(get_db)
   ) -> User:
       """
       Get current authenticated user from JWT token.

       Args:
           credentials: Bearer token from Authorization header
           db: Database session

       Returns:
           Current User model

       Raises:
           UnauthorizedException: No token or invalid token
           UserNotFoundException: User not found or inactive
       """
       # Check if credentials provided
       if not credentials:
           raise UnauthorizedException(detail="No authentication token provided")

       # Extract token
       token = credentials.credentials

       # Verify token and extract user_id
       try:
           user_id = verify_token(token, token_type="access")
       except Exception as e:
           raise UnauthorizedException(detail=str(e))

       # Get user from database
       result = await db.execute(
           select(User)
           .where(User.id == user_id)
           .options(selectinload(User.settings))
       )
       user = result.scalar_one_or_none()

       if not user:
           raise UserNotFoundException(user_id=str(user_id))

       if not user.is_active:
           raise UnauthorizedException(detail="User account is inactive")

       return user

   async def get_current_superuser(
       current_user: User = Depends(get_current_user)
   ) -> User:
       """
       Get current authenticated superuser.

       Args:
           current_user: Current user from get_current_user

       Returns:
           Current User model (superuser)

       Raises:
           ForbiddenException: User is not a superuser
       """
       if not current_user.is_superuser:
           raise ForbiddenException(detail="Superuser access required")

       return current_user
   ```

2. **Add /me endpoint to router**
   ```python
   # In src/api/v1/auth.py, add:

   from src.core.dependencies import get_current_user
   from src.schemas.user import UserProfileResponse

   @router.get(
       "/me",
       response_model=UserProfileResponse,
       summary="Get current user profile",
       description="Get authenticated user's profile with settings"
   )
   async def get_me(
       current_user: User = Depends(get_current_user)
   ) -> UserProfileResponse:
       """
       Get current authenticated user's profile.

       Requires valid JWT access token in Authorization header.

       Returns user profile with settings.
       """
       return UserProfileResponse.model_validate(current_user)
   ```

3. **Test /me endpoint**
   - Test successful profile retrieval with valid token
   - Test rejection with no token
   - Test rejection with expired token
   - Test rejection with invalid token
   - Test rejection with inactive user

#### Acceptance Criteria
- [x] `GET /api/v1/auth/me` endpoint functional
- [x] `get_current_user` dependency extracts user from JWT
- [x] Requires Bearer token in Authorization header
- [x] Returns user profile with settings
- [x] Returns 200 OK on success
- [x] Returns 401 Unauthorized on missing/invalid token
- [x] Returns 404 Not Found if user deleted

---

### Subtask 03.08: Create Authentication Middleware ✅ COMPLETED
**Status**: ✅ COMPLETED (2025-11-29)
**Actual Duration**: 45 minutes
**Priority**: Medium (optional enhancement)
**Plan**: [03.08-auth-middleware-plan.md](./03.08-auth-middleware-plan.md)
**Files**:
- `src/middleware/__init__.py` (NEW)
- `src/middleware/auth.py` (NEW - 194 lines)
- `src/main.py` (UPDATED - added import and middleware registration)
- `tests/unit/middleware/__init__.py` (NEW)
- `tests/unit/middleware/test_auth_middleware.py` (NEW - 677 lines, 42 tests)
- `scripts/verify_auth_middleware.py` (NEW - 148 lines)

**Completion Summary**:
- AuthLoggingMiddleware logs all requests to /api/v1/auth/* endpoints
- Request timing with time.perf_counter() for millisecond precision
- Client IP extraction: X-Forwarded-For, X-Real-IP, direct connection
- Log levels based on status code: INFO (2xx), WARNING (4xx), ERROR (5xx)
- Sensitive path marking for login, register, logout, logout-all
- Failed login attempt detection and warning logging
- 42/42 unit tests passed, 100% coverage
- QA Report: [../../qa/task-03.08-verification.md](../../qa/task-03.08-verification.md)
- Verdict: **READY FOR PRODUCTION**

#### Implementation Steps

**Note**: This subtask was OPTIONAL but now COMPLETED. FastAPI dependencies (Subtask 03.07) are the preferred method for authentication. This middleware adds supplementary security audit logging.

1. **Created auth middleware** (`src/middleware/auth.py`)
   - `AuthLoggingMiddleware` class extending `BaseHTTPMiddleware`
   - `dispatch()` method - main entry point with timing
   - `_should_log()` - filter auth endpoints
   - `_get_client_ip()` - extract IP from headers
   - `_log_request()` - log with appropriate level

2. **Added middleware to app** (`src/main.py`)
   - Import: `from src.middleware.auth import AuthLoggingMiddleware`
   - Registration: `app.add_middleware(AuthLoggingMiddleware)`

#### Acceptance Criteria
- [x] Middleware logs all auth endpoint requests
- [x] Request timing included in logs (duration_ms)
- [x] Client IP captured (direct, X-Forwarded-For, X-Real-IP)
- [x] Log level based on status code (INFO/WARNING/ERROR)
- [x] Sensitive paths marked
- [x] Failed login warning logged
- [x] Does not interfere with endpoint functionality
- [x] 42 unit tests passing (100% coverage)

---

### Subtask 03.09: Add Session Management and Token Revocation ✅ COMPLETED
**Status**: ✅ COMPLETED (2025-11-29)
**Actual Duration**: 45 minutes
**Priority**: High
**Files**:
- `src/services/auth_service.py` (updated with 5 new session management methods)
- `src/api/v1/auth.py` (updated with 4 session management endpoints)
- `src/schemas/user.py` (added 4 new schemas)
- `tests/unit/services/test_auth_service_sessions.py` (NEW - 12 tests)
- `scripts/verify_session_management.py` (NEW - verification script)

**Completion Summary**:
- Service methods: revoke_refresh_token(), revoke_all_user_tokens(), cleanup_expired_tokens(), get_user_sessions(), revoke_session_by_id()
- API endpoints: POST /logout (enhanced), POST /logout-all, GET /sessions, DELETE /sessions/{id}
- New schemas: SessionInfo, SessionListResponse, LogoutResponse, LogoutAllResponse
- Security: All endpoints require authentication, token values never exposed, users can only revoke own sessions
- 12/12 unit tests passing, 100% coverage
- QA verified: READY FOR PRODUCTION
- Detailed plan: [03.09-session-management-token-revocation-plan.md](./03.09-session-management-token-revocation-plan.md)

#### Implementation Steps

1. **Add token revocation methods to AuthService**
   ```python
   # In src/services/auth_service.py, add:

   async def revoke_refresh_token(self, refresh_token_str: str) -> bool:
       """
       Revoke a specific refresh token.

       Args:
           refresh_token_str: Refresh token to revoke

       Returns:
           True if token was revoked, False if not found
       """
       result = await self.db.execute(
           select(RefreshToken)
           .where(RefreshToken.token == refresh_token_str)
       )
       token = result.scalar_one_or_none()

       if token:
           await self.db.delete(token)
           await self.db.commit()
           return True

       return False

   async def revoke_all_user_tokens(self, user_id: UUID) -> int:
       """
       Revoke all refresh tokens for a user (logout from all devices).

       Args:
           user_id: User ID

       Returns:
           Number of tokens revoked
       """
       result = await self.db.execute(
           select(RefreshToken)
           .where(RefreshToken.user_id == user_id)
       )
       tokens = result.scalars().all()

       for token in tokens:
           await self.db.delete(token)

       await self.db.commit()
       return len(tokens)

   async def cleanup_expired_tokens(self) -> int:
       """
       Remove expired refresh tokens from database.

       Returns:
           Number of tokens deleted
       """
       result = await self.db.execute(
           select(RefreshToken)
           .where(RefreshToken.expires_at < datetime.utcnow())
       )
       tokens = result.scalars().all()

       for token in tokens:
           await self.db.delete(token)

       await self.db.commit()
       return len(tokens)
   ```

2. **Test token revocation**
   - Test revoking single token
   - Test revoking all user tokens
   - Test cleanup of expired tokens

#### Acceptance Criteria
- [x] `revoke_refresh_token()` deletes specific token
- [x] `revoke_all_user_tokens()` deletes all user tokens
- [x] `cleanup_expired_tokens()` removes expired tokens
- [x] `get_user_sessions()` returns session info without token values
- [x] `revoke_session_by_id()` revokes specific session (with authorization check)
- [x] POST /logout endpoint enhanced to require auth and return LogoutResponse
- [x] POST /logout-all endpoint for multi-device logout
- [x] GET /sessions endpoint lists active sessions
- [x] DELETE /sessions/{id} endpoint revokes specific session
- [x] All endpoints require authentication
- [x] Token values never exposed in responses
- [x] 12/12 unit tests pass

---

### Subtask 03.10: Implement Logout with Token Blacklisting ✅ COMPLETED
**Status**: ✅ COMPLETED (2025-11-29) - Implemented as part of Task 03.09
**Actual Duration**: 0 minutes (merged with 03.09)
**Priority**: High
**Files**:
- `src/api/v1/auth.py` (updated in 03.09)
- `src/services/auth_service.py` (updated in 03.09)
- `src/schemas/user.py` (updated in 03.09)

**Completion Summary**:
- POST /logout endpoint with authentication requirement
- POST /logout-all endpoint for multi-device logout
- LogoutResponse and LogoutAllResponse Pydantic schemas
- Token deletion from database (not blacklist table)
- Full test coverage via 03.09 test suite
- Detailed plan: [03.10-logout-endpoints-plan.md](./03.10-logout-endpoints-plan.md)

#### Acceptance Criteria
- [x] `POST /api/v1/auth/logout` endpoint functional
- [x] `POST /api/v1/auth/logout-all` endpoint functional
- [x] Refresh tokens deleted from database
- [x] Returns success message with count
- [x] Returns 200 OK on success
- [x] Returns 401 Unauthorized if not authenticated

---

## Implementation Order

### Phase 1: Foundation (Subtasks 03.01-03.02) ✅ COMPLETED
**Actual Duration**: 1.5 hours
**Dependencies**: None

1. **03.01: Password Hashing** ✅ COMPLETED (30 min, 2025-11-24)
   - Create `src/core/security.py`
   - Implement `hash_password()` and `verify_password()`
   - Test password hashing
   - 35/35 tests passed, 100% coverage

2. **03.02: JWT Token Management** ✅ COMPLETED (60 min, 2025-11-25)
   - Add JWT functions to `src/core/security.py`
   - Implement `create_access_token()`, `create_refresh_token()`, `verify_token()`
   - Test token generation and verification
   - 28/28 tests passed, 100% coverage

**Checkpoint**: ✅ Security utilities functional and tested - Phase 1 COMPLETE

---

### Phase 2: Core Authentication (Subtasks 03.03-03.05) ✅ COMPLETED
**Actual Duration**: 6+ hours
**Dependencies**: Phase 1

3. **03.03: User Registration** ✅ COMPLETED (80 min, 2025-11-25)
   - Create `src/services/auth_service.py`
   - Create `src/api/v1/auth.py`
   - Implement registration endpoint
   - Test registration flow
   - Bonus: Also implemented login, refresh, logout endpoints

4. **03.04: Email/Password Login** ✅ COMPLETED (4 hours, 2025-11-26)
   - Add `authenticate_user()` to auth service
   - Implement login endpoint
   - Enhanced with last_login_at, last_login_ip tracking
   - Added audit logging for security

5. **03.05: Token Refresh** ✅ COMPLETED (60 min, 2025-11-29)
   - Add `refresh_access_token()` to auth service with token rotation
   - Implement refresh endpoint with proper exception handling
   - Test refresh flow with token rotation
   - 11/11 unit tests passing, 100% coverage

**Checkpoint**: ✅ All authentication endpoints functional - Phase 2 COMPLETE

---

### Phase 3: Protected Endpoints (Subtasks 03.07, 03.09-03.10)
**Duration**: 1.5 hours
**Dependencies**: Phase 2

6. **03.07: Get Current User** ✅ COMPLETED (45 min, 2025-11-29)
   - Create `src/core/dependencies.py` with authentication dependencies
   - Implement `get_current_user`, `get_current_superuser`, `get_current_user_optional`
   - Add `/me` endpoint to auth router
   - 21/21 unit tests passing, 100% coverage

7. **03.07: Get Current User** (30 min) - ORIGINAL PLACEHOLDER BELOW
   - Create `src/core/dependencies.py`
   - Implement `get_current_user()` dependency
   - Implement `/me` endpoint
   - Test authentication dependency

7. **03.09: Session Management** (30 min)
   - Add token revocation methods to auth service
   - Test token revocation

8. **03.10: Logout Endpoints** (30 min)
   - Implement `/logout` and `/logout-all` endpoints
   - Test logout flows

**Checkpoint**: Full authentication system operational

---

### Phase 4: Optional & Future (Subtasks 03.06, 03.08)
**Duration**: 1 hour
**Dependencies**: Phase 3

9. **03.06: Google OAuth Placeholder** (30 min)
   - Add OAuth placeholder methods
   - Implement `/google` endpoint (returns 501)
   - Document future implementation

10. **03.08: Auth Middleware** (30 min) - OPTIONAL
    - Create auth logging middleware
    - Add to application

**Checkpoint**: All subtasks complete

---

## File Structure

### New Files to Create

```
src/
├── core/
│   ├── security.py                    # NEW - Password & JWT utilities
│   └── dependencies.py                # NEW - Auth dependencies
├── services/
│   └── auth_service.py                # NEW - Auth business logic
├── api/
│   └── v1/
│       └── auth.py                    # NEW - Auth router
└── middleware/                        # NEW (optional)
    └── auth.py                        # NEW - Auth middleware
```

### Files to Update

```
src/
├── main.py                            # UPDATE - Include auth router
├── core/
│   └── exceptions.py                  # VERIFY - Auth exceptions exist
├── db/
│   ├── models.py                      # VERIFY - User, RefreshToken models
│   └── dependencies.py                # VERIFY - get_db dependency
└── schemas/
    └── user.py                        # VERIFY - Auth schemas exist
```

### Final File Tree

```
src/
├── __init__.py
├── main.py                            # ✅ Updated
├── config.py                          # ✅ Existing
├── constants.py                       # ✅ Existing
├── core/
│   ├── __init__.py
│   ├── exceptions.py                  # ✅ Existing
│   ├── logging.py                     # ✅ Existing
│   ├── security.py                    # 🆕 NEW
│   └── dependencies.py                # 🆕 NEW
├── services/
│   ├── __init__.py
│   └── auth_service.py                # 🆕 NEW
├── api/
│   ├── __init__.py
│   └── v1/
│       ├── __init__.py
│       └── auth.py                    # 🆕 NEW
├── middleware/                        # 🆕 NEW (optional)
│   ├── __init__.py
│   └── auth.py                        # 🆕 NEW
├── db/
│   ├── __init__.py
│   ├── base.py                        # ✅ Existing
│   ├── session.py                     # ✅ Existing
│   ├── dependencies.py                # ✅ Existing
│   └── models.py                      # ✅ Existing
└── schemas/
    ├── __init__.py
    └── user.py                        # ✅ Existing
```

---

## Testing Strategy

### Unit Tests

**File**: `tests/unit/test_auth.py`

Test coverage for:
- Password hashing functions (100% coverage)
- JWT token generation and validation (100% coverage)
- Token expiration handling
- Token type validation
- Password verification

### Integration Tests

**File**: `tests/integration/test_auth_api.py`

Test coverage for:
- Registration endpoint (success, duplicate email, weak password)
- Login endpoint (success, wrong password, inactive user)
- Refresh endpoint (success, expired token, revoked token)
- /me endpoint (success, no token, expired token)
- Logout endpoints (single device, all devices)

### Test Fixtures

**File**: `tests/conftest.py`

Fixtures for:
- Test user creation
- Test user tokens (access + refresh)
- Authenticated HTTP client
- Test password

### Test Coverage Goals

- **Overall Coverage**: 90%+
- **Password Hashing**: 100%
- **JWT Token Management**: 100%
- **AuthService**: 95%
- **Auth Endpoints**: 90%
- **Dependencies**: 95%

---

## Security Checklist

### Password Security
- [ ] Passwords hashed with bcrypt cost factor 12
- [ ] Passwords never logged or returned in responses
- [ ] Password validation enforces minimum strength
- [ ] Plain passwords never stored in database

### JWT Security
- [ ] JWT secret key strong and environment-specific
- [ ] Access tokens short-lived (30 minutes)
- [ ] Refresh tokens rotated on each use
- [ ] Token expiration properly validated
- [ ] Token signature verified on every request
- [ ] User ID extracted from token, not request

### Session Management
- [ ] Refresh tokens stored in database
- [ ] Refresh tokens can be revoked (logout)
- [ ] Expired tokens automatically cleaned up
- [ ] Multiple sessions supported (multi-device)
- [ ] Logout from all devices supported

### API Security
- [ ] All auth endpoints use HTTPS in production
- [ ] CORS configured to allow only frontend domain
- [ ] Rate limiting on auth endpoints (5 req/min)
- [ ] Input validation on all endpoints
- [ ] Error messages don't leak sensitive info

### Data Protection
- [ ] Sensitive data never logged (passwords, tokens)
- [ ] Database queries use parameterized statements
- [ ] SQL injection prevented (SQLAlchemy ORM)
- [ ] XSS prevention (FastAPI auto-escaping)

### Monitoring
- [ ] Failed login attempts logged
- [ ] Unusual access patterns monitored
- [ ] Token revocation events logged
- [ ] Authentication errors tracked

---

## Integration Points

### Database Integration
- **Models Used**:
  - `User` - User accounts with password_hash
  - `UserSettings` - User preferences (auto-created)
  - `RefreshToken` - JWT refresh token storage

- **Queries**:
  - User lookup by email (registration, login)
  - User lookup by ID (token verification)
  - Refresh token CRUD operations
  - Eager loading of user.settings relationship

### Frontend Integration
- **API Endpoints**:
  ```
  POST /api/v1/auth/register
  POST /api/v1/auth/login
  POST /api/v1/auth/refresh
  POST /api/v1/auth/logout
  POST /api/v1/auth/logout-all
  GET  /api/v1/auth/me
  POST /api/v1/auth/google (placeholder)
  ```

- **Token Flow**:
  1. Frontend calls `/register` or `/login`
  2. Backend returns `TokenResponse` with access + refresh tokens
  3. Frontend stores tokens (localStorage or memory)
  4. Frontend includes `Authorization: Bearer <access_token>` on all requests
  5. When access token expires, frontend calls `/refresh` with refresh token
  6. Backend returns new access + refresh tokens (rotation)
  7. Frontend updates stored tokens

- **Error Handling**:
  - 401 Unauthorized → Redirect to login
  - 422 Validation Error → Display field-specific errors
  - 429 Rate Limited → Show "too many requests" message

### Other Backend Modules
- **Dependencies**:
  - `get_current_user` - Inject authenticated user into endpoints
  - `get_current_superuser` - Restrict to superusers
  - `get_db` - Database session dependency

- **Usage in Protected Endpoints**:
  ```python
  @router.get("/protected-endpoint")
  async def protected_route(
      current_user: User = Depends(get_current_user)
  ):
      # current_user is authenticated User model
      return {"message": f"Hello {current_user.full_name}"}
  ```

---

## Common Pitfalls

### 1. Token Expiration Handling
**Problem**: Not handling expired tokens gracefully.

**Solution**:
- Always check token expiration in `verify_token()`
- Raise `TokenExpiredException` for expired tokens
- Frontend should catch 401 and attempt refresh

### 2. Refresh Token Rotation
**Problem**: Reusing refresh tokens (security risk).

**Solution**:
- Delete old refresh token when generating new one
- Store only current refresh token in database
- Invalidate all tokens on security events

### 3. Password Hash Timing
**Problem**: bcrypt is slow, blocking event loop.

**Solution**:
- bcrypt operations are CPU-bound but FastAPI handles it
- For very high load, consider running in thread pool
- Current implementation is acceptable for MVP

### 4. Database Connection Management
**Problem**: Not properly closing database connections.

**Solution**:
- Use `async with` context manager for sessions
- FastAPI dependency system handles cleanup automatically
- Verify connections closed in tests

### 5. Token Secret Key
**Problem**: Using default secret key in production.

**Solution**:
- Generate strong secret key: `openssl rand -hex 32`
- Store in environment variable
- Never commit secret key to version control
- Rotate secret keys periodically

### 6. CORS Configuration
**Problem**: Allowing all origins in production.

**Solution**:
- Whitelist only frontend domain
- Set `allow_credentials=True` for cookies
- Configure in `settings.cors_origins`

### 7. Rate Limiting
**Problem**: No protection against brute force.

**Solution**:
- Implement rate limiting on auth endpoints
- Use Redis for distributed rate limiting
- Start with 5 requests/minute on auth endpoints

### 8. Error Message Leakage
**Problem**: Error messages revealing user existence.

**Solution**:
- Return generic "Invalid credentials" for both wrong email and password
- Don't distinguish between "user not found" and "wrong password"
- Log actual errors server-side

---

## Post-Implementation Checklist

### Code Quality
- [ ] All subtasks completed
- [ ] Code follows project style (Black, isort)
- [ ] Type hints added to all functions
- [ ] Docstrings added to all public functions
- [ ] No hardcoded secrets or credentials
- [ ] Environment variables used for configuration

### Testing
- [ ] All unit tests passing
- [ ] All integration tests passing
- [ ] Test coverage ≥ 90%
- [ ] Manual testing completed for all endpoints
- [ ] Edge cases tested (expired tokens, duplicate emails, etc.)

### Security
- [ ] Security checklist reviewed
- [ ] Passwords hashed with bcrypt
- [ ] JWT tokens properly signed and verified
- [ ] Refresh tokens stored in database
- [ ] Rate limiting configured
- [ ] CORS properly configured

### Documentation
- [ ] API endpoints documented in code
- [ ] Swagger docs generated and verified
- [ ] README updated with authentication flow
- [ ] Environment variables documented

### Integration
- [ ] Auth router included in main.py
- [ ] Dependencies functional in other endpoints
- [ ] Frontend integration plan documented
- [ ] Token flow tested end-to-end

### Deployment
- [ ] Configuration validated for production
- [ ] Secret key changed from default
- [ ] Database migrations applied
- [ ] Health checks passing

---

## Next Steps

After completing Task 3, proceed to:

1. **Task 4: API Foundation & Middleware**
   - Use `get_current_user` dependency on protected endpoints
   - Add rate limiting middleware
   - Implement request logging

2. **Task 5: Deck Management API**
   - All deck endpoints require authentication
   - Join user progress data with decks

3. **Task 10: Content Management & Seeding**
   - Seed database with test users
   - Verify authentication with seeded data

---

**Document End**

**Last Updated**: 2025-11-21
**Status**: Ready for Implementation
**Estimated Duration**: 4-5 hours
**Next Task**: Task 4 (API Foundation & Middleware)
