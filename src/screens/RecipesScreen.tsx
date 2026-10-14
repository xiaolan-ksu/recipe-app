import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CategoryChips } from '../components/CategoryChips';
import { Chip } from '../components/Chip';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { PrimaryButton } from '../components/PrimaryButton';
import { RecipeRowCard } from '../components/RecipeRowCard';
import { SearchBar } from '../components/SearchBar';
import { Toast } from '../components/Toast';
import { filterByAvoid } from '../lib/avoid';
import { useAllDishes, useAppStore } from '../store/useAppStore';
import { colors, radius, screenPadding, spacing, typography } from '../theme';
import type { Dish } from '../types';

type SortKey = '推荐' | '最快' | '最便宜' | '最受欢迎';

const SORTS: SortKey[] = ['推荐', '最快', '最便宜', '最受欢迎'];

interface Props {
  onOpenDish: (dishId: string) => void;
  onAddDish: () => void;
}

export function RecipesScreen({ onOpenDish, onAddDish }: Props) {
  const insets = useSafeAreaInsets();
  const [keyword, setKeyword] = useState('');
  const [sort, setSort] = useState<SortKey>('推荐');
  const [pendingDelete, setPendingDelete] = useState<Dish | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  // 忌口把整类挡空后，用户点「查看全部」临时放宽；换分类或改忌口就失效
  const [bypassAvoid, setBypassAvoid] = useState(false);

  const allDishes = useAllDishes();
  const activeCategory = useAppStore((state) => state.activeCategory);
  const setActiveCategory = useAppStore((state) => state.setActiveCategory);
  const favorites = useAppStore((state) => state.favorites);
  const toggleFavorite = useAppStore((state) => state.toggleFavorite);
  const removeCustomDish = useAppStore((state) => state.removeCustomDish);
  const avoid = useAppStore((state) => state.avoid);

  const list = useMemo(() => {
    const query = keyword.trim();
    let result = allDishes.filter((dish) => activeCategory === '全部' || dish.category === activeCategory);

    if (query.length > 0) {
      result = result.filter(
        (dish) =>
          dish.name.includes(query) ||
          (dish.description ?? '').includes(query) ||
          dish.tags.some((tag) => tag.includes(query)) ||
          dish.ingredients.some((ing) => ing.name.includes(query)) ||
          dish.steps.some((step) => step.text.includes(query)),
      );
    }

    // 忌口是硬约束：挡空了就显示空状态，不把忌口的菜偷偷放回来
    // （bypassAvoid 是用户点了「查看全部」之后的临时放宽，不改动已保存的忌口设置）
    const filtered = filterByAvoid(result, bypassAvoid ? [] : avoid);

    switch (sort) {
      case '最快':
        return [...filtered.dishes].sort((a, b) => a.minutes - b.minutes);
      case '最便宜':
        return [...filtered.dishes].sort((a, b) => a.costYuan - b.costYuan);
      case '最受欢迎':
        return [...filtered.dishes].sort((a, b) => b.popularity - a.popularity);
      default:
        return filtered.dishes;
    }
  }, [activeCategory, allDishes, keyword, sort, avoid, bypassAvoid]);

  // 换分类或改了忌口，之前的「查看全部」放宽就作废
  useEffect(() => {
    setBypassAvoid(false);
  }, [activeCategory, avoid]);

  // 忌口把这一类挡空了（或搜索无结果），两种情况提示不一样
  const avoidBlockedAll = useMemo(
    () => avoid.length > 0 && list.length === 0 && keyword.trim().length === 0,
    [avoid, list.length, keyword],
  );

  const customCount = allDishes.filter((dish) => dish.isCustom).length;

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.md }]}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>菜谱</Text>
          <Pressable
            onPress={onAddDish}
            style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
          >
            <Ionicons name="add" size={16} color="#FFFFFF" />
            <Text style={styles.addText}>加菜</Text>
          </Pressable>
        </View>
        <Text style={styles.subtitle}>
          一共 {allDishes.length} 道
          {customCount > 0 ? `（含我的菜 ${customCount} 道）` : ''}，想吃什么自己挑
        </Text>
      </View>

      <View style={styles.searchWrap}>
        <SearchBar value={keyword} onChange={setKeyword} />
      </View>

      <CategoryChips value={activeCategory} onChange={setActiveCategory} />

      <View style={styles.sortRow}>
        {SORTS.map((item) => (
          <Chip key={item} label={item} compact active={sort === item} onPress={() => setSort(item)} />
        ))}
      </View>

      <FlatList
        data={list}
        style={styles.list}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <RecipeRowCard
            dish={item}
            isFavorite={favorites.includes(item.id)}
            onPress={() => onOpenDish(item.id)}
            onToggleFavorite={() => toggleFavorite(item.id)}
            // 只有自己加的菜能删，菜谱自带的那 103 道不给删
            onDelete={item.isCustom ? () => setPendingDelete(item) : undefined}
          />
        )}
        ListEmptyComponent={
          avoidBlockedAll && !bypassAvoid ? (
            <View style={styles.empty}>
              <Ionicons name="alert-circle-outline" size={30} color={colors.textFaint} />
              <Text style={styles.emptyTitle}>这个分类都被忌口挡掉了</Text>
              <Text style={styles.emptyText}>
                你勾了「{avoid.join('、')}」，这一类里没有能吃的菜。
              </Text>
              <PrimaryButton
                label="查看全部"
                variant="outline"
                onPress={() => setBypassAvoid(true)}
                style={styles.emptyButton}
              />
            </View>
          ) : (
            <View style={styles.empty}>
              <Ionicons name="search-outline" size={30} color={colors.textFaint} />
              <Text style={styles.emptyTitle}>没找到这道菜</Text>
              <Text style={styles.emptyText}>换个关键词试试，比如「番茄」「鸡蛋」「豆腐」</Text>
            </View>
          )
        }
        ListFooterComponent={<Text style={styles.count}>共 {list.length} 道</Text>}
      />

      {toast ? <Toast message={toast} onHide={() => setToast(null)} offset={90} /> : null}

      <ConfirmDialog
        visible={pendingDelete !== null}
        title="删掉这道菜？"
        message={`「${pendingDelete?.name ?? ''}」是你自己加的菜，删了就找不回来了。`}
        confirmLabel="删除"
        onConfirm={() => {
          if (!pendingDelete) return;
          removeCustomDish(pendingDelete.id);
          setToast(`已删掉：${pendingDelete.name}`);
        }}
        onClose={() => setPendingDelete(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: screenPadding,
  },
  header: {
    marginBottom: spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  addText: {
    ...typography.label,
    color: '#FFFFFF',
    marginLeft: 4,
  },
  pressed: {
    opacity: 0.75,
  },
  title: {
    ...typography.hero,
    fontSize: 28,
    color: colors.text,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSub,
    marginTop: 4,
  },
  searchWrap: {
    marginBottom: spacing.md,
  },
  sortRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  listContent: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  list: {
    flex: 1,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: spacing.xxl * 2,
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
  emptyButton: {
    marginTop: spacing.lg,
    minWidth: 160,
  },
  count: {
    ...typography.caption,
    color: colors.textFaint,
    textAlign: 'center',
    marginTop: spacing.md,
  },
});
