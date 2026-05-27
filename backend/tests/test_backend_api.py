"""Card Rush Arena - Backend API tests covering auth, match, shop, daily, missions, leaderboard."""
import time
import pytest
import requests

# ----------------- Auth tests -----------------
class TestAuth:
    def test_root(self, api_url):
        r = requests.get(f"{api_url}/")
        assert r.status_code == 200
        data = r.json()
        assert data.get("status") == "ok"

    def test_guest_signup_defaults(self, client, api_url):
        r = client.post(f"{api_url}/auth/guest", json={"username": "TEST_DefaultsUser"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert "session_token" in d and d["session_token"]
        u = d["user"]
        assert u["coins"] == 1000
        assert u["tickets"] == 5
        assert u["rank_points"] == 0
        assert u["league"] == "Bronze"
        assert u["guest_mode"] is True
        assert u["username"].startswith("TEST_") or u["username"]

    def test_guest_auto_username(self, client, api_url):
        # Empty payload should still create a guest with auto username
        r = client.post(f"{api_url}/auth/guest", json={})
        assert r.status_code == 200
        u = r.json()["user"]
        assert u["username"].startswith("Guest")

    def test_auth_me_with_token(self, guest_session, api_url):
        token, user, ac = guest_session
        r = ac.get(f"{api_url}/auth/me")
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["id"] == user["id"]
        assert d["coins"] == 1000
        assert d["league"] == "Bronze"

    def test_auth_me_without_token(self, client, api_url):
        r = client.get(f"{api_url}/auth/me")
        assert r.status_code == 401

    def test_auth_session_missing_id(self, client, api_url):
        # Endpoint must exist; missing X-Session-ID should produce 400
        r = client.post(f"{api_url}/auth/session")
        assert r.status_code == 400, r.text

    def test_auth_session_invalid_id(self, client, api_url):
        r = client.post(f"{api_url}/auth/session", headers={"X-Session-ID": "invalid-not-real"})
        # Should fail with 401 or 502 (provider error) but NOT 500
        assert r.status_code in (401, 502), r.text

    def test_auth_logout(self, guest_session, api_url):
        token, user, ac = guest_session
        r = ac.post(f"{api_url}/auth/logout", json={})
        assert r.status_code == 200
        # Token must now be invalid
        r2 = ac.get(f"{api_url}/auth/me")
        assert r2.status_code == 401


# ----------------- Match -----------------
class TestMatch:
    def test_match_win_updates(self, guest_session, api_url):
        token, user, ac = guest_session
        payload = {"won": True, "cards_left": 0, "duration_seconds": 180,
                   "coins_earned": 100, "rank_points_delta": 25, "xp_earned": 20}
        r = ac.post(f"{api_url}/match/result", json=payload)
        assert r.status_code == 200, r.text
        u = r.json()["user"]
        assert u["coins"] == user["coins"] + 100
        assert u["rank_points"] == user["rank_points"] + 25

        # verify persistence via /auth/me
        me = ac.get(f"{api_url}/auth/me").json()
        assert me["coins"] == u["coins"]
        assert me["rank_points"] == u["rank_points"]

    def test_match_loss_no_negative_rp(self, guest_session, api_url):
        token, user, ac = guest_session
        payload = {"won": False, "cards_left": 4, "duration_seconds": 120,
                   "coins_earned": 0, "rank_points_delta": -100, "xp_earned": 0}
        r = ac.post(f"{api_url}/match/result", json=payload)
        assert r.status_code == 200
        u = r.json()["user"]
        assert u["rank_points"] >= 0


# ----------------- Shop -----------------
class TestShop:
    def test_shop_items(self, guest_session, api_url):
        _, _, ac = guest_session
        r = ac.get(f"{api_url}/shop/items")
        assert r.status_code == 200
        items = r.json()["items"]
        assert len(items) >= 4
        ids = {i["id"] for i in items}
        assert "coins_small" in ids

    def test_shop_purchase_with_tickets(self, guest_session, api_url):
        _, user, ac = guest_session
        r = ac.post(f"{api_url}/shop/purchase", json={"item_id": "coins_small"})
        assert r.status_code == 200, r.text
        u = r.json()["user"]
        assert u["tickets"] == user["tickets"] - 1
        assert u["coins"] == user["coins"] + 500

    def test_shop_purchase_with_coins(self, guest_session, api_url):
        _, user, ac = guest_session
        # Need 1500 coins. Starting 1000, so earn 500 via ads (10 x 50)
        for _ in range(10):
            ac.post(f"{api_url}/ads/reward", json={})
        before = ac.get(f"{api_url}/auth/me").json()
        r = ac.post(f"{api_url}/shop/purchase", json={"item_id": "tickets_pack"})
        assert r.status_code == 200, r.text
        u = r.json()["user"]
        assert u["coins"] == before["coins"] - 1500
        assert u["tickets"] == before["tickets"] + 3

    def test_shop_purchase_invalid_item(self, guest_session, api_url):
        _, _, ac = guest_session
        r = ac.post(f"{api_url}/shop/purchase", json={"item_id": "nope_does_not_exist"})
        assert r.status_code == 404

    def test_shop_purchase_insufficient(self, client, api_url):
        # Fresh guest with 5 tickets — try big purchase
        r = client.post(f"{api_url}/auth/guest", json={"username": "TEST_PoorGuest"})
        tok = r.json()["session_token"]
        ac = requests.Session()
        ac.headers.update({"Authorization": f"Bearer {tok}", "X-Session-Token": tok})
        # Spend down: 5 tickets covers coins_big once (5 tickets) -> then second purchase should fail
        ac.post(f"{api_url}/shop/purchase", json={"item_id": "coins_big"})  # consumes 5 tickets
        r2 = ac.post(f"{api_url}/shop/purchase", json={"item_id": "coins_small"})
        assert r2.status_code == 400


# ----------------- Ads -----------------
class TestAds:
    def test_ads_reward(self, guest_session, api_url):
        _, user, ac = guest_session
        r = ac.post(f"{api_url}/ads/reward", json={})
        assert r.status_code == 200
        u = r.json()["user"]
        assert u["coins"] == user["coins"] + 50


# ----------------- Daily -----------------
class TestDaily:
    def test_daily_status_initial(self, guest_session, api_url):
        _, _, ac = guest_session
        r = ac.get(f"{api_url}/daily/status")
        assert r.status_code == 200
        d = r.json()
        assert d["can_claim"] is True
        assert d["today_reward"] == 50
        assert isinstance(d["schedule"], list)

    def test_daily_claim_and_cooldown(self, guest_session, api_url):
        _, user, ac = guest_session
        r = ac.post(f"{api_url}/daily/claim", json={})
        assert r.status_code == 200
        d = r.json()
        assert d["reward"] == 50
        assert d["user"]["coins"] == user["coins"] + 50
        # Second claim should fail
        r2 = ac.post(f"{api_url}/daily/claim", json={})
        assert r2.status_code == 400
        # Status should now show can_claim false
        s = ac.get(f"{api_url}/daily/status").json()
        assert s["can_claim"] is False
        assert s["next_in_seconds"] > 0


# ----------------- Missions -----------------
class TestMissions:
    def test_missions_list(self, guest_session, api_url):
        _, _, ac = guest_session
        r = ac.get(f"{api_url}/missions")
        assert r.status_code == 200
        d = r.json()
        assert len(d["missions"]) >= 4
        ids = {m["id"] for m in d["missions"]}
        assert {"win_1", "win_3", "play_5", "action_10"}.issubset(ids)
        for m in d["missions"]:
            assert "progress" in m and "completed" in m and "claimed" in m

    def test_missions_claim_not_complete(self, guest_session, api_url):
        _, _, ac = guest_session
        r = ac.post(f"{api_url}/missions/claim", json={"mission_id": "win_3"})
        # Should reject because no matches played
        assert r.status_code == 400

    def test_missions_claim_invalid(self, guest_session, api_url):
        _, _, ac = guest_session
        r = ac.post(f"{api_url}/missions/claim", json={"mission_id": "fake"})
        assert r.status_code == 404


# ----------------- Leaderboard -----------------
class TestLeaderboard:
    def test_leaderboard(self, guest_session, api_url):
        _, _, ac = guest_session
        r = ac.get(f"{api_url}/leaderboard")
        assert r.status_code == 200, r.text
        entries = r.json()["entries"]
        assert isinstance(entries, list)
        assert len(entries) >= 1
        # ranks ordered desc
        rps = [e["rank_points"] for e in entries]
        assert rps == sorted(rps, reverse=True)


# ----------------- Profile -----------------
class TestProfile:
    def test_profile_update(self, guest_session, api_url):
        _, user, ac = guest_session
        r = ac.patch(f"{api_url}/profile", json={"username": "TEST_Renamed"})
        assert r.status_code == 200
        assert r.json()["username"] == "TEST_Renamed"
