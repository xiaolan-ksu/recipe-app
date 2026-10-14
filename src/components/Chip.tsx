import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, radius, spacing, typography } from '../theme';

interface Props {
  label: string;
  active?: boolean;
  onPress: () => void;
  compact?: boolean;
}

export function Chip({ label, active = false, onPress, compact = false }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        compact ? styles.compact : styles.normal,
        active ? styles.active : styles.idle,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.text, active ? styles.textActive : styles.textIdle]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  normal: {
    height: 38,
    paddingHorizontal: spacing.lg,
    marginRight: spacing.sm,
  },
  compact: {
    height: 32,
    paddingHorizontal: spacing.md,
    marginRight: 6,
    marginBottom: 6,
  },
  active: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  idle: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderColor: colors.border,
  },
  pressed: {
    opacity: 0.75,
  },
  text: {
    ...typography.body,
    fontSize: 13,
  },
  textActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  textIdle: {
    color: colors.textSub,
  },
});
