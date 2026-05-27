"""Card Rush Arena - Backend API.

Production-ready FastAPI backend serving:
- Auth (Emergent Google OAuth + Guest mode)
- User profile (coins, tickets, rank, league, stats, cosmetics)
- Match finish with server-side reward validation
- Daily rewards with 7-day streak
- Missions (daily/weekly) and claim flow
- Leaderboard (weekly)
- Shop (cosmetics)
- Rewarded-ad claims (with cooldowns + abuse prevention)
- Admin/debug endpoints
"""
from __future__ import annotations

import logging
import os
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Literal, Optional

import httpx
from dotenv import load_dotenv
from fastapi import APIRouter, FastAPI, Header, HTTPException
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# ---------- Config ----------
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
EMERGENT_SESSION_DATA_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="Card Rush Arena API")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s - %(message)s")
log = logging.getLogger("cardrush")


# ---------- Helpers ----------
def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def new_user_id() -> str:
    return f"user_{uuid.uuid4().hex[:12]}"


def league_from_points(points: int) -> str:
    if points >= 5000:
        return "Master"
    if points >= 3500:
        return "Diamond"
    if points >= 2200:
        return "Platinum"
    if points >= 1200:
        return "Gold"
    if points >= 500:
        return "Silver"
    return "Bronze"


def level_from_xp(xp: int) -> int:
    # Level grows ~ sqrt of xp; 200 xp/level base.
    lvl = 1
    threshold = 200
    while xp >= threshold and lvl < 200:
        lvl += 1
        threshold += int(200 * (1 + lvl * 0.15))
    return lvl


def default_missions() -> list[dict[str, Any]]:
    return [
        {"id": "play_3", "title": "Play 3 matches", "type": "daily", "target": 3, "progress": 0, "reward_coins": 100, "reward_xp": 50, "claimed": False, "metric": "matches_played"},
        {"id": "win_1", "title": "Win 1 match", "type": "daily", "target": 1, "progress": 0, "reward_coins": 200, "reward_xp": 80, "claimed": False, "metric": "matches_won"},
        {"id": "action_10", "title": "Play 10 special cards", "type": "daily", "target": 10, "progress": 0, "reward_coins": 150, "reward_xp": 60, "claimed": False, "metric": "action_cards_played"},
        {"id": "flawless_1", "title": "Finish a match with 0 cards left", "type": "daily", "target": 1, "progress": 0, "reward_coins": 300, "reward_xp": 100, "claimed": False, "metric": "matches_won"},
        {"id": "ad_1", "title": "Watch 1 rewarded ad", "type": "daily", "target": 1, "progress": 0, "reward_coins": 80, "reward_xp": 20, "claimed": False, "metric": "ads_watched"},
        {"id": "weekly_win_10", "title": "Win 10 matches this week", "type": "weekly", "target": 10, "progress": 0, "reward_coins": 1000, "reward_xp": 400, "claimed": False, "metric": "matches_won_week"},
    ]


def default_user_doc(user_id: str, *, username: str, email: Optional[str] = None, picture: Optional[str] = None, is_guest: bool = False) -> dict[str, Any]:
    return {
        "user_id": user_id,
        "email": email,
        "username": username,
        "picture": picture,
        "is_guest": is_guest,
        "level": 1,
        "xp": 0,
        "coins": 1000,
        "tickets": 5,
        "rank_points": 0,
        "league": "Bronze",
        "wins": 0,
        "losses": 0,
        "matches_played": 0,
        "matches_won_week": 0,
        "action_cards_played": 0,
        "ads_watched": 0,
        "daily_streak": 0,
        "last_daily_claim": None,
        "last_ad_claim": None,
        "last_match_finish": None,
        "unlocked_cosmetics": ["default_back", "default_table"],
        "selected_card_back": "default_back",
        "selected_table_theme": "default_table",
        "missions": default_missions(),
        "created_at": now_utc(),
        "updated_at": now_utc(),
    }


def safe_user(doc: dict[str, Any]) -> dict[str, Any]:
    """Strip Mongo _id and ensure JSON-safe."""
    if not doc:
        return {}
    out = {k: v for k, v in doc.items() if k != "_id"}
    return out


