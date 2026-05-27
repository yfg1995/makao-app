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

test_plan:
  current_focus:
    - "App boots / Splash + routing"
    - "Guest auth + Login screen + Emergent Google Auth button"
    - "Lobby → Game → Results flow vs 3 bots"
    - "Action cards: Skip, Reverse, Draw Two, Wild, Shield"
    - "Currency display + Shop purchase + Rewarded Ad mock + Daily/Missions/Leaderboard"
    - "Auth (Guest + Emergent Google) endpoints"
    - "Match / Game endpoints (start, play, finish vs bots)"
    - "Shop, Daily Reward, Missions, Leaderboard endpoints"
  stuck_tasks: []
  test_all: true
  test_priority: "high_first"

agent_communication:
    - agent: "main"
      message: |
        First full E2E test invocation. App compiles & renders (screenshots verified for Login,
        Lobby, Game, Shop). Please test backend first, then frontend. For Google Auth, only verify
        the button + auth-callback route exist and don't crash; the full Google redirect cannot be
        automated in the sandbox — do NOT mark this as failing if only the redirect step is unverified.
        Guest path must work fully. Validate the full game loop vs 3 bots and all action cards.
        Legal disclaimers were already manually verified — please just confirm they render on screen.