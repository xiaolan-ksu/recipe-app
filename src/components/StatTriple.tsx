import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '../theme';

export interface StatItem {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}

interface Props {
  items: StatItem[];
  tone?: 'light' | 'dark';
  divided?: boolean;
}

/** 成本 / 用时 / 难度 三栏信息 */
export function StatTriple({ items, tone = 'dark', divided = true }: Props) {
  const onDark = tone === 'dark';
  return (
    <View style={styles.row}>
      {items.map((item, index) => (
        <View
          key={item.label}
          style={[styles.cell, divided && index > 0 && { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: onDark ? 'rgba(255,255,255,0.25)' : colors.border }]}
        >
          <Ionicons name={item.icon} size={13} color={onDark ? 'rgba(255,255,255,0.85)' : colors.textFaint} />
          <Text style={[styles.label, { color: onDark ? 'rgba(255,255,255,0.75)' : colors.textSub }]}>{item.label}</Text>
          <Text style={[styles.value, { color: onDark ? '#FFFFFF' : colors.text }]} numberOfLines={1}>
            {item.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 2,
  },
  label: {
    ...typography.caption,
    marginTop: 3,
  },
  value: {
    ...typography.label,
    fontSize: 13,
    marginTop: 1,
  },
});