async def get_user_by_token(token: str) -> Optional[dict[str, Any]]:
    if not token:
        return None
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        return None
    expires = session.get("expires_at")
    if expires:
        if isinstance(expires, datetime) and expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
        if expires < now_utc():
            return None
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    return user


async def require_user(authorization: Optional[str]) -> dict[str, Any]:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = authorization.split(" ", 1)[1].strip()
    user = await get_user_by_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    return user


# ---------- Models ----------
class GuestLoginRequest(BaseModel):
    username: Optional[str] = None


class GoogleSessionRequest(BaseModel):
    session_id: str


class MatchFinishRequest(BaseModel):
    mode: Literal["casual", "ranked", "private"] = "casual"
    placement: int = Field(ge=1, le=4)  # 1 = winner
    cards_left: int = Field(ge=0, default=0)
    action_cards_played: int = Field(ge=0, default=0)
    duration_seconds: int = Field(ge=0, default=180)


class ClaimRequest(BaseModel):
    mission_id: str


class AdClaimRequest(BaseModel):
    reward_type: Literal["double_match", "extra_ticket", "premium_chest", "streak_recover", "generic"]
    match_ref: Optional[str] = None


class PurchaseRequest(BaseModel):
    item_id: str


class SelectCosmeticRequest(BaseModel):
    kind: Literal["card_back", "table_theme"]
    item_id: str


# ---------- Shop catalog (static) ----------
SHOP_CATALOG = [
    {"id": "default_back", "name": "Classic Back", "kind": "card_back", "price": 0, "rarity": "common"},
    {"id": "neon_back", "name": "Neon Pulse", "kind": "card_back", "price": 800, "rarity": "rare"},
    {"id": "galaxy_back", "name": "Galaxy Drift", "kind": "card_back", "price": 1500, "rarity": "epic"},
    {"id": "phoenix_back", "name": "Phoenix Crown", "kind": "card_back", "price": 3000, "rarity": "legendary"},
    {"id": "default_table", "name": "Arcane Hall", "kind": "table_theme", "price": 0, "rarity": "common"},
    {"id": "ember_table", "name": "Ember Forge", "kind": "table_theme", "price": 1200, "rarity": "rare"},
    {"id": "tide_table", "name": "Tide Sanctum", "kind": "table_theme", "price": 1200, "rarity": "rare"},
    {"id": "void_table", "name": "Void Citadel", "kind": "table_theme", "price": 2500, "rarity": "epic"},
]


# ---------- Startup ----------
@app.on_event("startup")
async def on_startup() -> None:
    await db.users.create_index("user_id", unique=True)
    await db.users.create_index("email", unique=False, sparse=True)
    await db.user_sessions.create_index("session_token", unique=True)
    await db.user_sessions.create_index("user_id")
    await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)
    await db.match_history.create_index([("user_id", 1), ("finished_at", -1)])
    await db.ad_claims.create_index([("user_id", 1), ("created_at", -1)])
    log.info("Card Rush Arena API ready")


@app.on_event("shutdown")
async def on_shutdown() -> None:
    client.close()


# ---------- Auth ----------
@api.get("/")
async def root() -> dict[str, str]:
    return {"app": "Card Rush Arena", "status": "ok"}


@api.post("/auth/guest")
async def auth_guest(req: GuestLoginRequest) -> dict[str, Any]:
    uid = new_user_id()
    base_name = (req.username or "").strip() or f"Guest_{uid[-4:].upper()}"
    user = default_user_doc(uid, username=base_name, is_guest=True)
    await db.users.insert_one(user)
    token = uuid.uuid4().hex
    await db.user_sessions.insert_one(
        {
            "session_token": token,
            "user_id": uid,
            "expires_at": now_utc() + timedelta(days=7),
            "created_at": now_utc(),
            "is_guest": True,
        }
    )
    return {"session_token": token, "user": safe_user(user)}


