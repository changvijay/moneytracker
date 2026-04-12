import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import {
  Text,
  FAB,
  useTheme,
  Card,
  IconButton,
  Portal,
  Modal,
  TextInput,
  Button,
  SegmentedButtons,
} from 'react-native-paper';
import { Stack } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  runOnJS,
  withSpring,
  withTiming,
  SharedValue,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  fetchCategories,
  addCategory,
  updateCategory,
  deleteCategory,
  reorderCategories,
} from '@/store/slices/categoriesSlice';
import { CATEGORY_ICONS, CATEGORY_COLORS } from '@/constants/defaultCategories';
import type { Category, NewCategory } from '@/db/schema';

const ITEM_HEIGHT = 64;

// ─── DraggableItem ─────────────────────────────────────────────────────────────

interface DraggableItemProps {
  item: Category;
  idx: number;
  totalItems: number;
  activeIndex: SharedValue<number>;
  dragY: SharedValue<number>;
  onCommit: (from: number, to: number) => void;
  onEdit: (item: Category) => void;
  onDelete: (item: Category) => void;
}

function DraggableItem({
  item,
  idx,
  totalItems,
  activeIndex,
  dragY,
  onCommit,
  onEdit,
  onDelete,
}: DraggableItemProps) {
  const theme = useTheme() as any;

  const haptic = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const gesture = Gesture.Pan()
    .activateAfterLongPress(300)
    .onStart(() => {
      'worklet';
      activeIndex.value = idx;
      dragY.value = 0;
      runOnJS(haptic)();
    })
    .onUpdate((e) => {
      'worklet';
      dragY.value = e.translationY;
    })
    .onEnd(() => {
      'worklet';
      const ai = activeIndex.value;
      const hoverIdx = Math.max(
        0,
        Math.min(totalItems - 1, ai + Math.round(dragY.value / ITEM_HEIGHT))
      );
      runOnJS(onCommit)(ai, hoverIdx);
      dragY.value = withTiming(0, { duration: 150 });
      activeIndex.value = -1;
    });

  const animStyle = useAnimatedStyle(() => {
    const ai = activeIndex.value;
    const isActive = ai === idx;

    if (isActive) {
      return {
        position: 'absolute',
        left: 0,
        right: 0,
        top: idx * ITEM_HEIGHT + dragY.value,
        height: ITEM_HEIGHT,
        zIndex: 100,
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 10,
      };
    }

    let targetTop = idx * ITEM_HEIGHT;
    if (ai !== -1) {
      const hoverIdx = Math.max(
        0,
        Math.min(totalItems - 1, ai + Math.round(dragY.value / ITEM_HEIGHT))
      );
      if (ai < hoverIdx && idx > ai && idx <= hoverIdx) {
        targetTop = (idx - 1) * ITEM_HEIGHT;
      } else if (ai > hoverIdx && idx >= hoverIdx && idx < ai) {
        targetTop = (idx + 1) * ITEM_HEIGHT;
      }
    }

    return {
      position: 'absolute',
      left: 0,
      right: 0,
      top: withSpring(targetTop, { damping: 20, stiffness: 300 }),
      height: ITEM_HEIGHT,
      zIndex: 1,
    };
  });

  return (
    <Animated.View style={animStyle}>
      <View style={[styles.catRow, { backgroundColor: theme.colors.surface }]}>
        <GestureDetector gesture={gesture}>
          <View style={styles.dragHandle}>
            <MaterialCommunityIcons name="drag-horizontal-variant" size={20} color="#9CA3AF" />
          </View>
        </GestureDetector>
        <TouchableOpacity style={styles.catRowContent} onPress={() => onEdit(item)}>
          <View style={[styles.catIcon, { backgroundColor: item.color + '20' }]}>
            <MaterialCommunityIcons name={item.icon as any} size={22} color={item.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="bodyMedium" style={{ fontWeight: '500' }}>
              {item.name}
            </Text>
            {item.budgetLimit ? (
              <Text variant="labelSmall" style={{ color: theme.colors.outline }}>
                Budget: ${item.budgetLimit.toFixed(0)}/month
              </Text>
            ) : null}
          </View>
        </TouchableOpacity>
        {!item.isDefault && (
          <IconButton
            icon="delete-outline"
            size={20}
            iconColor={theme.custom.expense}
            onPress={() => onDelete(item)}
          />
        )}
      </View>
    </Animated.View>
  );
}

// ─── DraggableList ─────────────────────────────────────────────────────────────

interface DraggableListProps {
  items: Category[];
  onReorder: (newItems: Category[]) => void;
  onEdit: (item: Category) => void;
  onDelete: (item: Category) => void;
}

function DraggableList({ items, onReorder, onEdit, onDelete }: DraggableListProps) {
  const [localItems, setLocalItems] = useState<Category[]>(items);
  const localRef = useRef<Category[]>(items);

  useEffect(() => {
    setLocalItems(items);
    localRef.current = items;
  }, [items]);

  const activeIndex = useSharedValue(-1);
  const dragY = useSharedValue(0);

  const commitReorder = useCallback(
    (from: number, to: number) => {
      if (from === to || from < 0) return;
      const next = [...localRef.current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      localRef.current = next;
      setLocalItems(next);
      onReorder(next);
    },
    [onReorder]
  );

  return (
    <View style={{ height: localItems.length * ITEM_HEIGHT }}>
      {localItems.map((item, idx) => (
        <DraggableItem
          key={item.id}
          item={item}
          idx={idx}
          totalItems={localItems.length}
          activeIndex={activeIndex}
          dragY={dragY}
          onCommit={commitReorder}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </View>
  );
}

// ─── ManageCategoriesScreen ────────────────────────────────────────────────────

export default function ManageCategoriesScreen() {
  const theme = useTheme() as any;
  const dispatch = useAppDispatch();

  const categories = useAppSelector((s) => s.categories.items);
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('help-circle-outline');
  const [color, setColor] = useState('#607D8B');
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [budgetLimit, setBudgetLimit] = useState('');

  useEffect(() => {
    dispatch(fetchCategories());
  }, [dispatch]);

  const expenseCategories = categories.filter((c) => c.type === 'expense');
  const incomeCategories = categories.filter((c) => c.type === 'income');

  const openAdd = () => {
    setEditingCategory(null);
    setName('');
    setIcon('help-circle-outline');
    setColor('#607D8B');
    setType('expense');
    setBudgetLimit('');
    setShowModal(true);
  };

  const openEdit = useCallback((cat: Category) => {
    setEditingCategory(cat);
    setName(cat.name);
    setIcon(cat.icon);
    setColor(cat.color);
    setType(cat.type as 'expense' | 'income');
    setBudgetLimit(cat.budgetLimit?.toString() ?? '');
    setShowModal(true);
  }, []);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Category name is required');
      return;
    }

    const data: NewCategory = {
      name: name.trim(),
      icon,
      color,
      type,
      budgetLimit: budgetLimit ? parseFloat(budgetLimit) : null,
    };

    if (editingCategory) {
      await dispatch(updateCategory({ id: editingCategory.id, data }));
    } else {
      await dispatch(addCategory(data));
    }
    setShowModal(false);
  };

  const handleDelete = useCallback(
    (cat: Category) => {
      if (cat.isDefault) {
        Alert.alert('Cannot Delete', 'Default categories cannot be deleted.');
        return;
      }
      Alert.alert('Delete Category', `Delete "${cat.name}"?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => dispatch(deleteCategory(cat.id)),
        },
      ]);
    },
    [dispatch]
  );

  const handleReorder = useCallback(
    (newItems: Category[]) => {
      dispatch(reorderCategories(newItems.map((c) => c.id)));
    },
    [dispatch]
  );

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen options={{ title: 'Manage Categories' }} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        <Text variant="labelSmall" style={styles.hint}>
          Long-press the ≡ handle to drag and reorder
        </Text>

        <Text variant="titleSmall" style={styles.sectionTitle}>
          Expense Categories ({expenseCategories.length})
        </Text>
        <Card style={styles.card}>
          <Card.Content style={styles.cardContent}>
            <DraggableList
              items={expenseCategories}
              onReorder={handleReorder}
              onEdit={openEdit}
              onDelete={handleDelete}
            />
          </Card.Content>
        </Card>

        <Text variant="titleSmall" style={styles.sectionTitle}>
          Income Categories ({incomeCategories.length})
        </Text>
        <Card style={styles.card}>
          <Card.Content style={styles.cardContent}>
            <DraggableList
              items={incomeCategories}
              onReorder={handleReorder}
              onEdit={openEdit}
              onDelete={handleDelete}
            />
          </Card.Content>
        </Card>
      </ScrollView>

      <FAB
        icon="plus"
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        color="white"
        onPress={openAdd}
      />

      {/* Add/Edit Modal */}
      <Portal>
        <Modal
          visible={showModal}
          onDismiss={() => setShowModal(false)}
          contentContainerStyle={[
            styles.modal,
            { backgroundColor: theme.colors.surface },
          ]}
        >
          <Text variant="titleLarge" style={{ fontWeight: '700', marginBottom: 16 }}>
            {editingCategory ? 'Edit Category' : 'New Category'}
          </Text>

          <SegmentedButtons
            value={type}
            onValueChange={(v) => setType(v as 'expense' | 'income')}
            buttons={[
              { value: 'expense', label: 'Expense' },
              { value: 'income', label: 'Income' },
            ]}
            style={{ marginBottom: 16 }}
          />

          <TextInput
            label="Name"
            value={name}
            onChangeText={setName}
            mode="outlined"
            style={{ marginBottom: 12 }}
          />

          <TextInput
            label="Budget Limit (optional, monthly)"
            value={budgetLimit}
            onChangeText={setBudgetLimit}
            keyboardType="decimal-pad"
            mode="outlined"
            left={<TextInput.Icon icon="currency-usd" />}
            style={{ marginBottom: 12 }}
          />

          {/* Icon Picker */}
          <Text variant="labelLarge" style={{ marginBottom: 8 }}>
            Icon
          </Text>
          <View style={styles.iconGrid}>
            {CATEGORY_ICONS.slice(0, 30).map((ic) => (
              <TouchableOpacity
                key={ic}
                style={[
                  styles.iconItem,
                  {
                    backgroundColor: icon === ic ? color + '30' : theme.colors.surfaceVariant,
                    borderColor: icon === ic ? color : 'transparent',
                    borderWidth: 2,
                  },
                ]}
                onPress={() => setIcon(ic)}
              >
                <MaterialCommunityIcons
                  name={ic as any}
                  size={20}
                  color={icon === ic ? color : theme.colors.outline}
                />
              </TouchableOpacity>
            ))}
          </View>

          {/* Color Picker */}
          <Text variant="labelLarge" style={{ marginTop: 12, marginBottom: 8 }}>
            Color
          </Text>
          <View style={styles.colorGrid}>
            {CATEGORY_COLORS.map((c) => (
              <TouchableOpacity
                key={c}
                style={[
                  styles.colorItem,
                  {
                    backgroundColor: c,
                    borderWidth: color === c ? 3 : 0,
                    borderColor: '#000',
                  },
                ]}
                onPress={() => setColor(c)}
              />
            ))}
          </View>

          <View style={styles.modalActions}>
            <Button
              mode="outlined"
              onPress={() => setShowModal(false)}
              style={{ flex: 1, marginRight: 8 }}
            >
              Cancel
            </Button>
            <Button mode="contained" onPress={handleSave} style={{ flex: 1 }}>
              Save
            </Button>
          </View>
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hint: { color: '#9CA3AF', marginBottom: 8, textAlign: 'center' },
  sectionTitle: { fontWeight: '600', marginBottom: 8, marginTop: 8 },
  card: { borderRadius: 12, marginBottom: 16, overflow: 'hidden' },
  cardContent: { paddingHorizontal: 0, paddingVertical: 0 },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: ITEM_HEIGHT,
    paddingRight: 4,
  },
  dragHandle: {
    width: 40,
    height: ITEM_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  catRowContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: ITEM_HEIGHT,
  },
  catIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  fab: { position: 'absolute', bottom: 24, right: 16, borderRadius: 16 },
  modal: { margin: 16, borderRadius: 16, padding: 16, maxHeight: '90%' },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  iconItem: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  colorItem: { width: 28, height: 28, borderRadius: 14 },
  modalActions: { flexDirection: 'row', marginTop: 16 },
});

