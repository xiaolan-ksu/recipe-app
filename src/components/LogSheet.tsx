import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, screenPadding, spacing, typography } from '../theme';
import { useKeyboardGap } from '../lib/useKeyboardGap';
import type { Dish } from '../types';
import { DishCover } from './DishCover';
import { PrimaryButton } from './PrimaryButton';
import { useAllDishes } from '../store/useAppStore';

interface Props {
  visible: boolean;
  favorites: string[];
  defaultDishId?: string;
  onClose: () => void;
  onSubmit: (dishId: string, rating: number, note: string) => void;
}

const RATING_HINT: Record<number, string> = {
  1: '凑合吃',
  2: '还能吃',
  3: '味道不错',
  4: '很下饭',
  5: '太香了，再做一次',
};

/** 「记一笔」：记下今天做的菜、打几颗星、写一句话 */
export function LogSheet({ visible, favorites, defaultDishId, onClose, onSubmit }: Props) {
  const insets = useSafeAreaInsets();
  const allDishes = useAllDishes();
  const [keyword, setKeyword] = useState('');
  // 写备注、搜菜名时键盘弹起来，弹层要跟着上移
  const keyboardGap = useKeyboardGap(visible);
  const [dishId, setDishId] = useState<string | null>(defaultDishId ?? null);
  const [rating, setRating] = useState(5);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!visible) return;
    setKeyword('');
    setDishId(defaultDishId ?? null);
    setRating(5);
    setNote('');
  }, [visible, defaultDishId]);

  const list = useMemo(() => {
    const query = keyword.trim();
    const filtered = query.length === 0
      ? allDishes
      : allDishes.filter(
          (dish) => dish.name.includes(query) || dish.ingredients.some((ing) => ing.name.includes(query)),
        );
    // 收藏过的排前面，方便常做的菜快速找到
    return [...filtered].sort((a, b) => {
      const favA = favorites.includes(a.id) ? 1 : 0;
      const favB = favorites.includes(b.id) ? 1 : 0;
      if (favA !== favB) return favB - favA;
      return b.popularity - a.popularity;
    });
  }, [allDishes, keyword, favorites]);

  const renderDish = ({ item }: { item: Dish }) => {
    const selected = item.id === dishId;
    return (
      <Pressable
        onPress={() => setDishId(item.id)}
        style={({ pressed }) => [styles.dishRow, selected && styles.dishRowActive, pressed && styles.pressed]}
      >
        <DishCover dish={item} style={styles.dishCover} letterSize={22} />
        <View style={styles.dishBody}>
          <Text style={styles.dishName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.dishMeta} numberOfLines={1}>
            {item.category} · {item.minutes} 分钟
            {favorites.includes(item.id) ? ' · 已收藏' : ''}
          </Text>
        </View>
        <Ionicons
          name={selected ? 'radio-button-on' : 'radio-button-off'}
          size={19}
          color={selected ? colors.primary : colors.textFaint}
        />
      </Pressable>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View
        style={[
          styles.sheet,
          { paddingBottom: Math.max(insets.bottom, spacing.lg), marginBottom: keyboardGap },
        ]}
      >
        <View style={styles.handle} />

        <View style={styles.header}>
          <Text style={styles.title}>记一笔</Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={22} color={colors.textSub} />
          </Pressable>
        </View>

        <View style={styles.searchWrap}>
          <Ionicons name="search" size={16} color={colors.textFaint} />
          <TextInput
            value={keyword}
            onChangeText={setKeyword}
            placeholder="今天做的哪道菜？"
            placeholderTextColor={colors.textFaint}
            style={styles.searchInput}
          />
        </View>

        <FlatList
          data={list}
          style={styles.list}
          keyExtractor={(item) => item.id}
          renderItem={renderDish}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<Text style={styles.emptyText}>没找到这道菜，换个词试试</Text>}
        />

        <View style={styles.ratingBlock}>
          <Text style={styles.blockTitle}>这次做得怎么样</Text>
          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Pressable key={star} onPress={() => setRating(star)} hitSlop={6}>
                <Ionicons
                  name={star <= rating ? 'star' : 'star-outline'}
                  size={26}
                  color={star <= rating ? '#E8A33D' : colors.textFaint}
                  style={styles.star}
                />
              </Pressable>
            ))}
            <Text style={styles.ratingHint}>{RATING_HINT[rating]}</Text>
          </View>
        </View>

        <View style={styles.noteWrap}>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="写一句话，比如「咸了一点点」"
            placeholderTextColor={colors.textFaint}
            style={styles.noteInput}
            multiline
          />
        </View>

        <PrimaryButton
          label="保存这条记录"
          icon="checkmark"
          disabled={!dishId}
          onPress={() => {
            if (!dishId) return;
            onSubmit(dishId, rating, note.trim());
          }}
          style={styles.submit}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.scrim,
  },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: spacing.sm,
    maxHeight: '90%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: screenPadding,
    marginBottom: spacing.md,
  },
  title: {
    ...typography.sectionTitle,
    color: colors.text,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: screenPadding,
    height: 42,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    fontSize: 13,
    color: colors.text,
    marginLeft: spacing.sm,
    padding: 0,
  },
  list: {
    marginTop: spacing.md,
    height: 216,
    flexGrow: 0,
  },
  listContent: {
    paddingHorizontal: screenPadding,
    paddingBottom: spacing.sm,
  },
  dishRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  dishRowActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  dishCover: {
    width: 46,
    height: 46,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
  },
  dishBody: {
    flex: 1,
    marginLeft: spacing.md,
    marginRight: spacing.sm,
  },
  dishName: {
    ...typography.body,
    fontWeight: '700',
    color: colors.text,
  },
  dishMeta: {
    ...typography.caption,
    color: colors.textSub,
    marginTop: 3,
  },
  emptyText: {
    ...typography.body,
    fontSize: 13,
    color: colors.textSub,
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
  ratingBlock: {
    paddingHorizontal: screenPadding,
    marginTop: spacing.md,
  },
  blockTitle: {
    ...typography.body,
    fontWeight: '700',
    color: colors.text,
  },
  stars: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  star: {
    marginRight: 6,
  },
  ratingHint: {
    ...typography.caption,
    color: colors.primary,
    marginLeft: spacing.sm,
  },
  noteWrap: {
    marginHorizontal: screenPadding,
    marginTop: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    minHeight: 46,
    justifyContent: 'center',
  },
  noteInput: {
    ...typography.body,
    fontSize: 13,
    color: colors.text,
    paddingVertical: 10,
  },
  submit: {
    marginHorizontal: screenPadding,
    marginTop: spacing.lg,
  },
  pressed: {
    opacity: 0.75,
  },
});
