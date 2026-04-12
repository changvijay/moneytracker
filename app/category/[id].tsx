import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import {
  Text,
  TextInput,
  Button,
  useTheme,
} from 'react-native-paper';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';

import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { updateCategory, fetchCategories } from '@/store/slices/categoriesSlice';

export default function EditCategoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const router = useRouter();
  const dispatch = useAppDispatch();

  const category = useAppSelector((s) =>
    s.categories.items.find((c) => c.id === Number(id))
  );
  const loading = useAppSelector((s) => s.categories.loading);

  const [budgetLimit, setBudgetLimit] = useState('');

  useEffect(() => {
    dispatch(fetchCategories());
  }, [dispatch]);

  useEffect(() => {
    if (category?.budgetLimit) {
      setBudgetLimit(category.budgetLimit.toString());
    }
  }, [category]);

  if (loading && !category) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: 'Edit Category' }} />
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!category) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: 'Edit Category' }} />
        <Text>Category not found</Text>
      </View>
    );
  }

  const handleSave = async () => {
    const limit = budgetLimit ? parseFloat(budgetLimit) : null;
    await dispatch(
      updateCategory({
        id: category.id,
        data: { budgetLimit: limit },
      })
    );
    router.back();
  };

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen options={{ title: `Edit ${category.name}` }} />
      <View style={styles.container}>
        <Text variant="titleMedium" style={{ fontWeight: '600', marginBottom: 16 }}>
          Set Budget Limit for {category.name}
        </Text>
        <TextInput
          label="Monthly Budget Limit"
          value={budgetLimit}
          onChangeText={setBudgetLimit}
          keyboardType="decimal-pad"
          mode="outlined"
          left={<TextInput.Icon icon="currency-usd" />}
          style={{ marginBottom: 16 }}
        />
        <Text variant="bodySmall" style={{ color: theme.colors.outline, marginBottom: 24 }}>
          Leave empty to remove budget limit. You'll be alerted when spending
          reaches 80% and 100% of this limit.
        </Text>
        <View style={styles.actions}>
          <Button mode="outlined" onPress={() => router.back()} style={{ flex: 1, marginRight: 8 }}>
            Cancel
          </Button>
          <Button mode="contained" onPress={handleSave} style={{ flex: 1 }}>
            Save
          </Button>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { padding: 16 },
  actions: { flexDirection: 'row' },
});
