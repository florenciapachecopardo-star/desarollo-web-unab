import os
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import FastAPI, HTTPException, Header, Depends
from pydantic import BaseModel

app = FastAPI(
    title="Auth Service",
    description="Servicio simple de autenticacion"
)

USERS = {
    "ana": {"user_id": "USR-001", "password": "1234", "roles": ["user"]},
    "pedro": {"user_id": "USR-002", "password": "1234", "roles": ["user"]},
    "ernesto": {"user_id": "USR-003", "password": "admin123", "roles": ["user", "admin"]}
}

SESSIONS = {}

TOKEN_LIFETIME_MINUTES = 15

AUTH_INTROSPECTION_SECRET = os.getenv("AUTH_INTROSPECTION_SECRET", "demo-introspection-secret")


class LoginRequest(BaseModel):
    username: str
    password: str


class IntrospectRequest(BaseModel):
    token: str


def verify_gateway(x_gateway_secret: str = Header(default="")):
    valid = secrets.compare_digest(x_gateway_secret, AUTH_INTROSPECTION_SECRET)
    if not valid:
        raise HTTPException(status_code=403, detail="Solicitud no autorizada desde Gateway")


@app.get("/health")
def health():
    return {"status": "OK", "service": "Auth Service"}


@app.post("/login")
def login(credentials: LoginRequest):
    user = USERS.get(credentials.username)
    if user is None or user["password"] != credentials.password:
        raise HTTPException(status_code=401, detail="Credenciales invalidas")

    token = secrets.token_hex(16)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=TOKEN_LIFETIME_MINUTES)

    SESSIONS[token] = {
        "user_id": user["user_id"],
        "username": credentials.username,
        "roles": user["roles"],
        "expires_at": expires_at
    }

    return {
        "access_token": token,
        "token_type": "bearer",
        "expires_in": TOKEN_LIFETIME_MINUTES * 60
    }


@app.post("/introspect", dependencies=[Depends(verify_gateway)])
def introspect(data: IntrospectRequest):
    session = SESSIONS.get(data.token)
    if session is None:
        return {"active": False}

    if datetime.now(timezone.utc) > session["expires_at"]:
        del SESSIONS[data.token]
        return {"active": False}

    return {
        "active": True,
        "user_id": session["user_id"],
        "username": session["username"],
        "roles": session["roles"]
    }


@app.post("/logout", dependencies=[Depends(verify_gateway)])
def logout(data: IntrospectRequest):
    SESSIONS.pop(data.token, None)
    return {"status": "OK"}
