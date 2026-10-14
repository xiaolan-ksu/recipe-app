import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { BackHandler, Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { BottomNav, type TabKey } from './src/components/BottomNav';
import { FilterSheet } from './src/components/FilterSheet';
import { DishDetailScreen } from './src/screens/DishDetailScreen';
import { DishEditorScreen } from './src/screens/DishEditorScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { IngredientsScreen } from './src/screens/IngredientsScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { RecipesScreen } from './src/screens/RecipesScreen';
import { ShoppingScreen } from './src/screens/ShoppingScreen';
import { useAppStore } from './src/store/useAppStore';
import { useAutoUpdate } from './src/lib/useAutoUpdate';
import { useShareSync } from './src/lib/useShareSync';
import { colors } from './src/theme';

function Root() {
  // 共享清单的自动同步（没配对时什么都不做）
  useShareSync();
  // 后台静默更新：悄悄查、悄悄下，下次打开自动是新版
  useAutoUpdate();

  const [tab, setTab] = useState<TabKey>('home');
  const [detailDishId, setDetailDishId] = useState<string | null>(null);
  const [editorDishId, setEditorDishId] = useState<string | null | 'new'>(null);
  const [filterOpen, setFilterOpen] = useState(false);

  const customDishes = useAppStore((state) => state.customDishes);
  const removeCustomDish = useAppStore((state) => state.removeCustomDish);
  const shopping = useAppStore((state) => state.shopping);
  const familySize = useAppStore((state) => state.familySize);
  const avoid = useAppStore((state) => state.avoid);
  const setFamilySize = useAppStore((state) => state.setFamilySize);
  const toggleAvoid = useAppStore((state) => state.toggleAvoid);
  const resetAll = useAppStore((state) => state.resetAll);

  const shoppingBadge = useMemo(() => shopping.filter((item) => !item.checked).length, [shopping]);

  // Android 实体返回键：先关弹层，再退详情页
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (filterOpen) {
        setFilterOpen(false);
        return true;
      }
      if (detailDishId) {
        setDetailDishId(null);
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [filterOpen, detailDishId]);

  const openDish = (dishId: string) => setDetailDishId(dishId);
  const openEditor = (dishId?: string) => setEditorDishId(dishId ?? 'new');

  const editingDish =
    editorDishId && editorDishId !== 'new'
      ? customDishes.find((dish) => dish.id === editorDishId)
      : undefined;

  const screens: Record<TabKey, ReactElement> = {
    home: (
      <HomeScreen
        onOpenDish={openDish}
        onOpenFilter={() => setFilterOpen(true)}
        onOpenRecipes={() => setTab('recipes')}
      />
    ),
    recipes: <RecipesScreen onOpenDish={openDish} onAddDish={() => openEditor()} />,
    ingredients: <IngredientsScreen onOpenDish={openDish} />,
    shopping: <ShoppingScreen onOpenRecipes={() => setTab('recipes')} />,
    profile: <ProfileScreen onOpenDish={openDish} onAddDish={() => openEditor()} onEditDish={openEditor} />,
  };

  return (
    <View style={styles.root}>
      <StatusBar style={detailDishId ? 'light' : 'dark'} />

      <View style={styles.body}>{screens[tab]}</View>

      <BottomNav active={tab} onChange={setTab} badge={{ shopping: shoppingBadge }} />

      {detailDishId ? (
        <DishDetailScreen
          dishId={detailDishId}
          onClose={() => setDetailDishId(null)}
          onEditDish={(dishId) => {
            openEditor(dishId);
          }}
          onDeleteDish={removeCustomDish}
          onGoShopping={() => {
            setDetailDishId(null);
            setTab('shopping');
          }}
        />
      ) : null}

      {editorDishId ? (
        <DishEditorScreen
          dish={editingDish}
          onClose={() => setEditorDishId(null)}
          onSaved={(dishId) => {
            setEditorDishId(null);
            setDetailDishId(dishId);
            setTab('recipes');
          }}
        />
      ) : null}

      <FilterSheet
        visible={filterOpen}
        familySize={familySize}
        avoid={avoid}
        onClose={() => setFilterOpen(false)}
        onFamilySizeChange={setFamilySize}
        onToggleAvoid={toggleAvoid}
        onReset={resetAll}
      />
    </View>
  );
}

export default function App() {
  const { width, height } = useWindowDimensions();
  // 在电脑浏览器里打开时，套一个手机外框居中显示，跟参考图一致
  const showPhoneFrame = Platform.OS === 'web' && width > 560;
  const frameHeight = Math.min(844, Math.max(520, height - 48));

  return (
    <SafeAreaProvider>
      <View style={[styles.outer, showPhoneFrame && styles.outerWide]}>
        <View
          style={
            showPhoneFrame ? [styles.phoneFrame, { height: frameHeight }] : styles.phone
          }
        >
          <Root />
        </View>
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  outerWide: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EDE4D9',
    paddingVertical: 24,
  },
  phone: {
    flex: 1,
    width: '100%',
  },
  phoneFrame: {
    flexGrow: 0,
    flexShrink: 0,
    width: 390,
    borderRadius: 46,
    borderWidth: 10,
    borderColor: '#2C2320',
    overflow: 'hidden',
    backgroundColor: colors.bg,
    shadowColor: '#3A2418',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.32,
    shadowRadius: 40,
    elevation: 18,
  },
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  body: {
    flex: 1,
  },
});
