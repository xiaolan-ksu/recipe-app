import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Chip } from '../components/Chip';
import { DishCover } from '../components/DishCover';
import { PrimaryButton } from '../components/PrimaryButton';
import { Stepper } from '../components/Stepper';
import { CATEGORIES as DISH_CATEGORIES, INGREDIENT_GROUPS } from '../constants';
import { persistPhoto, pickPhoto } from '../lib/photo';
import { uploadDishPhoto } from '../lib/share';
import { useAppStore, type CustomDishInput } from '../store/useAppStore';
import { colors, radius, screenPadding, shadow, spacing, typography } from '../theme';
import type { Category, Dish, DishIngredient, IngredientGroup } from '../types';

const DIFFICULTIES = ['零失败', '容易', '有点难'];

let draftSeed = 0;
const nextKey = (): string => {
  draftSeed += 1;
  return `draft-${draftSeed}`;
};

interface DraftIngredient {
  key: string;
  name: string;
  amount: string;
  unit: string;
  group: IngredientGroup;
  staple: boolean;
  price: string;
}

interface DraftStep {
  key: string;
  text: string;
}

interface Props {
  /** 传了就是改这道菜，不传就是新加一道 */
  dish?: Dish;
  onClose: () => void;
  onSaved: (dishId: string, isNew: boolean) => void;
}

