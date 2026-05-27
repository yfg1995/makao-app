// Crazy 8s / Makao-inspired shedding engine for Card Rush Arena.
// Suits: Flame, Wave, Leaf, Bolt. Ranks 1..10 + action cards.
// Action cards: Skip, Reverse, Draw Two, Wild, Shield.

export type Suit = 'Flame' | 'Wave' | 'Leaf' | 'Bolt';
export type Action = 'Skip' | 'Reverse' | 'DrawTwo' | 'Wild' | 'Shield' | null;

export interface Card {
  id: string;
  suit: Suit | 'Wild';
  value: number | null; // 1..10 for number cards, null for actions
  action: Action;
}

export interface Player {
  id: string;
  name: string;
  isHuman: boolean;
  hand: Card[];
  isBot: boolean;
}

export interface GameState {
  players: Player[];
  turn: number; // index
  direction: 1 | -1;
  drawPile: Card[];
  discardPile: Card[];
  currentSuit: Suit; // active suit (changes on Wild)
  pendingDraw: number; // accumulated Draw Two stack value
  skipNext: boolean;
  winner: number | null;
  log: string[];
  startedAt: number;
  actionsPlayed: number; // count of action cards played by human
}

const SUITS: Suit[] = ['Flame', 'Wave', 'Leaf', 'Bolt'];
const ACTION_KINDS: Exclude<Action, null>[] = ['Skip', 'Reverse', 'DrawTwo', 'Shield'];

function uid() { return Math.random().toString(36).slice(2, 10); }

export function buildDeck(): Card[] {
  const deck: Card[] = [];
  for (const s of SUITS) {
    for (let v = 1; v <= 10; v++) {
      deck.push({ id: uid(), suit: s, value: v, action: null });
    }
    for (const a of ACTION_KINDS) {
      deck.push({ id: uid(), suit: s, value: null, action: a });
      // two copies of Skip/Reverse/DrawTwo for action richness
      if (a !== 'Shield') deck.push({ id: uid(), suit: s, value: null, action: a });
    }
  }
  for (let i = 0; i < 4; i++) deck.push({ id: uid(), suit: 'Wild', value: null, action: 'Wild' });
  return shuffle(deck);
}

export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function newGame(humanName: string = 'You'): GameState {
  const deck = buildDeck();
  const players: Player[] = [
    { id: 'p0', name: humanName, isHuman: true, isBot: false, hand: [] },
    { id: 'p1', name: 'AceFlame', isHuman: false, isBot: true, hand: [] },
    { id: 'p2', name: 'WaveLord', isHuman: false, isBot: true, hand: [] },
    { id: 'p3', name: 'BoltKing', isHuman: false, isBot: true, hand: [] },
  ];
  for (let r = 0; r < 7; r++) {
    for (const p of players) p.hand.push(deck.pop()!);
  }
  // first discard: ensure it's a number card (avoid action cards starting the game)
  let first = deck.pop()!;
  while (first.action !== null || first.suit === 'Wild') {
    deck.unshift(first);
    first = deck.pop()!;
  }
  const state: GameState = {
    players,
    turn: 0,
    direction: 1,
    drawPile: deck,
    discardPile: [first],
    currentSuit: first.suit as Suit,
    pendingDraw: 0,
    skipNext: false,
    winner: null,
    log: [`Top card: ${first.suit} ${first.value ?? first.action}`],
    startedAt: Date.now(),
    actionsPlayed: 0,
  };
  return state;
}

export function topCard(s: GameState): Card { return s.discardPile[s.discardPile.length - 1]; }

export function canPlay(card: Card, top: Card, currentSuit: Suit, pendingDraw: number): boolean {
  // When DrawTwo is pending, only Shield, another DrawTwo, or Wild can be played
  if (pendingDraw > 0) {
    if (card.action === 'DrawTwo') return true;
    if (card.action === 'Shield') return true;
    if (card.action === 'Wild') return true;
    return false;
  }
  if (card.action === 'Wild') return true;
  if (card.suit === 'Wild') return true; // safety
  if (card.suit === currentSuit) return true;
  if (card.action && top.action && card.action === top.action) return true;
  if (card.value !== null && top.value !== null && card.value === top.value) return true;
  return false;
}

export function legalCardsFor(player: Player, s: GameState): Card[] {
  const top = topCard(s);
  return player.hand.filter((c) => canPlay(c, top, s.currentSuit, s.pendingDraw));
}

function nextIndex(s: GameState, from: number, steps: number = 1): number {
  let idx = from;
  for (let i = 0; i < steps; i++) idx = (idx + s.direction + s.players.length) % s.players.length;
  return idx;
}

export function drawN(s: GameState, playerIdx: number, n: number): GameState {
  const ns: GameState = { ...s, players: s.players.map((p) => ({ ...p, hand: p.hand.slice() })), drawPile: s.drawPile.slice(), discardPile: s.discardPile.slice() };
  for (let i = 0; i < n; i++) {
    if (ns.drawPile.length === 0) {
      // reshuffle discard except top
      if (ns.discardPile.length <= 1) break;
      const top = ns.discardPile.pop()!;
      ns.drawPile = shuffle(ns.discardPile);
      ns.discardPile = [top];
      ns.log = [...ns.log, 'Deck reshuffled'];
    }
    const c = ns.drawPile.pop();
    if (c) ns.players[playerIdx].hand.push(c);
  }
  return ns;
}

export interface PlayCardOptions {
  chosenSuit?: Suit; // for Wild
}