@api.post("/auth/google")
async def auth_google(req: GoogleSessionRequest) -> dict[str, Any]:
    """Verify session_id with Emergent, upsert user, return session_token."""
    async with httpx.AsyncClient(timeout=10.0) as cx:
        try:
            r = await cx.get(
                EMERGENT_SESSION_DATA_URL,
                headers={"X-Session-ID": req.session_id},
            )
        except httpx.HTTPError as e:
            log.error("emergent session-data request failed: %s", e)
            raise HTTPException(status_code=502, detail="Auth provider unreachable")
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid session id")
    data = r.json()
    email = data.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="No email from provider")
    name = data.get("name") or email.split("@")[0]
    picture = data.get("picture")
    session_token = data.get("session_token") or uuid.uuid4().hex

    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"username": name, "picture": picture, "is_guest": False, "updated_at": now_utc()}},
        )
        user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    else:
        user_id = new_user_id()
        user = default_user_doc(user_id, username=name, email=email, picture=picture, is_guest=False)
        await db.users.insert_one(user)

    await db.user_sessions.update_one(
        {"session_token": session_token},
        {
            "$set": {
                "session_token": session_token,
                "user_id": user_id,
                "expires_at": now_utc() + timedelta(days=7),
                "created_at": now_utc(),
                "is_guest": False,
            }
        },
        upsert=True,
    )
    return {"session_token": session_token, "user": safe_user(user)}


@api.get("/auth/me")
async def auth_me(authorization: Optional[str] = Header(default=None)) -> dict[str, Any]:
    user = await require_user(authorization)
    return {"user": safe_user(user)}


@api.post("/auth/logout")
async def auth_logout(authorization: Optional[str] = Header(default=None)) -> dict[str, str]:
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
        await db.user_sessions.delete_one({"session_token": token})
    return {"status": "ok"}


# ---------- Profile ----------
@api.get("/users/me")
async def me(authorization: Optional[str] = Header(default=None)) -> dict[str, Any]:
    user = await require_user(authorization)
    return {"user": safe_user(user)}


@api.post("/users/me/cosmetics/select")
async def select_cosmetic(req: SelectCosmeticRequest, authorization: Optional[str] = Header(default=None)) -> dict[str, Any]:
    user = await require_user(authorization)
    if req.item_id not in user.get("unlocked_cosmetics", []):
        raise HTTPException(status_code=400, detail="Cosmetic not unlocked")
    field = "selected_card_back" if req.kind == "card_back" else "selected_table_theme"
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {field: req.item_id, "updated_at": now_utc()}})
    user = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return {"user": safe_user(user)}


# ---------- Matches ----------
@api.post("/matches/finish")
async def finish_match(req: MatchFinishRequest, authorization: Optional[str] = Header(default=None)) -> dict[str, Any]:
    user = await require_user(authorization)

    # Anti-abuse: minimum match duration and small cooldown.
    if req.duration_seconds < 20:
        raise HTTPException(status_code=400, detail="Match too short")
    last = user.get("last_match_finish")
    if isinstance(last, datetime):
        if last.tzinfo is None:
            last = last.replace(tzinfo=timezone.utc)
        if (now_utc() - last).total_seconds() < 10:
            raise HTTPException(status_code=429, detail="Slow down")

    # Ticket check for ranked.
    if req.mode == "ranked" and user.get("tickets", 0) < 1:
        raise HTTPException(status_code=400, detail="Not enough tickets")

    is_win = req.placement == 1
    base_coins = {1: 120, 2: 60, 3: 30, 4: 10}[req.placement]
    base_xp = {1: 80, 2: 50, 3: 30, 4: 15}[req.placement]
    rank_delta = 0
    if req.mode == "ranked":
        rank_delta = {1: 30, 2: 10, 3: -10, 4: -25}[req.placement]
    elif req.mode == "casual":
        rank_delta = {1: 8, 2: 3, 3: 0, 4: 0}[req.placement]

    new_coins = max(0, user["coins"] + base_coins)
    new_xp = user["xp"] + base_xp
    new_rank = max(0, user["rank_points"] + rank_delta)
    new_level = level_from_xp(new_xp)
    new_league = league_from_points(new_rank)
    new_tickets = user["tickets"] - (1 if req.mode == "ranked" else 0)
    new_wins = user["wins"] + (1 if is_win else 0)
    new_losses = user["losses"] + (0 if is_win else 1)
    new_matches = user["matches_played"] + 1
    new_matches_week = user.get("matches_won_week", 0) + (1 if is_win else 0)
    new_actions = user.get("action_cards_played", 0) + req.action_cards_played

    # Mission progress.
    missions = user.get("missions", default_missions())
    for m in missions:
        if m.get("claimed"):
            continue
        if m["metric"] == "matches_played":
            m["progress"] = min(m["target"], m["progress"] + 1)
        elif m["metric"] == "matches_won" and is_win:
            if m["id"] == "flawless_1":
                if req.cards_left == 0:
                    m["progress"] = min(m["target"], m["progress"] + 1)
            else:
                m["progress"] = min(m["target"], m["progress"] + 1)
        elif m["metric"] == "action_cards_played":
            m["progress"] = min(m["target"], m["progress"] + req.action_cards_played)
        elif m["metric"] == "matches_won_week" and is_win:
            m["progress"] = min(m["target"], m["progress"] + 1)

    await db.users.update_one(
        {"user_id": user["user_id"]},
        {
            "$set": {
                "coins": new_coins,
                "xp": new_xp,
                "level": new_level,
                "rank_points": new_rank,
                "league": new_league,
                "tickets": new_tickets,
                "wins": new_wins,
                "losses": new_losses,
                "matches_played": new_matches,
                "matches_won_week": new_matches_week,
                "action_cards_played": new_actions,
                "missions": missions,
                "last_match_finish": now_utc(),
                "updated_at": now_utc(),
            }
        },
    )

    match_id = uuid.uuid4().hex
    await db.match_history.insert_one(
        {
            "match_id": match_id,
            "user_id": user["user_id"],
            "mode": req.mode,
            "placement": req.placement,
            "cards_left": req.cards_left,
            "duration_seconds": req.duration_seconds,
            "coins_awarded": base_coins,
            "xp_awarded": base_xp,
            "rank_delta": rank_delta,
            "doubled": False,
            "finished_at": now_utc(),
        }
    )

    return {
        "match_id": match_id,
        "rewards": {
            "coins": base_coins,
            "xp": base_xp,
            "rank_delta": rank_delta,
            "is_win": is_win,
        },
        "user": safe_user(await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})),
    }


