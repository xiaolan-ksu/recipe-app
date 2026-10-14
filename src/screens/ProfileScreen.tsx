import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Chip } from '../components/Chip';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { DishCover } from '../components/DishCover';
import { DishMiniCard } from '../components/DishMiniCard';
import { HScroll } from '../components/HScroll';
import { LogSheet } from '../components/LogSheet';
import { PrimaryButton } from '../components/PrimaryButton';
import { ProfileSheet } from '../components/ProfileSheet';
import { ShareSheet } from '../components/ShareSheet';
import { SectionHeader } from '../components/SectionHeader';
import { Stepper } from '../components/Stepper';
import { Toast } from '../components/Toast';
import { UpdateSheet } from '../components/UpdateSheet';
import { AVOID_OPTIONS } from '../constants';
import { calcStreak, formatDate, today } from '../lib/recommend';
import { SHARE_STATUS_LABEL, useShareStatus } from '../lib/shareStatus';
import { appVersionOf } from '../lib/updates';
import { useLocationLabel } from '../lib/useLocationLabel';
import { useAllDishes, useAppStore } from '../store/useAppStore';
import { colors, radius, screenPadding, shadow, spacing, typography } from '../theme';
import type { Dish } from '../types';

interface Props {
  onOpenDish: (dishId: string) => void;
  onAddDish: () => void;
  onEditDish: (dishId: string) => void;
}

