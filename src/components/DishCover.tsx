import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import {
  StyleSheet,
  Text,
  View,
  type ImageStyle,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors } from '../theme';
import type { Dish } from '../types';

interface Props {
  dish: Pick<Dish, 'name' | 'cover'>;
  style?: StyleProp<ViewStyle>;
  /** 占位首字的字号，按卡片大小传 */
  letterSize?: number;
}

/** 菜的封面图；自己加的菜没配照片时，用渐变加菜名首字占位 */
export function DishCover({ dish, style, letterSize = 26 }: Props) {
  if (dish.cover) {
    return (
      <Image source={dish.cover} style={style as StyleProp<ImageStyle>} contentFit="cover" transition={200} />
    );
  }

  return (
    <View style={[style, styles.wrap]}>
      <LinearGradient
        colors={['#F3C79F', '#E2553C']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Text style={[styles.letter, { fontSize: letterSize }]} numberOfLines={1}>
        {dish.name.trim().slice(0, 1) || '菜'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
  },
  letter: {
    color: 'rgba(255,255,255,0.92)',
    fontWeight: '800',
  },
});
