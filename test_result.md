#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: |
  Build "Card Rush Arena" — a free-to-play (no real money/gambling/crypto) Crazy 8s / Makao
  inspired 4-player card game (1 player vs 3 bots for MVP). Suits: Flame, Wave, Leaf, Bolt.
  Action cards: Skip, Reverse, Draw Two, Wild, Shield. First to 0 cards wins, 7-card start.
  Guest mode + Emergent Google Auth, virtual currencies (1000 coins, 5 tickets, 0 RP, Bronze).
  Mock AdMob rewarded ads. Vibrant purple/teal premium look. Screens: Splash, Login, Lobby,
  Game, Results, Daily, Missions, Leaderboard, Profile, Shop, Settings, Legal.

backend:
  - task: "Auth (Guest + Emergent Google) endpoints"
    implemented: true
    working: "NA"
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        - working: "NA"
          agent: "main"
          comment: "/api/auth/guest, /api/auth/me, /api/auth/session, /api/auth/logout implemented. Fixed datetime offset comparison bug + disabled withCredentials/CORS adjustment. Needs end-to-end testing."

  - task: "Match / Game endpoints (start, play, finish vs bots)"
    implemented: true
    working: "NA"
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Backend match endpoints to support 1v3-bot flow + coin/ticket/RP updates. Needs validation."

  - task: "Shop, Daily Reward, Missions, Leaderboard endpoints"
    implemented: true
    working: "NA"
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        - working: "NA"
          agent: "main"
          comment: "/api/shop/items, /api/shop/purchase, /api/rewards/daily, /api/missions, /api/leaderboard. Validate persistence and currency updates."

frontend:
  - task: "App boots / Splash + routing"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/_layout.tsx, /app/frontend/app/index.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        - working: "NA"
          agent: "main"
          comment: "App now compiles after fixing axios + CORS. Manual screenshots showed Login/Lobby/Game/Shop render. Needs full testing_agent sweep."

  - task: "Guest auth + Login screen + Emergent Google Auth button"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/login.tsx, /app/frontend/src/services/auth.tsx, /app/frontend/app/auth-callback.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Guest path should work fully. For Google Auth, only verify button + auth-callback route exist and don't crash; do NOT block MVP if full Google redirect can't be automated."

  - task: "Lobby → Game → Results flow vs 3 bots"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/(tabs)/lobby.tsx, /app/frontend/app/game.tsx, /app/frontend/app/results.tsx, /app/frontend/src/game/engine.ts"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Crazy 8s engine vs 3 bots. Validate full match: deal 7 cards, turn order, play valid cards by Flame/Wave/Leaf/Bolt or rank, finish to results with coin/RP update."

  - task: "Action cards: Skip, Reverse, Draw Two, Wild, Shield"
    implemented: true
    working: "NA"
    file: "/app/frontend/src/game/engine.ts, /app/frontend/app/game.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Validate each action card effect in-engine: Skip skips next, Reverse flips direction, Draw Two forces +2, Wild changes suit, Shield blocks next draw effect."

  - task: "Currency display + Shop purchase + Rewarded Ad mock + Daily/Missions/Leaderboard"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/(tabs)/shop.tsx, /app/frontend/app/(tabs)/missions.tsx, /app/frontend/app/(tabs)/leaderboard.tsx, /app/frontend/app/(tabs)/profile.tsx, /app/frontend/app/daily.tsx, /app/frontend/src/services/ads.ts"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Validate: 1000 starting coins, 5 tickets, 0 RP, Bronze league. Watch-Ad gives +50 coins (mock). Shop purchase decrements correct currency. Daily rewards cooldown. Missions list renders. Leaderboard renders."

  - task: "Legal disclaimers (no gambling/crypto/cash-out wording)"
    implemented: true
    working: true
    file: "/app/frontend/app/legal.tsx, /app/frontend/app/(tabs)/shop.tsx, /app/frontend/src/components/UI.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        - working: true
          agent: "main"
          comment: "Manually verified: legal.tsx contains explicit 'no gambling, no betting, no real-money prizes, no crypto, no cash-out, virtual coins/items have no monetary value and cannot be withdrawn, sold, transferred, or exchanged.' Shop also shows 'No real money involved' + NoMoneyFooter."

metadata:
  created_by: "main_agent"
  version: "1.0"
  test_sequence: 0
  run_ui: true

backend:
  - task: "Match start economy gate POST /api/match/start"
    implemented: true
    working: "NA"
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        - working: "NA"
          agent: "main"
          comment: |
            Server is now the SOLE source of truth for match entry cost.
            Atomic conditional decrement: prefer 1 ticket, fallback to 100 coins.
            If both insufficient -> HTTP 402 with detail.code = INSUFFICIENT_BALANCE and
            current_tickets/current_coins. On success returns {match_id, paid_with, user}.
            Inserts row in matches_active. Needs validation across 3 cases:
              (a) user has tickets -> tickets -1, paid_with='ticket'
              (b) user has 0 tickets & >=100 coins -> coins -100, paid_with='coins'
              (c) user has 0 tickets & <100 coins -> 402 INSUFFICIENT_BALANCE.

  - task: "Ads progress + watch flow GET /api/ads/progress, POST /api/ads/watch"
    implemented: true
    working: "NA"
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        - working: "NA"
          agent: "main"
          comment: |
            /ads/progress returns watched_today, daily_cap (6), pair_size (2),
            reward_per_pair (100), next_reward_in, daily_cap_reached, coins_earned_today,
            max_coins_today.
            /ads/watch increments count, anti-spam interval 3s (HTTP 429 if too fast),
            DAILY_AD_CAP_REACHED at 6 watches/day. Grants 100 coins every 2nd watch.
            Validate: 1st watch -> granted_coins=0; 2nd watch (after >=3s) -> granted_coins=100
            and user.coins increased by 100. After 6 watches in a day -> further calls return 429.

