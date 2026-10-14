import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { createFamily, fetchState, isUnchanged, issueCode, joinFamily, postOps, type ShareOp } from '../lib/share';
import { SHARE_STATUS_LABEL, useShareStatus } from '../lib/shareStatus';
import { useKeyboardGap } from '../lib/useKeyboardGap';
import { useAppStore } from '../store/useAppStore';
import { colors, radius, screenPadding, spacing, typography } from '../theme';
import { PrimaryButton } from './PrimaryButton';

interface Props {
  visible: boolean;
  onClose: () => void;
  onToast: (message: string) => void;
}

/** 从异常里取出后端给的错误码（不认就直接当网络问题处理） */
function errorCode(value: unknown): string {
  if (value && typeof value === 'object' && 'code' in value && typeof value.code === 'string') {
    return value.code;
  }
  return '';
}

/**
 * 共享清单的配对面板。
 *
 * 两个人用同一份清单：一个人「创建」拿到 6 位家庭码，另一个人输入这个码加入。
 * 加入以后，买菜清单和冰箱库存就是两边共用的了。
 */
export function ShareSheet({ visible, onClose, onToast }: Props) {
  const insets = useSafeAreaInsets();
  const keyboardGap = useKeyboardGap(visible);

  const token = useAppStore((state) => state.shareToken);
  const syncedAt = useAppStore((state) => state.shareSyncedAt);
  const setShareSession = useAppStore((state) => state.setShareSession);
  const applySharedState = useAppStore((state) => state.applySharedState);
  const shareStatus = useShareStatus();

  const [inviteCode, setInviteCode] = useState('');
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) {
      setInput('');
      setError('');
    }
  }, [visible]);

  /** 创建者的本机清单不为空时，把它推上去当共享清单的初始内容 */
  const pushLocalState = async (sessionToken: string) => {
    const local = useAppStore.getState();
    const ops: ShareOp[] = local.shopping.map(
      (item) => ({ kind: 'shopping', action: 'addAmount', item }) as ShareOp,
    );
    if (local.pantry.length > 0) {
      ops.push({ kind: 'pantry', action: 'add', names: local.pantry, expiry: local.pantryExpiry });
    }
    if (ops.length === 0) return;
    const merged = await postOps(sessionToken, ops, `init-${Date.now().toString(36)}`);
    applySharedState(merged);
  };

  const handleCreate = async () => {
    setBusy(true);
    setError('');
    try {
      const session = await createFamily();
      await pushLocalState(session.token);
      setShareSession({ familyId: session.familyId, token: session.token });
      setInviteCode(session.code);
      onToast('共享清单已建好，把家庭码发给另一个人');
    } catch (caught) {
      setError('连不上服务器，检查一下网络再试');
    } finally {
      setBusy(false);
    }
  };

  const handleJoin = async () => {
    const value = input.trim();
    if (!/^\d{6}$/.test(value)) {
      setError('家庭码是 6 位数字');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const session = await joinFamily(value);
      setShareSession(session);
      const state = await fetchState(session.token);
      if (!isUnchanged(state)) applySharedState(state);
      onToast('已加入共享清单');
    } catch (caught) {
      const code = errorCode(caught);
      if (code === 'code_expired') setError('这个家庭码过期了，让对方重新生成一个');
      else if (code === 'code_invalid') setError('家庭码不对，检查一下有没有输错');
      else if (code === 'too_many_attempts') setError('试得有点多，过一会儿再试');
      else setError('连不上服务器，检查一下网络再试');
    } finally {
      setBusy(false);
    }
  };

  const handleNewCode = async () => {
    if (!token) return;
    setBusy(true);
    setError('');
    try {
      const result = await issueCode(token);
      setInviteCode(result.code);
    } catch (caught) {
      setError('连不上服务器，等会儿再试');
    } finally {
      setBusy(false);
    }
  };

  const handleLeave = () => {
    setShareSession(null);
    setInviteCode('');
    onToast('已取消共享，清单还是留在这台手机上');
  };

  const syncedText =
    syncedAt > 0
      ? `上次同步：${new Date(syncedAt).toLocaleTimeString('zh-CN', { hour12: false })}`
      : '还没同步过';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View
        style={[
          styles.sheet,
          { paddingBottom: Math.max(insets.bottom, spacing.lg), marginBottom: keyboardGap },
        ]}
      >
        <View style={styles.handle} />

        <View style={styles.header}>
          <Text style={styles.title}>共享清单</Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={22} color={colors.textSub} />
          </Pressable>
        </View>

        <Text style={styles.intro}>
          两个人共用同一份买菜清单和冰箱库存：谁加到清单里、谁勾掉、谁买回来入库，对方过几秒就能看到。
          收藏、做饭记录、忌口这些还是各自留自己手机上。
        </Text>

        {token ? (
          <View style={styles.box}>
            <View style={styles.statusRow}>
              <View
                style={[
                  styles.dot,
                  shareStatus.status === 'online'
                    ? styles.dotOnline
                    : shareStatus.status === 'invalid'
                      ? styles.dotBad
                      : styles.dotIdle,
                ]}
              />
              <Text style={styles.statusText}>{SHARE_STATUS_LABEL[shareStatus.status]}</Text>
              {shareStatus.status === 'syncing' ? (
                <ActivityIndicator size="small" color={colors.textSub} />
              ) : null}
            </View>
            <Text style={styles.statusHint}>{shareStatus.message || syncedText}</Text>

            {inviteCode.length > 0 ? (
              <View style={styles.codeBox}>
                <Text style={styles.codeLabel}>把这串数字告诉另一个人</Text>
                <Text style={styles.codeValue} selectable>
                  {inviteCode}
                </Text>
                <Text style={styles.codeHint}>家庭码 24 小时内有效，用过一次就作废</Text>
              </View>
            ) : null}

            <PrimaryButton
              label={inviteCode.length > 0 ? '再生成一个家庭码' : '生成家庭码（给另一个人）'}
              icon="key-outline"
              variant="outline"
              loading={busy}
              onPress={() => void handleNewCode()}
              style={styles.action}
            />

            <Pressable onPress={handleLeave} hitSlop={8} style={({ pressed }) => pressed && styles.pressed}>
              <Text style={styles.leave}>取消共享</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.box}>
            <PrimaryButton
              label="我来创建（用我现在的清单）"
              icon="add-circle-outline"
              loading={busy}
              onPress={() => void handleCreate()}
              style={styles.action}
            />

            <View style={styles.orRow}>
              <View style={styles.orLine} />
              <Text style={styles.orText}>或者，加入对方建好的</Text>
              <View style={styles.orLine} />
            </View>

            <View style={styles.inputRow}>
              <TextInput
                value={input}
                onChangeText={(text) => setInput(text.replace(/[^0-9]/g, '').slice(0, 6))}
                placeholder="输入 6 位家庭码"
                placeholderTextColor={colors.textFaint}
                keyboardType="number-pad"
                maxLength={6}
                style={styles.input}
                returnKeyType="done"
                onSubmitEditing={() => void handleJoin()}
              />
              <PrimaryButton
                label="加入"
                onPress={() => void handleJoin()}
                disabled={input.trim().length !== 6}
                style={styles.joinButton}
              />
            </View>
          </View>
        )}

        {error.length > 0 ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.scrim,
  },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: spacing.sm,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: screenPadding,
  },
  title: {
    ...typography.sectionTitle,
    color: colors.text,
  },
  intro: {
    ...typography.caption,
    color: colors.textSub,
    lineHeight: 19,
    paddingHorizontal: screenPadding,
    marginTop: spacing.sm,
  },
  box: {
    paddingHorizontal: screenPadding,
    marginTop: spacing.lg,
  },
  action: {
    height: 48,
  },
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.lg,
  },
  orLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  orText: {
    ...typography.caption,
    color: colors.textFaint,
    paddingHorizontal: spacing.md,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    ...typography.body,
    letterSpacing: 2,
    color: colors.text,
    marginRight: spacing.md,
  },
  joinButton: {
    width: 92,
    height: 48,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    marginRight: spacing.sm,
  },
  dotOnline: {
    backgroundColor: colors.success,
  },
  dotIdle: {
    backgroundColor: colors.warning,
  },
  dotBad: {
    backgroundColor: colors.primary,
  },
  statusText: {
    ...typography.body,
    fontWeight: '700',
    color: colors.text,
    marginRight: spacing.sm,
  },
  statusHint: {
    ...typography.caption,
    color: colors.textFaint,
    marginTop: 4,
  },
  codeBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  codeLabel: {
    ...typography.caption,
    color: colors.textSub,
  },
  codeValue: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: 8,
    color: colors.primary,
    marginTop: spacing.sm,
  },
  codeHint: {
    ...typography.caption,
    color: colors.textFaint,
    marginTop: spacing.sm,
  },
  leave: {
    ...typography.label,
    color: colors.textSub,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  error: {
    ...typography.caption,
    color: colors.primary,
    paddingHorizontal: screenPadding,
    marginTop: spacing.md,
  },
  pressed: {
    opacity: 0.7,
  },
});
