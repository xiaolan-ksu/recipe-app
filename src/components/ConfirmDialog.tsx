import { Modal, StyleSheet, Text, View } from 'react-native';

import { colors, radius, shadow, spacing, typography } from '../theme';
import { PrimaryButton } from './PrimaryButton';

interface Props {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
}

/** 清空清单、恢复默认这类操作，先问一句 */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = '确定',
  cancelLabel = '算了',
  onConfirm,
  onClose,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.actions}>
            <PrimaryButton
              label={cancelLabel}
              variant="outline"
              onPress={onClose}
              style={[styles.button, styles.buttonGap]}
            />
            <PrimaryButton
              label={confirmLabel}
              onPress={() => {
                onConfirm();
                onClose();
              }}
              style={styles.button}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.scrim,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
  },
  card: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    ...shadow.floating,
  },
  title: {
    ...typography.sectionTitle,
    fontSize: 17,
    color: colors.text,
  },
  message: {
    ...typography.body,
    fontSize: 13,
    color: colors.textSub,
    lineHeight: 21,
    marginTop: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    marginTop: spacing.xl,
  },
  button: {
    flex: 1,
    height: 46,
  },
  buttonGap: {
    marginRight: spacing.md,
  },
});
