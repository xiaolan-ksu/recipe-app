import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, ViewStyle, type StyleProp } from 'react-native';

import { colors, radius, shadow, typography } from '../theme';

interface Props {
  label: string;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  variant?: 'solid' | 'outline' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function PrimaryButton({
  label,
  onPress,
  icon,
  variant = 'solid',
  loading = false,
  disabled = false,
  style,
}: Props) {
  const isSolid = variant === 'solid';
  const iconColor = isSolid ? '#FFFFFF' : colors.primary;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        isSolid ? styles.solid : variant === 'outline' ? styles.outline : styles.ghost,
        disabled && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={iconColor} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={18} color={iconColor} style={styles.icon} /> : null}
          <Text style={[styles.text, isSolid ? styles.textSolid : styles.textOutline]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 52,
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  solid: {
    backgroundColor: colors.primary,
    ...shadow.button,
  },
  outline: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.88,
  },
  icon: {
    marginRight: 8,
  },
  text: {
    fontSize: 16,
    fontWeight: '700',
  },
  textSolid: {
    color: '#FFFFFF',
  },
  textOutline: {
    color: colors.primary,
  },
});
