import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import { PrimaryButton } from '../components/PrimaryButton';
import { Toast } from '../components/Toast';
import { GROUP_LABEL } from '../constants';
import { SHOP_GROUP_ORDER } from '../lib/pantry';
import { formatAmount, formatQuantity } from '../lib/recommend';
import { useAllDishes, useAppStore, useDishById } from '../store/useAppStore';
import { colors, radius, screenPadding, shadow, spacing, typography } from '../theme';
import type { ShoppingItem } from '../types';

interface Props {
  onOpenRecipes: () => void;
}

export function ShoppingScreen({ onOpenRecipes }: Props) {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const shopping = useAppStore((state) => state.shopping);
  const currentDishId = useAppStore((state) => state.currentDishId);
  const toggleShoppingItem = useAppStore((state) => state.toggleShoppingItem);
  const adjustShoppingAmount = useAppStore((state) => state.adjustShoppingAmount);
  const removeShoppingItem = useAppStore((state) => state.removeShoppingItem);
  const clearCheckedShopping = useAppStore((state) => state.clearCheckedShopping);
  const clearShopping = useAppStore((state) => state.clearShopping);
  const addPantryItems = useAppStore((state) => state.addPantryItems);
  const addDishToShopping = useAppStore((state) => state.addDishToShopping);

  const allDishes = useAllDishes();
  const dishById = useMemo(() => new Map(allDishes.map((dish) => [dish.id, dish])), [allDishes]);
  const unchecked = useMemo(() => shopping.filter((item) => !item.checked), [shopping]);
  const checked = useMemo(() => shopping.filter((item) => item.checked), [shopping]);
  const estimate = unchecked.reduce((sum, item) => sum + item.price, 0);
  const totalEstimate = shopping.reduce((sum, item) => sum + item.price, 0);

  const sections = SHOP_GROUP_ORDER.map((group) => ({
    group,
    items: shopping.filter((item) => item.group === group),
  })).filter((section) => section.items.length > 0);

  const currentDish = useDishById(currentDishId);

  const handleStockIn = () => {
    const names = checked.map((item) => item.name);
    addPantryItems(names);
    clearCheckedShopping();
    setToast(`买到的 ${names.length} 样已经记进食材页`);
  };

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.root}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.md }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>买菜</Text>
        <Text style={styles.subtitle}>菜谱里「加入买菜清单」的东西都会汇总到这里</Text>

        {shopping.length === 0 ? (
          <>
            <EmptyState
              icon="cart-outline"
              title="清单还是空的"
              description={'去菜谱里挑几道菜，点一下「加入买菜清单」，\n买什么、买多少都会自动算好。'}
              actionLabel="去菜谱挑菜"
              onAction={onOpenRecipes}
            />
            {currentDish ? (
              <Pressable
                onPress={() => {
                  const added = addDishToShopping(currentDish.id);
                  setToast(
                    added > 0 ? `「${currentDish.name}」要买的 ${added} 样已加进清单` : '这些已经在清单里了',
                  );
                }}
                style={({ pressed }) => [styles.quickAdd, pressed && styles.pressed]}
              >
                <Ionicons name="add-circle-outline" size={17} color={colors.primary} />
                <Text style={styles.quickAddText}>把今天推荐的「{currentDish.name}」加进来</Text>
              </Pressable>
            ) : null}
          </>
        ) : (
          <>
            <View style={styles.summaryCard}>
              <View style={styles.summaryTop}>
                <View>
                  <Text style={styles.summaryValue}>
                    还要买 {unchecked.length} 样 · 预计 ¥{Math.round(estimate)}
                  </Text>
                  <Text style={styles.summaryHint}>
                    清单共 {shopping.length} 样，合计约 ¥{Math.round(totalEstimate)}
                  </Text>
                </View>
                <Text style={styles.progressText}>
                  已买 {checked.length}/{shopping.length}
                </Text>
              </View>

              <View style={styles.progressTrack}>
                {checked.length > 0 ? (
                  <View style={[styles.progressFill, { flex: checked.length }]} />
                ) : null}
                <View style={{ flex: Math.max(shopping.length - checked.length, 0) }} />
              </View>

              <View style={styles.summaryLinks}>
                {checked.length > 0 ? (
                  <Pressable onPress={clearCheckedShopping} hitSlop={6} style={({ pressed }) => pressed && styles.pressed}>
                    <Text style={styles.linkText}>清掉已买的 {checked.length} 样</Text>
                  </Pressable>
                ) : null}
                <Pressable onPress={() => setConfirmClear(true)} hitSlop={6} style={({ pressed }) => pressed && styles.pressed}>
                  <Text style={styles.linkMuted}>清空整个清单</Text>
                </Pressable>
              </View>
            </View>

            {sections.map((section) => (
              <View key={section.group} style={styles.group}>
                <View style={styles.groupHead}>
                  <Text style={styles.groupTitle}>{GROUP_LABEL[section.group]}</Text>
                  <Text style={styles.groupMeta}>
                    {section.items.filter((item) => item.checked).length}/{section.items.length} 已买
                  </Text>
                </View>

                <View style={styles.groupCard}>
                  {section.items.map((item, index) => (
                    <ShoppingRow
                      key={item.id}
                      item={item}
                      isLast={index === section.items.length - 1}
                      dishById={dishById}
                      onToggle={() => toggleShoppingItem(item.id)}
                      onAdjust={(direction) => adjustShoppingAmount(item.id, direction)}
                      onRemove={() => removeShoppingItem(item.id)}
                    />
                  ))}
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>

      {shopping.length > 0 ? (
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          <View style={styles.bottomInfo}>
            <Text style={styles.bottomValue}>
              还要买 {unchecked.length} 样 · ¥{Math.round(estimate)}
            </Text>
            <Text style={styles.bottomHint}>
              {checked.length > 0 ? `已买 ${checked.length} 样，勾一下入库` : '买一样勾一样'}
            </Text>
          </View>
          <PrimaryButton
            label="买完了入库"
            icon="checkmark-done-outline"
            onPress={handleStockIn}
            disabled={checked.length === 0}
            style={styles.bottomButton}
          />
        </View>
      ) : null}

      {toast ? <Toast message={toast} onHide={() => setToast(null)} offset={shopping.length > 0 ? 96 : 24} /> : null}

      <ConfirmDialog
        visible={confirmClear}
        title="清空整个清单？"
        message="清单里的东西会全部删掉，已经买的那几样也不会留。"
        confirmLabel="清空"
        onConfirm={() => {
          clearShopping();
          setToast('清单已清空');
        }}
        onClose={() => setConfirmClear(false)}
      />
    </View>
  );
}

interface RowProps {
  item: ShoppingItem;
  isLast: boolean;
  dishById: Map<string, ReturnType<typeof useAllDishes>[number]>;
  onToggle: () => void;
  onAdjust: (direction: 1 | -1) => void;
  onRemove: () => void;
}

function ShoppingRow({ item, isLast, dishById, onToggle, onAdjust, onRemove }: RowProps) {
  const fromDishes = item.fromDishIds
    .map((id) => dishById.get(id)?.name)
    .filter((name): name is string => Boolean(name))
    .join('、');

  return (
    <View style={[styles.row, isLast && styles.rowLast, item.checked && styles.rowChecked]}>
      <Pressable
        onPress={onToggle}
        hitSlop={8}
        style={({ pressed }) => [styles.checkbox, item.checked && styles.checkboxOn, pressed && styles.pressed]}
      >
        {item.checked ? <Ionicons name="checkmark" size={14} color="#FFFFFF" /> : null}
      </Pressable>

      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text style={[styles.itemName, item.checked && styles.itemNameChecked]} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={[styles.itemPrice, item.checked && styles.itemPriceChecked]}>
            ¥{formatAmount(Math.round(item.price * 10) / 10)}
          </Text>
        </View>

        <View style={styles.rowBottom}>
          <Text style={styles.itemFrom} numberOfLines={1}>
            {fromDishes ? `来自「${fromDishes}」` : '手动添加'}
          </Text>

          {item.unit === '适量' ? (
            <Text style={styles.stepValue}>适量</Text>
          ) : (
            <View style={styles.stepper}>
              <Pressable onPress={() => onAdjust(-1)} hitSlop={6} style={({ pressed }) => [styles.stepButton, pressed && styles.pressed]}>
                <Ionicons name="remove" size={13} color={colors.primary} />
              </Pressable>
              <Text style={styles.stepValue} numberOfLines={1}>
                {formatQuantity(item.amount, item.unit)}
              </Text>
              <Pressable onPress={() => onAdjust(1)} hitSlop={6} style={({ pressed }) => [styles.stepButton, pressed && styles.pressed]}>
                <Ionicons name="add" size={13} color={colors.primary} />
              </Pressable>
            </View>
          )}

          <Pressable onPress={onRemove} hitSlop={8} style={({ pressed }) => pressed && styles.pressed}>
            <Ionicons name="close" size={15} color={colors.textFaint} />
          </Pressable>
        </View>
      </View>
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
    paddingBottom: 132,
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
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.lg,
    ...shadow.card,
  },
  summaryTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  summaryValue: {
    ...typography.sectionTitle,
    fontSize: 17,
    color: colors.primary,
  },
  summaryHint: {
    ...typography.caption,
    color: colors.textSub,
    marginTop: 4,
  },
  progressText: {
    ...typography.label,
    color: colors.textSub,
  },
  progressTrack: {
    flexDirection: 'row',
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
    marginTop: spacing.md,
  },
  progressFill: {
    backgroundColor: colors.primary,
  },
  summaryLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  linkText: {
    ...typography.label,
    color: colors.primary,
  },
  linkMuted: {
    ...typography.label,
    color: colors.textFaint,
  },
  group: {
    marginTop: spacing.xl,
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
    color: colors.textFaint,
  },
  groupCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    ...shadow.card,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowChecked: {
    opacity: 0.62,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  rowBody: {
    flex: 1,
    marginLeft: spacing.md,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemName: {
    ...typography.body,
    fontWeight: '700',
    color: colors.text,
    flexShrink: 1,
    marginRight: spacing.sm,
  },
  itemNameChecked: {
    textDecorationLine: 'line-through',
    color: colors.textSub,
  },
  itemPrice: {
    ...typography.body,
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  itemPriceChecked: {
    color: colors.textFaint,
  },
  rowBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  itemFrom: {
    ...typography.caption,
    color: colors.textFaint,
    flex: 1,
    marginRight: spacing.sm,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    padding: 2,
  },
  stepButton: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepValue: {
    ...typography.caption,
    fontSize: 11,
    color: colors.text,
    minWidth: 58,
    textAlign: 'center',
  },
  quickAdd: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickAddText: {
    ...typography.body,
    fontSize: 13,
    color: colors.text,
    marginLeft: 6,
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingHorizontal: screenPadding,
    paddingTop: spacing.md,
  },
  bottomInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  bottomValue: {
    ...typography.body,
    fontWeight: '700',
    color: colors.text,
  },
  bottomHint: {
    ...typography.caption,
    color: colors.textSub,
    marginTop: 3,
  },
  bottomButton: {
    width: 148,
    height: 46,
  },
  pressed: {
    opacity: 0.7,
  },
});
