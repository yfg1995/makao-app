"""Card Rush Arena backend API tests."""

import time

import pytest
import requests


class TestAuth:
    def test_root(self, api_url):
        r = requests.get(f"{api_url}/")
        assert r.status_code == 200
        assert r.json().get("status") == "ok"

    def test_guest_signup_defaults(self, client, api_url):
        r = client.post(f"{api_url}/auth/guest", json={"username": "TEST_DefaultsUser"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["session_token"]
        u = d["user"]
        assert u["coins"] == 1000
        assert u["tickets"] == 5
        assert u["rank_points"] == 0
        assert u["league"] == "Bronze"
        assert u["guest_mode"] is True

    def test_guest_auto_username(self, client, api_url):
        r = client.post(f"{api_url}/auth/guest", json={})
        assert r.status_code == 200
        assert r.json()["user"]["username"].startswith("Guest")

    def test_auth_me_with_token(self, guest_session, api_url):
        _, user, ac = guest_session
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
        r = client.post(f"{api_url}/auth/session")
        assert r.status_code == 400, r.text

    def test_auth_session_invalid_id(self, client, api_url):
        r = client.post(f"{api_url}/auth/session", headers={"X-Session-ID": "invalid-not-real"})
        assert r.status_code in (401, 502), r.text

    def test_auth_logout(self, guest_session, api_url):
        _, _, ac = guest_session
        r = ac.post(f"{api_url}/auth/logout", json={})
        assert r.status_code == 200
        assert ac.get(f"{api_url}/auth/me").status_code == 401


class TestMatch:
    def test_match_win_updates_and_consumes_active_match(self, guest_session, api_url):
        _, user, ac = guest_session
        start = ac.post(f"{api_url}/match/start", json={})
        assert start.status_code == 200, start.text
        started = start.json()

        payload = {
            "match_id": started["match_id"],
            "won": True,
            "cards_left": 0,
            "duration_seconds": 180,
            "coins_earned": 100,
            "rank_points_delta": 25,
            "xp_earned": 20,
        }
        r = ac.post(f"{api_url}/match/result", json=payload)
        assert r.status_code == 200, r.text
        u = r.json()["user"]
        assert u["coins"] == started["user"]["coins"] + 100
        assert u["rank_points"] == user["rank_points"] + 25

        me = ac.get(f"{api_url}/auth/me").json()
        assert me["coins"] == u["coins"]
        assert me["rank_points"] == u["rank_points"]

        replay = ac.post(f"{api_url}/match/result", json=payload)
        assert replay.status_code == 400

    def test_match_loss_no_negative_rp(self, guest_session, api_url):
        _, _, ac = guest_session
        start = ac.post(f"{api_url}/match/start", json={})
        assert start.status_code == 200, start.text
        payload = {
            "match_id": start.json()["match_id"],
            "won": False,
            "cards_left": 4,
            "duration_seconds": 120,
            "coins_earned": 0,
            "rank_points_delta": -100,
            "xp_earned": 0,
        }
        r = ac.post(f"{api_url}/match/result", json=payload)
        assert r.status_code == 200
        assert r.json()["user"]["rank_points"] >= 0


class TestMatchEntryEconomy:
    def test_match_start_spends_ticket(self, guest_session, api_url):
        _, user, ac = guest_session
        r = ac.post(f"{api_url}/match/start", json={})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["paid_with"] == "ticket"
        assert d["user"]["tickets"] == user["tickets"] - 1
        assert d["user"]["coins"] == user["coins"]

    def test_match_start_falls_back_to_coins(self, guest_session, api_url):
        _, _, ac = guest_session
        for _ in range(5):
            r = ac.post(f"{api_url}/match/start", json={})
            assert r.status_code == 200, r.text
            assert r.json()["paid_with"] == "ticket"

        r = ac.post(f"{api_url}/match/start", json={})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["paid_with"] == "coins"
        assert d["user"]["tickets"] == 0
        assert d["user"]["coins"] == 900

    def test_match_start_insufficient_balance(self, guest_session, api_url):
        _, _, ac = guest_session
        for _ in range(16):
            r = ac.post(f"{api_url}/match/start", json={})
            if r.status_code == 402:
                detail = r.json()["detail"]
                assert detail["code"] == "INSUFFICIENT_BALANCE"
                assert detail["current_tickets"] == 0
                assert detail["current_coins"] < 100
                return
            assert r.status_code == 200, r.text
        pytest.fail("Expected 402 INSUFFICIENT_BALANCE")


class TestAds:
    def test_ads_pair_reward(self, guest_session, api_url):
        _, user, ac = guest_session
        p = ac.get(f"{api_url}/ads/progress")
        assert p.status_code == 200, p.text
        assert p.json()["reward_per_pair"] == 100

        first = ac.post(f"{api_url}/ads/watch", json={})
        assert first.status_code == 200, first.text
        assert first.json()["granted_coins"] == 0

        time.sleep(3.5)
        second = ac.post(f"{api_url}/ads/watch", json={})
        assert second.status_code == 200, second.text
        d = second.json()
        assert d["granted_coins"] == 100
        assert d["user"]["coins"] == user["coins"] + 100


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

        r2 = ac.post(f"{api_url}/daily/claim", json={})
        assert r2.status_code == 400

        s = ac.get(f"{api_url}/daily/status").json()
        assert s["can_claim"] is False
        assert s["next_in_seconds"] > 0


class TestMissions:
    def test_missions_list(self, guest_session, api_url):
        _, _, ac = guest_session
        r = ac.get(f"{api_url}/missions")
        assert r.status_code == 200
        d = r.json()
        ids = {m["id"] for m in d["missions"]}
        assert {"win_1", "win_3", "play_5", "action_10"}.issubset(ids)
        for m in d["missions"]:
            assert "progress" in m and "completed" in m and "claimed" in m

    def test_missions_claim_not_complete(self, guest_session, api_url):
        _, _, ac = guest_session
        r = ac.post(f"{api_url}/missions/claim", json={"mission_id": "win_3"})
        assert r.status_code == 400

    def test_missions_claim_invalid(self, guest_session, api_url):
        _, _, ac = guest_session
        r = ac.post(f"{api_url}/missions/claim", json={"mission_id": "fake"})
        assert r.status_code == 404


class TestLeaderboard:
    def test_leaderboard(self, guest_session, api_url):
        _, _, ac = guest_session
        r = ac.get(f"{api_url}/leaderboard")
        assert r.status_code == 200, r.text
        entries = r.json()["entries"]
        assert isinstance(entries, list)
        assert len(entries) >= 1
        rps = [e["rank_points"] for e in entries]
        assert rps == sorted(rps, reverse=True)


class TestProfile:
    def test_profile_update(self, guest_session, api_url):
        _, _, ac = guest_session
        r = ac.patch(f"{api_url}/profile", json={"username": "TEST_Renamed"})
        assert r.status_code == 200
        assert r.json()["username"] == "TEST_Renamed"