export function ProfileScreen({ onOpenDish, onAddDish, onEditDish }: Props) {
  const insets = useSafeAreaInsets();
  const [logOpen, setLogOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [updateOpen, setUpdateOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const { label: locationLabel } = useLocationLabel();
  const shareToken = useAppStore((state) => state.shareToken);
  const shareSyncedAt = useAppStore((state) => state.shareSyncedAt);
  const shareStatus = useShareStatus();
  const profileName = useAppStore((state) => state.profileName);
  const profileAvatar = useAppStore((state) => state.profileAvatar);
  const setProfileName = useAppStore((state) => state.setProfileName);
  const setProfileAvatar = useAppStore((state) => state.setProfileAvatar);
  const familySize = useAppStore((state) => state.familySize);
  const setFamilySize = useAppStore((state) => state.setFamilySize);
  const favorites = useAppStore((state) => state.favorites);
  const toggleFavorite = useAppStore((state) => state.toggleFavorite);
  const logs = useAppStore((state) => state.logs);
  const addLog = useAppStore((state) => state.addLog);
  const removeLog = useAppStore((state) => state.removeLog);
  const avoid = useAppStore((state) => state.avoid);
  const toggleAvoid = useAppStore((state) => state.toggleAvoid);
  const resetAll = useAppStore((state) => state.resetAll);
  const customDishes = useAppStore((state) => state.customDishes);

  const allDishes = useAllDishes();
  const dishById = useMemo(() => new Map(allDishes.map((dish) => [dish.id, dish])), [allDishes]);
  const streak = useMemo(() => calcStreak(logs, today()), [logs]);
  const cookedDishIds = useMemo(() => [...new Set(logs.map((log) => log.dishId))], [logs]);
  const favoriteDishes = useMemo(
    () => favorites.map((id) => dishById.get(id)).filter((dish): dish is Dish => Boolean(dish)),
    [dishById, favorites],
  );
  const averageRating =
    logs.length > 0 ? Math.round((logs.reduce((sum, log) => sum + log.rating, 0) / logs.length) * 10) / 10 : 0;

  const shareHint = !shareToken
    ? '两个人共用一份买菜清单和冰箱库存，点这里配对'
    : shareStatus.status === 'online' && shareSyncedAt > 0
      ? `已连接 · 上次同步 ${new Date(shareSyncedAt).toLocaleTimeString('zh-CN', { hour12: false })}`
      : SHARE_STATUS_LABEL[shareStatus.status];

  const versionLabel = appVersionOf();

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.root}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.md }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>我的</Text>
        <Text style={styles.subtitle}>收藏、做过的饭，还有你家的忌口</Text>

        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <Pressable
              onPress={() => setProfileOpen(true)}
              hitSlop={6}
              style={({ pressed }) => [styles.avatarPress, pressed && styles.pressed]}
            >
              <View style={styles.avatar}>
                {profileAvatar ? (
                  <Image
                    source={{ uri: profileAvatar }}
                    style={styles.avatarImage}
                    contentFit="cover"
                    transition={200}
                  />
                ) : (
                  <Ionicons name="person" size={24} color={colors.primary} />
                )}
              </View>
              <View style={styles.avatarBadge}>
                <Ionicons name="camera" size={10} color="#FFFFFF" />
              </View>
            </Pressable>
            <View style={styles.heroBody}>
              <Pressable
                onPress={() => setProfileOpen(true)}
                hitSlop={6}
                style={({ pressed }) => [styles.nameRow, pressed && styles.pressed]}
              >
                <Text style={styles.heroName} numberOfLines={1}>
                  {profileName}
                </Text>
                <Ionicons name="create-outline" size={14} color={colors.textFaint} style={styles.nameEdit} />
              </Pressable>
              <Text style={styles.heroMeta}>
                {locationLabel.length > 0 ? `${locationLabel} · ` : ''}
                {familySize} 人吃饭
              </Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statCell}>
              <Text style={styles.statValue}>{streak}</Text>
              <Text style={styles.statLabel}>连续认真吃饭</Text>
            </View>
            <View style={[styles.statCell, styles.statDivider]}>
              <Text style={styles.statValue}>{logs.length}</Text>
              <Text style={styles.statLabel}>做过的饭</Text>
            </View>
            <View style={[styles.statCell, styles.statDivider]}>
              <Text style={styles.statValue}>{favorites.length}</Text>
              <Text style={styles.statLabel}>收藏的菜</Text>
            </View>
          </View>

          <Text style={styles.heroHint}>
            {streak > 0
              ? `已经连着 ${streak} 天好好吃饭了，别断`
              : '做完饭点「记一笔」，天数就会一天天涨起来'}
          </Text>

          <Pressable
            onPress={() => setProfileOpen(true)}
            style={({ pressed }) => [styles.editRow, pressed && styles.pressed]}
          >
            <Ionicons name="create-outline" size={12} color={colors.primary} />
            <Text style={styles.editRowText}>点这里换头像、改昵称</Text>
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>共享清单</Text>
          <Text style={styles.sectionHint}>{shareHint}</Text>
          <Pressable
            onPress={() => setShareOpen(true)}
            style={({ pressed }) => [styles.shareRow, pressed && styles.pressed]}
          >
            <View style={styles.shareIcon}>
              <Ionicons name="people-outline" size={18} color={colors.primary} />
            </View>
            <View style={styles.shareBody}>
              <Text style={styles.shareTitle}>{shareToken ? '共享中' : '还没配对'}</Text>
              <Text style={styles.shareMeta}>
                {shareToken ? '买菜清单和冰箱库存跟对方同步' : '和家里人共用一份清单'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
          </Pressable>
        </View>

        <View style={styles.section}>
          <SectionHeader title={`收藏的菜（${favorites.length}）`} />
          {favoriteDishes.length === 0 ? (
            <Text style={styles.emptyHint}>还没有收藏。在菜卡右上角点一下爱心，菜就存在这里了。</Text>
          ) : (
            <HScroll
              style={styles.favScroll}
              contentContainerStyle={styles.favContent}
            >
              {favoriteDishes.map((dish) => (
                <DishMiniCard key={dish.id} dish={dish} isFavorite onPress={() => onOpenDish(dish.id)} />
              ))}
            </HScroll>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <View style={styles.sectionHeadText}>
              <Text style={styles.sectionTitle}>我加的菜</Text>
              <Text style={styles.sectionHint}>
                {customDishes.length > 0
                  ? `一共 ${customDishes.length} 道，点菜名能看，点「编辑」能改`
                  : '把家里的拿手菜记下来，推荐和买菜清单都会用上'}
              </Text>
            </View>
            <Pressable onPress={onAddDish} style={({ pressed }) => [styles.logButton, pressed && styles.pressed]}>
              <Ionicons name="add" size={15} color="#FFFFFF" />
              <Text style={styles.logButtonText}>加一道</Text>
            </Pressable>
          </View>

          {customDishes.length === 0 ? (
            <Pressable onPress={onAddDish} style={({ pressed }) => [styles.logEmpty, pressed && styles.pressed]}>
              <Ionicons name="create-outline" size={17} color={colors.primary} />
              <Text style={styles.logEmptyText}>比如「外婆的番茄牛腩」，点这里加进来</Text>
            </Pressable>
          ) : (
            customDishes.map((dish) => (
              <View key={dish.id} style={styles.logRow}>
                <Pressable onPress={() => onOpenDish(dish.id)} style={styles.logMain}>
                  <DishCover dish={dish} style={styles.logCover} letterSize={22} />
                  <View style={styles.logBody}>
                    <Text style={styles.logName} numberOfLines={1}>
                      {dish.name}
                    </Text>
                    <Text style={styles.logNote} numberOfLines={1}>
                      {dish.category} · {dish.minutes} 分钟 · 用料 {dish.ingredients.length} 样
                    </Text>
                  </View>
                </Pressable>
                <Pressable onPress={() => onEditDish(dish.id)} hitSlop={8} style={({ pressed }) => pressed && styles.pressed}>
                  <Text style={styles.editText}>编辑</Text>
                </Pressable>
              </View>
            ))
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <View>
              <Text style={styles.sectionTitle}>做饭记录</Text>
              <Text style={styles.sectionHint}>
                {logs.length > 0
                  ? `记了 ${logs.length} 次，做过 ${cookedDishIds.length} 道菜，平均 ${averageRating} 颗星`
                  : '做了什么菜、好不好吃，记下来有意思'}
              </Text>
            </View>
            <Pressable
              onPress={() => setLogOpen(true)}
              style={({ pressed }) => [styles.logButton, pressed && styles.pressed]}
            >
              <Ionicons name="create-outline" size={15} color="#FFFFFF" />
              <Text style={styles.logButtonText}>记一笔</Text>
            </Pressable>
          </View>

          {logs.length === 0 ? (
            <Pressable
              onPress={() => setLogOpen(true)}
              style={({ pressed }) => [styles.logEmpty, pressed && styles.pressed]}
            >
              <Ionicons name="restaurant-outline" size={17} color={colors.primary} />
              <Text style={styles.logEmptyText}>今天做了什么？点这里记下第一笔</Text>
            </Pressable>
          ) : (
            logs.map((log) => {
              const dish = dishById.get(log.dishId);
              if (!dish) return null;
              return (
                <View key={log.id} style={styles.logRow}>
                  <Pressable onPress={() => onOpenDish(dish.id)} style={styles.logMain}>
                    <DishCover dish={dish} style={styles.logCover} letterSize={22} />
                    <View style={styles.logBody}>
                      <Text style={styles.logName} numberOfLines={1}>
                        {dish.name}
                      </Text>
                      <View style={styles.logStars}>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Ionicons
                            key={star}
                            name={star <= log.rating ? 'star' : 'star-outline'}
                            size={11}
                            color={star <= log.rating ? '#E8A33D' : colors.textFaint}
                          />
                        ))}
                        <Text style={styles.logDate}>{formatLogDate(log.date)}</Text>
                      </View>
                      {log.note ? (
                        <Text style={styles.logNote} numberOfLines={2}>
                          {log.note}
                        </Text>
                      ) : null}
                    </View>
                  </Pressable>
                  <Pressable
                    onPress={() => removeLog(log.id)}
                    hitSlop={8}
                    style={({ pressed }) => pressed && styles.pressed}
                  >
                    <Ionicons name="close" size={15} color={colors.textFaint} />
                  </Pressable>
                </View>
              );
            })
          )}
        </View>

        <View style={styles.section}>
          <SectionHeader title="忌口与家庭" />

          <View style={styles.card}>
            <View style={styles.familyRow}>
              <View style={styles.familyText}>
                <Text style={styles.blockTitle}>家里几个人吃</Text>
                <Text style={styles.blockHint}>菜谱用量和买菜清单会按这个人数换算</Text>
              </View>
              <Stepper value={familySize} min={1} max={8} onChange={setFamilySize} suffix=" 人" />
            </View>

            <View style={styles.block}>
              <Text style={styles.blockTitle}>不吃这些</Text>
              <Text style={styles.blockHint}>勾上以后，推荐和菜谱都会避开</Text>
              <View style={styles.chips}>
                {AVOID_OPTIONS.map((option) => (
                  <Chip
                    key={option}
                    label={option}
                    compact
                    active={avoid.includes(option)}
                    onPress={() => toggleAvoid(option)}
                  />
                ))}
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>版本与更新</Text>
          <Text style={styles.sectionHint}>
            只改了界面和逻辑的更新可以直接下载，不用重新装安装包
          </Text>
          <Pressable
            onPress={() => setUpdateOpen(true)}
            style={({ pressed }) => [styles.shareRow, pressed && styles.pressed]}
          >
            <View style={styles.shareIcon}>
              <Ionicons name="cloud-download-outline" size={18} color={colors.primary} />
            </View>
            <View style={styles.shareBody}>
              <Text style={styles.shareTitle}>当前版本 {versionLabel}</Text>
              <Text style={styles.shareMeta}>点这里看看有没有新版本</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
          </Pressable>
        </View>

        <PrimaryButton
          label="恢复默认设置"
          variant="outline"
          icon="refresh-outline"
          onPress={() => setConfirmReset(true)}
          style={styles.reset}
        />
        <Text style={styles.version}>
          今天吃什么 v{versionLabel} · 收藏、记录和设置都只存在这台手机里
        </Text>
      </ScrollView>

      {toast ? <Toast message={toast} onHide={() => setToast(null)} offset={16} /> : null}

      <LogSheet
        visible={logOpen}
        favorites={favorites}
        onClose={() => setLogOpen(false)}
        onSubmit={(dishId, rating, note) => {
          addLog(dishId, rating, note);
          setLogOpen(false);
          const dish = dishById.get(dishId);
          setToast(dish ? `记下了：${dish.name} · ${rating} 颗星` : '已记下这一笔');
        }}
      />

      <ProfileSheet
        visible={profileOpen}
        name={profileName}
        avatar={profileAvatar}
        onClose={() => setProfileOpen(false)}
        onSave={({ name, avatar }) => {
          setProfileName(name);
          setProfileAvatar(avatar);
          setProfileOpen(false);
          setToast('资料已更新');
        }}
      />

      <ShareSheet visible={shareOpen} onClose={() => setShareOpen(false)} onToast={setToast} />

      <UpdateSheet visible={updateOpen} onClose={() => setUpdateOpen(false)} onToast={setToast} />

      <ConfirmDialog
        visible={confirmReset}
        title="恢复默认设置？"
        message="收藏、做饭记录、冰箱里的食材、买菜清单都会清空，头像和昵称恢复默认，并且退出共享清单，回到刚装好的样子。"
        confirmLabel="恢复默认"
        onConfirm={() => {
          resetAll();
          setToast('已经回到默认设置');
        }}
        onClose={() => setConfirmReset(false)}
      />
    </View>
  );
}

