import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, shadow, spacing, typography } from '../theme';
import type { Dish } from '../types';
import { DishCover } from './DishCover';

interface Props {
  dish: Dish;
  isFavorite: boolean;
  onPress: () => void;
  onToggleFavorite: () => void;
  /** 不传就不显示删除按钮 */
  onDelete?: () => void;
}

/** 菜谱列表里的横排卡片 */
export function RecipeRowCard({ dish, isFavorite, onPress, onToggleFavorite, onDelete }: Props) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <DishCover dish={dish} style={styles.cover} letterSize={30} />

      <View style={styles.body}>
        <Text style={styles.tagline} numberOfLines={1}>
          {dish.tagline}
        </Text>
        <Text style={styles.name} numberOfLines={1}>
          {dish.name}
        </Text>
        {dish.description ? (
          <Text style={styles.desc} numberOfLines={1}>
            {dish.description}
          </Text>
        ) : null}

        <View style={styles.metaRow}>
          <Text style={styles.meta}>约 ¥{dish.costYuan}</Text>
          <Text style={styles.dot}>·</Text>
          <Text style={styles.meta}>{dish.minutes} 分钟</Text>
          <Text style={styles.dot}>·</Text>
          <Text style={styles.meta}>{dish.difficulty}</Text>
        </View>
      </View>

      <View style={styles.side}>
        <Pressable onPress={onToggleFavorite} hitSlop={10} accessibilityLabel="收藏">
          <Ionicons
            name={isFavorite ? 'heart' : 'heart-outline'}
            size={18}
            color={isFavorite ? colors.primary : colors.textFaint}
          />
        </Pressable>

        {onDelete ? (
          <Pressable onPress={onDelete} hitSlop={10} accessibilityLabel="删掉这道菜">
            <Ionicons name="trash-outline" size={18} color={colors.textFaint} />
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadow.card,
  },
  pressed: {
    opacity: 0.9,
  },
  cover: {
    width: 96,
    height: 96,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  body: {
    flex: 1,
    marginLeft: spacing.md,
    marginRight: spacing.sm,
  },
  tagline: {
    ...typography.caption,
    color: colors.textFaint,
  },
  name: {
    ...typography.dishName,
    fontSize: 18,
    color: colors.text,
    marginTop: 2,
  },
  desc: {
    ...typography.body,
    fontSize: 12,
    color: colors.textSub,
    marginTop: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  meta: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
  },
  dot: {
    ...typography.caption,
    color: colors.textFaint,
    marginHorizontal: 5,
  },
  side: {
    alignItems: 'center',
    paddingLeft: 2,
    gap: 16,
  },
});
