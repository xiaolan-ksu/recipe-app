import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatCoords, type Coords } from '../lib/geocode';
import { useKeyboardGap } from '../lib/useKeyboardGap';
import type { LocationStatus } from '../lib/useLocationLabel';
import { colors, radius, screenPadding, spacing, typography } from '../theme';
import { PrimaryButton } from './PrimaryButton';

interface Props {
  visible: boolean;
  label: string;
  status: LocationStatus;
  coords: Coords | null;
  onClose: () => void;
  onRelocate: () => void;
  onSaveManual: (text: string) => void;
}

const STATUS_TEXT: Record<LocationStatus, string> = {
  idle: '还没定位',
  locating: '正在定位…',
  ready: '',
  denied: '系统里没给定位权限',
  failed: '这次没查到具体地名',
};

/** 点首页左上角的位置胶囊打开：重新定位，或者自己手填一个 */
export function LocationSheet({
  visible,
  label,
  status,
  coords,
  onClose,
  onRelocate,
  onSaveManual,
}: Props) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState(label);
  // 手动填地址时键盘弹起来，弹层要跟着上移
  const keyboardGap = useKeyboardGap(visible);

  useEffect(() => {
    if (visible) setDraft(label);
  }, [visible, label]);

  const locating = status === 'locating';
  const hint =
    status === 'denied'
      ? '想自动定位的话，去手机的「设置 → 应用 → 今天吃什么 → 权限」里把位置打开，再回来点重新定位。'
      : '地址只存在这台手机上，不会上传，用来告诉 App 你在哪个城市。';

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
          <Text style={styles.title}>当前位置</Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={22} color={colors.textSub} />
          </Pressable>
        </View>

        <View style={styles.currentCard}>
          <View style={styles.currentIcon}>
            <Ionicons name="location-sharp" size={18} color={colors.primary} />
          </View>
          <View style={styles.currentBody}>
            <Text style={styles.currentValue}>
              {locating ? '正在定位…' : label || STATUS_TEXT[status]}
            </Text>
            {coords ? <Text style={styles.currentCoords}>{formatCoords(coords)}</Text> : null}
          </View>
        </View>

        <PrimaryButton
          label={locating ? '正在定位…' : '重新定位'}
          icon="navigate-outline"
          variant="outline"
          loading={locating}
          onPress={onRelocate}
          style={styles.relocate}
        />

        <Text style={styles.orLabel}>也可以自己填</Text>
        <View style={styles.inputRow}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="比如：上海市 · 静安区"
            placeholderTextColor={colors.textFaint}
            style={styles.input}
            returnKeyType="done"
            onSubmitEditing={() => onSaveManual(draft)}
          />
          <PrimaryButton
            label="保存"
            onPress={() => onSaveManual(draft)}
            disabled={draft.trim().length === 0}
            style={styles.save}
          />
        </View>

        <Text style={styles.hint}>{hint}</Text>
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
  currentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: screenPadding,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  currentIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentBody: {
    flex: 1,
    marginLeft: spacing.md,
  },
  currentValue: {
    ...typography.body,
    fontWeight: '700',
    color: colors.text,
  },
  currentCoords: {
    ...typography.caption,
    color: colors.textSub,
    marginTop: 3,
  },
  relocate: {
    marginHorizontal: screenPadding,
    marginTop: spacing.md,
    height: 46,
  },
  orLabel: {
    ...typography.label,
    color: colors.textSub,
    marginHorizontal: screenPadding,
    marginTop: spacing.xl,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: screenPadding,
    marginTop: spacing.sm,
  },
  input: {
    flex: 1,
    height: 46,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    ...typography.body,
    color: colors.text,
    marginRight: spacing.md,
  },
  save: {
    width: 92,
    height: 46,
  },
  hint: {
    ...typography.caption,
    color: colors.textFaint,
    lineHeight: 17,
    marginHorizontal: screenPadding,
    marginTop: spacing.lg,
  },
});