/** 自己加菜：填名称、用料、步骤，可以配一张照片 */
export function DishEditorScreen({ dish, onClose, onSaved }: Props) {
  const insets = useSafeAreaInsets();
  const addCustomDish = useAppStore((state) => state.addCustomDish);
  const updateCustomDish = useAppStore((state) => state.updateCustomDish);
  const shareToken = useAppStore((state) => state.shareToken);
  const sharedDishIds = useAppStore((state) => state.sharedDishIds);
  const uploadDish = useAppStore((state) => state.uploadDish);
  const unshareDish = useAppStore((state) => state.unshareDish);

  /** 没配对「共享清单」之前，没有服务器可传 */
  const paired = Boolean(shareToken);
  const wasShared = Boolean(dish && (sharedDishIds ?? []).includes(dish.id));
  const [share, setShare] = useState(wasShared);

  const [name, setName] = useState(dish?.name ?? '');
  const [category, setCategory] = useState<Category>(dish?.category ?? DISH_CATEGORIES[0]);
  const [description, setDescription] = useState(dish?.description ?? '');
  const [cost, setCost] = useState(dish ? String(dish.costYuan) : '');
  const [minutes, setMinutes] = useState(dish ? String(dish.minutes) : '');
  const [difficulty, setDifficulty] = useState(dish?.difficulty ?? '零失败');
  const [tags, setTags] = useState(dish ? dish.tags.join('、') : '');
  const [baseServings, setBaseServings] = useState(dish?.baseServings ?? 2);
  const [coverUri, setCoverUri] = useState<string | undefined>(coverOf(dish));
  const [ingredients, setIngredients] = useState<DraftIngredient[]>(ingredientDrafts(dish));
  const [steps, setSteps] = useState<DraftStep[]>(stepDrafts(dish));
  const [tips, setTips] = useState(dish ? dish.tips.join('\n') : '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const updateIngredient = (key: string, patch: Partial<DraftIngredient>) =>
    setIngredients((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  const updateStep = (key: string, text: string) =>
    setSteps((rows) => rows.map((row) => (row.key === key ? { ...row, text } : row)));

  const pickImage = async () => {
    const picked = await pickPhoto('library', { aspect: [4, 3], quality: 0.8 });
    if (!picked.ok) {
      if (picked.reason === 'denied') setError('没有相册权限，可以在手机设置里打开，或者不要照片也行');
      return;
    }
    setError('');
    setCoverUri(picked.uri);
  };

  const handleSave = async () => {
    const goodIngredients = ingredients.filter((row) => row.name.trim().length > 0);
    const goodSteps = steps.filter((row) => row.text.trim().length > 0);

    if (name.trim().length === 0) {
      setError('先给这道菜起个名字');
      return;
    }
    if (goodIngredients.length === 0) {
      setError('至少填一样用料');
      return;
    }
    if (goodSteps.length === 0) {
      setError('至少写一步做法');
      return;
    }

    setError('');
    setSaving(true);

    const id = dish?.id ?? `custom-${Date.now()}`;
    const savedCover = coverUri ? await persistPhoto(coverUri, 'dish-covers', id) : undefined;

    // 勾了「上传到服务器」就先把照片传上去，传不上去先别保存，
    // 免得对方收到一道没有图的菜（这会儿还没写进本地，再点一次保存是安全的）
    let hasPhoto = false;
    if (share && shareToken) {
      const localPhoto = savedCover && savedCover.startsWith('file://') ? savedCover : undefined;
      if (localPhoto) {
        hasPhoto = await uploadDishPhoto(shareToken, id, localPhoto);
        if (!hasPhoto) {
          setSaving(false);
          setError('照片没传上去（网络问题？）。再点一次「保存」，或者先关掉「上传到服务器」。');
          return;
        }
      } else if (coverUri && !coverUri.startsWith('file://')) {
        // 照片本来就在服务器上（这道菜是从对方那边同步过来的），不用重传
        hasPhoto = true;
      }
    }

    const payload: CustomDishInput = {
      name: name.trim(),
      category,
      coverUri: savedCover,
      description: description.trim(),
      costYuan: toNumber(cost, 0),
      minutes: toNumber(minutes, 0),
      difficulty,
      tags: parseTags(tags, category, difficulty),
      baseServings,
      ingredients: goodIngredients.map<DishIngredient>((row) => ({
        name: row.name.trim(),
        amount: toNumber(row.amount, 1) || 1,
        unit: row.unit.trim() || '份',
        group: row.group,
        price: toNumber(row.price, 0),
        staple: row.staple,
      })),
      steps: goodSteps.map((row) => ({ text: row.text.trim() })),
      tips: tips
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0),
    };

    if (dish) updateCustomDish(dish.id, payload);
    else addCustomDish(payload, id);

    // 上传还是不上传，用户自己定；本来是共享的、这次关掉了，就从服务器撤下来
    if (shareToken) {
      if (share) uploadDish(id, { hasPhoto });
      else if (wasShared) unshareDish(id);
    }

    onSaved(id, !dish);
  };

  return (
    <View style={styles.root}>
      <View style={[styles.topBar, { paddingTop: insets.top + 6 }]}>
        <Pressable onPress={onClose} hitSlop={10} style={({ pressed }) => pressed && styles.pressed}>
          <Text style={styles.cancel}>取消</Text>
        </Pressable>
        <Text style={styles.topTitle}>{dish ? '编辑菜谱' : '加一道自己的菜'}</Text>
        <Pressable onPress={() => void handleSave()} hitSlop={10} style={({ pressed }) => pressed && styles.pressed}>
          <Text style={styles.save}>{saving ? '保存中…' : '保存'}</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.photoCard}>
          <DishCover dish={{ name: name || '新菜', cover: coverUri ? { uri: coverUri } : undefined }} style={styles.photo} letterSize={56} />
          <View style={styles.photoActions}>
            <PrimaryButton
              label={coverUri ? '换一张照片' : '从相册选一张'}
              icon="image-outline"
              variant="outline"
              onPress={() => void pickImage()}
              style={styles.photoButton}
            />
            {coverUri ? (
              <Pressable onPress={() => setCoverUri(undefined)} hitSlop={8} style={({ pressed }) => pressed && styles.pressed}>
                <Text style={styles.removePhoto}>不要照片</Text>
              </Pressable>
            ) : (
              <Text style={styles.photoHint}>不选也行，会用菜名首字做封面</Text>
            )}
          </View>
        </View>

        <Pressable
          onPress={() => {
            if (paired) setShare((value) => !value);
          }}
          disabled={!paired}
          style={({ pressed }) => [styles.shareCard, pressed && paired && styles.pressed]}
        >
          <View style={styles.shareText}>
            <Text style={styles.shareTitle}>上传到服务器</Text>
            <Text style={styles.shareHint}>
              {paired
                ? share
                  ? '开着：这道菜（连同照片）对方也能在菜谱里看到、能用。关掉就从对方那边撤下来。'
                  : '打开以后，对方也能在菜谱里看到、能用这道菜；不打开就只留在这台手机上。'
                : '要先把「我的 → 共享清单」配对好，才能把菜分享给对方。'}
            </Text>
          </View>
          <View style={[styles.switchTrack, share && styles.switchTrackOn, !paired && styles.switchOff]}>
            <View style={[styles.switchKnob, share && styles.switchKnobOn]} />
          </View>
        </Pressable>

        <View style={styles.card}>
          <Text style={styles.label}>菜名</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="比如：外婆的番茄牛腩"
            placeholderTextColor={colors.textFaint}
            style={styles.input}
          />

          <Text style={styles.label}>算哪一类</Text>
          <View style={styles.chipRow}>
            {DISH_CATEGORIES.map((item) => (
              <Chip key={item} label={item} compact active={category === item} onPress={() => setCategory(item)} />
            ))}
          </View>

          <Text style={styles.label}>一句话介绍</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="比如：牛腩炖到软烂，汤泡饭能吃两碗"
            placeholderTextColor={colors.textFaint}
            style={[styles.input, styles.inputMulti]}
            multiline
          />

          <View style={styles.twoColumns}>
            <View style={styles.column}>
              <Text style={styles.label}>大概多少钱</Text>
              <TextInput
                value={cost}
                onChangeText={setCost}
                placeholder="35"
                placeholderTextColor={colors.textFaint}
                keyboardType="numeric"
                style={styles.input}
              />
            </View>
            <View style={styles.column}>
              <Text style={styles.label}>要做多久（分钟）</Text>
              <TextInput
                value={minutes}
                onChangeText={setMinutes}
                placeholder="40"
                placeholderTextColor={colors.textFaint}
                keyboardType="numeric"
                style={styles.input}
              />
            </View>
          </View>

          <Text style={styles.label}>难度</Text>
          <View style={styles.chipRow}>
            {DIFFICULTIES.map((item) => (
              <Chip key={item} label={item} compact active={difficulty === item} onPress={() => setDifficulty(item)} />
            ))}
          </View>

          <Text style={styles.label}>标签（用顿号隔开，可不填）</Text>
          <TextInput
            value={tags}
            onChangeText={setTags}
            placeholder="家常、下饭、孩子爱吃"
            placeholderTextColor={colors.textFaint}
            style={styles.input}
          />

          <View style={styles.servingsRow}>
            <View style={styles.servingsText}>
              <Text style={styles.label}>这是几人的量</Text>
              <Text style={styles.hint}>菜谱详情里会按你家人数自动换算</Text>
            </View>
            <Stepper value={baseServings} min={1} max={8} onChange={setBaseServings} suffix=" 人" />
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>用料</Text>
            <Text style={styles.cardMeta}>{ingredients.length} 样</Text>
          </View>

          {ingredients.map((row, index) => (
            <View key={row.key} style={[styles.ingredientRow, index === ingredients.length - 1 && styles.rowLast]}>
              <View style={styles.ingredientTop}>
                <TextInput
                  value={row.name}
                  onChangeText={(text) => updateIngredient(row.key, { name: text })}
                  placeholder="食材，比如：牛腩"
                  placeholderTextColor={colors.textFaint}
                  style={[styles.input, styles.ingredientName]}
                />
                <TextInput
                  value={row.amount}
                  onChangeText={(text) => updateIngredient(row.key, { amount: text })}
                  placeholder="500"
                  placeholderTextColor={colors.textFaint}
                  keyboardType="numeric"
                  style={[styles.input, styles.amount]}
                />
                <TextInput
                  value={row.unit}
                  onChangeText={(text) => updateIngredient(row.key, { unit: text })}
                  placeholder="克"
                  placeholderTextColor={colors.textFaint}
                  style={[styles.input, styles.unit]}
                />
                <Pressable
                  onPress={() => setIngredients((rows) => rows.filter((item) => item.key !== row.key))}
                  hitSlop={8}
                  style={({ pressed }) => pressed && styles.pressed}
                >
                  <Ionicons name="close" size={16} color={colors.textFaint} />
                </Pressable>
              </View>

              <View style={styles.ingredientBottom}>
                {INGREDIENT_GROUPS.map((group) => (
                  <Chip
                    key={group}
                    label={group}
                    compact
                    active={row.group === group}
                    onPress={() => updateIngredient(row.key, { group })}
                  />
                ))}
                <Chip
                  label="家里常备"
                  compact
                  active={row.staple}
                  onPress={() => updateIngredient(row.key, { staple: !row.staple })}
                />
                <TextInput
                  value={row.price}
                  onChangeText={(text) => updateIngredient(row.key, { price: text })}
                  placeholder="¥单价"
                  placeholderTextColor={colors.textFaint}
                  keyboardType="numeric"
                  style={[styles.input, styles.price]}
                />
              </View>
            </View>
          ))}

          <PrimaryButton
            label="加一样用料"
            icon="add"
            variant="ghost"
            onPress={() =>
              setIngredients((rows) => [
                ...rows,
                { key: nextKey(), name: '', amount: '', unit: '', group: '蔬菜', staple: false, price: '' },
              ])
            }
            style={styles.addButton}
          />
          <Text style={styles.hint}>勾了「家里常备」的调料不会进买菜清单；填了单价，买菜页的总价才算得准。</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>做法</Text>
            <Text style={styles.cardMeta}>{steps.length} 步</Text>
          </View>

          {steps.map((row, index) => (
            <View key={row.key} style={styles.stepRow}>
              <View style={styles.stepIndex}>
                <Text style={styles.stepIndexText}>{index + 1}</Text>
              </View>
              <TextInput
                value={row.text}
                onChangeText={(text) => updateStep(row.key, text)}
                placeholder="这一步做什么"
                placeholderTextColor={colors.textFaint}
                style={[styles.input, styles.stepInput]}
                multiline
              />
              <Pressable
                onPress={() => setSteps((rows) => rows.filter((item) => item.key !== row.key))}
                hitSlop={8}
                style={({ pressed }) => pressed && styles.pressed}
              >
                <Ionicons name="close" size={16} color={colors.textFaint} />
              </Pressable>
            </View>
          ))}

          <PrimaryButton
            label="加一步"
            icon="add"
            variant="ghost"
            onPress={() => setSteps((rows) => [...rows, { key: nextKey(), text: '' }])}
            style={styles.addButton}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>小贴士（一行一条，可不填）</Text>
          <TextInput
            value={tips}
            onChangeText={setTips}
            placeholder="牛腩先焯水再炖，汤更清"
            placeholderTextColor={colors.textFaint}
            style={[styles.input, styles.inputMulti, styles.tipsInput]}
            multiline
          />
        </View>

        {error.length > 0 ? (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle-outline" size={15} color={colors.primary} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <PrimaryButton
          label={saving ? '正在保存…' : dish ? '保存修改' : '保存这道菜'}
          icon="checkmark"
          loading={saving}
          onPress={() => void handleSave()}
          style={styles.submit}
        />
      </ScrollView>
    </View>
  );
}

function coverOf(dish?: Dish): string | undefined {
  if (!dish?.cover) return undefined;
  const cover = dish.cover as { uri?: string };
  return typeof cover === 'object' && 'uri' in cover ? cover.uri : undefined;
}

function ingredientDrafts(dish?: Dish): DraftIngredient[] {
  if (!dish || dish.ingredients.length === 0) {
    return [{ key: nextKey(), name: '', amount: '', unit: '', group: '蔬菜', staple: false, price: '' }];
  }
  return dish.ingredients.map((ing) => ({
    key: nextKey(),
    name: ing.name,
    amount: String(ing.amount),
    unit: ing.unit,
    group: ing.group,
    staple: Boolean(ing.staple),
    price: ing.price > 0 ? String(ing.price) : '',
  }));
}

function stepDrafts(dish?: Dish): DraftStep[] {
  if (!dish || dish.steps.length === 0) {
    return [{ key: nextKey(), text: '' }];
  }
  return dish.steps.map((step) => ({ key: nextKey(), text: step.text }));
}

function toNumber(value: string, fallback: number): number {
  const parsed = Number(value.replace(/[^\d.]/g, ''));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseTags(raw: string, category: Category, difficulty: string): string[] {
  const parsed = raw
    .split(/[、,，\s]+/)
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
  return parsed.length > 0 ? parsed : [category, difficulty];
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
  scroll: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: screenPadding,
    paddingBottom: spacing.md,
    backgroundColor: colors.bg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  cancel: {
    ...typography.body,
    color: colors.textSub,
  },
  topTitle: {
    ...typography.sectionTitle,
    fontSize: 17,
    color: colors.text,
  },
  save: {
    ...typography.body,
    fontWeight: '700',
    color: colors.primary,
  },
  content: {
    paddingHorizontal: screenPadding,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl * 2,
  },
  photoCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    ...shadow.card,
  },
  photo: {
    width: '100%',
    height: 168,
    borderRadius: radius.md,
  },
  photoActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  photoButton: {
    height: 44,
    paddingHorizontal: spacing.xl,
    marginRight: spacing.md,
  },
  removePhoto: {
    ...typography.label,
    color: colors.textFaint,
  },
  photoHint: {
    ...typography.caption,
    color: colors.textFaint,
    flex: 1,
  },
  shareCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.lg,
    ...shadow.card,
  },
  shareText: {
    flex: 1,
    marginRight: spacing.md,
  },
  shareTitle: {
    ...typography.body,
    fontWeight: '700',
    color: colors.text,
  },
  shareHint: {
    ...typography.caption,
    color: colors.textSub,
    lineHeight: 17,
    marginTop: 3,
  },
  switchTrack: {
    width: 46,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    padding: 3,
    justifyContent: 'center',
  },
  switchTrackOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  switchKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    ...shadow.card,
  },
  switchKnobOn: {
    alignSelf: 'flex-end',
  },
  switchOff: {
    opacity: 0.45,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.lg,
    ...shadow.card,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  label: {
    ...typography.label,
    color: colors.textSub,
    marginTop: spacing.lg,
    marginBottom: 6,
  },
  hint: {
    ...typography.caption,
    color: colors.textFaint,
    lineHeight: 17,
    marginTop: 6,
  },
  input: {
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    ...typography.body,
    color: colors.text,
  },
  inputMulti: {
    minHeight: 66,
  },
  tipsInput: {
    minHeight: 78,
    marginTop: spacing.md,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 2,
  },
  twoColumns: {
    flexDirection: 'row',
  },
  column: {
    flex: 1,
  },
  servingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  servingsText: {
    flex: 1,
    marginRight: spacing.md,
  },
  ingredientRow: {
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  ingredientTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ingredientName: {
    flex: 1,
    marginRight: spacing.sm,
  },
  amount: {
    width: 62,
    marginRight: spacing.sm,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  unit: {
    width: 52,
    marginRight: spacing.sm,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  ingredientBottom: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  price: {
    width: 86,
    height: 32,
    minHeight: 32,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    marginBottom: 6,
    ...typography.caption,
  },
  addButton: {
    height: 44,
    marginTop: spacing.md,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: spacing.md,
  },
  stepIndex: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
    marginTop: 10,
  },
  stepIndexText: {
    ...typography.caption,
    fontWeight: '800',
    color: colors.primary,
  },
  stepInput: {
    flex: 1,
    marginRight: spacing.sm,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  errorText: {
    ...typography.body,
    fontSize: 13,
    color: colors.primaryDark,
    marginLeft: 6,
    flex: 1,
  },
  submit: {
    marginTop: spacing.xl,
  },
  pressed: {
    opacity: 0.7,
  },
});
