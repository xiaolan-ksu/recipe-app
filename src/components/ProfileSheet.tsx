import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { persistPhoto, pickPhoto, type PhotoSource } from '../lib/photo';
import { useKeyboardGap } from '../lib/useKeyboardGap';
import { colors, radius, screenPadding, spacing, typography } from '../theme';
import { PrimaryButton } from './PrimaryButton';

interface Props {
  visible: boolean;
  name: string;
  avatar: string | null;
  onClose: () => void;
  onSave: (next: { name: string; avatar: string | null }) => void;
}

/** 点头像或昵称打开：换头像、改昵称 */
export function ProfileSheet({ visible, name, avatar, onClose, onSave }: Props) {
  const insets = useSafeAreaInsets();
  const [draftName, setDraftName] = useState(name);
  const [draftAvatar, setDraftAvatar] = useState<string | null>(avatar);
  const [hint, setHint] = useState('');
  const [busy, setBusy] = useState(false);
  // 改昵称时键盘会弹起来，弹层要跟着上移，否则输入框被挡住
  const keyboardGap = useKeyboardGap(visible);

  useEffect(() => {
    if (!visible) return;
    setDraftName(name);
    setDraftAvatar(avatar);
    setHint('');
  }, [visible, name, avatar]);

  const chooseAvatar = async (source: PhotoSource) => {
    setBusy(true);
    const picked = await pickPhoto(source, { aspect: [1, 1], quality: 0.8 });
    if (!picked.ok) {
      setBusy(false);
      if (picked.reason === 'denied') {
        setHint(
          source === 'camera'
            ? '没拿到相机权限，可以在手机设置里打开，或者从相册里选一张'
            : '没拿到相册权限，可以在手机设置里打开',
        );
      }
      return;
    }
    // 选完就搬到 App 目录，避免系统清缓存以后头像变白
    const saved = await persistPhoto(picked.uri, 'profile', 'avatar');
    setDraftAvatar(saved);
    setHint('');
    setBusy(false);
  };

  const handleSave = () => {
    onSave({ name: draftName.trim(), avatar: draftAvatar });
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
          <Text style={styles.title}>编辑资料</Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={22} color={colors.textSub} />
          </Pressable>
        </View>

        <View style={styles.avatarRow}>
          <View style={styles.avatarPreview}>
            {draftAvatar ? (
              <Image source={{ uri: draftAvatar }} style={styles.avatarImage} contentFit="cover" transition={200} />
            ) : (
              <Ionicons name="person" size={34} color={colors.primary} />
            )}
          </View>
          <View style={styles.avatarActions}>
            <Pressable
              onPress={() => void chooseAvatar('library')}
              disabled={busy}
              style={({ pressed }) => [styles.avatarButton, pressed && styles.pressed]}
            >
              <Ionicons name="image-outline" size={16} color={colors.primary} />
              <Text style={styles.avatarButtonText}>从相册选</Text>
            </Pressable>
            <Pressable
              onPress={() => void chooseAvatar('camera')}
              disabled={busy}
              style={({ pressed }) => [styles.avatarButton, pressed && styles.pressed]}
            >
              <Ionicons name="camera-outline" size={16} color={colors.primary} />
              <Text style={styles.avatarButtonText}>拍一张</Text>
            </Pressable>
            {draftAvatar ? (
              <Pressable
                onPress={() => {
                  setDraftAvatar(null);
                  setHint('');
                }}
                hitSlop={8}
                style={({ pressed }) => pressed && styles.pressed}
              >
                <Text style={styles.resetAvatar}>用默认头像</Text>
              </Pressable>
            ) : (
              <Text style={styles.avatarEmptyHint}>不选也行，用默认的小人</Text>
            )}
          </View>
        </View>

        <Text style={styles.fieldLabel}>昵称</Text>
        <View style={styles.inputRow}>
          <TextInput
            value={draftName}
            onChangeText={setDraftName}
            placeholder="比如：家里的掌勺人"
            placeholderTextColor={colors.textFaint}
            style={styles.input}
            maxLength={12}
            returnKeyType="done"
            onSubmitEditing={handleSave}
          />
          {draftName.length > 0 ? (
            <Pressable onPress={() => setDraftName('')} hitSlop={8} style={styles.clear}>
              <Ionicons name="close-circle" size={18} color={colors.textFaint} />
            </Pressable>
          ) : null}
        </View>

        <Text style={styles.hint}>{hint || '头像和昵称只存在这台手机上，点一下就能改。'}</Text>

        <View style={styles.footer}>
          <PrimaryButton label="保存" onPress={handleSave} loading={busy} style={styles.save} />
        </View>
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
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.sectionTitle,
    color: colors.text,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: screenPadding,
  },
  avatarPreview: {
    width: 76,
    height: 76,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarActions: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginLeft: spacing.lg,
    gap: spacing.sm,
  },
  avatarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
  },
  avatarButtonText: {
    ...typography.label,
    color: colors.primary,
    marginLeft: 4,
  },
  resetAvatar: {
    ...typography.caption,
    color: colors.textSub,
  },
  avatarEmptyHint: {
    ...typography.caption,
    color: colors.textFaint,
  },
  fieldLabel: {
    ...typography.label,
    color: colors.textSub,
    marginHorizontal: screenPadding,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: screenPadding,
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
  },
  clear: {
    position: 'absolute',
    right: spacing.md,
  },
  hint: {
    ...typography.caption,
    color: colors.textFaint,
    lineHeight: 17,
    marginHorizontal: screenPadding,
    marginTop: spacing.lg,
  },
  footer: {
    paddingHorizontal: screenPadding,
    marginTop: spacing.lg,
  },
  save: {
    height: 48,
  },
  pressed: {
    opacity: 0.7,
  },
});