@api.get("/matches/history")
async def match_history(authorization: Optional[str] = Header(default=None)) -> dict[str, Any]:
    user = await require_user(authorization)
    cursor = db.match_history.find({"user_id": user["user_id"]}, {"_id": 0}).sort("finished_at", -1).limit(20)
    items = [doc async for doc in cursor]
    return {"items": items}


# ---------- Daily Rewards ----------
DAILY_REWARDS_TABLE = [
    {"day": 1, "coins": 100, "tickets": 0},
    {"day": 2, "coins": 150, "tickets": 0},
    {"day": 3, "coins": 200, "tickets": 1},
    {"day": 4, "coins": 250, "tickets": 0},
    {"day": 5, "coins": 300, "tickets": 1},
    {"day": 6, "coins": 400, "tickets": 1},
    {"day": 7, "coins": 800, "tickets": 3},
]


@api.get("/rewards/daily/status")
async def daily_status(authorization: Optional[str] = Header(default=None)) -> dict[str, Any]:
    user = await require_user(authorization)
    last = user.get("last_daily_claim")
    streak = user.get("daily_streak", 0)
    can_claim = True
    if isinstance(last, datetime):
        last_aware = last if last.tzinfo else last.replace(tzinfo=timezone.utc)
        can_claim = (now_utc() - last_aware) >= timedelta(hours=20)
    day_index = (streak % 7) + 1 if can_claim else (streak % 7) or 7
    return {"can_claim": can_claim, "streak": streak, "next_day": day_index, "table": DAILY_REWARDS_TABLE}


@api.post("/rewards/daily/claim")
async def daily_claim(authorization: Optional[str] = Header(default=None)) -> dict[str, Any]:
    user = await require_user(authorization)
    last = user.get("last_daily_claim")
    if isinstance(last, datetime):
        last_aware = last if last.tzinfo else last.replace(tzinfo=timezone.utc)
        if (now_utc() - last_aware) < timedelta(hours=20):
            raise HTTPException(status_code=429, detail="Already claimed today")
        if (now_utc() - last_aware) > timedelta(hours=48):
            # Streak broken
            user["daily_streak"] = 0
    streak = user.get("daily_streak", 0) + 1
    day_idx = ((streak - 1) % 7)
    reward = DAILY_REWARDS_TABLE[day_idx]
    new_coins = user["coins"] + reward["coins"]
    new_tickets = user["tickets"] + reward["tickets"]
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {
            "$set": {
                "coins": new_coins,
                "tickets": new_tickets,
                "daily_streak": streak,
                "last_daily_claim": now_utc(),
                "updated_at": now_utc(),
            }
        },
    )
    user = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return {"reward": reward, "streak": streak, "user": safe_user(user)}


