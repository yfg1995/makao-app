// Card Rush Arena – core game engine (pure, UI-independent).
// Classic shedding card game adapted with ORIGINAL art and naming:
//  - 4 suits: flame, wave, leaf, bolt
//  - Numbers 0..9
//  - Action cards (per suit): skip, reverse, draw2
//  - Wild cards: wild, wild_draw4
// Rules summary:
//  - Play a card matching the top of discard by suit OR value, OR play a wild.
//  - Skip: next player loses turn.
//  - Reverse: turn direction reverses.
//  - Draw2: next player draws 2 cards and loses turn.
//  - Wild: choose a suit; next player plays normally.
//  - Wild Draw4: choose suit, next player draws 4 and loses turn.
//  - If no playable card, draw 1 from deck; if playable, may immediately play it.
//  - First to 0 cards wins.

export type Suit = "flame" | "wave" | "leaf" | "bolt";
export type Value =
  | "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9"
  | "skip" | "reverse" | "draw2"
  | "wild" | "wild4";

export interface Card {
  id: string;
  suit: Suit | "wild";
  value: Value;
}

export interface Player {
  id: string;
  name: string;
  hand: Card[];
  isBot: boolean;
  avatar?: string;
}

export interface GameState {
  players: Player[]; // index 0 = human (user)
  deck: Card[];
  discard: Card[];
  currentIndex: number;
  direction: 1 | -1;
  activeSuit: Suit; // current suit (changes with wilds)
  pendingDraw: number; // accumulated draw from draw2/wild4 (not stacked here; reset after applied)
  winnerId: string | null;
  actionCardsPlayedByUser: number;
  log: string[];
}

