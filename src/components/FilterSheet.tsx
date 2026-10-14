import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AVOID_OPTIONS } from '../constants';
import { colors, radius, spacing, typography } from '../theme';
import { Chip } from './Chip';
import { PrimaryButton } from './PrimaryButton';
import { Stepper } from './Stepper';

interface Props {
  visible: boolean;
  familySize: number;
  avoid: string[];
  onClose: () => void;
  onFamilySizeChange: (size: number) => void;
  onToggleAvoid: (tag: string) => void;
  onReset: () => void;
}

/** 从首页右上角进来的「筛选偏好」底部弹层 */
export function FilterSheet({
  visible,
  familySize,
  avoid,
  onClose,
  onFamilySizeChange,
  onToggleAvoid,
  onReset,
}: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
        <View style={styles.handle} />

        <View style={styles.header}>
          <Text style={styles.title}>筛选偏好</Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={22} color={colors.textSub} />
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
          <View style={styles.block}>
            <Text style={styles.blockTitle}>家里几个人吃</Text>
            <View style={styles.familyRow}>
              <Text style={styles.familyHint}>菜谱用量和买菜清单会按这个人数换算</Text>
              <Stepper value={familySize} min={1} max={8} onChange={onFamilySizeChange} suffix=" 人" />
            </View>
          </View>

          <View style={styles.block}>
            <Text style={styles.blockTitle}>不吃这些</Text>
            <Text style={styles.blockHint}>勾上以后，推荐和菜谱都会避开</Text>
            <View style={styles.chips}>
              {AVOID_OPTIONS.map((option) => (
                <Chip
                  key={option}
                  label={option}
                  compact
                  active={avoid.includes(option)}
                  onPress={() => onToggleAvoid(option)}
                />
              ))}
            </View>
          </View>

          <View style={styles.actions}>
            <PrimaryButton label="恢复默认" variant="outline" onPress={onReset} style={styles.resetButton} />
            <PrimaryButton label="完成" onPress={onClose} style={styles.doneButton} />
          </View>
        </ScrollView>
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
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.sectionTitle,
    color: colors.text,
  },
  body: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  block: {
    marginTop: spacing.lg,
  },
  blockTitle: {
    ...typography.body,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 6,
  },
  blockHint: {
    ...typography.caption,
    color: colors.textSub,
    marginBottom: spacing.sm,
  },
  familyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  familyHint: {
    ...typography.caption,
    color: colors.textSub,
    flex: 1,
    marginRight: spacing.md,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
    marginTop: spacing.xxl,
  },
  resetButton: {
    flex: 1,
    marginRight: spacing.md,
  },
  doneButton: {
    flex: 1,
  },
});
