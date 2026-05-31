// Classic Mau Mau style shedding engine: regular playing cards only.
// No jokers and no custom action deck.

export type Suit = 'Hearts' | 'Diamonds' | 'Clubs' | 'Spades';
export type Rank = '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';
export type Action = 'DrawTwo' | 'ChooseSuit' | null;
export type Gender = 'male' | 'female';

export interface Card {
  id: string;
  suit: Suit;
  value: Rank;
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
  drawPile: Card[];
  discardPile: Card[];
  currentSuit: Suit;
  pendingDraw: number;
  winner: number | null;
  log: string[];
  startedAt: number;
  actionsPlayed: number;
}

const SUITS: Suit[] = ['Hearts', 'Diamonds', 'Clubs', 'Spades'];
const RANKS: Rank[] = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const STARTING_HAND_SIZE = 5;

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

function actionForRank(value: Rank): Action {
  if (value === '7') return 'DrawTwo';
  if (value === 'J') return 'ChooseSuit';
  return null;
}

function isOpeningCard(card: Card) {
  return card.value !== '7' && card.value !== 'J';
}

export function buildDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const value of RANKS) {
      deck.push({ id: uid(), suit, value, action: actionForRank(value) });
    }
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

  for (let round = 0; round < STARTING_HAND_SIZE; round += 1) {
    for (const player of players) player.hand.push(deck.pop()!);
  }

  let first = deck.pop()!;
  while (!isOpeningCard(first)) {
    deck.unshift(first);
    first = deck.pop()!;
  }

  return {
    players,
    turn: 0,
    drawPile: deck,
    discardPile: [first],
    currentSuit: first.suit,
    pendingDraw: 0,
    winner: null,
    log: [`Top card: ${formatCard(first)}`],
    startedAt: Date.now(),
    actionsPlayed: 0,
  };
}

export function topCard(state: GameState): Card {
  return state.discardPile[state.discardPile.length - 1];
}

export function canPlay(card: Card, top: Card, currentSuit: Suit, pendingDraw: number): boolean {
  if (pendingDraw > 0) return card.value === '7';
  if (card.value === 'J') return true;
  if (card.suit === currentSuit) return true;
  if (card.value === top.value) return true;
  return false;
}

export function legalCardsFor(player: Player, state: GameState): Card[] {
  return player.hand.filter((card) => canPlay(card, topCard(state), state.currentSuit, state.pendingDraw));
}

function nextIndex(state: GameState, from: number): number {
  return (from + 1) % state.players.length;
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
    log: [...state.log, `${player.name} played ${formatCard(card)}`],
  };

  if (card.value === 'J') {
    nextState.currentSuit = opts.chosenSuit || pickBestSuitForOpponent(nextState, playerIdx);
    nextState.log.push(`${player.name} chose ${nextState.currentSuit}`);
  } else {
    nextState.currentSuit = card.suit;
  }

  if (playerIdx === 0 && card.action) nextState.actionsPlayed += 1;

  if (nextState.players[playerIdx].hand.length === 0) {
    nextState.winner = playerIdx;
    nextState.log.push(`${player.name} wins!`);
    return { state: nextState, ok: true };
  }

  if (card.value === '7') {
    nextState.pendingDraw = (nextState.pendingDraw || 0) + 2;
  }
  nextState.turn = nextIndex(nextState, playerIdx);

  return { state: nextState, ok: true };
}

export function drawAndPass(state: GameState, playerIdx: number): GameState {
  if (state.winner !== null || state.turn !== playerIdx) return state;
  const toDraw = state.pendingDraw > 0 ? state.pendingDraw : 1;
  const nextState = drawN(state, playerIdx, toDraw);
  nextState.pendingDraw = 0;
  nextState.log = [...nextState.log, `${nextState.players[playerIdx].name} drew ${toDraw}`];
  nextState.turn = nextIndex(nextState, playerIdx);
  return nextState;
}

function countBySuit(hand: Card[]) {
  const counts: Record<Suit, number> = { Hearts: 0, Diamonds: 0, Clubs: 0, Spades: 0 };
  for (const card of hand) counts[card.suit] += 1;
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

function rankScore(value: Rank) {
  return RANKS.indexOf(value) + 1;
}

export function opponentTurn(state: GameState, playerIdx: number): GameState {
  if (state.winner !== null || state.turn !== playerIdx) return state;
  const player = state.players[playerIdx];
  const legal = legalCardsFor(player, state);
  if (legal.length === 0) return drawAndPass(state, playerIdx);

  const suitCounts = countBySuit(player.hand);
  const scored = legal
    .map((card) => {
      let score = Math.random() * 1.3;
      if (state.pendingDraw > 0 && card.value === '7') score += 8;
      else if (card.value === '7') score += 5.5;
      else if (card.value === 'J') score += player.hand.length <= 2 ? 7 : 3;
      else score += rankScore(card.value) * 0.35;
      score += suitCounts[card.suit] * 0.2;
      return { card, score };
    })
    .sort((a, b) => b.score - a.score);

  const choice = scored[Math.random() < 0.16 && scored[1] ? 1 : 0].card;
  const opts: PlayCardOptions = {};
  if (choice.value === 'J') opts.chosenSuit = pickBestSuitForOpponent(state, playerIdx);
  const result = playCard(state, playerIdx, choice.id, opts);
  return result.ok ? result.state : drawAndPass(state, playerIdx);
}

export function suitColor(suit: Suit): string {
  switch (suit) {
    case 'Hearts': return '#B91C1C';
    case 'Diamonds': return '#BE123C';
    case 'Clubs': return '#111827';
    case 'Spades': return '#020617';
  }
}

export function suitAccentColor(suit: Suit): string {
  switch (suit) {
    case 'Hearts': return '#EF4444';
    case 'Diamonds': return '#F43F5E';
    case 'Clubs': return '#64748B';
    case 'Spades': return '#94A3B8';
  }
}

export function suitGlyph(suit: Suit): string {
  switch (suit) {
    case 'Hearts': return '\u2665';
    case 'Diamonds': return '\u2666';
    case 'Clubs': return '\u2663';
    case 'Spades': return '\u2660';
  }
}

export function actionLabel(action: Action): string {
  switch (action) {
    case 'DrawTwo': return '+2';
    case 'ChooseSuit': return 'Suit';
    default: return '';
  }
}

export function formatCard(card: Card): string {
  return `${card.value}${suitGlyph(card.suit)}`;
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