function formatLogDate(date: string): string {
  const now = today();
  if (date === now) return '今天';
  const yesterday = new Date(`${now}T00:00:00`);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date === formatDate(yesterday)) return '昨天';
  const [, month, day] = date.split('-');
  return `${Number(month)} 月 ${Number(day)} 日`;
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
  heroCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.lg,
    ...shadow.card,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarPress: {
    width: 52,
    height: 52,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarBadge: {
    position: 'absolute',
    right: -3,
    bottom: -3,
    width: 19,
    height: 19,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBody: {
    flex: 1,
    marginLeft: spacing.md,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  nameEdit: {
    marginLeft: 6,
  },
  heroName: {
    ...typography.sectionTitle,
    fontSize: 17,
    color: colors.text,
    flexShrink: 1,
  },
  heroMeta: {
    ...typography.caption,
    color: colors.textSub,
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: spacing.lg,
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: colors.border,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.primary,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textSub,
    marginTop: 4,
  },
  heroHint: {
    ...typography.caption,
    color: colors.textFaint,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  editRowText: {
    ...typography.caption,
    color: colors.primary,
    marginLeft: 4,
  },
  shareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.md,
    ...shadow.card,
  },
  shareIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareBody: {
    flex: 1,
    marginLeft: spacing.md,
  },
  shareTitle: {
    ...typography.body,
    fontWeight: '700',
    color: colors.text,
  },
  shareMeta: {
    ...typography.caption,
    color: colors.textSub,
    marginTop: 3,
  },
  section: {
    marginTop: spacing.xxl,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionHeadText: {
    flex: 1,
    marginRight: spacing.md,
  },
  editText: {
    ...typography.label,
    color: colors.primary,
  },
  sectionTitle: {
    ...typography.sectionTitle,
    color: colors.text,
  },
  sectionHint: {
    ...typography.caption,
    color: colors.textSub,
    marginTop: 4,
  },
  logButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  logButtonText: {
    ...typography.label,
    color: '#FFFFFF',
    marginLeft: 5,
  },
  emptyHint: {
    ...typography.body,
    fontSize: 13,
    color: colors.textSub,
    lineHeight: 21,
    marginTop: spacing.md,
  },
  favScroll: {
    marginHorizontal: -screenPadding,
    marginTop: spacing.md,
  },
  favContent: {
    paddingHorizontal: screenPadding,
  },
  logEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  logEmptyText: {
    ...typography.body,
    fontSize: 13,
    color: colors.text,
    marginLeft: spacing.sm,
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
    ...shadow.card,
  },
  logMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  logCover: {
    width: 56,
    height: 56,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
  },
  logBody: {
    flex: 1,
    marginLeft: spacing.md,
  },
  logName: {
    ...typography.body,
    fontWeight: '700',
    color: colors.text,
  },
  logStars: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  logDate: {
    ...typography.caption,
    color: colors.textSub,
    marginLeft: spacing.sm,
  },
  logNote: {
    ...typography.caption,
    color: colors.textSub,
    marginTop: 4,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.md,
    ...shadow.card,
  },
  familyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  familyText: {
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
  block: {
    marginTop: spacing.xl,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.sm,
  },
  reset: {
    marginTop: spacing.xxl,
    height: 46,
  },
  version: {
    ...typography.caption,
    color: colors.textFaint,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  pressed: {
    opacity: 0.7,
  },
});
