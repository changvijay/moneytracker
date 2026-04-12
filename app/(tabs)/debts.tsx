import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
} from 'react-native';
import {
  Text,
  FAB,
  useTheme,
  SegmentedButtons,
  Card,
  Badge,
  Divider,
} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchDebts, deleteDebt } from '@/store/slices/debtsSlice';
import { fetchContacts } from '@/store/slices/contactsSlice';
import { formatCurrency } from '@/utils/currency';
import { formatTransactionDate } from '@/utils/dateHelpers';
import { selectDebtSummary } from '@/store/selectors/insightsSelectors';
import EmptyState from '@/components/EmptyState';
import type { Debt } from '@/db/schema';

export default function DebtsScreen() {
  const theme = useTheme() as any;
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const dispatch = useAppDispatch();

  const [tab, setTab] = useState<'lent' | 'borrowed'>('lent');

  const allDebts = useAppSelector((s) => s.debts.items);
  const contacts = useAppSelector((s) => s.contacts.items);
  const settings = useAppSelector((s) => s.settings.data);
  const debtSummary = useAppSelector(selectDebtSummary);
  const symbol = settings?.currencySymbol ?? '$';

  useEffect(() => {
    dispatch(fetchDebts());
    dispatch(fetchContacts());
  }, [dispatch]);

  const filteredDebts = useMemo(
    () => allDebts.filter((d) => d.type === tab),
    [allDebts, tab]
  );

  const getContact = (contactId: number) =>
    contacts.find((c) => c.id === contactId);

  const statusColor = (status: string) => {
    switch (status) {
      case 'settled':
        return theme.custom.income;
      case 'partial':
        return theme.custom.warning;
      default:
        return theme.colors.outline;
    }
  };

  const handleDelete = (id: number) => {
    Alert.alert('Delete Debt', 'This will also delete all payment records. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => dispatch(deleteDebt(id)),
      },
    ]);
  };

  const renderDebt = ({ item }: { item: Debt }) => {
    const contact = getContact(item.contactId);
    const progress =
      item.amount > 0
        ? ((item.amount - item.remainingAmount) / item.amount) * 100
        : 0;

    return (
      <TouchableOpacity onPress={() => router.push(`/debt/${item.id}`)}>
        <Card style={styles.debtCard}>
          <Card.Content>
            <View style={styles.debtHeader}>
              <View style={styles.debtInfo}>
                <Text variant="titleMedium" style={{ fontWeight: '600' }}>
                  {contact?.name ?? 'Unknown'}
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
              <View style={{ alignItems: 'flex-end' }}>
                <Text
                  variant="titleMedium"
                  style={{
                    fontWeight: '700',
                    color: tab === 'lent' ? theme.custom.lent : theme.custom.borrowed,
                  }}
                >
                  {formatCurrency(item.remainingAmount, symbol)}
                </Text>
                <Badge
                  style={[
                    styles.statusBadge,
                    { backgroundColor: statusColor(item.status) + '20' },
                  ]}
                >
                  {item.status.toUpperCase()}
                </Badge>
              </View>
            </View>

            {/* Progress bar */}
            <View style={styles.progressBg}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${Math.min(progress, 100)}%`,
                    backgroundColor:
                      tab === 'lent' ? theme.custom.lent : theme.custom.borrowed,
                  },
                ]}
              />
            </View>
            <View style={styles.debtFooter}>
              <Text variant="labelSmall" style={{ color: theme.colors.outline }}>
                {formatCurrency(item.amount - item.remainingAmount, symbol)} of{' '}
                {formatCurrency(item.amount, symbol)} paid
              </Text>
              {item.dueDate && (
                <Text variant="labelSmall" style={{ color: theme.colors.outline }}>
                  Due: {formatTransactionDate(item.dueDate)}
                </Text>
              )}
            </View>
          </Card.Content>
        </Card>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.headerArea, { paddingTop: insets.top + 8 }]}>
        <Text variant="headlineSmall" style={styles.title}>
          Debts
        </Text>

        {/* Summary cards */}
        <View style={styles.summaryRow}>
          <Card style={[styles.summaryCard, { borderLeftColor: theme.custom.lent, borderLeftWidth: 3 }]}>
            <Card.Content style={styles.summaryContent}>
              <Text variant="labelSmall">Total Lent</Text>
              <Text variant="titleMedium" style={{ fontWeight: '700', color: theme.custom.lent }}>
                {formatCurrency(debtSummary.totalLent, symbol)}
              </Text>
            </Card.Content>
          </Card>
          <Card style={[styles.summaryCard, { borderLeftColor: theme.custom.borrowed, borderLeftWidth: 3 }]}>
            <Card.Content style={styles.summaryContent}>
              <Text variant="labelSmall">Total Borrowed</Text>
              <Text variant="titleMedium" style={{ fontWeight: '700', color: theme.custom.borrowed }}>
                {formatCurrency(debtSummary.totalBorrowed, symbol)}
              </Text>
            </Card.Content>
          </Card>
        </View>

        <SegmentedButtons
          value={tab}
          onValueChange={(v) => setTab(v as 'lent' | 'borrowed')}
          buttons={[
            { value: 'lent', label: `Lent (${allDebts.filter((d) => d.type === 'lent' && d.status !== 'settled').length})` },
            { value: 'borrowed', label: `Borrowed (${allDebts.filter((d) => d.type === 'borrowed' && d.status !== 'settled').length})` },
          ]}
          style={styles.segment}
        />
      </View>

      <FlatList
        data={filteredDebts}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderDebt}
        ListEmptyComponent={
          <EmptyState
            icon="handshake"
            title={`No ${tab} money records`}
            subtitle={`Tap + to add money you've ${tab === 'lent' ? 'lent to' : 'borrowed from'} someone`}
          />
        }
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
      />

      <FAB
        icon="plus"
        style={[styles.fab, { backgroundColor: theme.colors.primary, bottom: insets.bottom + 16 }]}
        color="white"
        onPress={() => router.push('/debt/add')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headerArea: { paddingHorizontal: 16, paddingBottom: 8 },
  title: { fontWeight: '700', marginBottom: 12 },
  summaryRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  summaryCard: { flex: 1, borderRadius: 12 },
  summaryContent: { paddingVertical: 8 },
  segment: { marginBottom: 4 },
  debtCard: { borderRadius: 12 },
  debtHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  debtInfo: { flex: 1, marginRight: 12 },
  statusBadge: {
    marginTop: 4,
    borderRadius: 6,
    paddingHorizontal: 8,
    height: 20,
  },
  progressBg: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E0E0E0',
    marginTop: 12,
  },
  progressFill: { height: 4, borderRadius: 2 },
  debtFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  fab: {
    position: 'absolute',
    right: 16,
    borderRadius: 16,
  },
});
