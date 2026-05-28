from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta, timezone
import os
import uuid
import httpx
from dotenv import load_dotenv

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
    created_at: Optional[str] = None

class MatchResultIn(BaseModel):
    won: bool
    cards_left: int = 0
    duration_seconds: int = 0
    coins_earned: int = 0
    rank_points_delta: int = 0
    xp_earned: int = 0

class PurchaseIn(BaseModel):
    item_id: str

class MissionClaimIn(BaseModel):
    mission_id: str

# Economy constants — server is source of truth
MATCH_ENTRY_COIN_COST = 100
MATCH_ENTRY_TICKET_COST = 1
AD_REWARD_PER_PAIR_COINS = 100   # every 2 ads watched
AD_DAILY_MAX_WATCHES = 6          # max 6 ads/day => 300 coins/day max
AD_WATCH_MIN_INTERVAL_SECONDS = 3 # anti-spam between watches

# ---------- Helpers ----------
def _now():
    return datetime.now(timezone.utc)

def _league_for_rp(rp: int) -> str:
    if rp >= 4000: return "Diamond"
    if rp >= 2500: return "Platinum"
    if rp >= 1500: return "Gold"
    if rp >= 700: return "Silver"
    return "Bronze"

async def _ensure_user(user_doc: Dict[str, Any]) -> Dict[str, Any]:
    # default fields
    defaults = {
        "coins": 1000, "tickets": 5, "rank_points": 0, "league": "Bronze",
        "level": 1, "xp": 0, "daily_streak": 0, "last_daily_claim": None,
        "guest_mode": False,
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
        "created_at": u.get("created_at"),
    }

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
            "created_at": _now().isoformat(),
        }
        await db.users.insert_one(user)
    else:
        await db.users.update_one({"_id": user["_id"]}, {"$set": {"picture": picture, "username": name, "guest_mode": False}})
        user["picture"] = picture
        user["username"] = name
        user["guest_mode"] = False
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

@api.post("/auth/guest")
async def auth_guest(payload: Dict[str, Any]):
    username = (payload or {}).get("username") or f"Guest{uuid.uuid4().hex[:6].upper()}"
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
        "started_at": _now().isoformat(),
        "entry_paid_with": used,
        "entry_ticket_cost": MATCH_ENTRY_TICKET_COST if used == "ticket" else 0,
        "entry_coin_cost": MATCH_ENTRY_COIN_COST if used == "coins" else 0,
    })

    return {
        "match_id": match_id,
        "paid_with": used,
        "user": _user_to_public(user),
    }


def _today_key() -> str:
    return _now().date().isoformat()


