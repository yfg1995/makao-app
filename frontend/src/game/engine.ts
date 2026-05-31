// Mau Mau-inspired shedding engine for Card Rush Arena.
// Standard suits keep the table familiar while the economy and match gate stay server-side.

export type Suit = 'Hearts' | 'Diamonds' | 'Clubs' | 'Spades';
export type Action = 'Skip' | 'Reverse' | 'DrawTwo' | 'Wild' | 'Shield' | null;
export type Gender = 'male' | 'female';

export interface Card {
  id: string;
  suit: Suit | 'Wild';
  value: number | null;
  action: Action;
}

export interface Player {
  id: string;
  name: string;
  isHuman: boolean;
  isVirtual: boolean;
  gender: Gender;
  avatarName: string;
  avatarColor: string;
  hand: Card[];
}

export interface GameState {
  players: Player[];
  turn: number;
  direction: 1 | -1;
  drawPile: Card[];
  discardPile: Card[];
  currentSuit: Suit;
  pendingDraw: number;
  skipNext: boolean;
  winner: number | null;
  log: string[];
  startedAt: number;
  actionsPlayed: number;
}

const SUITS: Suit[] = ['Hearts', 'Diamonds', 'Clubs', 'Spades'];
const ACTION_KINDS: Exclude<Action, null>[] = ['Skip', 'Reverse', 'DrawTwo', 'Shield'];

const OPPONENT_PROFILES: Pick<Player, 'name' | 'gender' | 'avatarName' | 'avatarColor'>[] = [
  { name: 'Lena Storm', gender: 'female', avatarName: 'Lena', avatarColor: '#EC4899' },
  { name: 'Mila Nova', gender: 'female', avatarName: 'Mila', avatarColor: '#8B5CF6' },
  { name: 'Sofija Ace', gender: 'female', avatarName: 'Sofija', avatarColor: '#14B8A6' },
  { name: 'Ana Spark', gender: 'female', avatarName: 'Ana', avatarColor: '#F97316' },
  { name: 'Tara Leaf', gender: 'female', avatarName: 'Tara', avatarColor: '#22C55E' },
  { name: 'Dunja Star', gender: 'female', avatarName: 'Dunja', avatarColor: '#F59E0B' },
  { name: 'Nikola King', gender: 'male', avatarName: 'Nikola', avatarColor: '#2563EB' },
  { name: 'Marko Wave', gender: 'male', avatarName: 'Marko', avatarColor: '#0891B2' },
  { name: 'Luka Prime', gender: 'male', avatarName: 'Luka', avatarColor: '#7C3AED' },
  { name: 'Stefan Bolt', gender: 'male', avatarName: 'Stefan', avatarColor: '#CA8A04' },
  { name: 'Viktor Rush', gender: 'male', avatarName: 'Viktor', avatarColor: '#DC2626' },
  { name: 'Filip Shade', gender: 'male', avatarName: 'Filip', avatarColor: '#475569' },
];

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export function buildDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (let value = 1; value <= 10; value += 1) {
      deck.push({ id: uid(), suit, value, action: null });
    }
    for (const action of ACTION_KINDS) {
      deck.push({ id: uid(), suit, value: null, action });
      if (action !== 'Shield') deck.push({ id: uid(), suit, value: null, action });
    }
  }
  for (let i = 0; i < 4; i += 1) {
    deck.push({ id: uid(), suit: 'Wild', value: null, action: 'Wild' });
  }
  return shuffle(deck);
}

