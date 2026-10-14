import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { PantryEntry } from '../lib/pantry';
import { colors, radius, screenPadding, spacing, typography } from '../theme';

interface Props {
  visible: boolean;
  entries: PantryEntry[];
  onClose: () => void;
  onShift: (name: string, days: number) => void;
  onRemove: (name: string) => void;
}

const TONE_COLOR: Record<string, string> = {
  expired: colors.primary,
  today: colors.warning,
  soon: colors.warning,
  fresh: colors.textSub,
};

/** 「管理保质期」弹层：一样一样加减天数，或者直接标记吃掉 */
export function PantryExpirySheet({ visible, entries, onClose, onShift, onRemove }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
        <View style={styles.handle} />

        <View style={styles.header}>
          <Text style={styles.title}>保质期</Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={22} color={colors.textSub} />
          </Pressable>
        </View>

        <Text style={styles.intro}>
          按食材种类给的默认天数：蔬菜 5 天、肉蛋 3 天、豆制品 2 天、调味 45 天、主食 30 天。快过期和已过期的排在最前面。
        </Text>

        <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          {entries.length === 0 ? (
            <Text style={styles.empty}>冰箱里还没有东西，先去上面勾几样。</Text>
          ) : (
            entries.map((entry) => (
              <View key={entry.name} style={styles.row}>
                <View style={styles.rowTop}>
                  <Text style={styles.name} numberOfLines={1}>
                    {entry.name}
                  </Text>
                  <Text style={[styles.status, { color: TONE_COLOR[entry.info?.tone ?? 'fresh'] }]}>
                    {entry.info?.label ?? '没记日期'}
                  </Text>
                </View>
                <Text style={styles.meta}>
                  {entry.group}
                  {entry.expiry ? ` · ${formatDateLabel(entry.expiry)}到期` : ''}
                </Text>

                <View style={styles.actions}>
                  <Pressable
                    onPress={() => onShift(entry.name, -1)}
                    style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
                  >
                    <Ionicons name="remove" size={14} color={colors.primary} />
                    <Text style={styles.actionText}>1 天</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => onShift(entry.name, 1)}
                    style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
                  >
                    <Ionicons name="add" size={14} color={colors.primary} />
                    <Text style={styles.actionText}>1 天</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => onRemove(entry.name)}
                    style={({ pressed }) => [styles.removeButton, pressed && styles.pressed]}
                  >
                    <Text style={styles.removeText}>吃掉了</Text>
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

function formatDateLabel(date: string): string {
  const [, month, day] = date.split('-');
  return `${Number(month)} 月 ${Number(day)} 日`;
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
    maxHeight: '82%',
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
    lineHeight: 18,
    paddingHorizontal: screenPadding,
    marginTop: spacing.sm,
  },
  list: {
    marginTop: spacing.md,
  },
  listContent: {
    paddingHorizontal: screenPadding,
    paddingBottom: spacing.md,
  },
  empty: {
    ...typography.body,
    fontSize: 13,
    color: colors.textSub,
    paddingVertical: spacing.xl,
    textAlign: 'center',
  },
  row: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  name: {
    ...typography.body,
    fontWeight: '700',
    color: colors.text,
    flexShrink: 1,
    marginRight: spacing.sm,
  },
  status: {
    ...typography.label,
    fontWeight: '800',
  },
  meta: {
    ...typography.caption,
    color: colors.textFaint,
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.md,
    marginRight: spacing.sm,
  },
  actionText: {
    ...typography.caption,
    color: colors.primary,
    marginLeft: 2,
  },
  removeButton: {
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: {
    ...typography.caption,
    color: colors.textSub,
  },
  pressed: {
    opacity: 0.7,
  },
});