const SUITS: Suit[] = ["flame", "wave", "leaf", "bolt"];

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function buildDeck(): Card[] {
  const deck: Card[] = [];
  for (const s of SUITS) {
    // One 0, two of 1-9, two each of skip/reverse/draw2
    deck.push({ id: uid(), suit: s, value: "0" });
    for (let n = 1; n <= 9; n++) {
      deck.push({ id: uid(), suit: s, value: String(n) as Value });
      deck.push({ id: uid(), suit: s, value: String(n) as Value });
    }
    for (const v of ["skip", "reverse", "draw2"] as Value[]) {
      deck.push({ id: uid(), suit: s, value: v });
      deck.push({ id: uid(), suit: s, value: v });
    }
  }
  for (let i = 0; i < 4; i++) {
    deck.push({ id: uid(), suit: "wild", value: "wild" });
    deck.push({ id: uid(), suit: "wild", value: "wild4" });
  }
  return shuffle(deck);
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function isActionCard(c: Card): boolean {
  return ["skip", "reverse", "draw2", "wild", "wild4"].includes(c.value);
}

export function canPlay(card: Card, top: Card, activeSuit: Suit): boolean {
  if (card.suit === "wild") return true;
  if (card.suit === activeSuit) return true;
  if (card.value === top.value && card.suit !== "wild") return true;
  return false;
}

export function newGame(playerNames: string[], userIsFirst = true): GameState {
  const deck = buildDeck();
  const players: Player[] = playerNames.map((name, i) => ({
    id: i === 0 ? "user" : `bot_${i}`,
    name,
    hand: [],
    isBot: i !== 0,
  }));
  // Deal 7 each
  for (let i = 0; i < 7; i++) {
    for (const p of players) {
      const c = deck.pop();
      if (c) p.hand.push(c);
    }
  }
  // Reveal first non-wild, non-action card
  let top: Card | undefined;
  while (deck.length) {
    const c = deck.pop()!;
    if (c.suit !== "wild" && !isActionCard(c)) {
      top = c;
      break;
    }
    deck.unshift(c); // re-insert at bottom
  }
  if (!top) top = { id: uid(), suit: "flame", value: "0" };
  const activeSuit = (top.suit as Suit) ?? "flame";
  return {
    players,
    deck,
    discard: [top],
    currentIndex: userIsFirst ? 0 : 1,
    direction: 1,
    activeSuit,
    pendingDraw: 0,
    winnerId: null,
    actionCardsPlayedByUser: 0,
    log: [`${players[userIsFirst ? 0 : 1].name} starts.`],
  };
}

export function topCard(state: GameState): Card {
  return state.discard[state.discard.length - 1];
}

function drawFromDeck(state: GameState, count: number): Card[] {
  const drawn: Card[] = [];
  for (let i = 0; i < count; i++) {
    if (state.deck.length === 0) {
      // Reshuffle discard pile minus top.
      const top = state.discard.pop()!;
      const reshuffled = shuffle(state.discard);
      state.discard = [top];
      state.deck = reshuffled;
    }
    const c = state.deck.pop();
    if (c) drawn.push(c);
  }
  return drawn;
}

export function drawCards(state: GameState, playerIndex: number, count: number): Card[] {
  const drawn = drawFromDeck(state, count);
  state.players[playerIndex].hand.push(...drawn);
  return drawn;
}

function nextIndex(state: GameState, steps = 1): number {
  const n = state.players.length;
  return (state.currentIndex + state.direction * steps + n * 10) % n;
}

export function playCard(state: GameState, playerIndex: number, card: Card, chosenSuit?: Suit): { ok: boolean; reason?: string } {
  if (playerIndex !== state.currentIndex) return { ok: false, reason: "Not your turn" };
  const player = state.players[playerIndex];
  const cardInHand = player.hand.find(c => c.id === card.id);
  if (!cardInHand) return { ok: false, reason: "Card not in hand" };
  const top = topCard(state);
  if (!canPlay(cardInHand, top, state.activeSuit)) return { ok: false, reason: "Illegal move" };

  // Remove from hand
  player.hand = player.hand.filter(c => c.id !== card.id);
  state.discard.push(cardInHand);

  // Action effects
  if (cardInHand.suit === "wild") {
    state.activeSuit = chosenSuit || "flame";
  } else {
    state.activeSuit = cardInHand.suit as Suit;
  }

  // Track action cards for missions
  if (playerIndex === 0 && isActionCard(cardInHand)) {
    state.actionCardsPlayedByUser += 1;
  }

  // Win check
  if (player.hand.length === 0) {
    state.winnerId = player.id;
    state.log.unshift(`${player.name} played the final card!`);
    return { ok: true };
  }

  // Apply effect + advance turn
  if (cardInHand.value === "skip") {
    state.log.unshift(`${player.name} skipped ${state.players[nextIndex(state)].name}.`);
    state.currentIndex = nextIndex(state, 2);
  } else if (cardInHand.value === "reverse") {
    state.direction = (state.direction === 1 ? -1 : 1) as 1 | -1;
    state.log.unshift(`${player.name} reversed the order.`);
    // In 2-player it would skip, but we have 4, so just continue.
    state.currentIndex = nextIndex(state);
  } else if (cardInHand.value === "draw2") {
    const victim = nextIndex(state);
    drawCards(state, victim, 2);
    state.log.unshift(`${state.players[victim].name} draws 2.`);
    state.currentIndex = nextIndex(state, 2);
  } else if (cardInHand.value === "wild4") {
    const victim = nextIndex(state);
    drawCards(state, victim, 4);
    state.log.unshift(`${state.players[victim].name} draws 4!`);
    state.currentIndex = nextIndex(state, 2);
  } else {
    state.log.unshift(`${player.name} played ${cardInHand.value.toUpperCase()} ${cardInHand.suit}.`);
    state.currentIndex = nextIndex(state);
  }
  return { ok: true };
}

export function playerDraw(state: GameState, playerIndex: number): Card | null {
  if (playerIndex !== state.currentIndex) return null;
  const [c] = drawCards(state, playerIndex, 1);
  state.log.unshift(`${state.players[playerIndex].name} drew a card.`);
  // Move to next player (no auto-play here for simplicity)
  state.currentIndex = nextIndex(state);
  return c || null;
}

export function findPlayableIndex(player: Player, top: Card, activeSuit: Suit): number {
  for (let i = 0; i < player.hand.length; i++) {
    if (canPlay(player.hand[i], top, activeSuit)) return i;
  }
  return -1;
}

// Bot strategy: prefer non-wild action cards, then highest number, save wilds for last.
export function botPickCard(player: Player, top: Card, activeSuit: Suit): { card: Card; chosenSuit?: Suit } | null {
  const playable = player.hand.filter(c => canPlay(c, top, activeSuit));
  if (!playable.length) return null;
  const score = (c: Card) => {
    if (c.value === "wild4") return 1;
    if (c.value === "wild") return 2;
    if (c.value === "draw2") return 100;
    if (c.value === "skip") return 90;
    if (c.value === "reverse") return 80;
    return 50 + parseInt(c.value, 10 || 0);
  };
  playable.sort((a, b) => score(b) - score(a));
  const chosen = playable[0];
  let chosenSuit: Suit | undefined;
  if (chosen.suit === "wild") {
    // Pick most-held suit
    const counts: Record<Suit, number> = { flame: 0, wave: 0, leaf: 0, bolt: 0 };
    for (const c of player.hand) if (c.suit !== "wild") counts[c.suit as Suit] += 1;
    chosenSuit = (Object.keys(counts) as Suit[]).sort((a, b) => counts[b] - counts[a])[0];
  }
  return { card: chosen, chosenSuit };
}
