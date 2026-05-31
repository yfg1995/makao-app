import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  BackHandler,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../src/theme';
import { CardView } from '../src/components/Card';
import { PressScale } from '../src/components/UI';
import {
  GameState,
  Gender,
  newGame,
  topCard,
  legalCardsFor,
  playCard,
  drawAndPass,
  opponentTurn,
  suitAccentColor,
  suitColor,
  suitGlyph,
  SUIT_LIST,
  Suit,
} from '../src/game/engine';
import { useAuth } from '../src/services/auth';
import { api } from '../src/services/api';

// DiceBear avatar URL generator
const getDiceBearAvatar = (seed: string, style: 'adventurer' | 'avataaars' | 'bottts' | 'lorelei' = 'adventurer') => {
  return `https://api.dicebear.com/7.x/${style}/png?seed=${encodeURIComponent(seed)}&size=64`;
};

export default function GameScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ matchId?: string; paidWith?: string }>();
  const matchId = typeof params.matchId === 'string' ? params.matchId : '';
  const { user, refresh } = useAuth();
  const { width, height } = useWindowDimensions();
  const [state, setState] = useState<GameState>(() => newGame(user?.username || 'You', user?.gender as Gender | undefined));
  const [showSuitPicker, setShowSuitPicker] = useState(false);
  const [pendingSuitChoiceId, setPendingSuitChoiceId] = useState<string | null>(null);
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);
  const [showScore, setShowScore] = useState(false);
  const [endHandled, setEndHandled] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  const compact = width < 380 || height < 760;
  const handCardWidth = compact ? 64 : width < 430 ? 72 : 78;
  const tableCardWidth = compact ? 76 : 88;

  const top = topCard(state);
  const human = state.players[0];
  const legalIds = useMemo(() => new Set(legalCardsFor(human, state).map((card) => card.id)), [human, state]);

  useEffect(() => {
    if (!matchId) router.replace('/(tabs)/lobby');
  }, [matchId, router]);

  useEffect(() => {
    if (state.winner !== null || state.turn === 0) return;
    const activePlayer = state.players[state.turn];
    const legalCount = legalCardsFor(activePlayer, state).length;
    const delay = 1200 + Math.floor(Math.random() * 1700) + (legalCount === 0 ? 400 : 0);
    const timeout = setTimeout(() => {
      setState((current) => {
        if (current.winner !== null || current.turn === 0) return current;
        return opponentTurn(current, current.turn);
      });
    }, delay);
    return () => clearTimeout(timeout);
  }, [state.players, state.turn, state.winner, state]);

  useEffect(() => {
    const winnerIndex = state.winner;
    if (winnerIndex === null || endHandled || !matchId) return;
    setEndHandled(true);
    const won = winnerIndex === 0;
    const myCardsLeft = state.players[0].hand.length;
    const duration = Math.floor((Date.now() - state.startedAt) / 1000);
    const coins_earned = won ? 50 + Math.max(0, (30 - duration / 6) | 0) : 10;
    const rp_delta = won ? 30 : -10;
    const xp_earned = won ? 50 : 15;

    (async () => {
      try {
        await api.post('/match/result', {
          match_id: matchId,
          won,
          cards_left: myCardsLeft,
          duration_seconds: duration,
          coins_earned,
          rank_points_delta: rp_delta,
          xp_earned,
        });
        await refresh();
      } catch {
        Alert.alert('Result sync', 'The match ended, but result sync did not complete. Please refresh profile later.');
      }
      router.replace({
        pathname: '/results',
        params: {
          won: won ? '1' : '0',
          coins: String(coins_earned),
          rp: String(rp_delta),
          xp: String(xp_earned),
          duration: String(duration),
          cardsLeft: String(myCardsLeft),
          winnerName: state.players[winnerIndex].name,
        },
      });
    })();
  }, [endHandled, matchId, refresh, router, state.players, state.startedAt, state.winner]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setShowQuitConfirm(true);
      return true;
    });
    return () => sub.remove();
  }, []);

  const onPlayCard = (cardId: string) => {
    if (state.turn !== 0 || state.winner !== null) return;
    const card = human.hand.find((candidate) => candidate.id === cardId);
    if (!card || !legalIds.has(cardId)) return;
    if (card.action === 'ChooseSuit') {
      setPendingSuitChoiceId(cardId);
      setShowSuitPicker(true);
      return;
    }
    const result = playCard(state, 0, cardId);
    if (result.ok) setState(result.state);
  };

  const chooseSuit = (suit: Suit) => {
    if (!pendingSuitChoiceId) return;
    const result = playCard(state, 0, pendingSuitChoiceId, { chosenSuit: suit });
    setShowSuitPicker(false);
    setPendingSuitChoiceId(null);
    if (result.ok) setState(result.state);
  };

  const onDraw = () => {
    if (state.turn !== 0 || state.winner !== null) return;
    setState(drawAndPass(state, 0));
  };

  const forfeit = async () => {
    setShowQuitConfirm(false);
    try {
      await api.post('/match/result', {
        match_id: matchId,
        won: false,
        cards_left: human.hand.length,
        duration_seconds: 0,
        coins_earned: 0,
        rank_points_delta: -10,
        xp_earned: 5,
      });
      await refresh();
    } catch {}
    router.replace('/(tabs)/lobby');
  };

  if (!matchId) {
    return (
      <LinearGradient colors={['#053827', '#0B5A3C', '#07261D']} style={{ flex: 1 }}>
        <SafeAreaView style={styles.centered}>
          <Text style={styles.status}>Opening match...</Text>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  const myTurn = state.turn === 0 && state.winner === null;

  // Get opponents - indices 1, 2, 3
  const leftOpponent = state.players[1];
  const topOpponent = state.players[2];
  const rightOpponent = state.players[3];

  return (
    <LinearGradient colors={['#053827', '#0B5A3C', '#07261D']} style={{ flex: 1 }}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.phoneFrame}>
          {/* Top Bar - Leave game and Score only */}
          <View style={styles.topBar}>
            <TouchableOpacity onPress={() => setShowQuitConfirm(true)} style={styles.leaveBtn}>
              <Ionicons name="exit-outline" color={theme.colors.text} size={18} />
              <Text style={styles.leaveText}>Izađi</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowScore((current) => !current)} style={styles.scoreBtn}>
              <Text style={styles.scoreBtnText}>Rezultat</Text>
              <Ionicons name={showScore ? 'chevron-up' : 'chevron-down'} size={16} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          {/* Score Panel */}
          {showScore ? (
            <View style={styles.scorePanel}>
              {state.players.map((player) => (
                <View key={player.id} style={styles.scoreRow}>
                  <Image 
                    source={{ uri: getDiceBearAvatar(player.avatarName, 'adventurer') }} 
                    style={styles.scoreAvatar}
                  />
                  <Text style={styles.scoreName} numberOfLines={1}>{player.name}</Text>
                  <View style={styles.scoreCards}>
                    <Ionicons name="albums" size={13} color="#F7D98C" />
                    <Text style={styles.scoreCardsText}>{player.hand.length}</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          {/* Main Game Board */}
          <View style={styles.boardShell}>
            <View style={styles.tableSurface}>
              {/* Game Layout: Left - Center (Top & Table) - Right */}
              <View style={styles.gameLayout}>
                {/* Left Opponent */}
                <View style={styles.sideColumn}>
                  {leftOpponent && (
                    <OpponentCard 
                      player={leftOpponent} 
                      isActive={state.turn === 1}
                      position="left"
                    />
                  )}
                </View>

                {/* Center Column: Top Opponent + Table */}
                <View style={styles.centerColumn}>
                  {/* Top Opponent */}
                  {topOpponent && (
                    <View style={styles.topOpponentContainer}>
                      <OpponentCard 
                        player={topOpponent} 
                        isActive={state.turn === 2}
                        position="top"
                      />
                    </View>
                  )}

                  {/* Table Center - Draw Pile & Discard Pile */}
                  <View style={[styles.tableCenter, compact && styles.tableCenterCompact]}>
                    <PressScale onPress={onDraw} disabled={!myTurn} style={{ opacity: myTurn ? 1 : 0.6 }}>
                      <View style={styles.drawPileWrap}>
                        <View style={[styles.cardShadow, { width: tableCardWidth, height: tableCardWidth * 1.45 }]} />
                        <CardView card={{ id: 'back', suit: 'Hearts', value: 'A', action: null }} hidden width={tableCardWidth} />
                      </View>
                    </PressScale>

                    <View style={{ width: compact ? 14 : 20 }} />

                    <View style={styles.discardWrap}>
                      <CardView card={top} width={tableCardWidth + 10} />
                    </View>
                  </View>
                </View>

                {/* Right Opponent */}
                <View style={styles.sideColumn}>
                  {rightOpponent && (
                    <OpponentCard 
                      player={rightOpponent} 
                      isActive={state.turn === 3}
                      position="right"
                    />
                  )}
                </View>
              </View>
            </View>
          </View>

          {/* Player's Hand - Cards are centered */}
          <View style={styles.handArea}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={[styles.handScroll, { paddingHorizontal: compact ? 10 : 14 }]}
            >
              {human.hand.map((card) => {
                const playable = legalIds.has(card.id) && myTurn;
                return (
                  <CardView
                    key={card.id}
                    card={card}
                    width={handCardWidth}
                    onPress={() => onPlayCard(card.id)}
                    disabled={!playable}
                    highlight={false}
                  />
                );
              })}
            </ScrollView>
          </View>

          {/* Suit Picker Modal */}
          <Modal transparent visible={showSuitPicker} animationType="fade" onRequestClose={() => { setShowSuitPicker(false); setPendingSuitChoiceId(null); }}>
            <View style={styles.modalRoot}>
              <View style={styles.modalCard}>
                <Text style={styles.modalTitle}>Izaberi boju za Žandara</Text>
                <View style={styles.suitGrid}>
                  {SUIT_LIST.map((suit) => (
                    <PressScale key={suit} style={[styles.suitBtn, { borderColor: suitAccentColor(suit) }]} onPress={() => chooseSuit(suit)}>
                      <Text style={[styles.suitBtnGlyph, { color: suitColor(suit) }]}>{suitGlyph(suit)}</Text>
                      <Text style={styles.suitBtnLabel}>{getSuitNameSr(suit)}</Text>
                    </PressScale>
                  ))}
                </View>
                <TouchableOpacity style={styles.modalSecondaryBtn} onPress={() => { setShowSuitPicker(false); setPendingSuitChoiceId(null); }}>
                  <Text style={styles.modalSecondaryText}>Otkaži</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {/* Quit Confirm Modal */}
          <Modal transparent visible={showQuitConfirm} animationType="fade" onRequestClose={() => setShowQuitConfirm(false)}>
            <View style={styles.modalRoot}>
              <View style={styles.modalCard}>
                <Text style={styles.modalTitle}>Napusti meč?</Text>
                <Text style={styles.modalText}>Izgubićeš meč i 10 RP poena.</Text>
                <TouchableOpacity style={styles.modalPrimaryBtn} onPress={() => setShowQuitConfirm(false)}>
                  <Text style={styles.modalPrimaryText}>Nastavi igru</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalDangerBtn} onPress={forfeit}>
                  <Text style={styles.modalPrimaryText}>Napusti igru</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

// Helper function for Serbian suit names
function getSuitNameSr(suit: Suit): string {
  switch (suit) {
    case 'Hearts': return 'Herc';
    case 'Diamonds': return 'Karo';
    case 'Clubs': return 'Tref';
    case 'Spades': return 'Pik';
  }
}

// Opponent Card Component with DiceBear Avatar
interface OpponentCardProps {
  player: {
    id: string;
    name: string;
    avatarName: string;
    avatarColor: string;
    hand: { id: string }[];
  };
  isActive: boolean;
  position: 'left' | 'top' | 'right';
}

function OpponentCard({ player, isActive, position }: OpponentCardProps) {
  const isHorizontal = position === 'left' || position === 'right';
  
  return (
    <View
      style={[
        styles.opponentSlot,
        isActive && styles.opponentSlotActive,
        isHorizontal && styles.opponentSlotHorizontal,
      ]}
    >
      <Image 
        source={{ uri: getDiceBearAvatar(player.avatarName, 'adventurer') }} 
        style={styles.avatar}
      />
      <Text style={[styles.opponentName, isActive && { color: '#FFE08A' }]} numberOfLines={1}>
        {player.name}
      </Text>
      <View style={styles.cardCountRow}>
        <Ionicons name="albums" size={13} color="#F7D98C" />
        <Text style={styles.opponentCount}>{player.hand.length}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  safe: { flex: 1, alignItems: 'center' },
  phoneFrame: { flex: 1, width: '100%', maxWidth: 430 },
  
  // Top Bar
  topBar: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 12, 
    paddingVertical: 8, 
  },
  leaveBtn: { 
    height: 40, 
    borderRadius: 20, 
    paddingHorizontal: 14, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: 6, 
    backgroundColor: 'rgba(5,31,24,0.88)', 
    borderWidth: 1, 
    borderColor: 'rgba(236,255,244,0.28)' 
  },
  leaveText: { color: theme.colors.text, fontSize: 13, fontWeight: '800' },
  scoreBtn: { 
    height: 40, 
    borderRadius: 20, 
    paddingHorizontal: 14, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: 4, 
    backgroundColor: 'rgba(5,31,24,0.88)', 
    borderWidth: 1, 
    borderColor: 'rgba(236,255,244,0.28)' 
  },
  scoreBtnText: { color: theme.colors.text, fontSize: 13, fontWeight: '800' },
  
  // Score Panel
  scorePanel: { 
    marginHorizontal: 12, 
    marginBottom: 8, 
    padding: 12, 
    borderRadius: 12, 
    backgroundColor: '#5B351C', 
    borderWidth: 2, 
    borderColor: '#D59B43', 
    gap: 8 
  },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  scoreAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#3A2210' },
  scoreName: { color: '#FFF2C4', fontSize: 13, fontWeight: '800', flex: 1 },
  scoreCards: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  scoreCardsText: { color: '#F7D98C', fontSize: 13, fontWeight: '800' },
  
  // Board
  boardShell: { 
    flex: 1, 
    marginHorizontal: 8, 
    marginBottom: 0, 
    padding: 6, 
    borderRadius: 14, 
    backgroundColor: '#7A4A1F', 
    borderWidth: 3, 
    borderColor: '#D59B43', 
    shadowColor: '#000', 
    shadowOpacity: 0.4, 
    shadowRadius: 12, 
    elevation: 8 
  },
  tableSurface: { 
    flex: 1, 
    borderRadius: 10, 
    backgroundColor: '#1B6B4A', 
    borderWidth: 2, 
    borderColor: '#0D3D2A', 
    overflow: 'hidden' 
  },
  
  // Game Layout - 3 columns
  gameLayout: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 8,
  },
  sideColumn: {
    width: 90,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  centerColumn: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  topOpponentContainer: {
    alignItems: 'center',
  },
  
  // Opponent Slots
  opponentSlot: { 
    backgroundColor: 'rgba(91,53,28,0.95)', 
    paddingHorizontal: 8, 
    paddingVertical: 10, 
    borderRadius: 10, 
    borderWidth: 2, 
    borderColor: '#A67C52', 
    alignItems: 'center', 
    minWidth: 80,
    shadowColor: '#000', 
    shadowOpacity: 0.3, 
    shadowRadius: 4, 
    elevation: 3 
  },
  opponentSlotHorizontal: {
    minWidth: 78,
  },
  opponentSlotActive: { 
    borderColor: '#FFE08A', 
    shadowColor: '#FFE08A', 
    shadowOpacity: 0.6, 
    shadowRadius: 10, 
    elevation: 6,
    backgroundColor: 'rgba(91,53,28,1)', 
  },
  avatar: { 
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    marginBottom: 6,
    backgroundColor: '#3A2210',
    borderWidth: 2,
    borderColor: '#D59B43',
  },
  opponentName: { 
    color: theme.colors.text, 
    fontSize: 11, 
    fontWeight: '800', 
    maxWidth: 70,
    textAlign: 'center',
  },
  cardCountRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  opponentCount: { color: '#F7D98C', fontSize: 12, fontWeight: '800' },
  
  // Table Center
  tableCenter: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center',
  },
  tableCenterCompact: { },
  drawPileWrap: { alignItems: 'center', position: 'relative' },
  cardShadow: { 
    position: 'absolute', 
    top: 5, 
    left: 5, 
    borderRadius: 8, 
    backgroundColor: '#03150F', 
    opacity: 0.5 
  },
  discardWrap: { alignItems: 'center' },
  
  // Status
  status: { color: '#FDE68A', fontSize: 14, fontWeight: '800', textAlign: 'center' },
  
  // Hand Area
  handArea: { 
    backgroundColor: '#4A2614', 
    paddingTop: 10, 
    paddingBottom: 12, 
    borderTopWidth: 3, 
    borderTopColor: '#D59B43' 
  },
  handScroll: { 
    gap: 8, 
    paddingVertical: 4, 
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
  },
  
  // Modals
  modalRoot: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: 22, width: '100%', maxWidth: 360, borderWidth: 1, borderColor: theme.colors.border },
  modalTitle: { color: theme.colors.text, fontSize: 20, fontWeight: '900', marginBottom: 14, textAlign: 'center' },
  modalText: { color: theme.colors.textMuted, fontSize: 14, textAlign: 'center', marginBottom: 8 },
  suitGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 14 },
  suitBtn: { width: '48%', marginVertical: 6, paddingVertical: 18, alignItems: 'center', borderWidth: 2, borderRadius: theme.radius.md, backgroundColor: '#F8FAFC' },
  suitBtnGlyph: { fontSize: 32 },
  suitBtnLabel: { color: '#0E0B1F', fontSize: 14, fontWeight: '800', marginTop: 4 },
  modalPrimaryBtn: { marginTop: 14, minHeight: 48, borderRadius: theme.radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.primary },
  modalDangerBtn: { marginTop: 10, minHeight: 48, borderRadius: theme.radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: '#991B1B' },
  modalPrimaryText: { color: '#fff', fontSize: 15, fontWeight: '900' },
  modalSecondaryBtn: { minHeight: 44, borderRadius: theme.radius.pill, alignItems: 'center', justifyContent: 'center' },
  modalSecondaryText: { color: theme.colors.accent, fontSize: 15, fontWeight: '800' },
});
