import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  BackHandler,
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
import { Button, PressScale } from '../src/components/UI';
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
  playerInitials,
} from '../src/game/engine';
import { useAuth } from '../src/services/auth';
import { api } from '../src/services/api';

const TURN_NOTES = ['checking cards', 'choosing a move', 'reading the table', 'thinking'];

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
  const [endHandled, setEndHandled] = useState(false);
  const [opponentNote, setOpponentNote] = useState(TURN_NOTES[0]);
  const stateRef = useRef(state);
  stateRef.current = state;

  const compact = width < 380 || height < 760;
  const handCardWidth = compact ? 64 : width < 430 ? 72 : 78;
  const tableCardWidth = compact ? 76 : 88;
  const opponentSlotWidth = Math.max(94, Math.min(128, (width - 48) / 3));

  const top = topCard(state);
  const human = state.players[0];
  const legalIds = useMemo(() => new Set(legalCardsFor(human, state).map((card) => card.id)), [human, state]);

  useEffect(() => {
    if (!matchId) router.replace('/(tabs)/lobby');
  }, [matchId, router]);

  useEffect(() => {
    if (state.winner !== null || state.turn === 0) return;
    const activePlayer = state.players[state.turn];
    setOpponentNote(TURN_NOTES[Math.floor(Math.random() * TURN_NOTES.length)]);
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
  const activeName = state.players[state.turn]?.name || '';

  return (
    <LinearGradient colors={['#053827', '#0B5A3C', '#07261D']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => setShowQuitConfirm(true)} style={styles.iconBtn}>
            <Ionicons name="close" color={theme.colors.text} size={25} />
          </TouchableOpacity>
          <View style={[styles.suitIndicator, { borderColor: suitAccentColor(state.currentSuit) }]}>
            <Text style={styles.suitIndicatorLabel}>ACTIVE SUIT</Text>
            <Text style={[styles.suitGlyph, { color: suitAccentColor(state.currentSuit) }]}>
              {suitGlyph(state.currentSuit)} {state.currentSuit}
            </Text>
          </View>
          <View style={styles.iconBtn}>
            <Text style={styles.tableBadgeText}>MM</Text>
          </View>
        </View>

        <View style={styles.boardShell}>
          <View style={styles.tableSurface}>
            <View style={styles.opponentsRow}>
              {state.players.slice(1).map((player, idx) => {
                const realIdx = idx + 1;
                const isActive = state.turn === realIdx;
                return (
                  <View
                    key={player.id}
                    style={[
                      styles.opponentSlot,
                      { width: opponentSlotWidth },
                      isActive && styles.opponentSlotActive,
                    ]}
                  >
                    <View style={[styles.avatar, { backgroundColor: player.avatarColor }]}>
                      <Text style={styles.avatarText}>{playerInitials(player.avatarName)}</Text>
                    </View>
                    <Text style={[styles.opponentName, isActive && { color: '#FFE08A' }]} numberOfLines={1}>
                      {player.name}
                    </Text>
                    <View style={styles.cardCountRow}>
                      <Ionicons name="albums" size={13} color="#F7D98C" />
                      <Text style={styles.opponentCount}>{player.hand.length}</Text>
                    </View>
                    {isActive ? <Text style={styles.turnNote}>{opponentNote}</Text> : null}
                  </View>
                );
              })}
            </View>

            <View style={[styles.tableCenter, compact && styles.tableCenterCompact]}>
              <PressScale onPress={onDraw} disabled={!myTurn} style={{ opacity: myTurn ? 1 : 0.6 }}>
                <View style={styles.drawPileWrap}>
                  <View style={[styles.cardShadow, { width: tableCardWidth, height: tableCardWidth * 1.45 }]} />
                  <CardView card={{ id: 'back', suit: 'Hearts', value: 'A', action: null }} hidden width={tableCardWidth} />
                  <Text style={styles.pileLabel}>Draw ({state.drawPile.length})</Text>
                </View>
              </PressScale>

              <View style={{ width: compact ? 18 : 28 }} />

              <View style={styles.discardWrap}>
                <CardView card={top} width={tableCardWidth + 10} />
                <Text style={styles.pileLabel}>Discard</Text>
              </View>
            </View>

            <View style={styles.statusRow}>
              <Text style={styles.status} numberOfLines={2}>
                {state.winner !== null
                  ? `${state.players[state.winner].name} wins!`
                  : myTurn
                    ? 'Your turn - match suit/rank or draw'
                    : `${activeName} is ${opponentNote}`}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.handArea}>
          <Text style={styles.handLabel}>Your hand ({human.hand.length})</Text>
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
                  highlight={playable}
                />
              );
            })}
          </ScrollView>
          <View style={styles.handActions}>
            <Button
              title="Draw"
              variant="secondary"
              small
              onPress={onDraw}
              disabled={!myTurn}
            />
          </View>
        </View>

        <Modal transparent visible={showSuitPicker} animationType="fade" onRequestClose={() => { setShowSuitPicker(false); setPendingSuitChoiceId(null); }}>
          <View style={styles.modalRoot}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Choose suit for Jack</Text>
              <View style={styles.suitGrid}>
                {SUIT_LIST.map((suit) => (
                  <PressScale key={suit} style={[styles.suitBtn, { borderColor: suitAccentColor(suit) }]} onPress={() => chooseSuit(suit)}>
                    <Text style={[styles.suitBtnGlyph, { color: suitColor(suit) }]}>{suitGlyph(suit)}</Text>
                    <Text style={styles.suitBtnLabel}>{suit}</Text>
                  </PressScale>
                ))}
              </View>
              <Button title="Cancel" variant="ghost" small onPress={() => { setShowSuitPicker(false); setPendingSuitChoiceId(null); }} />
            </View>
          </View>
        </Modal>

        <Modal transparent visible={showQuitConfirm} animationType="fade" onRequestClose={() => setShowQuitConfirm(false)}>
          <View style={styles.modalRoot}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Quit match?</Text>
              <Text style={styles.modalText}>You will forfeit the match and lose 10 RP.</Text>
              <View style={{ height: 12 }} />
              <Button title="Resume" variant="primary" onPress={() => setShowQuitConfirm(false)} fullWidth />
              <View style={{ height: 8 }} />
              <Button title="Forfeit" variant="danger" onPress={forfeit} fullWidth />
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 8 },
  iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(5,31,24,0.82)', borderWidth: 1, borderColor: 'rgba(236,255,244,0.22)' },
  tableBadgeText: { color: '#F7F3E8', fontSize: 14, fontWeight: '900' },
  suitIndicator: { alignItems: 'center', backgroundColor: 'rgba(5,31,24,0.82)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  suitIndicatorLabel: { color: '#B7D8C9', fontSize: 9, letterSpacing: 1.2, fontWeight: '700' },
  suitGlyph: { fontSize: 16, fontWeight: '900' },
  boardShell: { flex: 1, marginHorizontal: 10, marginBottom: 8, padding: 10, borderRadius: 12, backgroundColor: '#7A4A1F', borderWidth: 3, borderColor: '#D59B43', shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 10, elevation: 6 },
  tableSurface: { flex: 1, borderRadius: 8, backgroundColor: '#8D7A58', borderWidth: 2, borderColor: '#4C2E16', paddingVertical: 12, overflow: 'hidden' },
  opponentsRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingHorizontal: 8, marginTop: 4 },
  opponentSlot: { backgroundColor: '#5B351C', paddingHorizontal: 8, paddingVertical: 8, borderRadius: 8, borderWidth: 2, borderColor: '#F2B544', alignItems: 'center', minHeight: 112, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 4, elevation: 3 },
  opponentSlotActive: { borderColor: '#FFE08A', shadowColor: '#FFE08A', shadowOpacity: 0.5, shadowRadius: 8, elevation: 5 },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 5 },
  avatarText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  opponentName: { color: theme.colors.text, fontSize: 11, fontWeight: '900', maxWidth: '100%' },
  cardCountRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  opponentCount: { color: '#F7D98C', fontSize: 12, fontWeight: '800' },
  turnNote: { color: '#FFE08A', fontSize: 9, marginTop: 3, fontStyle: 'italic', textAlign: 'center' },
  tableCenter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 18, marginBottom: 4 },
  tableCenterCompact: { marginTop: 12 },
  drawPileWrap: { alignItems: 'center', position: 'relative' },
  cardShadow: { position: 'absolute', top: 5, left: 5, borderRadius: 8, backgroundColor: '#03150F', opacity: 0.45 },
  discardWrap: { alignItems: 'center' },
  pileLabel: { color: '#CDEBDD', fontSize: 11, marginTop: 6 },
  statusRow: { alignItems: 'center', marginTop: 8, marginBottom: 4, paddingHorizontal: 18 },
  status: { color: '#FDE68A', fontSize: 14, fontWeight: '800', textAlign: 'center' },
  handArea: { marginTop: 'auto', backgroundColor: '#21163E', paddingTop: 8, paddingBottom: 8, borderTopWidth: 1, borderTopColor: '#5C4A91' },
  handLabel: { color: '#B7D8C9', fontSize: 11, letterSpacing: 1.2, fontWeight: '700', paddingHorizontal: 16 },
  handScroll: { gap: 8, paddingVertical: 8, alignItems: 'center' },
  handActions: { flexDirection: 'row', justifyContent: 'center', marginTop: 2 },
  modalRoot: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: 20, width: '100%', maxWidth: 380, borderWidth: 1, borderColor: theme.colors.border },
  modalTitle: { color: theme.colors.text, fontSize: 20, fontWeight: '900', marginBottom: 12, textAlign: 'center' },
  modalText: { color: theme.colors.textMuted, fontSize: 13, textAlign: 'center' },
  suitGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 12 },
  suitBtn: { width: '48%', marginVertical: 6, paddingVertical: 16, alignItems: 'center', borderWidth: 2, borderRadius: theme.radius.md, backgroundColor: '#F8FAFC' },
  suitBtnGlyph: { fontSize: 30 },
  suitBtnLabel: { color: '#0E0B1F', fontSize: 13, fontWeight: '900', marginTop: 4 },
});
