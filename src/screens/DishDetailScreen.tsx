import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ConfirmDialog } from '../components/ConfirmDialog';
import { DishCover } from '../components/DishCover';
import { GlassPanel } from '../components/GlassPanel';
import { PrimaryButton } from '../components/PrimaryButton';
import { StatTriple } from '../components/StatTriple';
import { Stepper } from '../components/Stepper';
import { formatAmount, formatQuantity, scaleAmount } from '../lib/recommend';
import { useAppStore, useDishById } from '../store/useAppStore';
import { colors, heroGradient, radius, screenPadding, shadow, spacing, typography } from '../theme';

interface Props {
  dishId: string;
  onClose: () => void;
  onGoShopping: () => void;
  /** 自己加的菜可以改、可以删 */
  onEditDish?: (dishId: string) => void;
  onDeleteDish?: (dishId: string) => void;
}

export function DishDetailScreen({ dishId, onClose, onGoShopping, onEditDish, onDeleteDish }: Props) {
  const insets = useSafeAreaInsets();
  const dish = useDishById(dishId);
  const isShared = useAppStore((state) => (state.sharedDishIds ?? []).includes(dishId));

  const familySize = useAppStore((state) => state.familySize);
  const setFamilySize = useAppStore((state) => state.setFamilySize);
  const favorites = useAppStore((state) => state.favorites);
  const toggleFavorite = useAppStore((state) => state.toggleFavorite);
  const addDishToShopping = useAppStore((state) => state.addDishToShopping);

  const [toast, setToast] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [scrolledPastCover, setScrolledPastCover] = useState(false);
  const toastOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!toast) return;
    Animated.timing(toastOpacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    const timer = setTimeout(() => {
      Animated.timing(toastOpacity, { toValue: 0, duration: 240, useNativeDriver: true }).start(() =>
        setToast(null),
      );
    }, 1700);
    return () => clearTimeout(timer);
  }, [toast, toastOpacity]);

  if (!dish) return null;

  const isFavorite = favorites.includes(dish.id);
  const ratio = familySize / dish.baseServings;

  const handleAddShopping = () => {
    const added = addDishToShopping(dish.id);
    setToast(added > 0 ? `已加入买菜清单 · ${added} 样食材` : '买菜清单里已经有这些了');
  };

  return (
    <View style={styles.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        scrollEventThrottle={32}
        onScroll={(event) => {
          const offset = event.nativeEvent.contentOffset.y;
          setScrolledPastCover((current) => {
            if (!current && offset > 250) return true;
            if (current && offset < 210) return false;
            return current;
          });
        }}
      >
        <View style={styles.hero}>
          <DishCover dish={dish} style={StyleSheet.absoluteFill} letterSize={96} />
          <LinearGradient colors={heroGradient} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} />
        </View>

        <View style={styles.sheet}>
          <View style={styles.taglineRow}>
            <Text style={styles.tagline}>{dish.tagline}</Text>
          </View>
          <Text style={styles.name}>{dish.name}</Text>
          {dish.description ? <Text style={styles.description}>{dish.description}</Text> : null}

          <View style={styles.tagRow}>
            {dish.tags.map((tag) => (
              <View key={tag} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>

          {dish.isCustom ? (
            <View style={styles.customRow}>
              <Text style={styles.customHint}>
                {isShared ? '已经上传到服务器，对方也能看到' : '这是你自己加的菜'}
              </Text>
              {onEditDish ? (
                <Pressable onPress={() => onEditDish(dish.id)} hitSlop={8} style={({ pressed }) => pressed && styles.pressed}>
                  <Text style={styles.customAction}>编辑</Text>
                </Pressable>
              ) : null}
              {onDeleteDish ? (
                <Pressable onPress={() => setConfirmDelete(true)} hitSlop={8} style={({ pressed }) => pressed && styles.pressed}>
                  <Text style={styles.customDelete}>删除</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          <View style={styles.statCard}>
            <StatTriple
              tone="light"
              items={[
                { icon: 'pricetag-outline', label: '成本', value: `约 ¥${dish.costYuan}` },
                { icon: 'time-outline', label: '用时', value: `${dish.minutes} 分钟` },
                { icon: 'flame-outline', label: '难度', value: dish.difficulty },
              ]}
            />
          </View>

          <View style={styles.servingsRow}>
            <View style={styles.servingsTextWrap}>
              <Text style={styles.blockTitle}>做几人的量</Text>
              <Text style={styles.blockHint}>下面的用料会跟着人数自动换算</Text>
            </View>
            <Stepper value={familySize} min={1} max={8} onChange={setFamilySize} suffix=" 人" />
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>要买的东西</Text>
              <Text style={styles.cardMeta}>{familySize} 人份</Text>
            </View>
            {dish.ingredients.map((ing, index) => (
              <View
                key={`${ing.name}-${ing.unit}`}
                style={[styles.ingredientRow, index === dish.ingredients.length - 1 && styles.rowLast]}
              >
                <View style={styles.ingredientNameWrap}>
                  <Text style={styles.ingredientName}>{ing.name}</Text>
                  {ing.staple ? <Text style={styles.stapleTag}>家里常备</Text> : null}
                </View>
                <Text style={styles.ingredientAmount}>
                  {formatQuantity(scaleAmount(ing.amount, dish.baseServings, familySize), ing.unit)}
                </Text>
                {ing.price > 0 ? (
                  <Text style={styles.ingredientPrice}>¥{formatAmount(Math.round(ing.price * ratio * 10) / 10)}</Text>
                ) : (
                  <Text style={styles.ingredientPrice}>家里有</Text>
                )}
              </View>
            ))}
            <View style={styles.ingredientFooter}>
              <Text style={styles.footerLabel}>这份大概花费</Text>
              <Text style={styles.footerValue}>约 ¥{Math.round(dish.costYuan * ratio)}</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>怎么做</Text>
            {dish.steps.map((step, index) => (
              <View key={step.text} style={styles.stepRow}>
                <View style={styles.stepIndex}>
                  <Text style={styles.stepIndexText}>{index + 1}</Text>
                </View>
                <View style={styles.stepBody}>
                  <Text style={styles.stepText}>{step.text}</Text>
                  {step.tip ? (
                    <View style={styles.tipRow}>
                      <Ionicons name="bulb-outline" size={13} color={colors.warning} />
                      <Text style={styles.tipText}>{step.tip}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            ))}
          </View>

          {dish.tips.length > 0 ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>小贴士</Text>
              {dish.tips.map((tip) => (
                <Text key={tip} style={styles.tipLine}>
                  · {tip}
                </Text>
              ))}
            </View>
          ) : null}
        </View>
      </ScrollView>

      <View
        style={[
          styles.topBar,
          { paddingTop: insets.top + 6 },
          scrolledPastCover && styles.topBarSolid,
        ]}
      >
        <Pressable onPress={onClose} hitSlop={10} style={({ pressed }) => [styles.circleButton, pressed && styles.pressed]}>
          <GlassPanel tone={scrolledPastCover ? 'light' : 'dark'} style={[styles.circleInner, scrolledPastCover && styles.circleInnerSolid]}>
            <Ionicons name="chevron-back" size={20} color={scrolledPastCover ? colors.text : '#FFFFFF'} />
          </GlassPanel>
        </Pressable>

        {scrolledPastCover ? (
          <Text style={styles.topBarTitle} numberOfLines={1}>
            {dish.name}
          </Text>
        ) : null}

        <Pressable
          onPress={() => toggleFavorite(dish.id)}
          hitSlop={10}
          style={({ pressed }) => [styles.circleButton, pressed && styles.pressed]}
        >
          <GlassPanel tone={scrolledPastCover ? 'light' : 'dark'} style={[styles.circleInner, scrolledPastCover && styles.circleInnerSolid]}>
            <Ionicons
              name={isFavorite ? 'heart' : 'heart-outline'}
              size={19}
              color={isFavorite ? '#FF8A75' : scrolledPastCover ? colors.text : '#FFFFFF'}
            />
          </GlassPanel>
        </Pressable>
      </View>

      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        <PrimaryButton
          label={isFavorite ? '已收藏' : '收藏'}
          icon="heart-outline"
          variant="outline"
          onPress={() => toggleFavorite(dish.id)}
          style={styles.bottomFav}
        />
        <PrimaryButton
          label="加入买菜清单"
          icon="cart-outline"
          onPress={handleAddShopping}
          style={styles.bottomCart}
        />
      </View>

      {toast ? (
        <Animated.View style={[styles.toast, { opacity: toastOpacity }]}>
          <Pressable onPress={onGoShopping} style={styles.toastInner}>
            <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />
            <Text style={styles.toastText}>{toast}</Text>
            <Text style={styles.toastAction}>去看看</Text>
          </Pressable>
        </Animated.View>
      ) : null}

      <ConfirmDialog
        visible={confirmDelete}
        title="删掉这道菜？"
        message="这是你自己加的菜，删了就找不回来了。"
        confirmLabel="删除"
        onConfirm={() => {
          onDeleteDish?.(dish.id);
          onClose();
        }}
        onClose={() => setConfirmDelete(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.bg,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  hero: {
    height: 320,
    backgroundColor: colors.surfaceAlt,
  },
  sheet: {
    marginTop: -28,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    backgroundColor: colors.bg,
    paddingHorizontal: screenPadding,
    paddingTop: spacing.xl,
  },
  taglineRow: {
    flexDirection: 'row',
  },
  tagline: {
    ...typography.label,
    color: colors.primary,
  },
  name: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    marginTop: 6,
  },
  description: {
    ...typography.body,
    color: colors.textSub,
    lineHeight: 21,
    marginTop: spacing.sm,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.md,
  },
  tag: {
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    marginRight: 6,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tagText: {
    ...typography.caption,
    color: colors.textSub,
  },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  customHint: {
    ...typography.caption,
    color: colors.textFaint,
    flex: 1,
  },
  customAction: {
    ...typography.label,
    color: colors.primary,
    marginRight: spacing.lg,
  },
  customDelete: {
    ...typography.label,
    color: colors.textFaint,
  },
  statCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
    ...shadow.card,
  },
  servingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xl,
  },
  servingsTextWrap: {
    flex: 1,
    marginRight: spacing.md,
  },
  blockTitle: {
    ...typography.body,
    fontWeight: '700',
    color: colors.text,
  },
  blockHint: {
    ...typography.caption,
    color: colors.textSub,
    marginTop: 3,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.lg,
    ...shadow.card,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  cardTitle: {
    ...typography.sectionTitle,
    fontSize: 16,
    color: colors.text,
  },
  cardMeta: {
    ...typography.caption,
    color: colors.textFaint,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  ingredientNameWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  ingredientName: {
    ...typography.body,
    color: colors.text,
  },
  stapleTag: {
    ...typography.caption,
    fontSize: 10,
    color: colors.textFaint,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 6,
    overflow: 'hidden',
  },
  ingredientAmount: {
    ...typography.body,
    fontWeight: '700',
    color: colors.text,
    marginRight: spacing.md,
  },
  ingredientPrice: {
    ...typography.caption,
    color: colors.textFaint,
    minWidth: 46,
    textAlign: 'right',
  },
  ingredientFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  footerLabel: {
    ...typography.body,
    color: colors.textSub,
  },
  footerValue: {
    ...typography.sectionTitle,
    fontSize: 17,
    color: colors.primary,
  },
  stepRow: {
    flexDirection: 'row',
    marginTop: spacing.md,
  },
  stepIndex: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    marginTop: 1,
  },
  stepIndexText: {
    ...typography.caption,
    fontWeight: '800',
    color: colors.primary,
  },
  stepBody: {
    flex: 1,
  },
  stepText: {
    ...typography.body,
    color: colors.text,
    lineHeight: 22,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  tipText: {
    ...typography.caption,
    color: colors.warning,
    marginLeft: 4,
    flex: 1,
  },
  tipLine: {
    ...typography.body,
    fontSize: 13,
    color: colors.textSub,
    lineHeight: 22,
    marginTop: 6,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: screenPadding,
    paddingBottom: 6,
  },
  topBarSolid: {
    backgroundColor: colors.bg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  topBarTitle: {
    position: 'absolute',
    left: 72,
    right: 72,
    bottom: 16,
    ...typography.sectionTitle,
    fontSize: 16,
    color: colors.text,
    textAlign: 'center',
  },
  circleButton: {
    borderRadius: radius.pill,
  },
  circleInner: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleInnerSolid: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: {
    opacity: 0.75,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingHorizontal: screenPadding,
    paddingTop: spacing.md,
  },
  bottomFav: {
    flex: 1,
    marginRight: spacing.md,
  },
  bottomCart: {
    flex: 1.6,
  },
  toast: {
    position: 'absolute',
    left: screenPadding,
    right: screenPadding,
    bottom: 108,
  },
  toastInner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(24,16,10,0.9)',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
  },
  toastText: {
    ...typography.body,
    fontSize: 13,
    color: '#FFFFFF',
    flex: 1,
    marginLeft: 8,
  },
  toastAction: {
    ...typography.label,
    color: '#FFB4A2',
  },
});
