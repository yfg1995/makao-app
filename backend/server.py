from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime, timedelta, timezone
import os
import uuid
import httpx
from dotenv import load_dotenv
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

load_dotenv()

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "card_rush_arena")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="Card Rush Arena API")
api = APIRouter(prefix="/api")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

EMERGENT_AUTH_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"
FIREBASE_PROJECT_ID = os.environ.get("FIREBASE_PROJECT_ID", "card-rush-arena-makao")
FIREBASE_ISSUER = f"https://securetoken.google.com/{FIREBASE_PROJECT_ID}"
FIREBASE_CERTS_URL = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com"
_firebase_certs_cache: Dict[str, Any] = {"expires_at": None, "certs": {}}

# ---------- Models ----------
class UserPublic(BaseModel):
    id: str
    username: str
    email: Optional[str] = None
    picture: Optional[str] = None
    coins: int = 1000
    tickets: int = 5
    rank_points: int = 0
    league: str = "Bronze"
    level: int = 1
    xp: int = 0
    daily_streak: int = 0
    last_daily_claim: Optional[str] = None
    guest_mode: bool = False
    gender: Optional[str] = None
    created_at: Optional[str] = None

class MatchResultIn(BaseModel):
    match_id: str
    won: bool
    cards_left: int = 0
    duration_seconds: int = 0
    coins_earned: int = 0
    rank_points_delta: int = 0
    xp_earned: int = 0

class MissionClaimIn(BaseModel):
    mission_id: str

class FirebaseAuthIn(BaseModel):
    id_token: str = Field(..., min_length=20)
    username: Optional[str] = None
    gender: Optional[str] = None

# Economy constants — server is source of truth
MATCH_ENTRY_COIN_COST = 100
MATCH_ENTRY_TICKET_COST = 1
MATCH_DAILY_LIMIT = int(os.environ.get("MATCH_DAILY_LIMIT", "3"))
AD_PAIR_SIZE = 2
AD_REWARD_PER_PAIR_COINS = 100   # every 2 ads watched, enough for one match
AD_WATCH_MIN_INTERVAL_SECONDS = int(os.environ.get("AD_WATCH_MIN_INTERVAL_SECONDS", "30"))

# ---------- Helpers ----------
def _now():
    return datetime.now(timezone.utc)

def _league_for_rp(rp: int) -> str:
    if rp >= 4000: return "Diamond"
    if rp >= 2500: return "Platinum"
    if rp >= 1500: return "Gold"
    if rp >= 700: return "Silver"
    return "Bronze"