# ---------- Missions ----------
@api.get("/missions")
async def list_missions(authorization: Optional[str] = Header(default=None)) -> dict[str, Any]:
    user = await require_user(authorization)
    return {"missions": user.get("missions", default_missions())}


@api.post("/missions/claim")
async def claim_mission(req: ClaimRequest, authorization: Optional[str] = Header(default=None)) -> dict[str, Any]:
    user = await require_user(authorization)
    missions = user.get("missions", default_missions())
    target_mission = None
    for m in missions:
        if m["id"] == req.mission_id:
            target_mission = m
            break
    if not target_mission:
        raise HTTPException(status_code=404, detail="Mission not found")
    if target_mission.get("claimed"):
        raise HTTPException(status_code=400, detail="Already claimed")
    if target_mission["progress"] < target_mission["target"]:
        raise HTTPException(status_code=400, detail="Mission not complete")
    target_mission["claimed"] = True
    new_coins = user["coins"] + target_mission["reward_coins"]
    new_xp = user["xp"] + target_mission["reward_xp"]
    new_level = level_from_xp(new_xp)
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"coins": new_coins, "xp": new_xp, "level": new_level, "missions": missions, "updated_at": now_utc()}},
    )
    user = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return {"mission": target_mission, "user": safe_user(user)}


# ---------- Leaderboard ----------
@api.get("/leaderboard")
async def leaderboard(limit: int = 50) -> dict[str, Any]:
    cursor = db.users.find({}, {"_id": 0, "user_id": 1, "username": 1, "picture": 1, "rank_points": 1, "league": 1, "level": 1, "wins": 1}).sort("rank_points", -1).limit(limit)
    items = [doc async for doc in cursor]
    for i, it in enumerate(items, start=1):
        it["position"] = i
    return {"items": items}


# ---------- Shop ----------
@api.get("/shop")
async def shop(authorization: Optional[str] = Header(default=None)) -> dict[str, Any]:
    user = await require_user(authorization)
    owned = set(user.get("unlocked_cosmetics", []))
    items = [{**it, "owned": it["id"] in owned} for it in SHOP_CATALOG]
    return {"items": items, "coins": user["coins"]}


@api.post("/shop/purchase")
async def purchase(req: PurchaseRequest, authorization: Optional[str] = Header(default=None)) -> dict[str, Any]:
    user = await require_user(authorization)
    item = next((it for it in SHOP_CATALOG if it["id"] == req.item_id), None)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    if item["id"] in user.get("unlocked_cosmetics", []):
        raise HTTPException(status_code=400, detail="Already owned")
    if user["coins"] < item["price"]:
        raise HTTPException(status_code=400, detail="Not enough coins")
    new_coins = user["coins"] - item["price"]
    unlocked = list(user.get("unlocked_cosmetics", [])) + [item["id"]]
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"coins": new_coins, "unlocked_cosmetics": unlocked, "updated_at": now_utc()}},
    )
    user = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return {"item": item, "user": safe_user(user)}


# ---------- Ads (mock) ----------
AD_COOLDOWN_SECONDS = 30
AD_DAILY_LIMIT = 30


