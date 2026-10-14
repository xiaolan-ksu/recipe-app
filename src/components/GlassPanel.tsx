import { BlurView } from 'expo-blur';
import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

interface Props {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** light = 白底毛玻璃（压在图上是浅色雾面），dark = 压暗毛玻璃 */
  tone?: 'light' | 'dark';
  intensity?: number;
}

/**
 * 图片上方的毛玻璃面板。
 * iOS 用系统级模糊；Android 上用半透明底色代替，避免个别机型模糊失效后文字看不清。
 */
export function GlassPanel({ children, style, tone = 'light', intensity = 28 }: Props) {
  if (Platform.OS === 'ios') {
    return (
      <BlurView intensity={intensity} tint={tone === 'light' ? 'light' : 'dark'} style={[styles.base, style]}>
        {children}
      </BlurView>
    );
  }

  return <View style={[styles.base, tone === 'light' ? styles.light : styles.dark, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
  },
  light: {
    backgroundColor: 'rgba(255,255,255,0.82)',
  },
  dark: {
    backgroundColor: 'rgba(26,17,11,0.42)',
  },
});