export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function newGame(humanName = 'You', humanGender?: Gender | null): GameState {
  const deck = buildDeck();
  const opponents = shuffle(OPPONENT_PROFILES).slice(0, 3);
  const players: Player[] = [
    {
      id: 'p0',
      name: humanName,
      isHuman: true,
      isVirtual: false,
      gender: humanGender || 'male',
      avatarName: humanName,
      avatarColor: '#22D3EE',
      hand: [],
    },
    ...opponents.map((profile, index) => ({
      id: `p${index + 1}`,
      ...profile,
      isHuman: false,
      isVirtual: true,
      hand: [],
    })),
  ];

  for (let round = 0; round < 7; round += 1) {
    for (const player of players) player.hand.push(deck.pop()!);
  }

  let first = deck.pop()!;
  while (first.action !== null || first.suit === 'Wild') {
    deck.unshift(first);
    first = deck.pop()!;
  }

  return {
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
}

export function topCard(state: GameState): Card {
  return state.discardPile[state.discardPile.length - 1];
}

export function canPlay(card: Card, top: Card, currentSuit: Suit, pendingDraw: number): boolean {
  if (pendingDraw > 0) {
    return card.action === 'DrawTwo' || card.action === 'Shield' || card.action === 'Wild';
  }
  if (card.action === 'Wild' || card.suit === 'Wild') return true;
  if (card.suit === currentSuit) return true;
  if (card.action && top.action && card.action === top.action) return true;
  if (card.value !== null && top.value !== null && card.value === top.value) return true;
  return false;
}

export function legalCardsFor(player: Player, state: GameState): Card[] {
  return player.hand.filter((card) => canPlay(card, topCard(state), state.currentSuit, state.pendingDraw));
}

function nextIndex(state: GameState, from: number, steps = 1): number {
  let idx = from;
  for (let i = 0; i < steps; i += 1) {
    idx = (idx + state.direction + state.players.length) % state.players.length;
  }
  return idx;
}

export function drawN(state: GameState, playerIdx: number, n: number): GameState {
  const nextState: GameState = {
    ...state,
    players: state.players.map((player) => ({ ...player, hand: player.hand.slice() })),
    drawPile: state.drawPile.slice(),
    discardPile: state.discardPile.slice(),
  };

  for (let i = 0; i < n; i += 1) {
    if (nextState.drawPile.length === 0) {
      if (nextState.discardPile.length <= 1) break;
      const top = nextState.discardPile.pop()!;
      nextState.drawPile = shuffle(nextState.discardPile);
      nextState.discardPile = [top];
      nextState.log = [...nextState.log, 'Deck reshuffled'];
    }
    const card = nextState.drawPile.pop();
    if (card) nextState.players[playerIdx].hand.push(card);
  }
  return nextState;
}

export interface PlayCardOptions {
  chosenSuit?: Suit;
}

export function playCard(
  state: GameState,
  playerIdx: number,
  cardId: string,
  opts: PlayCardOptions = {},
): { state: GameState; ok: boolean; reason?: string } {
  if (state.winner !== null) return { state, ok: false, reason: 'Game over' };
  if (state.turn !== playerIdx) return { state, ok: false, reason: 'Not your turn' };

  const player = state.players[playerIdx];
  const card = player.hand.find((candidate) => candidate.id === cardId);
  if (!card) return { state, ok: false, reason: 'Card not in hand' };
  if (!canPlay(card, topCard(state), state.currentSuit, state.pendingDraw)) {
    return { state, ok: false, reason: 'Illegal play' };
  }

  const nextState: GameState = {
    ...state,
    players: state.players.map((current, index) => (
      index === playerIdx
        ? { ...current, hand: current.hand.filter((candidate) => candidate.id !== cardId) }
        : { ...current }
    )),
    discardPile: [...state.discardPile, card],
    log: [...state.log, `${player.name} played ${card.suit === 'Wild' ? 'Wild' : card.suit} ${card.value ?? card.action}`],
  };

  if (card.action === 'Wild') {
    nextState.currentSuit = opts.chosenSuit || pickBestSuitForOpponent(nextState, playerIdx);
    nextState.log.push(`${player.name} chose ${nextState.currentSuit}`);
  } else {
    nextState.currentSuit = card.suit as Suit;
  }

  if (playerIdx === 0 && card.action) nextState.actionsPlayed += 1;

  if (nextState.players[playerIdx].hand.length === 0) {
    nextState.winner = playerIdx;
    nextState.log.push(`${player.name} wins!`);
    return { state: nextState, ok: true };
  }

  if (card.action === 'DrawTwo') {
    nextState.pendingDraw = (nextState.pendingDraw || 0) + 2;
    nextState.turn = nextIndex(nextState, playerIdx, 1);
  } else if (card.action === 'Skip') {
    nextState.turn = nextIndex(nextState, playerIdx, 2);
  } else if (card.action === 'Reverse') {
    nextState.direction = (nextState.direction === 1 ? -1 : 1) as 1 | -1;
    nextState.turn = nextIndex(nextState, playerIdx, nextState.players.length === 2 ? 2 : 1);
  } else if (card.action === 'Shield') {
    nextState.pendingDraw = 0;
    nextState.turn = nextIndex(nextState, playerIdx, 1);
  } else {
    nextState.turn = nextIndex(nextState, playerIdx, 1);
  }

  return { state: nextState, ok: true };
}

export function drawAndPass(state: GameState, playerIdx: number): GameState {
  if (state.winner !== null || state.turn !== playerIdx) return state;
  const toDraw = state.pendingDraw > 0 ? state.pendingDraw : 1;
  const nextState = drawN(state, playerIdx, toDraw);
  nextState.pendingDraw = 0;
  nextState.log = [...nextState.log, `${nextState.players[playerIdx].name} drew ${toDraw}`];
  nextState.turn = nextIndex(nextState, playerIdx, 1);
  return nextState;
}

function countBySuit(hand: Card[]) {
  const counts: Record<Suit, number> = { Hearts: 0, Diamonds: 0, Clubs: 0, Spades: 0 };
  for (const card of hand) {
    if (card.suit !== 'Wild') counts[card.suit] += 1;
  }
  return counts;
}

export function pickBestSuitForOpponent(state: GameState, playerIdx: number): Suit {
  const counts = countBySuit(state.players[playerIdx].hand);
  let best: Suit = 'Hearts';
  let max = -1;
  for (const suit of SUITS) {
    if (counts[suit] > max) {
      max = counts[suit];
      best = suit;
    }
  }
  return best;
}

export function opponentTurn(state: GameState, playerIdx: number): GameState {
  if (state.winner !== null || state.turn !== playerIdx) return state;
  const player = state.players[playerIdx];
  const legal = legalCardsFor(player, state);
  if (legal.length === 0) return drawAndPass(state, playerIdx);

  const conserveWild = player.hand.length > 3;
  const scored = legal
    .map((card) => {
      let score = Math.random() * 1.4;
      if (state.pendingDraw > 0) {
        if (card.action === 'Shield') score += 9;
        if (card.action === 'DrawTwo') score += 8;
        if (card.action === 'Wild') score += 5;
      } else if (card.action === 'DrawTwo') score += 7;
      else if (card.action === 'Skip') score += 5;
      else if (card.action === 'Reverse') score += 4;
      else if (card.action === 'Wild') score += conserveWild ? 1.5 : 8;
      else if (card.action === 'Shield') score += 2;
      else score += (card.value || 0) / 10;
      if (card.suit !== 'Wild') score += countBySuit(player.hand)[card.suit] * 0.15;
      return { card, score };
    })
    .sort((a, b) => b.score - a.score);

  const choice = scored[Math.random() < 0.18 && scored[1] ? 1 : 0].card;
  const opts: PlayCardOptions = {};
  if (choice.action === 'Wild') opts.chosenSuit = pickBestSuitForOpponent(state, playerIdx);
  const result = playCard(state, playerIdx, choice.id, opts);
  return result.ok ? result.state : drawAndPass(state, playerIdx);
}

export function suitColor(suit: Suit | 'Wild'): string {
  switch (suit) {
    case 'Hearts': return '#DC2626';
    case 'Diamonds': return '#E11D48';
    case 'Clubs': return '#111827';
    case 'Spades': return '#020617';
    default: return '#7C3AED';
  }
}

export function suitAccentColor(suit: Suit | 'Wild'): string {
  switch (suit) {
    case 'Hearts': return '#F87171';
    case 'Diamonds': return '#FB7185';
    case 'Clubs': return '#94A3B8';
    case 'Spades': return '#CBD5E1';
    default: return '#A78BFA';
  }
}

export function suitGlyph(suit: Suit | 'Wild'): string {
  switch (suit) {
    case 'Hearts': return '\u2665';
    case 'Diamonds': return '\u2666';
    case 'Clubs': return '\u2663';
    case 'Spades': return '\u2660';
    default: return '\u2605';
  }
}

export function actionLabel(action: Action): string {
  switch (action) {
    case 'Skip': return 'Skip';
    case 'Reverse': return 'Reverse';
    case 'DrawTwo': return '+2';
    case 'Wild': return 'Wild';
    case 'Shield': return 'Block';
    default: return '';
  }
}

export function playerInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || '?';
}

export const SUIT_LIST: Suit[] = SUITS;