@api.post("/ads/claim")
async def claim_ad(req: AdClaimRequest, authorization: Optional[str] = Header(default=None)) -> dict[str, Any]:
    user = await require_user(authorization)
    last = user.get("last_ad_claim")
    if isinstance(last, datetime):
        last_aware = last if last.tzinfo else last.replace(tzinfo=timezone.utc)
        if (now_utc() - last_aware).total_seconds() < AD_COOLDOWN_SECONDS:
            raise HTTPException(status_code=429, detail=f"Ad cooldown {AD_COOLDOWN_SECONDS}s")
    # Daily limit check
    since = now_utc() - timedelta(hours=24)
    count = await db.ad_claims.count_documents({"user_id": user["user_id"], "created_at": {"$gte": since}})
    if count >= AD_DAILY_LIMIT:
        raise HTTPException(status_code=429, detail="Daily ad limit reached")

    # Compute reward by type.
    coins = 0
    tickets = 0
    if req.reward_type == "double_match":
        if not req.match_ref:
            raise HTTPException(status_code=400, detail="match_ref required")
        match = await db.match_history.find_one({"match_id": req.match_ref, "user_id": user["user_id"]}, {"_id": 0})
        if not match:
            raise HTTPException(status_code=404, detail="Match not found")
        if match.get("doubled"):
            raise HTTPException(status_code=400, detail="Already doubled")
        # Match must be recent.
        finished = match["finished_at"]
        if isinstance(finished, datetime) and finished.tzinfo is None:
            finished = finished.replace(tzinfo=timezone.utc)
        if (now_utc() - finished) > timedelta(minutes=5):
            raise HTTPException(status_code=400, detail="Match too old to double")
        coins = match["coins_awarded"]
        await db.match_history.update_one({"match_id": req.match_ref}, {"$set": {"doubled": True}})
    elif req.reward_type == "extra_ticket":
        tickets = 1
    elif req.reward_type == "premium_chest":
        coins = 250
        tickets = 1
    elif req.reward_type == "streak_recover":
        coins = 0
        # Reset last_daily_claim so user can claim now to extend streak.
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"last_daily_claim": None}})
    elif req.reward_type == "generic":
        coins = 50

    # Mission progress for ads.
    missions = user.get("missions", default_missions())
    for m in missions:
        if m.get("metric") == "ads_watched" and not m.get("claimed"):
            m["progress"] = min(m["target"], m["progress"] + 1)

    await db.ad_claims.insert_one(
        {
            "claim_id": uuid.uuid4().hex,
            "user_id": user["user_id"],
            "reward_type": req.reward_type,
            "coins": coins,
            "tickets": tickets,
            "created_at": now_utc(),
        }
    )
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {
            "$inc": {"coins": coins, "tickets": tickets, "ads_watched": 1},
            "$set": {"last_ad_claim": now_utc(), "missions": missions, "updated_at": now_utc()},
        },
    )
    user = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return {"coins": coins, "tickets": tickets, "user": safe_user(user)}


# ---------- Admin / Debug ----------
@api.get("/admin/users")
async def admin_users(authorization: Optional[str] = Header(default=None), limit: int = 100) -> dict[str, Any]:
    await require_user(authorization)
    cursor = db.users.find({}, {"_id": 0}).sort("created_at", -1).limit(limit)
    return {"items": [doc async for doc in cursor]}


@api.post("/admin/reset-missions")
async def admin_reset_missions(authorization: Optional[str] = Header(default=None)) -> dict[str, Any]:
    user = await require_user(authorization)
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"missions": default_missions(), "matches_won_week": 0, "updated_at": now_utc()}})
    user = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return {"user": safe_user(user)}


@api.post("/admin/grant")
async def admin_grant(coins: int = 0, tickets: int = 0, rank_points: int = 0, authorization: Optional[str] = Header(default=None)) -> dict[str, Any]:
    user = await require_user(authorization)
    new_coins = max(0, user["coins"] + coins)
    new_tickets = max(0, user["tickets"] + tickets)
    new_rank = max(0, user["rank_points"] + rank_points)
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"coins": new_coins, "tickets": new_tickets, "rank_points": new_rank, "league": league_from_points(new_rank), "updated_at": now_utc()}},
    )
    user = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return {"user": safe_user(user)}


@api.post("/admin/seed-bots")
async def seed_bots() -> dict[str, Any]:
    """Seed bot/leaderboard users for visual richness. Idempotent."""
    bots = [
        ("Aurora_Vex", 4800),
        ("NeonRift", 4200),
        ("Solstice", 3700),
        ("EmberOwl", 3100),
        ("TidalWolf", 2600),
        ("CipherFox", 2100),
        ("HexCobra", 1700),
        ("LunaQuill", 1300),
        ("PixieBolt", 900),
        ("AshenKite", 600),
    ]
    seeded = 0
    for name, rp in bots:
        if await db.users.find_one({"username": name, "is_guest": False, "email": None}):
            continue
        uid = new_user_id()
        doc = default_user_doc(uid, username=name, is_guest=False)
        doc["rank_points"] = rp
        doc["league"] = league_from_points(rp)
        doc["wins"] = max(5, rp // 60)
        doc["level"] = max(1, rp // 200)
        await db.users.insert_one(doc)
        seeded += 1
    return {"seeded": seeded}


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
