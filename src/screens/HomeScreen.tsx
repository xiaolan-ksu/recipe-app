import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CategoryChips } from '../components/CategoryChips';
import { DishMiniCard } from '../components/DishMiniCard';
import { HeroDishCard } from '../components/HeroDishCard';
import { HScroll } from '../components/HScroll';
import { LocationSheet } from '../components/LocationSheet';
import { PrimaryButton } from '../components/PrimaryButton';
import { SectionHeader } from '../components/SectionHeader';
import { DISHES } from '../data/dishes';
import { useLocationLabel } from '../lib/useLocationLabel';
import { dishHitsAvoid, filterByAvoid } from '../lib/avoid';
import { recommendPool, selectCurrentDish, useAllDishes, useAppStore } from '../store/useAppStore';
import { colors, radius, screenPadding, shadow, spacing, typography } from '../theme';

interface Props {
  onOpenDish: (dishId: string) => void;
  onOpenFilter: () => void;
  onOpenRecipes: () => void;
}

export function HomeScreen({ onOpenDish, onOpenFilter, onOpenRecipes }: Props) {
  const insets = useSafeAreaInsets();
  const fade = useRef(new Animated.Value(1)).current;
  const [locationOpen, setLocationOpen] = useState(false);

  const { label: locationLabel, coords, status, locate } = useLocationLabel();
  const setLocation = useAppStore((state) => state.setLocation);
  const activeCategory = useAppStore((state) => state.activeCategory);
  const setActiveCategory = useAppStore((state) => state.setActiveCategory);
  const nextDish = useAppStore((state) => state.nextDish);
  const avoid = useAppStore((state) => state.avoid);
  const favorites = useAppStore((state) => state.favorites);
  const toggleFavorite = useAppStore((state) => state.toggleFavorite);

  const allDishes = useAllDishes();
  // 用 selectCurrentDish：万一当前这道刚被删掉，会自动换成菜谱里的第一道
  const dish = useAppStore(selectCurrentDish);
  // 忌口把当前分类挡空了：不要装作有推荐，明确告诉用户
  const poolEmpty = useMemo(
    () => recommendPool(activeCategory, avoid, allDishes).length === 0,
    [activeCategory, avoid, allDishes],
  );
  const popular = useMemo(
    () =>
      // 忌口挡掉的菜不能出现在人气榜里；先复制再排序，别改到 store 里的数组
      [...filterByAvoid(allDishes, avoid).dishes]
        .sort((a, b) => b.popularity - a.popularity)
        .filter((item) => item.id !== dish?.id)
        .slice(0, 6),
    [allDishes, dish?.id, avoid],
  );
  const isFavorite = favorites.includes(dish.id);

  // 兜底：老版本存下来的「当前这道菜」可能正好是现在忌口的（升级、或对方同步过来的数据）。
  // 发现这种情况就换一道还能吃的；poolEmpty 时 store 里换不动，交给上面的空状态提示。
  useEffect(() => {
    if (!poolEmpty && dishHitsAvoid(dish, avoid)) nextDish();
  }, [dish, avoid, poolEmpty, nextDish]);

  const locationText =
    status === 'locating'
      ? '正在定位…'
      : locationLabel.length > 0
        ? locationLabel
        : status === 'denied'
          ? '点击允许定位'
          : '点击设置位置';

  const handleNext = () => {
    Animated.timing(fade, { toValue: 0.2, duration: 130, useNativeDriver: true }).start(() => {
      nextDish();
      Animated.timing(fade, { toValue: 1, duration: 240, useNativeDriver: true }).start();
    });
  };

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.root}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.md }]}
        showsVerticalScrollIndicator={false}
      >
      <View style={styles.headerRow}>
        <Pressable
          onPress={() => setLocationOpen(true)}
          hitSlop={6}
          style={({ pressed }) => [styles.locationPill, pressed && styles.pressed]}
        >
          <Ionicons name="location-sharp" size={13} color={colors.primary} />
          <View style={styles.locationTextWrap}>
            <Text style={styles.locationLabel}>{locationLabel.length > 0 ? '当前位置' : '位置'}</Text>
            <Text style={styles.locationValue} numberOfLines={1}>
              {locationText}
            </Text>
          </View>
          <Ionicons name="chevron-down" size={12} color={colors.textFaint} style={styles.locationChevron} />
        </Pressable>

        <Pressable
          onPress={onOpenFilter}
          hitSlop={8}
          style={({ pressed }) => [styles.filterButton, pressed && styles.pressed]}
        >
          <Ionicons name="options-outline" size={19} color={colors.text} />
        </Pressable>
      </View>

      <View style={styles.greetingRow}>
        <Ionicons name="sparkles" size={15} color={colors.primary} />
        <Text style={styles.greeting}>今天也要好好吃饭</Text>
      </View>

      <Text style={styles.title}>今天吃什么？</Text>
      <Text style={styles.subtitle}>一日三餐，人间烟火，选一道家的味道</Text>

      <View style={styles.chipsRow}>
        <CategoryChips value={activeCategory} onChange={setActiveCategory} />
      </View>

      {poolEmpty ? (
        <View style={styles.emptyCard}>
          <Ionicons name="alert-circle-outline" size={30} color={colors.textFaint} />
          <Text style={styles.emptyTitle}>这一类都被忌口挡掉了</Text>
          <Text style={styles.emptyText}>
            你勾了「{avoid.join('、')}」，这个分类里没有能吃的菜。换个分类，或者去右上角改一下忌口。
          </Text>
        </View>
      ) : (
        <>
          <Animated.View style={{ opacity: fade }}>
            <Pressable onPress={() => onOpenDish(dish.id)}>
              <HeroDishCard dish={dish} isFavorite={isFavorite} onToggleFavorite={() => toggleFavorite(dish.id)} />
            </Pressable>
          </Animated.View>

          <PrimaryButton label="换一个试试" icon="refresh" onPress={handleNext} style={styles.cta} />
        </>
      )}

      <View style={styles.section}>
        <SectionHeader title="最近很受欢迎" actionLabel="查看全部" onAction={onOpenRecipes} />
      </View>

      <HScroll style={styles.popularScroll} contentContainerStyle={styles.popularContent}>
        {popular.map((item) => (
          <DishMiniCard
            key={item.id}
            dish={item}
            isFavorite={favorites.includes(item.id)}
            onPress={() => onOpenDish(item.id)}
          />
        ))}
      </HScroll>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          共 {allDishes.length} 道菜
          {allDishes.length > DISHES.length ? `（含自己加的 ${allDishes.length - DISHES.length} 道）` : ''} · 收藏{' '}
          {favorites.length} 道
        </Text>
      </View>
      </ScrollView>

      <LocationSheet
        visible={locationOpen}
        label={locationLabel}
        status={status}
        coords={coords}
        onClose={() => setLocationOpen(false)}
        onRelocate={() => void locate()}
        onSaveManual={(text) => {
          setLocation(text.trim(), 'manual');
          setLocationOpen(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingHorizontal: screenPadding,
    paddingBottom: spacing.xxl,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    maxWidth: '78%',
    ...shadow.card,
  },
  locationTextWrap: {
    marginLeft: 5,
    flexShrink: 1,
  },
  locationChevron: {
    marginLeft: 4,
  },
  locationLabel: {
    fontSize: 9,
    color: colors.textFaint,
  },
  locationValue: {
    ...typography.label,
    color: colors.text,
  },
  filterButton: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
  },
  pressed: {
    opacity: 0.7,
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xl,
  },
  greeting: {
    ...typography.label,
    color: colors.primary,
    marginLeft: 6,
    letterSpacing: 0.6,
  },
  title: {
    ...typography.hero,
    color: colors.text,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSub,
    textAlign: 'center',
    marginTop: 6,
  },
  chipsRow: {
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },
  cta: {
    marginTop: spacing.xl,
  },
  emptyCard: {
    marginTop: spacing.lg,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    alignItems: 'center',
    ...shadow.card,
  },
  emptyTitle: {
    ...typography.sectionTitle,
    fontSize: 16,
    color: colors.text,
    marginTop: spacing.md,
  },
  emptyText: {
    ...typography.body,
    fontSize: 13,
    color: colors.textSub,
    marginTop: 6,
    textAlign: 'center',
  },
  section: {
    marginTop: spacing.xxl,
  },
  popularScroll: {
    marginHorizontal: -screenPadding,
    marginTop: spacing.lg,
  },
  popularContent: {
    paddingHorizontal: screenPadding,
  },
  footer: {
    marginTop: spacing.xxl,
    alignItems: 'center',
  },
  footerText: {
    ...typography.caption,
    color: colors.textFaint,
  },
});
