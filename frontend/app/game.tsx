import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Alert, BackHandler, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../src/theme';
import { CardView } from '../src/components/Card';
import { Button } from '../src/components/UI';
import {
  GameState, newGame, topCard, legalCardsFor, playCard, drawAndPass, botTurn,
  suitColor, suitGlyph, actionLabel, SUIT_LIST, Suit,
} from '../src/game/engine';
import { useAuth } from '../src/services/auth';
import { api } from '../src/services/api';

export default function GameScreen() {
  const router = useRouter();
  const { user, refresh } = useAuth();
  const [state, setState] = useState<GameState>(() => newGame(user?.username || 'You'));
  const [showSuitPicker, setShowSuitPicker] = useState(false);
  const [pendingWildId, setPendingWildId] = useState<string | null>(null);
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);
  const [endHandled, setEndHandled] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  const top = topCard(state);
  const human = state.players[0];
  const legalIds = useMemo(() => new Set(legalCardsFor(human, state).map((c) => c.id)), [state]);

  // Bot turn loop
  useEffect(() => {
    if (state.winner !== null) return;
    if (state.turn === 0) return;
    const t = setTimeout(() => {
      setState((s) => {
        if (s.winner !== null || s.turn === 0) return s;
        return botTurn(s, s.turn);
      });
    }, 900);
    return () => clearTimeout(t);
  }, [state.turn, state.winner]);

  // Match end handler
  useEffect(() => {
    if (state.winner === null || endHandled) return;
    setEndHandled(true);
    const won = state.winner === 0;
    const myCardsLeft = state.players[0].hand.length;
    const duration = Math.floor((Date.now() - state.startedAt) / 1000);
    const coins_earned = won ? 50 + Math.max(0, 30 - duration / 6 | 0) : 10;
    const rp_delta = won ? 30 : -10;
    const xp_earned = won ? 50 : 15;
    (async () => {
      try {
        await api.post('/match/result', {
          won, cards_left: myCardsLeft, duration_seconds: duration,
          coins_earned, rank_points_delta: rp_delta, xp_earned,
        });
        await refresh();
      } catch {}
      router.replace({
        pathname: '/results',
        params: {
          won: won ? '1' : '0',
          coins: String(coins_earned),
          rp: String(rp_delta),
          xp: String(xp_earned),
          duration: String(duration),
          cardsLeft: String(myCardsLeft),
          winnerName: state.players[state.winner].name,
        },
      });
    })();
  }, [state.winner]);

  // Hardware back -> confirm quit
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
    const card = human.hand.find((c) => c.id === cardId);
    if (!card) return;
    if (!legalIds.has(cardId)) return;
    if (card.action === 'Wild') {
      setPendingWildId(cardId);
      setShowSuitPicker(true);
      return;
    }
    const res = playCard(state, 0, cardId);
    if (res.ok) setState(res.state);
  };

  const chooseSuit = (s: Suit) => {
    if (!pendingWildId) return;
    const res = playCard(state, 0, pendingWildId, { chosenSuit: s });
    setShowSuitPicker(false);
    setPendingWildId(null);
    if (res.ok) setState(res.state);
  };

  const onDraw = () => {
    if (state.turn !== 0 || state.winner !== null) return;
    setState(drawAndPass(state, 0));
  };

  const myTurn = state.turn === 0 && state.winner === null;
  const mustDrawStack = state.pendingDraw > 0;

  return (
    <LinearGradient colors={[theme.colors.bg, theme.colors.bgAlt]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Top Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => setShowQuitConfirm(true)} style={styles.iconBtn}>
            <Ionicons name="close" color={theme.colors.text} size={26} />
          </TouchableOpacity>
          <View style={styles.suitIndicator}>
            <Text style={styles.suitIndicatorLabel}>SUIT</Text>
            <Text style={[styles.suitGlyph, { color: suitColor(state.currentSuit) }]}>
              {suitGlyph(state.currentSuit)} {state.currentSuit}
            </Text>
          </View>
          <View style={styles.iconBtn}>
            <Text style={styles.dirText}>{state.direction === 1 ? '↻' : '↺'}</Text>
          </View>
        </View>

        {/* Opponents */}
        <View style={styles.opponentsRow}>
          {state.players.slice(1).map((p, idx) => {
            const realIdx = idx + 1;
            const isActive = state.turn === realIdx;
            return (
              <View key={p.id} style={[styles.botSlot, isActive && styles.botSlotActive]}>
                <Text style={[styles.botName, isActive && { color: theme.colors.accent }]}>{p.name}</Text>
                <Text style={styles.botCount}>{p.hand.length} 🂠</Text>
                {isActive && <Text style={styles.thinking}>thinking…</Text>}
              </View>
            );
          })}
        </View>

        {/* Center: Draw pile + Discard */}
        <View style={styles.tableCenter}>
          <TouchableOpacity onPress={onDraw} disabled={!myTurn} activeOpacity={0.8} style={{ opacity: myTurn ? 1 : 0.6 }}>
            <View style={styles.drawPileWrap}>
              <View style={styles.cardShadow} />
              <CardView card={{ id: 'back', suit: 'Flame', value: null, action: null }} hidden width={70} />
              <Text style={styles.pileLabel}>Draw ({state.drawPile.length})</Text>
              {mustDrawStack && myTurn && (
                <View style={styles.pendingBadge}>
                  <Text style={styles.pendingText}>+{state.pendingDraw}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>

          <View style={{ width: 24 }} />

          <View style={styles.discardWrap}>
            <CardView card={top} width={86} />
            <Text style={styles.pileLabel}>Discard</Text>
          </View>
        </View>

        {/* Status / Log */}
        <View style={styles.statusRow}>
          <Text style={styles.status}>
            {state.winner !== null
              ? `${state.players[state.winner].name} wins!`
              : myTurn
                ? (mustDrawStack ? `Counter +${state.pendingDraw} or draw!` : 'Your turn — play or draw')
                : `${state.players[state.turn].name}'s turn`}
          </Text>
        </View>

        {/* Hand */}
        <View style={styles.handArea}>
          <Text style={styles.handLabel}>Your hand ({human.hand.length})</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, gap: 8, paddingVertical: 6 }}>
            {human.hand.map((c) => {
              const playable = legalIds.has(c.id) && myTurn;
              return (
                <CardView
                  key={c.id}
                  card={c}
                  onPress={() => onPlayCard(c.id)}
                  disabled={!playable}
                  highlight={playable}
                />
              );
            })}
          </ScrollView>
          <View style={styles.handActions}>
            <Button title={mustDrawStack ? `Take +${state.pendingDraw}` : 'Draw'} variant="secondary" small onPress={onDraw} disabled={!myTurn} />
          </View>
        </View>

        {/* Suit Picker Modal */}
        <Modal transparent visible={showSuitPicker} animationType="fade" onRequestClose={() => { setShowSuitPicker(false); setPendingWildId(null); }}>
          <View style={styles.modalRoot}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Choose a suit</Text>
              <View style={styles.suitGrid}>
                {SUIT_LIST.map((s) => (
                  <TouchableOpacity key={s} style={[styles.suitBtn, { borderColor: suitColor(s) }]} onPress={() => chooseSuit(s)}>
                    <Text style={[styles.suitBtnGlyph, { color: suitColor(s) }]}>{suitGlyph(s)}</Text>
                    <Text style={styles.suitBtnLabel}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Button title="Cancel" variant="ghost" small onPress={() => { setShowSuitPicker(false); setPendingWildId(null); }} />
            </View>
          </View>
        </Modal>

        {/* Quit Confirm Modal */}
        <Modal transparent visible={showQuitConfirm} animationType="fade" onRequestClose={() => setShowQuitConfirm(false)}>
          <View style={styles.modalRoot}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Quit match?</Text>
              <Text style={styles.modalText}>You'll forfeit the match and lose 10 RP.</Text>
              <View style={{ height: 12 }} />
              <Button title="Resume" variant="primary" onPress={() => setShowQuitConfirm(false)} fullWidth />
              <View style={{ height: 8 }} />
              <Button title="Forfeit" variant="danger" onPress={async () => {
                setShowQuitConfirm(false);
                try { await api.post('/match/result', { won: false, cards_left: human.hand.length, duration_seconds: 0, coins_earned: 0, rank_points_delta: -10, xp_earned: 5 }); await refresh(); } catch {}
                router.replace('/(tabs)/lobby');
              }} fullWidth />
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 8 },
  iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  dirText: { color: theme.colors.text, fontSize: 22, fontWeight: '900' },
  suitIndicator: { alignItems: 'center', backgroundColor: theme.colors.surface, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: theme.colors.border },
  suitIndicatorLabel: { color: theme.colors.textMuted, fontSize: 9, letterSpacing: 1.5, fontWeight: '700' },
  suitGlyph: { fontSize: 16, fontWeight: '900' },
  opponentsRow: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 8, marginTop: 6 },
  botSlot: { backgroundColor: theme.colors.surface, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', minWidth: 90 },
  botSlotActive: { borderColor: theme.colors.accent, shadowColor: theme.colors.accent, shadowOpacity: 0.6, shadowRadius: 8, elevation: 4 },
  botName: { color: theme.colors.text, fontSize: 12, fontWeight: '800' },
  botCount: { color: theme.colors.textMuted, fontSize: 14, fontWeight: '700', marginTop: 2 },
  thinking: { color: theme.colors.accent, fontSize: 9, marginTop: 2, fontStyle: 'italic' },
  tableCenter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 18, marginBottom: 4 },
  drawPileWrap: { alignItems: 'center', position: 'relative' },
  cardShadow: { position: 'absolute', top: 4, left: 4, width: 70, height: 70 * 1.45, borderRadius: 10, backgroundColor: theme.colors.primaryDark, opacity: 0.5 },
  discardWrap: { alignItems: 'center' },
  pileLabel: { color: theme.colors.textMuted, fontSize: 11, marginTop: 6 },
  pendingBadge: { position: 'absolute', top: -6, right: -10, backgroundColor: theme.colors.danger, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  pendingText: { color: '#fff', fontWeight: '900', fontSize: 12 },
  statusRow: { alignItems: 'center', marginTop: 8, marginBottom: 4 },
  status: { color: theme.colors.accent, fontSize: 14, fontWeight: '800' },
  handArea: { marginTop: 'auto', backgroundColor: 'rgba(30,23,64,0.6)', paddingTop: 8, paddingBottom: 8, borderTopWidth: 1, borderTopColor: theme.colors.border },
  handLabel: { color: theme.colors.textMuted, fontSize: 11, letterSpacing: 1.2, fontWeight: '700', paddingHorizontal: 16 },
  handActions: { flexDirection: 'row', justifyContent: 'center', marginTop: 6 },
  modalRoot: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: 20, width: '100%', maxWidth: 360, borderWidth: 1, borderColor: theme.colors.border },
  modalTitle: { color: theme.colors.text, fontSize: 20, fontWeight: '900', marginBottom: 12, textAlign: 'center' },
  modalText: { color: theme.colors.textMuted, fontSize: 13, textAlign: 'center' },
  suitGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 12 },
  suitBtn: { width: '48%', marginVertical: 6, paddingVertical: 18, alignItems: 'center', borderWidth: 2, borderRadius: theme.radius.md, backgroundColor: theme.colors.bgAlt },
  suitBtnGlyph: { fontSize: 30 },
  suitBtnLabel: { color: theme.colors.text, fontSize: 13, fontWeight: '800', marginTop: 4 },
});
