import { Platform, TextStyle } from 'react-native';

/** 家常菜主题配色，取自参考图 */
export const colors = {
  primary: '#E2553C',
  primaryDark: '#C6432C',
  primarySoft: '#FBEAE4',
  bg: '#FBF6EF',
  surface: '#FFFFFF',
  surfaceAlt: '#F6EFE6',
  text: '#2E2622',
  textSub: '#8A7C72',
  textFaint: '#B3A69C',
  border: '#EDE3D8',
  success: '#5C8A4A',
  warning: '#D98A2B',
  scrim: 'rgba(28,18,12,0.42)',
  glass: 'rgba(255,255,255,0.86)',
  glassDark: 'rgba(28,18,12,0.38)',
};

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 26,
  pill: 999,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
};

export const typography = {
  hero: { fontSize: 32, fontWeight: '800', letterSpacing: 0.5 } as TextStyle,
  title: { fontSize: 24, fontWeight: '800' } as TextStyle,
  sectionTitle: { fontSize: 18, fontWeight: '800' } as TextStyle,
  dishName: { fontSize: 22, fontWeight: '800' } as TextStyle,
  body: { fontSize: 14, fontWeight: '500' } as TextStyle,
  label: { fontSize: 12, fontWeight: '600' } as TextStyle,
  caption: { fontSize: 11, fontWeight: '500' } as TextStyle,
};

export const shadow = {
  card: {
    shadowColor: '#6B4225',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 3,
  },
  floating: {
    shadowColor: '#6B4225',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 6,
  },
  button: {
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 5,
  },
};

export const fonts = {
  /** 中文优先使用系统字体，保证 Android / iOS 都不缺字 */
  regular: Platform.select({ ios: 'PingFang SC', android: 'sans-serif', default: undefined }),
  medium: Platform.select({ ios: 'PingFang SC', android: 'sans-serif-medium', default: undefined }),
};

/** 图片底部压暗的渐变，让白色文字始终看得清 */
export const heroGradient = ['rgba(0,0,0,0)', 'rgba(24,14,8,0.35)', 'rgba(24,14,8,0.78)'] as const;
export const cardGradient = ['rgba(0,0,0,0)', 'rgba(24,14,8,0.62)'] as const;

/** 手机 App 内容区左右留白 */
export const screenPadding = 18;
