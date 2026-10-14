import { StyleSheet } from 'react-native';

import { CATEGORY_FILTERS } from '../constants';
import { screenPadding } from '../theme';
import type { CategoryFilter } from '../types';
import { Chip } from './Chip';
import { HScroll } from './HScroll';

interface Props {
  value: CategoryFilter;
  onChange: (value: CategoryFilter) => void;
}

export function CategoryChips({ value, onChange }: Props) {
  return (
    <HScroll contentContainerStyle={styles.content} style={styles.wrap}>
      {CATEGORY_FILTERS.map((category) => (
        <Chip key={category} label={category} active={value === category} onPress={() => onChange(category)} />
      ))}
    </HScroll>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: -screenPadding,
    // 固定高度：横向 ScrollView 在纵向 flex 里会被压扁
    height: 44,
    flexGrow: 0,
    flexShrink: 0,
  },
  content: {
    paddingHorizontal: screenPadding,
    paddingVertical: 3,
    alignItems: 'center',
  },
});
