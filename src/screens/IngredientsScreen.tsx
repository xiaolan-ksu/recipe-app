import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Chip } from '../components/Chip';
import { DishCover } from '../components/DishCover';
import { EmptyState } from '../components/EmptyState';
import { PantryExpirySheet } from '../components/PantryExpirySheet';
import { Toast } from '../components/Toast';
import { INGREDIENT_GROUPS } from '../constants';
import { filterByAvoid } from '../lib/avoid';
import { buildPantryCatalog, cookableDishes, pantryOverview, type DishCookability } from '../lib/pantry';
import { today } from '../lib/recommend';
import { useAllDishes, useAppStore } from '../store/useAppStore';
import { colors, radius, screenPadding, shadow, spacing, typography } from '../theme';

type ViewMode = '全部' | '现在就能做' | '还差 1 样';

const MODES: ViewMode[] = ['全部', '现在就能做', '还差 1 样'];

/** 第一次进来时，一键勾上最常用的三样，马上能看到效果 */
const QUICK_PICK = ['番茄', '鸡蛋', '小葱'];

interface Props {
  onOpenDish: (dishId: string) => void;
}

export function IngredientsScreen({ onOpenDish }: Props) {
  const insets = useSafeAreaInsets();
  const [keyword, setKeyword] = useState('');
  const [mode, setMode] = useState<ViewMode>('全部');
  const [toast, setToast] = useState<string | null>(null);
  const [expiryOpen, setExpiryOpen] = useState(false);

  const allDishes = useAllDishes();
  const avoid = useAppStore((state) => state.avoid);
  const pantry = useAppStore((state) => state.pantry);
  const pantryExpiry = useAppStore((state) => state.pantryExpiry);
  const togglePantry = useAppStore((state) => state.togglePantry);
  const addPantryItems = useAppStore((state) => state.addPantryItems);
  const clearPantry = useAppStore((state) => state.clearPantry);
  const shiftPantryExpiry = useAppStore((state) => state.shiftPantryExpiry);
  const addMissingToShopping = useAppStore((state) => state.addMissingToShopping);

  const query = keyword.trim();

  const catalog = useMemo(() => buildPantryCatalog(allDishes), [allDishes]);

  const sections = useMemo(
    () =>
      INGREDIENT_GROUPS.map((group) => ({
        group,
        items: catalog.filter(
          (item) => item.group === group && (query.length === 0 || item.name.includes(query)),
        ),
      })).filter((section) => section.items.length > 0),
    [catalog, query],
  );

  const cookList = useMemo(() => {
    // 忌口是硬约束：能做的菜里也不能出现忌口的，否则等于换个入口又推荐回来
    const all = cookableDishes(pantry, filterByAvoid(allDishes, avoid).dishes);
    if (mode === '现在就能做') return all.filter((item) => item.ready);
    if (mode === '还差 1 样') return all.filter((item) => item.missing.length === 1);
    return all;
  }, [allDishes, pantry, mode, avoid]);

  const entries = useMemo(
    () => pantryOverview(pantry, pantryExpiry, today(), catalog),
    [catalog, pantry, pantryExpiry],
  );
  const attention = entries.filter((entry) => entry.info !== null && entry.info.days <= 2);

  const handleAddMissing = (item: DishCookability) => {
    const added = addMissingToShopping(item.dish.id);
    setToast(
      added > 0
        ? `已把缺的 ${item.missing.length} 样加进买菜清单`
        : '这几样已经在买菜清单里了',
    );
  };

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.root}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.md }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>食材</Text>
        <Text style={styles.subtitle}>勾一下家里有什么，就能看出今天能做什么</Text>

        <View style={styles.summaryCard}>
          <View style={styles.summaryIcon}>
            <Ionicons name="snow-outline" size={20} color={colors.primary} />
          </View>
          <View style={styles.summaryBody}>
            <Text style={styles.summaryValue}>
              {pantry.length > 0 ? `冰箱里有 ${pantry.length} 样` : '冰箱还空着'}
            </Text>
            <Text style={styles.summaryHint}>
              {pantry.length > 0 ? '下面列的菜都用得上这些食材' : '在下面勾几样，马上就出结果'}
            </Text>
          </View>
          {pantry.length > 0 ? (
            <View style={styles.summaryActions}>
              <Pressable onPress={() => setExpiryOpen(true)} hitSlop={8} style={({ pressed }) => pressed && styles.pressed}>
                <Text style={styles.expiryLink}>保质期</Text>
              </Pressable>
              <Pressable onPress={clearPantry} hitSlop={8} style={({ pressed }) => pressed && styles.pressed}>
                <Text style={styles.clearText}>清空</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        {attention.length > 0 ? (
          <View style={styles.expireCard}>
            <Ionicons name="alert-circle-outline" size={16} color={colors.warning} />
            <View style={styles.expireBody}>
              <Text style={styles.expireText}>
                先吃掉这些：
                {attention
                  .slice(0, 3)
                  .map((entry) => `${entry.name}（${entry.info?.label}）`)
                  .join('、')}
                {attention.length > 3 ? ` 等 ${attention.length} 样` : ''}
              </Text>
              <Pressable onPress={() => setExpiryOpen(true)} hitSlop={6} style={({ pressed }) => pressed && styles.pressed}>
                <Text style={styles.expireAction}>管理保质期</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <View style={styles.searchWrap}>
          <Ionicons name="search" size={16} color={colors.textFaint} />
          <TextInput
            value={keyword}
            onChangeText={setKeyword}
            placeholder="搜食材，比如「鸡蛋」「豆腐」"
            placeholderTextColor={colors.textFaint}
            style={styles.searchInput}
          />
          {keyword.length > 0 ? (
            <Pressable onPress={() => setKeyword('')} hitSlop={10}>
              <Ionicons name="close-circle" size={16} color={colors.textFaint} />
            </Pressable>
          ) : null}
        </View>

        {sections.map((section) => {
          const checked = section.items.filter((item) => pantry.includes(item.name)).length;
          return (
            <View key={section.group} style={styles.group}>
              <View style={styles.groupHead}>
                <Text style={styles.groupTitle}>{section.group}</Text>
                <Text style={styles.groupMeta}>{checked > 0 ? `已勾 ${checked} 样` : ''}</Text>
              </View>
              <View style={styles.chips}>
                {section.items.map((item) => {
                  const selected = pantry.includes(item.name);
                  const info = selected ? entries.find((entry) => entry.name === item.name)?.info : undefined;
                  const urgent = info ? info.days <= 2 : false;
                  return (
                    <Pressable
                      key={item.name}
                      onPress={() => togglePantry(item.name)}
                      style={({ pressed }) => [
                        styles.chip,
                        selected && styles.chipActive,
                        pressed && styles.pressed,
                      ]}
                    >
                      {selected ? <Ionicons name="checkmark" size={12} color="#FFFFFF" /> : null}
                      <Text style={[styles.chipText, selected && styles.chipTextActive]}>{item.name}</Text>
                      <Text
                        style={[
                          styles.chipCount,
                          selected && styles.chipCountActive,
                          urgent && !selected && styles.chipCountUrgent,
                        ]}
                      >
                        {urgent ? info?.label : `${item.dishCount} 道`}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          );
        })}

        <Text style={styles.footnote}>盐、生抽、食用油这类常备调料默认算家里有，不用勾。</Text>

        <View style={styles.cookHead}>
          <Text style={styles.sectionTitle}>能做什么菜</Text>
          <Text style={styles.sectionMeta}>
            {pantry.length === 0 ? '勾了食材才会出结果' : `${cookList.length} 道用得上`}
          </Text>
        </View>

        {pantry.length > 0 ? (
          <View style={styles.modeRow}>
            {MODES.map((item) => (
              <Chip key={item} label={item} compact active={mode === item} onPress={() => setMode(item)} />
            ))}
          </View>
        ) : null}

        {pantry.length === 0 ? (
          <EmptyState
            icon="leaf-outline"
            title="先说说家里有什么"
            description={'勾几样食材，这里就会列出能做的菜，\n还会写清楚每道菜还差哪几样。'}
            actionLabel="试试：番茄 + 鸡蛋 + 小葱"
            onAction={() => addPantryItems(QUICK_PICK)}
          />
        ) : cookList.length === 0 ? (
          <EmptyState
            icon="search-outline"
            title="这几样还没凑出菜"
            description={'再勾一两样试试，\n比如勾上「鸡蛋」，能做的菜立刻变多。'}
            actionLabel="勾上鸡蛋、番茄、小葱"
            onAction={() => addPantryItems(QUICK_PICK)}
          />
        ) : (
          cookList.map((item) => (
            <DishCookRow
              key={item.dish.id}
              item={item}
              onPress={() => onOpenDish(item.dish.id)}
              onAddMissing={() => handleAddMissing(item)}
            />
          ))
        )}
      </ScrollView>

      {toast ? <Toast message={toast} onHide={() => setToast(null)} offset={16} /> : null}

      <PantryExpirySheet
        visible={expiryOpen}
        entries={entries}
        onClose={() => setExpiryOpen(false)}
        onShift={(name, days) => shiftPantryExpiry(name, days)}
        onRemove={(name) => togglePantry(name)}
      />
    </View>
  );
}

interface RowProps {
  item: DishCookability;
  onPress: () => void;
  onAddMissing: () => void;
}

function DishCookRow({ item, onPress, onAddMissing }: RowProps) {
  const { dish, missing, ready } = item;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.dishCard, pressed && styles.cardPressed]}>
      <DishCover dish={dish} style={styles.dishCover} letterSize={30} />

      <View style={styles.dishBody}>
        <View style={styles.dishTitleRow}>
          <Text style={styles.dishName} numberOfLines={1}>
            {dish.name}
          </Text>
          {ready ? (
            <View style={styles.readyPill}>
              <Ionicons name="checkmark-circle" size={11} color={colors.success} />
              <Text style={styles.readyText}>现在就能做</Text>
            </View>
          ) : (
            <View style={styles.missingPill}>
              <Text style={styles.missingPillText}>还差 {missing.length} 样</Text>
            </View>
          )}
        </View>

        <Text style={styles.dishMeta} numberOfLines={1}>
          {dish.category} · {dish.minutes} 分钟 · 约 ¥{dish.costYuan}
        </Text>

        <Text style={styles.missingText} numberOfLines={1}>
          {ready ? '材料齐了，直接开做' : `还差：${missing.map((ing) => ing.name).join('、')}`}
        </Text>

        {ready ? null : (
          <Pressable onPress={onAddMissing} hitSlop={6} style={styles.addLink}>
            <Ionicons name="cart-outline" size={13} color={colors.primary} />
            <Text style={styles.addLinkText}>把缺的加进买菜清单</Text>
          </Pressable>
        )}
      </View>
    </Pressable>
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
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.lg,
    ...shadow.card,
  },
  summaryIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryBody: {
    flex: 1,
    marginLeft: spacing.md,
  },
  summaryValue: {
    ...typography.body,
    fontWeight: '700',
    color: colors.text,
  },
  summaryHint: {
    ...typography.caption,
    color: colors.textSub,
    marginTop: 3,
  },
  clearText: {
    ...typography.label,
    color: colors.primary,
  },
  summaryActions: {
    alignItems: 'flex-end',
  },
  expiryLink: {
    ...typography.label,
    color: colors.textSub,
    marginBottom: 6,
  },
  expireCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FBF0DC',
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  expireText: {
    ...typography.caption,
    color: '#8A6320',
    lineHeight: 18,
  },
  expireBody: {
    flex: 1,
    marginLeft: 6,
  },
  expireAction: {
    ...typography.caption,
    color: colors.warning,
    fontWeight: '800',
    marginTop: 6,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    fontSize: 13,
    color: colors.text,
    marginLeft: spacing.sm,
    padding: 0,
  },
  group: {
    marginTop: spacing.lg,
  },
  groupHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  groupTitle: {
    ...typography.body,
    fontWeight: '700',
    color: colors.text,
  },
  groupMeta: {
    ...typography.caption,
    color: colors.primary,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 34,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    marginRight: 8,
    marginBottom: 8,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    ...typography.body,
    fontSize: 13,
    color: colors.text,
  },
  chipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  chipCount: {
    ...typography.caption,
    fontSize: 10,
    color: colors.textFaint,
    marginLeft: 5,
  },
  chipCountActive: {
    color: 'rgba(255,255,255,0.85)',
  },
  chipCountUrgent: {
    color: colors.warning,
    fontWeight: '800',
  },
  footnote: {
    ...typography.caption,
    color: colors.textFaint,
    marginTop: spacing.lg,
    lineHeight: 17,
  },
  cookHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xxl,
  },
  sectionTitle: {
    ...typography.sectionTitle,
    color: colors.text,
  },
  sectionMeta: {
    ...typography.caption,
    color: colors.textSub,
  },
  modeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.md,
  },
  dishCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.md,
    ...shadow.card,
  },
  cardPressed: {
    opacity: 0.9,
  },
  dishCover: {
    width: 84,
    height: 84,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  dishBody: {
    flex: 1,
    marginLeft: spacing.md,
  },
  dishTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dishName: {
    ...typography.dishName,
    fontSize: 17,
    color: colors.text,
    flexShrink: 1,
    marginRight: spacing.sm,
  },
  readyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EAF3E4',
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  readyText: {
    ...typography.caption,
    fontSize: 10,
    color: colors.success,
    fontWeight: '700',
    marginLeft: 3,
  },
  missingPill: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  missingPillText: {
    ...typography.caption,
    fontSize: 10,
    color: colors.primary,
    fontWeight: '700',
  },
  dishMeta: {
    ...typography.caption,
    color: colors.textSub,
    marginTop: 4,
  },
  missingText: {
    ...typography.caption,
    color: colors.text,
    marginTop: 6,
  },
  addLink: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  addLinkText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
    marginLeft: 4,
  },
  pressed: {
    opacity: 0.7,
  },
});
