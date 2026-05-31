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
  Animated,
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
const getDiceBearAvatar = (seed: string) => {
  return `https://api.dicebear.com/7.x/adventurer/png?seed=${encodeURIComponent(seed)}&size=64`;
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

  const compact = width < 380 || height < 700;
  const handCardWidth = compact ? 58 : width < 430 ? 68 : 74;
  const tableCardWidth = compact ? 70 : 85;

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
  const opponents = [state.players[1], state.players[2], state.players[3]];

  return (
    <LinearGradient colors={['#053827', '#0B5A3C', '#07261D']} style={{ flex: 1 }}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.phoneFrame}>
          {/* Top Bar */}
          <View style={styles.topBar}>
            <TouchableOpacity onPress={() => setShowQuitConfirm(true)} style={styles.topBtn}>
              <Ionicons name="exit-outline" color="#fff" size={18} />
              <Text style={styles.topBtnText}>Leave</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowScore((c) => !c)} style={styles.topBtn}>
              <Text style={styles.topBtnText}>Score</Text>
              <Ionicons name={showScore ? 'chevron-up' : 'chevron-down'} size={16} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Score Panel - Collapsible */}
          {showScore && (
            <View style={styles.scorePanel}>
              {state.players.map((player, idx) => (
                <View key={player.id} style={[styles.scoreRow, idx === state.turn && styles.scoreRowActive]}>
                  <Image source={{ uri: getDiceBearAvatar(player.avatarName) }} style={styles.scoreAvatar} />
                  <Text style={[styles.scoreName, idx === 0 && styles.scoreNameYou]} numberOfLines={1}>
                    {idx === 0 ? 'You' : player.name}
                  </Text>
                  <View style={styles.cardsBadge}>
                    <Text style={styles.cardsBadgeText}>{player.hand.length}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Main Game Area */}
          <View style={styles.gameArea}>
            {/* Opponents Row - All 3 at top */}
            <View style={styles.opponentsRow}>
              {opponents.map((opponent, idx) => (
                <View 
                  key={opponent.id} 
                  style={[
                    styles.opponentSlot,
                    state.turn === idx + 1 && styles.opponentSlotActive,
                  ]}
                >
                  <Image source={{ uri: getDiceBearAvatar(opponent.avatarName) }} style={styles.opponentAvatar} />
                  <Text style={styles.opponentName} numberOfLines={1}>{opponent.name}</Text>
                  <View style={styles.opponentCards}>
                    <Ionicons name="albums-outline" size={12} color="#FFD700" />
                    <Text style={styles.opponentCardsText}>{opponent.hand.length}</Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Table Center - Draw & Discard */}
            <View style={styles.tableCenter}>
              <PressScale onPress={onDraw} disabled={!myTurn} style={{ opacity: myTurn ? 1 : 0.6 }}>
                <View style={styles.drawPile}>
                  <CardView card={{ id: 'back', suit: 'Hearts', value: 'A', action: null }} hidden width={tableCardWidth} />
                  <Text style={styles.drawLabel}>Draw</Text>
                </View>
              </PressScale>

              <View style={styles.discardPile}>
                <CardView card={top} width={tableCardWidth + 8} />
              </View>
            </View>

            {/* Turn Indicator */}
            <View style={styles.turnIndicator}>
              <Text style={[styles.turnText, myTurn && styles.turnTextActive]}>
                {myTurn ? "Your Turn" : `${state.players[state.turn].name}'s Turn`}
              </Text>
            </View>
          </View>

          {/* Player's Hand */}
          <View style={styles.handArea}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.handScroll}
            >
              {human.hand.map((card) => {
                const playable = legalIds.has(card.id) && myTurn;
                return (
                  <View key={card.id} style={styles.cardWrapper}>
                    <CardView
                      card={card}
                      width={handCardWidth}
                      onPress={() => onPlayCard(card.id)}
                      disabled={!playable}
                    />
                  </View>
                );
              })}
            </ScrollView>
          </View>

          {/* Suit Picker Modal */}
          <Modal transparent visible={showSuitPicker} animationType="fade" onRequestClose={() => { setShowSuitPicker(false); setPendingSuitChoiceId(null); }}>
            <View style={styles.modalOverlay}>
              <View style={styles.modalCard}>
                <Text style={styles.modalTitle}>Choose Suit</Text>
                <View style={styles.suitGrid}>
                  {SUIT_LIST.map((suit) => (
                    <TouchableOpacity 
                      key={suit} 
                      style={[styles.suitBtn, { borderColor: suitAccentColor(suit) }]} 
                      onPress={() => chooseSuit(suit)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.suitGlyph, { color: suitColor(suit) }]}>{suitGlyph(suit)}</Text>
                      <Text style={styles.suitLabel}>{suit}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowSuitPicker(false); setPendingSuitChoiceId(null); }}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {/* Quit Confirm Modal */}
          <Modal transparent visible={showQuitConfirm} animationType="fade" onRequestClose={() => setShowQuitConfirm(false)}>
            <View style={styles.modalOverlay}>
              <View style={styles.modalCard}>
                <Text style={styles.modalTitle}>Leave Match?</Text>
                <Text style={styles.modalText}>You will lose the match and 10 RP.</Text>
                <TouchableOpacity style={styles.primaryBtn} onPress={() => setShowQuitConfirm(false)}>
                  <Text style={styles.primaryBtnText}>Continue Playing</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.dangerBtn} onPress={forfeit}>
                  <Text style={styles.dangerBtnText}>Leave Game</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  safe: { flex: 1 },
  phoneFrame: { flex: 1, width: '100%', maxWidth: 500, alignSelf: 'center' },
  status: { color: '#FDE68A', fontSize: 16, fontWeight: '700' },

  // Top Bar
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  topBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 20,
  },
  topBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  // Score Panel
  scorePanel: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  scoreRowActive: {
    backgroundColor: 'rgba(255,215,0,0.2)',
  },
  scoreAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#333' },
  scoreName: { flex: 1, marginLeft: 12, color: '#fff', fontSize: 14, fontWeight: '600' },
  scoreNameYou: { color: '#FFD700' },
  cardsBadge: {
    backgroundColor: '#1E40AF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  cardsBadgeText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  // Game Area
  gameArea: {
    flex: 1,
    marginHorizontal: 8,
    backgroundColor: '#1B6B4A',
    borderRadius: 16,
    borderWidth: 4,
    borderColor: '#0D3D2A',
    overflow: 'hidden',
  },

  // Opponents Row
  opponentsRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  opponentSlot: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    minWidth: 90,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  opponentSlotActive: {
    borderColor: '#FFD700',
    backgroundColor: 'rgba(255,215,0,0.15)',
  },
  opponentAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#222', marginBottom: 6 },
  opponentName: { color: '#fff', fontSize: 12, fontWeight: '700', maxWidth: 80, textAlign: 'center' },
  opponentCards: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  opponentCardsText: { color: '#FFD700', fontSize: 12, fontWeight: '700' },

  // Table Center
  tableCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  drawPile: { alignItems: 'center' },
  drawLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '600', marginTop: 6 },
  discardPile: { alignItems: 'center' },

  // Turn Indicator
  turnIndicator: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  turnText: { color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: '600' },
  turnTextActive: { color: '#FFD700', fontWeight: '800' },

  // Hand Area
  handArea: {
    backgroundColor: '#2D1810',
    paddingVertical: 12,
    borderTopWidth: 3,
    borderTopColor: '#8B4513',
  },
  handScroll: {
    paddingHorizontal: 16,
    gap: 6,
    alignItems: 'center',
  },
  cardWrapper: {
    marginHorizontal: 2,
  },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#1F2937',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 340,
  },
  modalTitle: { color: '#fff', fontSize: 20, fontWeight: '800', textAlign: 'center', marginBottom: 16 },
  modalText: { color: '#9CA3AF', fontSize: 14, textAlign: 'center', marginBottom: 20 },
  suitGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center', marginBottom: 16 },
  suitBtn: {
    width: '45%',
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 3,
  },
  suitGlyph: { fontSize: 32, fontWeight: '900' },
  suitLabel: { color: '#374151', fontSize: 14, fontWeight: '700', marginTop: 4 },
  cancelBtn: { paddingVertical: 12, alignItems: 'center' },
  cancelBtnText: { color: '#60A5FA', fontSize: 15, fontWeight: '700' },
  primaryBtn: {
    backgroundColor: '#10B981',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  dangerBtn: {
    backgroundColor: '#DC2626',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  dangerBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
