from typing import Optional
from pydantic import BaseModel

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenPayload(BaseModel):
    sub: Optional[str] = None

class UserLogin(BaseModel):
    username: str
    password: str

class UserRead(BaseModel):
    id: str
    username: str
    full_name: Optional[str] = None
    role: str
    is_active: bool
    parent_user_id: Optional[str] = None
    last_login_at: Optional[str] = None
    permissions: list[str] = []

class UserCreate(BaseModel):
    username: str
    full_name: Optional[str] = None
    password: str
    role: str

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None

class UserPasswordReset(BaseModel):
    password: str

class UserPasswordChange(BaseModel):
    current_password: str
    new_password: str
