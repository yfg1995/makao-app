"""P0 Economy flow E2E test for Card Rush Arena.

Covers /auth/guest, /match/start (ticket→coins→insufficient), /ads/progress,
/ads/watch (pair reward + daily cap + anti-spam), /daily/status, /daily/claim.

Designed to run as ONE ordered scenario on a SINGLE fresh guest user.
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def state():
    """Shared state across the ordered scenario."""
    return {}


@pytest.fixture(scope="module")
def session():
    """One guest user / one HTTP session for the full ordered scenario."""
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{API}/auth/guest", json={})
    assert r.status_code == 200, r.text
    data = r.json()
    token = data["session_token"]
    user = data["user"]
    s.headers.update({
        "Authorization": f"Bearer {token}",
        "X-Session-Token": token,
    })
    return {"token": token, "user": user, "s": s}


# Each step is an ordered test method on a single class so they run in declared order.
class TestEconomyFlow:
    # 1) Guest signup defaults
    def test_01_guest_signup(self, session, state):
        u = session["user"]
        assert session["token"]
        assert u["coins"] == 1000
        assert u["tickets"] == 5
        assert u["guest_mode"] is True
        state["coins"] = u["coins"]
        state["tickets"] = u["tickets"]

    # 2) First /match/start spends a ticket
    def test_02_match_start_first_ticket(self, session, state):
        r = session["s"].post(f"{API}/match/start", json={})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["paid_with"] == "ticket"
        assert d["user"]["tickets"] == 4
        assert d["user"]["coins"] == 1000
        state["tickets"] = d["user"]["tickets"]
        state["coins"] = d["user"]["coins"]

    # 3) Drain remaining 4 tickets — all pay with 'ticket'
    def test_03_match_start_drain_tickets(self, session, state):
        for expected_after in (3, 2, 1, 0):
            r = session["s"].post(f"{API}/match/start", json={})
            assert r.status_code == 200, r.text
            d = r.json()
            assert d["paid_with"] == "ticket", f"expected ticket, got {d['paid_with']}"
            assert d["user"]["tickets"] == expected_after
            assert d["user"]["coins"] == 1000
        state["tickets"] = 0
        state["coins"] = 1000

    # 4) Tickets=0, coins=1000 → next match pays in coins
    def test_04_match_start_first_coin(self, session, state):
        r = session["s"].post(f"{API}/match/start", json={})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["paid_with"] == "coins"
        assert d["user"]["coins"] == 900
        assert d["user"]["tickets"] == 0
        state["coins"] = 900

    # 5) Drain coins until <100 and 402 INSUFFICIENT_BALANCE
    def test_05_match_start_until_insufficient(self, session, state):
        # 900 → call until 402; should happen exactly after 9 successful coin spends (coins 800,700,…,0)
        successes = 0
        for _ in range(15):  # safety upper bound
            r = session["s"].post(f"{API}/match/start", json={})
            if r.status_code == 402:
                d = r.json()
                detail = d.get("detail")
                assert isinstance(detail, dict), detail
                assert detail.get("code") == "INSUFFICIENT_BALANCE"
                assert "current_coins" in detail and "current_tickets" in detail
                assert detail["current_tickets"] == 0
                assert detail["current_coins"] < 100
                state["coins"] = detail["current_coins"]
                return
            assert r.status_code == 200, r.text
            assert r.json()["paid_with"] == "coins"
            successes += 1
        pytest.fail("Expected 402 INSUFFICIENT_BALANCE within 15 spends but never got it")

    # 6) /ads/progress shape on fresh user (0 watched today)
    def test_06_ads_progress_initial(self, session, state):
        r = session["s"].get(f"{API}/ads/progress")
        assert r.status_code == 200, r.text
        d = r.json()
        # Field names per spec
        for k in ("watched_today", "daily_cap", "pair_size", "reward_per_pair",
                  "max_coins_today", "daily_cap_reached"):
            assert k in d, f"missing field {k}"
        assert d["watched_today"] == 0
        assert d["daily_cap"] == 6
        assert d["pair_size"] == 2
        assert d["reward_per_pair"] == 100
        assert d["max_coins_today"] == 300
        assert d["daily_cap_reached"] is False

    # 7) First /ads/watch — no reward yet
    def test_07_ads_watch_first(self, session, state):
        coins_before = state["coins"]
        r = session["s"].post(f"{API}/ads/watch", json={})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["granted_coins"] == 0
        assert d["watched_today"] == 1
        assert d["user"]["coins"] == coins_before  # unchanged
        state["coins"] = d["user"]["coins"]

    # 8) Wait > 3s anti-spam window then 2nd watch → +100 coins
    def test_08_ads_watch_second_grants(self, session, state):
        time.sleep(3.5)
        coins_before = state["coins"]
        r = session["s"].post(f"{API}/ads/watch", json={})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["watched_today"] == 2
        assert d["granted_coins"] == 100
        assert d["user"]["coins"] == coins_before + 100
        state["coins"] = d["user"]["coins"]

    # 9) Immediately watch again → 429 anti-spam
    def test_09_ads_watch_too_fast(self, session):
        r = session["s"].post(f"{API}/ads/watch", json={})
        assert r.status_code == 429, r.text

    # 10) Daily status — fresh user can_claim
    def test_10_daily_status(self, session, state):
        r = session["s"].get(f"{API}/daily/status")
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("can_claim", "today_reward", "streak", "next_in_seconds"):
            assert k in d
        assert d["can_claim"] is True
        assert d["today_reward"] > 0
        state["can_claim"] = d["can_claim"]

    # 11) Claim daily → coins increase, streak ≥ 1; second claim fails
    def test_11_daily_claim(self, session, state):
        if not state.get("can_claim"):
            pytest.skip("Cannot claim — status said not claimable")
        coins_before = state["coins"]
        r = session["s"].post(f"{API}/daily/claim", json={})
        assert r.status_code == 200, r.text
        d = r.json()
        reward = d["reward"]
        assert reward > 0
        # verify via /auth/me
        me = session["s"].get(f"{API}/auth/me").json()
        assert me["coins"] == coins_before + reward
        assert me["daily_streak"] >= 1
        state["coins"] = me["coins"]
        # second claim must fail
        r2 = session["s"].post(f"{API}/daily/claim", json={})
        assert r2.status_code in (400, 429), r2.text

    # 12) Optional — ensure /match/start consistency post-daily-claim
    def test_12_match_start_after_daily(self, session, state):
        r = session["s"].post(f"{API}/match/start", json={})
        # We just topped up coins via /daily/claim and possibly +100 from ads.
        # Whether this succeeds depends on the topped-up coins vs 100. Assert
        # response is a clean 200 (coins) or 402 (insufficient) — never 500.
        assert r.status_code in (200, 402), r.text
        if r.status_code == 200:
            assert r.json()["paid_with"] == "coins"
