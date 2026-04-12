import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { Text, Button, useTheme } from 'react-native-paper';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';

import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  updateTransaction,
  deleteTransaction,
  fetchTransactions,
} from '@/store/slices/transactionsSlice';
import { fetchCategories } from '@/store/slices/categoriesSlice';
import TransactionForm from '@/components/TransactionForm';
import type { NewTransaction } from '@/db/schema';

export default function TransactionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme() as any;
  const router = useRouter();
  const dispatch = useAppDispatch();

  const transaction = useAppSelector((s) =>
    s.transactions.items.find((t) => t.id === Number(id))
  );
  const loading = useAppSelector((s) => s.transactions.loading);

  useEffect(() => {
    dispatch(fetchTransactions());
    dispatch(fetchCategories());
  }, [dispatch]);

  if (!transaction) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <Stack.Screen options={{ title: 'Transaction' }} />
        <Text variant="bodyLarge">Transaction not found</Text>
      </View>
    );
  }

  const handleUpdate = async (data: NewTransaction) => {
    await dispatch(updateTransaction({ id: transaction.id, data }));
    router.back();
  };

  const handleDelete = () => {
    Alert.alert('Delete Transaction', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await dispatch(deleteTransaction(transaction.id));
          router.back();
        },
      },
    ]);
  };

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen options={{ title: 'Edit Transaction' }} />
      <TransactionForm
        initialData={transaction}
        onSubmit={handleUpdate}
        onCancel={() => router.back()}
        loading={loading}
      />
      <View style={styles.deleteArea}>
        <Button
          mode="outlined"
          textColor={theme.custom.expense}
          onPress={handleDelete}
          icon="delete"
        >
          Delete Transaction
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  deleteArea: { padding: 16, paddingBottom: 32 },
});
