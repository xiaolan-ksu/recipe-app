import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, screenPadding, spacing, typography } from '../theme';

interface Props {
  message: string;
  /** 右边可点的一句话，例如「去看看」 */
  actionLabel?: string;
  onAction?: () => void;
  onHide: () => void;
  /** 距离底部的距离 */
  offset?: number;
}

/** 一次性提示条，2 秒后自己淡出 */
export function Toast({ message, actionLabel, onAction, onHide, offset = 24 }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    const timer = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 240, useNativeDriver: true }).start(() => onHide());
    }, 2200);
    return () => clearTimeout(timer);
  }, [message, opacity, onHide]);

  const content = (
    <View style={styles.inner}>
      <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />
      <Text style={styles.text}>{message}</Text>
      {actionLabel ? <Text style={styles.action}>{actionLabel}</Text> : null}
    </View>
  );

  return (
    <Animated.View style={[styles.wrap, { opacity, bottom: offset }]}>
      {actionLabel && onAction ? <Pressable onPress={onAction}>{content}</Pressable> : content}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: screenPadding,
    right: screenPadding,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(24,16,10,0.9)',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
  },
  text: {
    ...typography.body,
    fontSize: 13,
    color: '#FFFFFF',
    flex: 1,
    marginLeft: 8,
  },
  action: {
    ...typography.label,
    color: '#FFB4A2',
  },
});
