// Classic Mau Mau engine with a regular 52-card deck.
// Rules used here: 2, 7, 8, J, Q and K carry the special table actions.

export type Suit = 'Hearts' | 'Diamonds' | 'Clubs' | 'Spades';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';
export type Action = 'DrawPreviousFour' | 'DrawNextThree' | 'SkipNext' | 'ChooseSuit' | 'Reverse' | 'PlayAgain' | null;
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
  direction: 1 | -1;
  drawPile: Card[];
  discardPile: Card[];
  currentSuit: Suit;
  winner: number | null;
  log: string[];
  startedAt: number;
  actionsPlayed: number;
}

const SUITS: Suit[] = ['Hearts', 'Diamonds', 'Clubs', 'Spades'];
const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const STARTING_HAND_SIZE = 6;

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
  if (value === '2') return 'DrawPreviousFour';
  if (value === '7') return 'DrawNextThree';
  if (value === '8') return 'SkipNext';
  if (value === 'J') return 'ChooseSuit';
  if (value === 'Q') return 'Reverse';
  if (value === 'A') return 'PlayAgain';
  return null;
}

function isOpeningCard(card: Card) {
  return card.action === null;
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
    direction: 1,
    drawPile: deck,
    discardPile: [first],
    currentSuit: first.suit,
    winner: null,
    log: [`Top card: ${formatCard(first)}`],
    startedAt: Date.now(),
    actionsPlayed: 0,
  };
}

export function topCard(state: GameState): Card {
  return state.discardPile[state.discardPile.length - 1];
}

export function canPlay(card: Card, top: Card, currentSuit: Suit): boolean {
  if (card.value === 'J') return true;
  if (card.suit === currentSuit) return true;
  if (card.value === top.value) return true;
  return false;
}

export function legalCardsFor(player: Player, state: GameState): Card[] {
  return player.hand.filter((card) => canPlay(card, topCard(state), state.currentSuit));
}

function nextIndex(state: GameState, from: number, steps = 1): number {
  let idx = from;
  for (let i = 0; i < steps; i += 1) {
    idx = (idx + state.direction + state.players.length) % state.players.length;
  }
  return idx;
}

function previousIndex(state: GameState, from: number): number {
  return (from - state.direction + state.players.length) % state.players.length;
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
  if (!canPlay(card, topCard(state), state.currentSuit)) {
    return { state, ok: false, reason: 'Illegal play' };
  }

  let nextState: GameState = {
    ...state,
    players: state.players.map((current, index) => (
      index === playerIdx
        ? { ...current, hand: current.hand.filter((candidate) => candidate.id !== cardId) }
        : { ...current, hand: current.hand.slice() }
    )),
    discardPile: [...state.discardPile, card],
    log: [...state.log, `${player.name} played ${formatCard(card)}`],
  };

  if (card.value === 'J') {
    nextState.currentSuit = opts.chosenSuit || pickBestSuitForPlayer(nextState, playerIdx);
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

  if (card.value === '2') {
    const victim = previousIndex(nextState, playerIdx);
    nextState = drawN(nextState, victim, 4);
    nextState.log.push(`${nextState.players[victim].name} drew 4`);
    nextState.turn = nextIndex(nextState, playerIdx);
  } else if (card.value === '7') {
    const victim = nextIndex(nextState, playerIdx);
    nextState = drawN(nextState, victim, 3);
    nextState.log.push(`${nextState.players[victim].name} drew 3`);
    nextState.turn = nextIndex(nextState, victim);
  } else if (card.value === '8') {
    const skipped = nextIndex(nextState, playerIdx);
    nextState.log.push(`${nextState.players[skipped].name} skipped`);
    nextState.turn = nextIndex(nextState, skipped);
  } else if (card.value === 'Q') {
    nextState.direction = (nextState.direction === 1 ? -1 : 1) as 1 | -1;
    nextState.turn = nextIndex(nextState, playerIdx);
  } else if (card.value === 'A') {
    nextState.turn = playerIdx;
  } else {
    nextState.turn = nextIndex(nextState, playerIdx);
  }

  return { state: nextState, ok: true };
}

export function drawAndPass(state: GameState, playerIdx: number): GameState {
  if (state.winner !== null || state.turn !== playerIdx) return state;
  const nextState = drawN(state, playerIdx, 1);
  nextState.log = [...nextState.log, `${nextState.players[playerIdx].name} drew 1`];
  nextState.turn = nextIndex(nextState, playerIdx);
  return nextState;
}

function countBySuit(hand: Card[]) {
  const counts: Record<Suit, number> = { Hearts: 0, Diamonds: 0, Clubs: 0, Spades: 0 };
  for (const card of hand) counts[card.suit] += 1;
  return counts;
}

export function pickBestSuitForPlayer(state: GameState, playerIdx: number): Suit {
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
      let score = Math.random() * 1.4;
      if (card.value === '7') score += 8;
      else if (card.value === '2') score += 7;
      else if (card.value === '8') score += 5.5;
      else if (card.value === 'J') score += player.hand.length <= 2 ? 7 : 3.5;
      else if (card.value === 'Q') score += 4.5;
      else if (card.value === 'A') score += player.hand.length <= 2 ? 7 : 4;
      else score += rankScore(card.value) * 0.3;
      score += suitCounts[card.suit] * 0.22;
      return { card, score };
    })
    .sort((a, b) => b.score - a.score);

  const choice = scored[Math.random() < 0.18 && scored[1] ? 1 : 0].card;
  const opts: PlayCardOptions = {};
  if (choice.value === 'J') opts.chosenSuit = pickBestSuitForPlayer(state, playerIdx);
  const result = playCard(state, playerIdx, choice.id, opts);
  return result.ok ? result.state : drawAndPass(state, playerIdx);
}

export function suitColor(suit: Suit): string {
  switch (suit) {
    case 'Hearts': return '#C60E18';
    case 'Diamonds': return '#C60E18';
    case 'Clubs': return '#0B0B0B';
    case 'Spades': return '#0B0B0B';
  }
}

export function suitAccentColor(suit: Suit): string {
  switch (suit) {
    case 'Hearts': return '#E11D2E';
    case 'Diamonds': return '#E11D2E';
    case 'Clubs': return '#2F2F2F';
    case 'Spades': return '#2F2F2F';
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
    case 'DrawPreviousFour': return 'Prev +4';
    case 'DrawNextThree': return '+3';
    case 'SkipNext': return 'Skip';
    case 'ChooseSuit': return 'Suit';
    case 'Reverse': return 'Turn';
    case 'PlayAgain': return 'Again';
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
