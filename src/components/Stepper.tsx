import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, typography } from '../theme';

interface Props {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  suffix?: string;
}

export function Stepper({ value, min, max, onChange, suffix = '' }: Props) {
  const canDec = value > min;
  const canInc = value < max;

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => canDec && onChange(value - 1)}
        disabled={!canDec}
        style={({ pressed }) => [styles.btn, !canDec && styles.disabled, pressed && styles.pressed]}
      >
        <Ionicons name="remove" size={17} color={canDec ? colors.primary : colors.textFaint} />
      </Pressable>
      <Text style={styles.value}>
        {value}
        {suffix}
      </Text>
      <Pressable
        onPress={() => canInc && onChange(value + 1)}
        disabled={!canInc}
        style={({ pressed }) => [styles.btn, !canInc && styles.disabled, pressed && styles.pressed]}
      >
        <Ionicons name="add" size={17} color={canInc ? colors.primary : colors.textFaint} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 3,
  },
  btn: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    backgroundColor: 'transparent',
  },
  pressed: {
    opacity: 0.7,
  },
  value: {
    ...typography.body,
    fontWeight: '700',
    color: colors.text,
    minWidth: 46,
    textAlign: 'center',
  },
});
