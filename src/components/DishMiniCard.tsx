import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { cardGradient, colors, radius, spacing, typography } from '../theme';
import type { Dish } from '../types';
import { DishCover } from './DishCover';

interface Props {
  dish: Dish;
  isFavorite?: boolean;
  onPress: () => void;
}

/** 「最近很受欢迎」里的横向小卡片 */
export function DishMiniCard({ dish, isFavorite = false, onPress }: Props) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.wrap, pressed && styles.pressed]}>
      <View style={styles.imageWrap}>
        <DishCover dish={dish} style={StyleSheet.absoluteFill} letterSize={44} />
        <LinearGradient colors={cardGradient} style={StyleSheet.absoluteFill} />
        <Text style={styles.name} numberOfLines={1}>
          {dish.name}
        </Text>
        {isFavorite ? (
          <View style={styles.heart}>
            <Ionicons name="heart" size={12} color="#FF8A75" />
          </View>
        ) : null}
      </View>
      <Text style={styles.meta} numberOfLines={1}>
        约 ¥{dish.costYuan} · {dish.minutes} 分钟
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 136,
    marginRight: spacing.md,
  },
  pressed: {
    opacity: 0.85,
  },
  imageWrap: {
    height: 124,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
    justifyContent: 'flex-end',
  },
  name: {
    ...typography.body,
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    paddingHorizontal: 10,
    paddingBottom: 8,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowRadius: 6,
  },
  heart: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(26,17,11,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: {
    ...typography.caption,
    color: colors.textSub,
    marginTop: 6,
  },
});