export function playCard(state: GameState, playerIdx: number, cardId: string, opts: PlayCardOptions = {}): { state: GameState; ok: boolean; reason?: string } {
  if (state.winner !== null) return { state, ok: false, reason: 'Game over' };
  if (state.turn !== playerIdx) return { state, ok: false, reason: 'Not your turn' };
  const player = state.players[playerIdx];
  const card = player.hand.find((c) => c.id === cardId);
  if (!card) return { state, ok: false, reason: 'Card not in hand' };
  const top = topCard(state);
  if (!canPlay(card, top, state.currentSuit, state.pendingDraw)) {
    return { state, ok: false, reason: 'Illegal play' };
  }
  let s: GameState = {
    ...state,
    players: state.players.map((p, i) => i === playerIdx ? { ...p, hand: p.hand.filter((c) => c.id !== cardId) } : { ...p }),
    discardPile: [...state.discardPile, card],
    log: [...state.log, `${player.name} played ${card.suit === 'Wild' ? 'Wild' : card.suit} ${card.value ?? card.action}`],
  };
  // determine new currentSuit
  if (card.action === 'Wild') {
    s.currentSuit = (opts.chosenSuit || pickBestSuitForBot(s, playerIdx)) as Suit;
    s.log.push(`${player.name} chose ${s.currentSuit}`);
  } else {
    s.currentSuit = card.suit as Suit;
  }
  if (playerIdx === 0 && card.action) s.actionsPlayed += 1;

  // win check
  if (s.players[playerIdx].hand.length === 0) {
    s.winner = playerIdx;
    s.log.push(`${player.name} wins!`);
    return { state: s, ok: true };
  }

  // handle action effects
  if (card.action === 'DrawTwo') {
    s.pendingDraw = (s.pendingDraw || 0) + 2;
    s.turn = nextIndex(s, playerIdx, 1);
  } else if (card.action === 'Skip') {
    s.turn = nextIndex(s, playerIdx, 2);
  } else if (card.action === 'Reverse') {
    s.direction = (s.direction === 1 ? -1 : 1) as 1 | -1;
    if (s.players.length === 2) {
      // in 2P reverse acts as skip; not our case but safe
      s.turn = nextIndex(s, playerIdx, 2);
    } else {
      s.turn = nextIndex(s, playerIdx, 1);
    }
  } else if (card.action === 'Shield') {
    // Cancel pending draw if any. Shield stops the chain; control passes.
    s.pendingDraw = 0;
    s.turn = nextIndex(s, playerIdx, 1);
  } else if (card.action === 'Wild') {
    s.turn = nextIndex(s, playerIdx, 1);
  } else {
    s.turn = nextIndex(s, playerIdx, 1);
  }
  return { state: s, ok: true };
}

export function drawAndPass(state: GameState, playerIdx: number): GameState {
  if (state.winner !== null || state.turn !== playerIdx) return state;
  // If pendingDraw, player absorbs it; otherwise draw 1
  const toDraw = state.pendingDraw > 0 ? state.pendingDraw : 1;
  let s = drawN(state, playerIdx, toDraw);
  s.pendingDraw = 0;
  s.log = [...s.log, `${s.players[playerIdx].name} drew ${toDraw}`];
  s.turn = nextIndex(s, playerIdx, 1);
  return s;
}

// --- Bot AI ---
function countBySuit(hand: Card[]) {
  const c: Record<Suit, number> = { Flame: 0, Wave: 0, Leaf: 0, Bolt: 0 };
  for (const card of hand) {
    if (card.suit !== 'Wild') c[card.suit] += 1;
  }
  return c;
}

export function pickBestSuitForBot(s: GameState, playerIdx: number): Suit {
  const counts = countBySuit(s.players[playerIdx].hand);
  let best: Suit = 'Flame'; let max = -1;
  for (const k of SUITS) if (counts[k] > max) { max = counts[k]; best = k; }
  return best;
}

export function botTurn(state: GameState, playerIdx: number): GameState {
  if (state.winner !== null) return state;
  if (state.turn !== playerIdx) return state;
  const player = state.players[playerIdx];
  const legal = legalCardsFor(player, state);
  if (legal.length === 0) {
    return drawAndPass(state, playerIdx);
  }
  // priority: action cards first; among same, prefer suit we have most of
  const scored = legal.map((c) => {
    let score = 0;
    if (c.action === 'DrawTwo') score += 8;
    else if (c.action === 'Skip') score += 6;
    else if (c.action === 'Reverse') score += 5;
    else if (c.action === 'Wild') score += (player.hand.length <= 2 ? 9 : 2);
    else if (c.action === 'Shield') score += 3;
    else score += (c.value || 0) / 10;
    return { c, score };
  }).sort((a, b) => b.score - a.score);
  const choice = scored[0].c;
  const opts: PlayCardOptions = {};
  if (choice.action === 'Wild') opts.chosenSuit = pickBestSuitForBot(state, playerIdx);
  const res = playCard(state, playerIdx, choice.id, opts);
  return res.ok ? res.state : drawAndPass(state, playerIdx);
}

export function suitColor(suit: Suit | 'Wild'): string {
  switch (suit) {
    case 'Flame': return '#F97316';
    case 'Wave': return '#22D3EE';
    case 'Leaf': return '#34D399';
    case 'Bolt': return '#FACC15';
    default: return '#A78BFA';
  }
}

export function suitGlyph(suit: Suit | 'Wild'): string {
  switch (suit) {
    case 'Flame': return '🔥';
    case 'Wave': return '🌊';
    case 'Leaf': return '🍃';
    case 'Bolt': return '⚡';
    default: return '✦';
  }
}

export function actionLabel(a: Action): string {
  switch (a) {
    case 'Skip': return 'Skip';
    case 'Reverse': return 'Reverse';
    case 'DrawTwo': return '+2';
    case 'Wild': return 'Wild';
    case 'Shield': return 'Shield';
    default: return '';
  }
}

export const SUIT_LIST: Suit[] = SUITS;