def _sanitize_gender(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    normalized = str(value).strip().lower()
    return normalized if normalized in {"male", "female"} else None

async def _ensure_user(user_doc: Dict[str, Any]) -> Dict[str, Any]:
    # default fields
    defaults = {
        "coins": 1000, "tickets": 5, "rank_points": 0, "league": "Bronze",
        "level": 1, "xp": 0, "daily_streak": 0, "last_daily_claim": None,
        "guest_mode": False, "gender": None,
    }
    updates = {}
    for k, v in defaults.items():
        if k not in user_doc:
            updates[k] = v
            user_doc[k] = v
    if updates:
        await db.users.update_one({"_id": user_doc["_id"]}, {"$set": updates})
    return user_doc

def _user_to_public(u: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": u.get("_id") or u.get("id"),
        "username": u.get("username", "Player"),
        "email": u.get("email"),
        "picture": u.get("picture"),
        "coins": u.get("coins", 1000),
        "tickets": u.get("tickets", 5),
        "rank_points": u.get("rank_points", 0),
        "league": u.get("league", "Bronze"),
        "level": u.get("level", 1),
        "xp": u.get("xp", 0),
        "daily_streak": u.get("daily_streak", 0),
        "last_daily_claim": u.get("last_daily_claim"),
        "guest_mode": u.get("guest_mode", False),
        "gender": _sanitize_gender(u.get("gender")),
        "created_at": u.get("created_at"),
    }

async def _get_firebase_certs() -> Dict[str, str]:
    expires_at = _firebase_certs_cache.get("expires_at")
    if expires_at and isinstance(expires_at, datetime) and expires_at > _now():
        return _firebase_certs_cache.get("certs") or {}

    async with httpx.AsyncClient(timeout=10.0) as hc:
        try:
            r = await hc.get(FIREBASE_CERTS_URL)
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Firebase certs error: {e}")
    if r.status_code != 200:
        raise HTTPException(status_code=502, detail="Firebase certs unavailable")

    certs = r.json()
    _firebase_certs_cache["certs"] = certs
    _firebase_certs_cache["expires_at"] = _now() + timedelta(hours=1)
    return certs

async def _verify_firebase_id_token(id_token: str) -> Dict[str, Any]:
    try:
        import jwt
    except ImportError:
        raise HTTPException(status_code=500, detail="PyJWT dependency is required for Firebase Auth")

    try:
        header = jwt.get_unverified_header(id_token)
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid Firebase token")

    kid = header.get("kid")
    if header.get("alg") != "RS256" or not kid:
        raise HTTPException(status_code=401, detail="Invalid Firebase token")

    cert = (await _get_firebase_certs()).get(kid)
    if not cert:
        raise HTTPException(status_code=401, detail="Unknown Firebase token key")

    try:
        claims = jwt.decode(
            id_token,
            cert,
            algorithms=["RS256"],
            audience=FIREBASE_PROJECT_ID,
            issuer=FIREBASE_ISSUER,
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Firebase token expired")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid Firebase token")

    if not (claims.get("user_id") or claims.get("sub")):
        raise HTTPException(status_code=401, detail="Invalid Firebase token")
    return claims

async def get_current_user(
    request: Request,
    authorization: Optional[str] = Header(default=None),
    x_session_token: Optional[str] = Header(default=None),
):
    token = None
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
    if not token:
        token = x_session_token
    if not token:
        token = request.cookies.get("session_token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    sess = await db.sessions.find_one({"token": token})
    if not sess:
        raise HTTPException(status_code=401, detail="Invalid session")
        # expiry check
    expires_at = sess.get("expires_at")
    if expires_at and isinstance(expires_at, datetime):
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at < _now():
            raise HTTPException(status_code=401, detail="Session expired")
    user = await db.users.find_one({"_id": sess["user_id"]})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return await _ensure_user(user)

# ---------- Routes ----------
@api.get("/")
async def root():
    return {"app": "Card Rush Arena", "status": "ok"}

@api.post("/auth/session")
async def auth_session(response: Response, x_session_id: Optional[str] = Header(default=None)):
    """Exchange Emergent session_id for a session token + user."""
    if not x_session_id:
        raise HTTPException(status_code=400, detail="Missing X-Session-ID")
    async with httpx.AsyncClient(timeout=10.0) as hc:
        try:
            r = await hc.get(EMERGENT_AUTH_URL, headers={"X-Session-ID": x_session_id})
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Auth provider error: {e}")
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid session")
    data = r.json()
    email = data.get("email")
    name = data.get("name") or (email.split("@")[0] if email else "Player")
    picture = data.get("picture")
    gender = _sanitize_gender(data.get("gender"))
    session_token = data.get("session_token") or str(uuid.uuid4())

    user = await db.users.find_one({"email": email}) if email else None
    if not user:
        uid = str(uuid.uuid4())
        user = {
            "_id": uid,
            "username": name,
            "email": email,
            "picture": picture,
            "coins": 1000,
            "tickets": 5,
            "rank_points": 0,
            "league": "Bronze",
            "level": 1,
            "xp": 0,
            "daily_streak": 0,
            "last_daily_claim": None,
            "guest_mode": False,
            "gender": gender,
            "created_at": _now().isoformat(),
        }
        await db.users.insert_one(user)
    else:
        updates = {"picture": picture, "username": name, "guest_mode": False}
        if gender:
            updates["gender"] = gender
        await db.users.update_one({"_id": user["_id"]}, {"$set": updates})
        user["picture"] = picture
        user["username"] = name
        user["guest_mode"] = False
        if gender:
            user["gender"] = gender
    user = await _ensure_user(user)

    expires_at = _now() + timedelta(days=7)
    await db.sessions.update_one(
        {"token": session_token},
        {"$set": {"token": session_token, "user_id": user["_id"], "expires_at": expires_at, "created_at": _now()}},
        upsert=True,
    )

    # set cookie (best-effort; SameSite=None for cross-site)
    response.set_cookie(
        "session_token", session_token,
        max_age=7*24*3600, httponly=True, secure=True, samesite="none", path="/"
    )
    return {"session_token": session_token, "user": _user_to_public(user)}

@api.post("/auth/firebase")
async def auth_firebase(payload: FirebaseAuthIn, response: Response):
    claims = await _verify_firebase_id_token(payload.id_token)
    firebase_uid = claims.get("user_id") or claims.get("sub")
    email = claims.get("email")
    picture = claims.get("picture")
    gender = _sanitize_gender(payload.gender)
    requested_name = (payload.username or "").strip()[:24]
    default_name = claims.get("name") or (email.split("@")[0] if email else "Player")
    username = requested_name if len(requested_name) >= 2 else default_name

    user = await db.users.find_one({"firebase_uid": firebase_uid})
    if not user and email:
        user = await db.users.find_one({"email": email})

    if not user:
        uid = str(uuid.uuid4())
        user = {
            "_id": uid,
            "firebase_uid": firebase_uid,
            "username": username,
            "email": email,
            "picture": picture,
            "coins": 1000,
            "tickets": 5,
            "rank_points": 0,
            "league": "Bronze",
            "level": 1,
            "xp": 0,
            "daily_streak": 0,
            "last_daily_claim": None,
            "guest_mode": False,
            "gender": gender,
            "created_at": _now().isoformat(),
        }
        await db.users.insert_one(user)
    else:
        updates = {"firebase_uid": firebase_uid, "email": email, "guest_mode": False}
        if gender:
            updates["gender"] = gender
        if picture:
            updates["picture"] = picture
        if requested_name and requested_name != user.get("username"):
            updates["username"] = requested_name
        await db.users.update_one({"_id": user["_id"]}, {"$set": updates})
        user.update(updates)
    user = await _ensure_user(user)

    session_token = str(uuid.uuid4())
    expires_at = _now() + timedelta(days=30)
    await db.sessions.insert_one({
        "token": session_token,
        "user_id": user["_id"],
        "expires_at": expires_at,
        "created_at": _now(),
        "provider": "firebase",
    })

    response.set_cookie(
        "session_token", session_token,
        max_age=30*24*3600, httponly=True, secure=True, samesite="none", path="/"
    )
    return {"session_token": session_token, "user": _user_to_public(user)}

@api.post("/auth/guest")
async def auth_guest(payload: Dict[str, Any]):
    username = (payload or {}).get("username") or f"Guest{uuid.uuid4().hex[:6].upper()}"
    gender = _sanitize_gender((payload or {}).get("gender"))
    uid = str(uuid.uuid4())
    user = {
        "_id": uid,
        "username": username,
        "email": None,
        "picture": None,
        "coins": 1000,
        "tickets": 5,
        "rank_points": 0,
        "league": "Bronze",
        "level": 1,
        "xp": 0,
        "daily_streak": 0,
        "last_daily_claim": None,
        "guest_mode": True,
        "gender": gender,
        "created_at": _now().isoformat(),
    }
    await db.users.insert_one(user)
    token = str(uuid.uuid4())
    expires_at = _now() + timedelta(days=30)
    await db.sessions.insert_one({"token": token, "user_id": uid, "expires_at": expires_at, "created_at": _now()})
    return {"session_token": token, "user": _user_to_public(user)}

@api.get("/auth/me")
async def auth_me(user=Depends(get_current_user)):
    return _user_to_public(user)

@api.post("/auth/logout")
async def auth_logout(response: Response, user=Depends(get_current_user), authorization: Optional[str] = Header(default=None), x_session_token: Optional[str] = Header(default=None)):
    token = None
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
    if not token:
        token = x_session_token
    if token:
        await db.sessions.delete_one({"token": token})
    response.delete_cookie("session_token", path="/")
    return {"ok": True}

@api.post("/match/start")
async def match_start(user=Depends(get_current_user)):
    """Atomically deduct match entry cost from server-side balance.
    Prefer 1 ticket; fallback to 100 coins. Reject if both insufficient.
    This is the sole gate for starting a match — frontend MUST call this
    before opening the game screen.
    """
    today = _today_key()
    completed_today = await db.matches.count_documents({"user_id": user["_id"], "day": today})
    active_today = await db.matches_active.count_documents({"user_id": user["_id"], "day": today})
    matches_today = completed_today + active_today
    if matches_today >= MATCH_DAILY_LIMIT:
        raise HTTPException(
            status_code=429,
            detail={
                "code": "DAILY_MATCH_LIMIT_REACHED",
                "message": f"Daily match limit reached ({MATCH_DAILY_LIMIT}). Come back tomorrow.",
                "matches_today": matches_today,
                "daily_limit": MATCH_DAILY_LIMIT,
            },
        )

    tickets = int(user.get("tickets", 0))
    coins = int(user.get("coins", 0))

    used = None
    if tickets >= MATCH_ENTRY_TICKET_COST:
        # Atomic conditional decrement
        res = await db.users.update_one(
            {"_id": user["_id"], "tickets": {"$gte": MATCH_ENTRY_TICKET_COST}},
            {"$inc": {"tickets": -MATCH_ENTRY_TICKET_COST}},
        )
        if res.modified_count == 1:
            used = "ticket"
            user["tickets"] = tickets - MATCH_ENTRY_TICKET_COST

    if used is None:
        if coins >= MATCH_ENTRY_COIN_COST:
            res = await db.users.update_one(
                {"_id": user["_id"], "coins": {"$gte": MATCH_ENTRY_COIN_COST}},
                {"$inc": {"coins": -MATCH_ENTRY_COIN_COST}},
            )
            if res.modified_count == 1:
                used = "coins"
                user["coins"] = coins - MATCH_ENTRY_COIN_COST

    if used is None:
        # 402 Payment Required — best HTTP semantic for "insufficient balance"
        raise HTTPException(
            status_code=402,
            detail={
                "code": "INSUFFICIENT_BALANCE",
                "message": "Not enough tickets or coins to start a match.",
                "required_tickets": MATCH_ENTRY_TICKET_COST,
                "required_coins": MATCH_ENTRY_COIN_COST,
                "current_tickets": tickets,
                "current_coins": coins,
            },
        )

    match_id = str(uuid.uuid4())
    await db.matches_active.insert_one({
        "_id": match_id,
        "user_id": user["_id"],
        "day": today,
        "started_at": _now().isoformat(),
        "entry_paid_with": used,
        "entry_ticket_cost": MATCH_ENTRY_TICKET_COST if used == "ticket" else 0,
        "entry_coin_cost": MATCH_ENTRY_COIN_COST if used == "coins" else 0,
    })

    return {
        "match_id": match_id,
        "paid_with": used,
        "matches_today": matches_today + 1,
        "daily_match_limit": MATCH_DAILY_LIMIT,
        "user": _user_to_public(user),
    }


def _today_key() -> str:
    return _now().date().isoformat()


@api.get("/ads/progress")
async def ads_progress(user=Depends(get_current_user)):
    """Return ad progress toward the next 100-coin virtual reward."""
    today = _today_key()
    doc = await db.ad_progress.find_one({"user_id": user["_id"], "day": today})
    watched = int(doc["count"]) if doc else 0
    next_reward_in = AD_PAIR_SIZE - (watched % AD_PAIR_SIZE)
    return {
        "watched_today": watched,
        "daily_cap": None,
        "pair_size": AD_PAIR_SIZE,
        "reward_per_pair": AD_REWARD_PER_PAIR_COINS,
        "next_reward_in": next_reward_in,
        "daily_cap_reached": False,
        "coins_earned_today": (watched // AD_PAIR_SIZE) * AD_REWARD_PER_PAIR_COINS,
        "max_coins_today": None,
    }


@api.post("/ads/watch")
async def ads_watch(user=Depends(get_current_user)):
    """Record one ad watch. Every pair (2 ads) grants AD_REWARD_PER_PAIR_COINS.
    Anti-spam: ad watches must be at least AD_WATCH_MIN_INTERVAL_SECONDS apart.
    """
    today = _today_key()
    now = _now()
    doc = await db.ad_progress.find_one({"user_id": user["_id"], "day": today})

    if doc:
        # Anti-spam interval check
        last_at = doc.get("last_at")
        if isinstance(last_at, datetime):
            if last_at.tzinfo is None:
                last_at = last_at.replace(tzinfo=timezone.utc)
            elapsed = (now - last_at).total_seconds()
            if elapsed < AD_WATCH_MIN_INTERVAL_SECONDS:
                wait_seconds = max(1, int(AD_WATCH_MIN_INTERVAL_SECONDS - elapsed))
                raise HTTPException(
                    status_code=429,
                    detail={
                        "code": "AD_WATCH_TOO_FAST",
                        "message": f"Please wait {wait_seconds}s before claiming another ad reward.",
                        "wait_seconds": wait_seconds,
                    },
                )
        watched = int(doc.get("count", 0))
    else:
        watched = 0

    new_watched = watched + 1
    granted_coins = 0
    # Grant on every 2nd completed mock ad.
    if new_watched % AD_PAIR_SIZE == 0:
        granted_coins = AD_REWARD_PER_PAIR_COINS
        await db.users.update_one(
            {"_id": user["_id"]},
            {"$inc": {"coins": granted_coins}},
        )
        user["coins"] = int(user.get("coins", 0)) + granted_coins

    await db.ad_progress.update_one(
        {"user_id": user["_id"], "day": today},
        {"$set": {"count": new_watched, "last_at": now},
         "$setOnInsert": {"user_id": user["_id"], "day": today}},
        upsert=True,
    )

    next_reward_in = AD_PAIR_SIZE - (new_watched % AD_PAIR_SIZE)
    return {
        "watched_today": new_watched,
        "daily_cap": None,
        "pair_size": AD_PAIR_SIZE,
        "reward_per_pair": AD_REWARD_PER_PAIR_COINS,
        "granted_coins": granted_coins,
        "next_reward_in": next_reward_in,
        "daily_cap_reached": False,
        "coins_earned_today": (new_watched // AD_PAIR_SIZE) * AD_REWARD_PER_PAIR_COINS,
        "max_coins_today": None,
        "user": _user_to_public(user),
    }


@api.post("/match/result")
async def match_result(payload: MatchResultIn, user=Depends(get_current_user)):
    active_match = await db.matches_active.find_one_and_delete({
        "_id": payload.match_id,
        "user_id": user["_id"],
    })
    if not active_match:
        raise HTTPException(status_code=400, detail="Match was not started or was already completed")

    coins = max(0, int(payload.coins_earned))
    rp_delta = int(payload.rank_points_delta)
    xp = max(0, int(payload.xp_earned))
    new_coins = int(user.get("coins", 0)) + coins
    new_rp = max(0, int(user.get("rank_points", 0)) + rp_delta)
    new_xp = int(user.get("xp", 0)) + xp
    new_level = int(user.get("level", 1))
    while new_xp >= new_level * 100:
        new_xp -= new_level * 100
        new_level += 1
    league = _league_for_rp(new_rp)
    matches_played = int(user.get("matches_played", 0)) + 1
    matches_won = int(user.get("matches_won", 0)) + (1 if payload.won else 0)
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {
            "coins": new_coins, "rank_points": new_rp, "xp": new_xp, "level": new_level,
            "league": league, "matches_played": matches_played, "matches_won": matches_won,
            "last_match_at": _now().isoformat(),
        }}
    )
    await db.matches.insert_one({
        "_id": str(uuid.uuid4()), "match_id": payload.match_id,
        "user_id": user["_id"], "day": active_match.get("day") or _today_key(), "won": payload.won,
        "entry_paid_with": active_match.get("entry_paid_with"),
        "cards_left": payload.cards_left, "duration_seconds": payload.duration_seconds,
        "coins_earned": coins, "rank_points_delta": rp_delta, "xp_earned": xp,
        "at": _now().isoformat(),
    })
    user["coins"] = new_coins; user["rank_points"] = new_rp; user["xp"] = new_xp
    user["level"] = new_level; user["league"] = league
    return {"user": _user_to_public(user)}

@api.get("/leaderboard")
async def leaderboard(user=Depends(get_current_user)):
    cursor = db.users.find({}, {"username":1, "rank_points":1, "league":1, "picture":1, "level":1, "gender":1}).sort("rank_points", -1).limit(50)
    rows = []
    rank = 1
    async for u in cursor:
        rows.append({
            "rank": rank, "id": u["_id"], "username": u.get("username","Player"),
            "rank_points": u.get("rank_points",0), "league": u.get("league","Bronze"),
            "picture": u.get("picture"), "level": u.get("level",1), "gender": _sanitize_gender(u.get("gender")),
            "is_me": u["_id"] == user["_id"],
        })
        rank += 1
    return {"entries": rows}

@api.get("/daily/status")
async def daily_status(user=Depends(get_current_user)):
    last = user.get("last_daily_claim")
    can_claim = True
    next_in_seconds = 0
    if last:
        try:
            last_dt = datetime.fromisoformat(last)
        except Exception:
            last_dt = None
        if last_dt:
            elapsed = (_now() - last_dt.replace(tzinfo=timezone.utc) if last_dt.tzinfo is None else _now() - last_dt).total_seconds()
            if elapsed < 24*3600:
                can_claim = False
                next_in_seconds = int(24*3600 - elapsed)
    streak = int(user.get("daily_streak", 0))
    rewards = [50, 75, 100, 150, 200, 300, 500]
    today_reward = rewards[min(streak, len(rewards)-1)]
    return {"can_claim": can_claim, "next_in_seconds": next_in_seconds, "streak": streak, "today_reward": today_reward, "schedule": rewards}

@api.post("/daily/claim")
async def daily_claim(user=Depends(get_current_user)):
    now = _now()
    last = user.get("last_daily_claim")
    claim_filter_extra = []
    if last:
        try:
            last_dt = last if isinstance(last, datetime) else datetime.fromisoformat(last)
            if last_dt.tzinfo is None:
                last_dt = last_dt.replace(tzinfo=timezone.utc)
            if (now - last_dt).total_seconds() < 24*3600:
                raise HTTPException(status_code=400, detail="Already claimed today")
            streak_reset = (now - last_dt).total_seconds() > 48*3600
        except HTTPException:
            raise
        except Exception:
            claim_filter_extra.append({"last_daily_claim": last})
            streak_reset = False
    else:
        streak_reset = False
    streak = 0 if streak_reset else int(user.get("daily_streak", 0))
    rewards = [50, 75, 100, 150, 200, 300, 500]
    reward = rewards[min(streak, len(rewards)-1)]
    new_streak = min(streak + 1, len(rewards))
    cutoff_dt = now - timedelta(hours=24)
    cutoff = cutoff_dt.isoformat()
    updated_user = await db.users.find_one_and_update(
        {
            "_id": user["_id"],
            "$or": [
                {"last_daily_claim": None},
                {"last_daily_claim": {"$exists": False}},
                {"last_daily_claim": {"$lte": cutoff}},
                {"last_daily_claim": {"$lte": cutoff_dt}},
            ] + claim_filter_extra,
        },
        {
            "$inc": {"coins": reward},
            "$set": {
                "daily_streak": new_streak,
                "last_daily_claim": now.isoformat(),
            },
        },
        return_document=ReturnDocument.AFTER,
    )
    if not updated_user:
        raise HTTPException(status_code=400, detail="Already claimed today")
    return {"reward": reward, "streak": new_streak, "user": _user_to_public(updated_user)}

MISSIONS = [
    {"id": "win_1", "title": "Win 1 match", "goal": 1, "metric": "wins_today", "reward_coins": 100},
    {"id": "win_3", "title": "Win 3 matches", "goal": 3, "metric": "wins_today", "reward_coins": 250},
    {"id": "play_5", "title": "Play 5 matches", "goal": 5, "metric": "plays_today", "reward_coins": 150},
    {"id": "action_10", "title": "Play 10 action cards", "goal": 10, "metric": "actions_today", "reward_coins": 200},
]

@api.get("/missions")
async def missions(user=Depends(get_current_user)):
    # Pull metrics from today's matches
    today = _now().date().isoformat()
    plays_today = await db.matches.count_documents({"user_id": user["_id"], "at": {"$gte": today}})
    wins_today = await db.matches.count_documents({"user_id": user["_id"], "at": {"$gte": today}, "won": True})
    actions_today = int(user.get("actions_today_count", 0))
    claims = await db.mission_claims.find({"user_id": user["_id"], "day": today}).to_list(length=100)
    claimed_ids = {c["mission_id"] for c in claims}
    metrics = {"wins_today": wins_today, "plays_today": plays_today, "actions_today": actions_today}
    out = []
    for m in MISSIONS:
        progress = min(m["goal"], metrics.get(m["metric"], 0))
        out.append({**m, "progress": progress, "completed": progress >= m["goal"], "claimed": m["id"] in claimed_ids})
    return {"missions": out, "metrics": metrics}

@api.post("/missions/claim")
async def missions_claim(payload: MissionClaimIn, user=Depends(get_current_user)):
    today = _now().date().isoformat()
    mission = next((m for m in MISSIONS if m["id"] == payload.mission_id), None)
    if not mission:
        raise HTTPException(status_code=404, detail="Mission not found")
    # validate progress
    plays_today = await db.matches.count_documents({"user_id": user["_id"], "at": {"$gte": today}})
    wins_today = await db.matches.count_documents({"user_id": user["_id"], "at": {"$gte": today}, "won": True})
    metric_val = {"wins_today": wins_today, "plays_today": plays_today, "actions_today": int(user.get("actions_today_count",0))}.get(mission["metric"], 0)
    if metric_val < mission["goal"]:
        raise HTTPException(status_code=400, detail="Mission not complete")

    try:
        existing = await db.mission_claims.find_one_and_update(
            {"user_id": user["_id"], "day": today, "mission_id": payload.mission_id},
            {"$setOnInsert": {
                "user_id": user["_id"],
                "day": today,
                "mission_id": payload.mission_id,
                "at": _now().isoformat(),
            }},
            upsert=True,
            return_document=ReturnDocument.BEFORE,
        )
    except DuplicateKeyError:
        raise HTTPException(status_code=400, detail="Already claimed")
    if existing:
        raise HTTPException(status_code=400, detail="Already claimed")

    reward = int(mission["reward_coins"])
    updated_user = await db.users.find_one_and_update(
        {"_id": user["_id"]},
        {"$inc": {"coins": reward}},
        return_document=ReturnDocument.AFTER,
    )
    if not updated_user:
        raise HTTPException(status_code=401, detail="User not found")
    return {"reward": reward, "user": _user_to_public(updated_user)}

# Coin-bundle and ticket-pack endpoints have been permanently removed.
# Coins are earned via gameplay rewards, daily reward, and mock ad pairs.

@api.patch("/profile")
async def update_profile(payload: Dict[str, Any], user=Depends(get_current_user)):
    updates = {}
    if "username" in payload and isinstance(payload["username"], str):
        uname = payload["username"].strip()[:24]
        if len(uname) >= 2:
            updates["username"] = uname
    if "gender" in payload:
        gender = _sanitize_gender(payload.get("gender"))
        if gender:
            updates["gender"] = gender
    if updates:
        await db.users.update_one({"_id": user["_id"]}, {"$set": updates})
        user.update(updates)
    return _user_to_public(user)

# Seed leaderboard profile entries (once)
async def seed_leaderboard_profiles():
    count = await db.users.count_documents({"seeded_profile": True})
    if count >= 12:
        return
    seeded_profiles = [
        ("Lena Storm", "female", 4200, "Diamond"), ("Mila Nova", "female", 3800, "Platinum"),
        ("Sofija Ace", "female", 3300, "Platinum"), ("Nikola King", "male", 2900, "Platinum"),
        ("Marko Wave", "male", 2300, "Gold"), ("Ana Spark", "female", 1900, "Gold"),
        ("Luka Prime", "male", 1700, "Gold"), ("Tara Leaf", "female", 1300, "Silver"),
        ("Stefan Bolt", "male", 1100, "Silver"), ("Dunja Star", "female", 900, "Silver"),
        ("Viktor Rush", "male", 500, "Bronze"), ("Sara Shine", "female", 200, "Bronze"),
    ]
    for name, gender, rp, lg in seeded_profiles:
        if await db.users.find_one({"username": name}):
            continue
        await db.users.insert_one({
            "_id": str(uuid.uuid4()), "username": name, "email": None,
            "coins": 1000, "tickets": 5, "rank_points": rp, "league": lg,
            "level": max(1, rp // 250), "xp": 0, "gender": gender,
            "seeded_profile": True,
            "created_at": _now().isoformat()
        })

async def ensure_indexes():
    await db.users.create_index([("firebase_uid", 1)], sparse=True)
    await db.users.create_index([("email", 1)], sparse=True)
    await db.ad_progress.create_index([("user_id", 1), ("day", 1)], unique=True)
    await db.mission_claims.create_index([("user_id", 1), ("day", 1), ("mission_id", 1)], unique=True)
    await db.matches_active.create_index([("user_id", 1), ("started_at", 1)])
    await db.matches_active.create_index([("user_id", 1), ("day", 1)])
    await db.matches.create_index([("user_id", 1), ("day", 1)])

@app.on_event("startup")
async def on_startup():
    # Clean up legacy unique indexes from prior schemas (e.g., user_id_1)
    try:
        idx = await db.users.index_information()
        for name in list(idx.keys()):
            if name == "_id_":
                continue
            try:
                await db.users.drop_index(name)
            except Exception:
                pass
    except Exception:
        pass
    await ensure_indexes()
    await seed_leaderboard_profiles()

app.include_router(api)