frontend:
  - task: "Lobby PLAY button wired to /api/match/start + OutOfCoinsModal"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/(tabs)/lobby.tsx, /app/frontend/src/components/OutOfCoinsModal.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        - working: "NA"
          agent: "main"
          comment: |
            PLAY now calls POST /api/match/start. On success routes to /game with matchId and paid_with.
            On 402 / detail.code=INSUFFICIENT_BALANCE opens <OutOfCoinsModal/> with a "Go to Earn" CTA
            that navigates to /(tabs)/earn. Lobby balance pills must reflect refreshed user after spend.

  - task: "Earn tab — replaces Shop, AdSimulatorModal + Daily Reward claim"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/(tabs)/earn.tsx, /app/frontend/src/components/AdSimulatorModal.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        - working: "NA"
          agent: "main"
          comment: |
            New Earn screen (no shop, no IAP). "Watch Ad" opens 5s countdown AdSimulatorModal,
            on complete posts /ads/watch, refreshes balance + progress. After 2nd ad => Alert "+100 coins".
            Daily Reward card hits /daily/status and /daily/claim. Legal text shown at the bottom.
            Validate that after the 2nd ad, balance pill increases by 100 and the alert appears.

  - task: "Legal page strict NO-IAP / NO-Gambling text"
    implemented: true
    working: true
    file: "/app/frontend/app/legal.tsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
        - working: true
          agent: "main"
          comment: "Manually verified — explicit NO IAP, no real money, no crypto, no cashout, no transfer."

metadata:
  created_by: "main_agent"
  version: "1.1"
  test_sequence: 1
  run_ui: true

test_plan:
  current_focus:
    - "Match start economy gate POST /api/match/start"
    - "Ads progress + watch flow GET /api/ads/progress, POST /api/ads/watch"
    - "Lobby PLAY button wired to /api/match/start + OutOfCoinsModal"
    - "Earn tab — replaces Shop, AdSimulatorModal + Daily Reward claim"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
    - agent: "main"
      message: |
        P0 ECONOMY FLOW TEST.
        Please test the following NEW flow end-to-end. This is the priority — older tasks above
        ("Lobby->Game vs 3 bots", "Action cards", etc.) are out-of-scope for this run.

        Auth: use guest auth — POST /api/auth/guest returns a Bearer session_token. Use it as
        Authorization: Bearer <token> for all subsequent calls. No test_credentials needed
        (guest is anonymous, fresh user each call).

        BACKEND TESTS (priority order):
        1. POST /api/auth/guest -> 200, returns user (coins=1000, tickets=5) and session_token.
        2. POST /api/match/start (with the new guest)
           -> 200, paid_with='ticket', user.tickets=4, user.coins=1000.
        3. Drain tickets: call /api/match/start 5 more times until tickets=0.
           Each call should succeed, paid_with='ticket'.
        4. Next /api/match/start with tickets=0, coins=1000
           -> 200, paid_with='coins', user.coins=900.
        5. Force INSUFFICIENT_BALANCE: drain coins via repeated /match/start (10 times more to get coins<100).
           Final call with tickets=0 & coins<100 -> HTTP 402 with detail.code='INSUFFICIENT_BALANCE'.
        6. GET /api/ads/progress -> 200, watched_today=0, daily_cap=6, pair_size=2, reward_per_pair=100.
        7. POST /api/ads/watch (1st) -> granted_coins=0, watched_today=1.
        8. Wait 3.5s (anti-spam interval is 3s) then POST /api/ads/watch (2nd)
           -> granted_coins=100, watched_today=2, user.coins increased by 100.
        9. POST /api/ads/watch immediately after the 2nd (no wait) -> HTTP 429 (anti-spam).
        10. GET /api/daily/status -> 200, returns can_claim/today_reward/streak/next_in_seconds.
        11. POST /api/daily/claim (only if can_claim=true) -> 200, reward>0, user.coins increased.

        FRONTEND TESTS (after backend passes):
        A. App boots at / (Splash) -> auto-redirect to /login or /(tabs)/lobby if session exists.
        B. Tap "Play as Guest" on /login -> lands on Lobby with coins=1000, tickets=5.
        C. Lobby: PLAY button -> deducts 1 ticket -> navigates to /game. Press hardware back / Leave to return.
        D. Go to Earn tab. Tap "Watch Ad" -> AdSimulatorModal appears with 5s countdown -> completes -> back to Earn. Coins unchanged after 1st ad.
        E. Tap "Watch Ad" again (wait at least 4s) -> after 5s countdown -> Alert "+100 coins" -> balance pill updates to coins+100.
        F. Spend down: switch to Lobby, press PLAY repeatedly until OutOfCoinsModal pops (you may need to keep playing to drain). Modal must show coin/ticket balance and "Go to Earn" CTA that navigates to /(tabs)/earn.

        KNOWN MOCK: AdMob is fully mocked (5s countdown).
        DO NOT TEST: Lobby->Game->Results full match (out of scope this run), Action cards, Leaderboard, Missions claim cooldowns. Those will be covered separately.