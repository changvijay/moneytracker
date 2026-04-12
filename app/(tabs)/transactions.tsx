import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  Alert,
  Modal as RNModal,
} from 'react-native';
import {
  Text,
  Searchbar,
  Chip,
  FAB,
  useTheme,
  Divider,
  IconButton,
} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';


import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  fetchTransactions,
  addTransaction,
  deleteTransaction,
} from '@/store/slices/transactionsSlice';
import { fetchCategories } from '@/store/slices/categoriesSlice';
import { formatCurrency } from '@/utils/currency';
import { formatSectionDate } from '@/utils/dateHelpers';
import TransactionForm from '@/components/TransactionForm';
import EmptyState from '@/components/EmptyState';
import type { NewTransaction, Transaction } from '@/db/schema';

type FilterType = 'all' | 'income' | 'expense';

export default function TransactionsScreen() {
  const theme = useTheme() as any;
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const dispatch = useAppDispatch();

  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');

  const allTransactions = useAppSelector((s) => s.transactions.items);
  const categories = useAppSelector((s) => s.categories.items);
  const settings = useAppSelector((s) => s.settings.data);
  const symbol = settings?.currencySymbol ?? '$';

  const lastTransactionDate = allTransactions[0]?.date ?? null;

  useEffect(() => {
    dispatch(fetchTransactions());
    dispatch(fetchCategories());
  }, [dispatch]);

  const filteredTransactions = useMemo(() => {
    let result = allTransactions;
    if (filter !== 'all') {
      result = result.filter((t) => t.type === filter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.description?.toLowerCase().includes(q) ||
          categories
            .find((c) => c.id === t.categoryId)
            ?.name.toLowerCase()
            .includes(q)
      );
    }
    return result;
  }, [allTransactions, filter, searchQuery, categories]);

  const sections = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    filteredTransactions.forEach((t) => {
      const existing = map.get(t.date) ?? [];
      existing.push(t);
      map.set(t.date, existing);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, data]) => ({
        title: formatSectionDate(date),
        date,
        total: data.reduce(
          (sum, t) => sum + (t.type === 'income' ? t.amount : -t.amount),
          0
        ),
        data,
      }));
  }, [filteredTransactions]);

  const getCategory = (catId: number | null) =>
    categories.find((c) => c.id === catId);

  const handleDelete = (id: number) => {
    Alert.alert('Delete Transaction', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => dispatch(deleteTransaction(id)),
      },
    ]);
  };

  const handleAdd = async (data: NewTransaction) => {
    await dispatch(addTransaction(data));
    setShowAddModal(false);
  };

  const renderTransaction = ({ item }: { item: Transaction }) => {
    const cat = getCategory(item.categoryId);
    return (
        <TouchableOpacity
          style={[styles.txnRow, { backgroundColor: theme.colors.surface }]}
          onPress={() => router.push(`/transaction/${item.id}`)}
          onLongPress={() => handleDelete(item.id)}
          delayLongPress={400}
        >
          <View
            style={[
              styles.txnIcon,
              { backgroundColor: (cat?.color ?? '#757575') + '20' },
            ]}
          >
            <MaterialCommunityIcons
              name={(cat?.icon ?? 'help-circle') as any}
              size={22}
              color={cat?.color ?? '#757575'}
            />
          </View>
          <View style={styles.txnInfo}>
            <Text variant="bodyMedium" style={{ fontWeight: '500' }}>
              {cat?.name ?? 'Unknown'}
            </Text>
            {item.description && (
              <Text
                variant="bodySmall"
                style={{ color: theme.colors.outline }}
                numberOfLines={1}
              >
                {item.description}
              </Text>
            )}
          </View>
          <Text
            variant="titleSmall"
            style={{
              fontWeight: '600',
              color:
                item.type === 'income'
                  ? theme.custom.income
                  : theme.custom.expense,
            }}
          >
            {item.type === 'income' ? '+' : '-'}
            {formatCurrency(item.amount, symbol)}
          </Text>
        </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.headerArea, { paddingTop: insets.top + 8 }]}>
        <Text variant="headlineSmall" style={styles.title}>
          Transactions
        </Text>
        <Searchbar
          placeholder="Search transactions..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={styles.searchbar}
          inputStyle={{ fontSize: 14 }}
        />
        <View style={styles.filterRow}>
          {(['all', 'income', 'expense'] as FilterType[]).map((f) => (
            <Chip
              key={f}
              selected={filter === f}
              onPress={() => setFilter(f)}
              style={styles.chip}
              compact
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Chip>
          ))}
        </View>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderTransaction}
        renderSectionHeader={({ section }) => (
          <View
            style={[
              styles.sectionHeader,
              { backgroundColor: theme.colors.background },
            ]}
          >
            <Text variant="labelLarge" style={{ fontWeight: '600', flex: 1 }}>
              {section.title}
            </Text>
            <Text
              variant="labelMedium"
              style={{
                color:
                  section.total >= 0
                    ? theme.custom.income
                    : theme.custom.expense,
                fontWeight: '600',
              }}
            >
              {formatCurrency(section.total, symbol)}
            </Text>
          </View>
        )}
        ItemSeparatorComponent={() => <Divider />}
        ListEmptyComponent={
          <EmptyState
            icon="swap-horizontal"
            title="No Transactions"
            subtitle="Tap the + button to record your first transaction"
          />
        }
        contentContainerStyle={{ paddingBottom: 100 }}
      />

      <FAB
        icon="plus"
        style={[
          styles.fab, 
          { 
            backgroundColor: theme.colors.primary,
            bottom: insets.bottom + 20,
            elevation: 8,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
          }
        ]}
        color="white"
        onPress={() => setShowAddModal(true)}
        size="medium"
        label="Add"
      />

      <RNModal
        visible={showAddModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAddModal(false)}
      >
        <View
          style={[
            styles.fullScreenModal,
            {
              backgroundColor: theme.colors.surface,
              paddingTop: insets.top,
              paddingBottom: insets.bottom,
            }
          ]}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHandle} />
            <View style={[styles.modalHeader, { borderBottomColor: theme.colors.outline + '20' }]}>
              <Text
                variant="titleMedium"
                style={{ fontWeight: '700', color: theme.colors.onSurface }}
              >
                Add Transaction
              </Text>
              <IconButton
                icon="close"
                size={20}
                onPress={() => setShowAddModal(false)}
                iconColor={theme.colors.onSurfaceVariant}
              />
            </View>
            <View style={styles.modalContent}>
              <TransactionForm
                initialData={lastTransactionDate ? { date: lastTransactionDate } : undefined}
                onSubmit={handleAdd}
                onCancel={() => setShowAddModal(false)}
              />
            </View>
          </View>
        </View>
      </RNModal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headerArea: { paddingHorizontal: 16, paddingBottom: 8 },
  title: { fontWeight: '700', marginBottom: 12 },
  searchbar: { marginBottom: 8, height: 44 },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  chip: { borderRadius: 20 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  txnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 64,
  },
  txnIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  txnInfo: { flex: 1 },

  fab: {
    position: 'absolute',
    right: 20,
    borderRadius: 16,
    zIndex: 1000,
  },
  fullScreenModal: {
    flex: 1,
    margin: 0,
    width: '100%',
    height: '100%',
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  modalContainer: {
    flex: 1,
    height: '100%',
  },
  modalContent: {
    flex: 1,
  },
});
