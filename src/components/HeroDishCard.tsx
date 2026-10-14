import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, heroGradient, radius, shadow, spacing, typography } from '../theme';
import type { Dish } from '../types';
import { DishCover } from './DishCover';
import { GlassPanel } from './GlassPanel';
import { StatTriple } from './StatTriple';

interface Props {
  dish: Dish;
  isFavorite: boolean;
  onToggleFavorite: () => void;
}

/** 首页的主角卡片：今日推荐的家常菜 */
export function HeroDishCard({ dish, isFavorite, onToggleFavorite }: Props) {
  return (
    <View style={styles.card}>
      <DishCover dish={dish} style={StyleSheet.absoluteFill} letterSize={96} />
      <LinearGradient colors={heroGradient} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />

      <View style={styles.content}>
        <View style={styles.topRow}>
          <GlassPanel tone="dark" style={styles.badge}>
            <Ionicons name="sparkles" size={12} color="#FFF3E4" />
            <Text style={styles.badgeText}>今日家常菜</Text>
          </GlassPanel>

          <Pressable
            onPress={onToggleFavorite}
            hitSlop={10}
            style={({ pressed }) => [styles.favButton, pressed && styles.pressed]}
          >
            <GlassPanel tone="dark" style={styles.favInner}>
              <Ionicons
                name={isFavorite ? 'heart' : 'heart-outline'}
                size={19}
                color={isFavorite ? '#FF8A75' : '#FFFFFF'}
              />
            </GlassPanel>
          </Pressable>
        </View>

        <View>
          <Text style={styles.tagline}>{dish.tagline}</Text>
          <Text style={styles.name}>{dish.name}</Text>
          {dish.description ? (
            <Text style={styles.description} numberOfLines={2}>
              {dish.description}
            </Text>
          ) : null}

          <GlassPanel tone="dark" style={styles.statBar}>
            <StatTriple
              items={[
                { icon: 'pricetag-outline', label: '成本', value: `约 ¥${dish.costYuan}` },
                { icon: 'time-outline', label: '用时', value: `${dish.minutes} 分钟` },
                { icon: 'flame-outline', label: '难度', value: dish.difficulty },
              ]}
            />
          </GlassPanel>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    height: 424,
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
    ...shadow.floating,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: 'space-between',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 27,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
  },
  badgeText: {
    ...typography.caption,
    color: '#FFF7F0',
    marginLeft: 5,
  },
  favButton: {
    borderRadius: radius.pill,
  },
  favInner: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.75,
  },
  tagline: {
    ...typography.label,
    color: 'rgba(255,255,255,0.88)',
    marginBottom: 4,
  },
  name: {
    fontSize: 30,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  description: {
    ...typography.body,
    color: 'rgba(255,255,255,0.86)',
    marginTop: 6,
    lineHeight: 20,
  },
  statBar: {
    marginTop: spacing.lg,
    borderRadius: radius.md,
    paddingVertical: 9,
    paddingHorizontal: 4,
  },
});
