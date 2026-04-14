import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import {
  Text,
  FAB,
  useTheme,
  SegmentedButtons,
  Card,
  Badge,
} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchDebts } from '@/store/slices/debtsSlice';
import { fetchContacts } from '@/store/slices/contactsSlice';
import { formatCurrency } from '@/utils/currency';
import {
  selectDebtSummary,
  selectGroupedDebtsByType,
  DebtGroup,
} from '@/store/selectors/insightsSelectors';
import EmptyState from '@/components/EmptyState';

export default function DebtsScreen() {
  const theme = useTheme() as any;
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const dispatch = useAppDispatch();

  const [tab, setTab] = useState<'lent' | 'borrowed'>('lent');

  const contacts = useAppSelector((s) => s.contacts.items);
  const settings = useAppSelector((s) => s.settings.data);
  const debtSummary = useAppSelector(selectDebtSummary);
  const groupedDebts = useAppSelector(selectGroupedDebtsByType);
  const symbol = settings?.currencySymbol ?? '$';

  useEffect(() => {
    dispatch(fetchDebts());
    dispatch(fetchContacts());
  }, [dispatch]);

  const data = tab === 'lent' ? groupedDebts.lent : groupedDebts.borrowed;

  const hasContacts = contacts.length > 0;

  const renderGroup = ({ item }: { item: DebtGroup }) => {
    const progress =
      item.totalAmount > 0
        ? (item.totalPaid / item.totalAmount) * 100
        : 0;

    const statusLabel = item.allSettled
      ? 'SETTLED'
      : item.activeCount < item.debtCount
      ? 'PARTIAL'
      : 'ACTIVE';

    const statusColor = item.allSettled
      ? theme.custom.income
      : item.activeCount < item.debtCount
      ? theme.custom.warning
      : theme.colors.outline;

    const typeColor =
      tab === 'lent' ? theme.custom.lent : theme.custom.borrowed;

    return (
      <TouchableOpacity
        onPress={() =>
          router.push(`/debt/group/${item.contactId}?type=${item.type}`)
        }
      >
        <Card style={styles.debtCard}>
          <Card.Content>
            <View style={styles.debtHeader}>
              <View style={styles.debtInfo}>
                <View style={styles.nameRow}>
                  <MaterialCommunityIcons
                    name="account-circle"
                    size={24}
                    color={typeColor}
                    style={{ marginRight: 8 }}
                  />
                  <Text variant="titleMedium" style={{ fontWeight: '600', flex: 1 }}>
                    {item.contactName}
                  </Text>
                </View>
                <Text
                  variant="bodySmall"
                  style={{ color: theme.colors.outline, marginTop: 2 }}
                >
                  {item.debtCount} transaction{item.debtCount !== 1 ? 's' : ''}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text
                  variant="titleMedium"
                  style={{
                    fontWeight: '700',
                    color: typeColor,
                  }}
                >
                  {formatCurrency(item.totalRemaining, symbol)}
                </Text>
                <Badge
                  style={[
                    styles.statusBadge,
                    { backgroundColor: statusColor + '20' },
                  ]}
                >
                  {statusLabel}
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
                    backgroundColor: typeColor,
                  },
                ]}
              />
            </View>
            <View style={styles.debtFooter}>
              <Text variant="labelSmall" style={{ color: theme.colors.outline }}>
                {formatCurrency(item.totalPaid, symbol)} of{' '}
                {formatCurrency(item.totalAmount, symbol)} paid
              </Text>
              <MaterialCommunityIcons
                name="chevron-right"
                size={18}
                color={theme.colors.outline}
              />
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
          <Card
            style={[
              styles.summaryCard,
              { borderLeftColor: theme.custom.lent, borderLeftWidth: 3 },
            ]}
          >
            <Card.Content style={styles.summaryContent}>
              <Text variant="labelSmall">Total Lent</Text>
              <Text
                variant="titleMedium"
                style={{ fontWeight: '700', color: theme.custom.lent }}
              >
                {formatCurrency(debtSummary.totalLent, symbol)}
              </Text>
            </Card.Content>
          </Card>
          <Card
            style={[
              styles.summaryCard,
              { borderLeftColor: theme.custom.borrowed, borderLeftWidth: 3 },
            ]}
          >
            <Card.Content style={styles.summaryContent}>
              <Text variant="labelSmall">Total Borrowed</Text>
              <Text
                variant="titleMedium"
                style={{ fontWeight: '700', color: theme.custom.borrowed }}
              >
                {formatCurrency(debtSummary.totalBorrowed, symbol)}
              </Text>
            </Card.Content>
          </Card>
        </View>

        <SegmentedButtons
          value={tab}
          onValueChange={(v) => setTab(v as 'lent' | 'borrowed')}
          buttons={[
            {
              value: 'lent',
              label: `Lending (${groupedDebts.lent.filter((g) => !g.allSettled).length})`,
            },
            {
              value: 'borrowed',
              label: `Borrowing (${groupedDebts.borrowed.filter((g) => !g.allSettled).length})`,
            },
          ]}
          style={styles.segment}
        />
      </View>

      <FlatList
        data={data}
        keyExtractor={(item) => `${item.type}-${item.contactId}`}
        renderItem={renderGroup}
        ListEmptyComponent={
          <View>
            <EmptyState
              icon="handshake"
              title={`No ${tab === 'lent' ? 'lending' : 'borrowing'} records`}
              subtitle={`Tap + to add money you've ${tab === 'lent' ? 'lent to' : 'borrowed from'} someone`}
            />
            {!hasContacts && (
              <View style={styles.importHint}>
                <Text
                  variant="bodySmall"
                  style={{ color: theme.colors.outline, textAlign: 'center' }}
                >
                  You can search your phone contacts when adding a new debt
                </Text>
              </View>
            )}
          </View>
        }
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
      />

      <FAB
        icon="plus"
        style={[
          styles.fab,
          { backgroundColor: theme.colors.primary, bottom: insets.bottom + 16 },
        ]}
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
  nameRow: { flexDirection: 'row', alignItems: 'center' },
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
    alignItems: 'center',
    marginTop: 8,
  },
  fab: {
    position: 'absolute',
    right: 16,
    borderRadius: 16,
  },
  importHint: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingBottom: 16,
  },
});