@api.get("/ads/progress")
async def ads_progress(user=Depends(get_current_user)):
    """Return how many ads watched today + progress toward next 100-coin reward."""
    today = _today_key()
    doc = await db.ad_progress.find_one({"user_id": user["_id"], "day": today})
    watched = int(doc["count"]) if doc else 0
    daily_cap_reached = watched >= AD_DAILY_MAX_WATCHES
    next_reward_in = max(0, 2 - (watched % 2)) if not daily_cap_reached else 0
    return {
        "watched_today": watched,
        "daily_cap": AD_DAILY_MAX_WATCHES,
        "pair_size": 2,
        "reward_per_pair": AD_REWARD_PER_PAIR_COINS,
        "next_reward_in": next_reward_in,
        "daily_cap_reached": daily_cap_reached,
        "coins_earned_today": (watched // 2) * AD_REWARD_PER_PAIR_COINS,
        "max_coins_today": (AD_DAILY_MAX_WATCHES // 2) * AD_REWARD_PER_PAIR_COINS,
    }


@api.post("/ads/watch")
async def ads_watch(user=Depends(get_current_user)):
    """Record one ad watch. Every pair (2 ads) grants AD_REWARD_PER_PAIR_COINS.
    Daily cap: AD_DAILY_MAX_WATCHES. All validation is server-side.
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
            if (now - last_at).total_seconds() < AD_WATCH_MIN_INTERVAL_SECONDS:
                raise HTTPException(status_code=429, detail="Watch too fast — wait a moment.")
        watched = int(doc.get("count", 0))
    else:
        watched = 0

    if watched >= AD_DAILY_MAX_WATCHES:
        raise HTTPException(
            status_code=429,
            detail={"code": "DAILY_AD_CAP_REACHED",
                    "message": f"Daily ad limit reached ({AD_DAILY_MAX_WATCHES}). Come back tomorrow."},
        )

    new_watched = watched + 1
    granted_coins = 0
    # Grant on every 2nd watch
    if new_watched % 2 == 0:
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

    next_reward_in = max(0, 2 - (new_watched % 2)) if new_watched < AD_DAILY_MAX_WATCHES else 0
    return {
        "watched_today": new_watched,
        "daily_cap": AD_DAILY_MAX_WATCHES,
        "granted_coins": granted_coins,
        "next_reward_in": next_reward_in,
        "daily_cap_reached": new_watched >= AD_DAILY_MAX_WATCHES,
        "user": _user_to_public(user),
    }


@api.post("/match/result")
async def match_result(payload: MatchResultIn, user=Depends(get_current_user)):
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
        "_id": str(uuid.uuid4()), "user_id": user["_id"], "won": payload.won,
        "cards_left": payload.cards_left, "duration_seconds": payload.duration_seconds,
        "coins_earned": coins, "rank_points_delta": rp_delta, "xp_earned": xp,
        "at": _now().isoformat(),
    })
    user["coins"] = new_coins; user["rank_points"] = new_rp; user["xp"] = new_xp
    user["level"] = new_level; user["league"] = league
    return {"user": _user_to_public(user)}

@api.get("/leaderboard")
async def leaderboard(user=Depends(get_current_user)):
    cursor = db.users.find({}, {"username":1, "rank_points":1, "league":1, "picture":1, "level":1}).sort("rank_points", -1).limit(50)
    rows = []
    rank = 1
    async for u in cursor:
        rows.append({
            "rank": rank, "id": u["_id"], "username": u.get("username","Player"),
            "rank_points": u.get("rank_points",0), "league": u.get("league","Bronze"),
            "picture": u.get("picture"), "level": u.get("level",1),
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
    last = user.get("last_daily_claim")
    if last:
        try:
            last_dt = datetime.fromisoformat(last)
            if last_dt.tzinfo is None:
                last_dt = last_dt.replace(tzinfo=timezone.utc)
            if (_now() - last_dt).total_seconds() < 24*3600:
                raise HTTPException(status_code=400, detail="Already claimed today")
            streak_reset = (_now() - last_dt).total_seconds() > 48*3600
        except HTTPException:
            raise
        except Exception:
            streak_reset = False
    else:
        streak_reset = False
    streak = 0 if streak_reset else int(user.get("daily_streak", 0))
    rewards = [50, 75, 100, 150, 200, 300, 500]
    reward = rewards[min(streak, len(rewards)-1)]
    new_streak = (streak + 1) % (len(rewards) + 1) or 1
    new_coins = int(user.get("coins", 0)) + reward
    await db.users.update_one({"_id": user["_id"]}, {"$set": {
        "coins": new_coins, "daily_streak": new_streak, "last_daily_claim": _now().isoformat()
    }})
    user["coins"] = new_coins; user["daily_streak"] = new_streak
    return {"reward": reward, "streak": new_streak, "user": _user_to_public(user)}

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
    existing = await db.mission_claims.find_one({"user_id": user["_id"], "day": today, "mission_id": payload.mission_id})
    if existing:
        raise HTTPException(status_code=400, detail="Already claimed")
    # validate progress
    plays_today = await db.matches.count_documents({"user_id": user["_id"], "at": {"$gte": today}})
    wins_today = await db.matches.count_documents({"user_id": user["_id"], "at": {"$gte": today}, "won": True})
    metric_val = {"wins_today": wins_today, "plays_today": plays_today, "actions_today": int(user.get("actions_today_count",0))}.get(mission["metric"], 0)
    if metric_val < mission["goal"]:
        raise HTTPException(status_code=400, detail="Mission not complete")
    new_coins = int(user.get("coins",0)) + int(mission["reward_coins"])
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"coins": new_coins}})
    await db.mission_claims.insert_one({"user_id": user["_id"], "day": today, "mission_id": payload.mission_id, "at": _now().isoformat()})
    user["coins"] = new_coins
    return {"reward": mission["reward_coins"], "user": _user_to_public(user)}

SHOP_ITEMS = [
    {"id": "coins_small", "title": "Pouch of Coins", "coins": 500, "cost_tickets": 1},
    {"id": "coins_mid", "title": "Chest of Coins", "coins": 1500, "cost_tickets": 3},
    {"id": "coins_big", "title": "Vault of Coins", "coins": 4000, "cost_tickets": 5},
    {"id": "tickets_pack", "title": "Ticket Bundle", "tickets": 3, "cost_coins": 1500},
]

@api.get("/shop/items")
async def shop_items(user=Depends(get_current_user)):
    return {"items": SHOP_ITEMS}

@api.post("/shop/purchase")
async def shop_purchase(payload: PurchaseIn, user=Depends(get_current_user)):
    item = next((i for i in SHOP_ITEMS if i["id"] == payload.item_id), None)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    coins = int(user.get("coins",0)); tickets = int(user.get("tickets",0))
    if "cost_tickets" in item:
        if tickets < item["cost_tickets"]:
            raise HTTPException(status_code=400, detail="Not enough tickets")
        tickets -= item["cost_tickets"]
        coins += item.get("coins",0)
    if "cost_coins" in item:
        if coins < item["cost_coins"]:
            raise HTTPException(status_code=400, detail="Not enough coins")
        coins -= item["cost_coins"]
        tickets += item.get("tickets",0)
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"coins": coins, "tickets": tickets}})
    user["coins"] = coins; user["tickets"] = tickets
    return {"user": _user_to_public(user)}

@api.post("/ads/reward")
async def ads_reward(user=Depends(get_current_user)):
    reward = 50
    new_coins = int(user.get("coins",0)) + reward
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"coins": new_coins}})
    user["coins"] = new_coins
    return {"reward_coins": reward, "user": _user_to_public(user)}

@api.patch("/profile")
async def update_profile(payload: Dict[str, Any], user=Depends(get_current_user)):
    updates = {}
    if "username" in payload and isinstance(payload["username"], str):
        uname = payload["username"].strip()[:24]
        if len(uname) >= 2:
            updates["username"] = uname
    if updates:
        await db.users.update_one({"_id": user["_id"]}, {"$set": updates})
        user.update(updates)
    return _user_to_public(user)

# Seed bot leaderboard entries (once)
async def seed_bots():
    count = await db.users.count_documents({"bot": True})
    if count >= 12:
        return
    bot_names = [
        ("AceFlame", 4200, "Diamond"), ("WaveLord", 3800, "Platinum"), ("LeafSage", 3300, "Platinum"),
        ("BoltKing", 2900, "Platinum"), ("NovaCat", 2300, "Gold"), ("PixelPaw", 1900, "Gold"),
        ("ShadeLynx", 1700, "Gold"), ("EmberFox", 1300, "Silver"), ("MossElk", 1100, "Silver"),
        ("GaleHawk", 900, "Silver"), ("SparkOtter", 500, "Bronze"), ("DewMouse", 200, "Bronze"),
    ]
    for name, rp, lg in bot_names:
        if await db.users.find_one({"username": name}):
            continue
        await db.users.insert_one({
            "_id": str(uuid.uuid4()), "username": name, "email": None,
            "coins": 1000, "tickets": 5, "rank_points": rp, "league": lg,
            "level": max(1, rp // 250), "xp": 0, "bot": True,
            "created_at": _now().isoformat()
        })

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
    await seed_bots()

app.include_router(api)
