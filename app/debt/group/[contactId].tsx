import React, { useEffect, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import {
  Text,
  Card,
  Button,
  useTheme,
  Divider,
  Badge,
} from 'react-native-paper';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  fetchDebts,
  fetchPaymentsForDebts,
  deleteDebt,
} from '@/store/slices/debtsSlice';
import { fetchContacts } from '@/store/slices/contactsSlice';
import { formatCurrency } from '@/utils/currency';
import { formatTransactionDate } from '@/utils/dateHelpers';
import type { Debt, DebtPayment } from '@/db/schema';

export default function DebtGroupDetailScreen() {
  const { contactId, type } = useLocalSearchParams<{
    contactId: string;
    type: string;
  }>();
  const theme = useTheme() as any;
  const router = useRouter();
  const dispatch = useAppDispatch();

  const allDebts = useAppSelector((s) => s.debts.items);
  const allPayments = useAppSelector((s) => s.debts.payments);
  const contacts = useAppSelector((s) => s.contacts.items);
  const settings = useAppSelector((s) => s.settings.data);
  const symbol = settings?.currencySymbol ?? '$';

  const contact = contacts.find((c) => c.id === Number(contactId));
  const typeColor =
    type === 'lent' ? theme.custom.lent : theme.custom.borrowed;

  // All debts for this contact + type
  const debts = useMemo(
    () =>
      allDebts
        .filter(
          (d) =>
            d.contactId === Number(contactId) && d.type === type
        )
        .sort(
          (a, b) => b.createdAt.localeCompare(a.createdAt)
        ),
    [allDebts, contactId, type]
  );

  const debtIds = useMemo(() => debts.map((d) => d.id), [debts]);

  // Payments for these debts
  const payments = useMemo(
    () =>
      allPayments
        .filter((p) => debtIds.includes(p.debtId))
        .sort((a, b) => b.date.localeCompare(a.date)),
    [allPayments, debtIds]
  );

  useEffect(() => {
    dispatch(fetchDebts());
    dispatch(fetchContacts());
  }, [dispatch]);

  useEffect(() => {
    if (debtIds.length > 0) {
      dispatch(fetchPaymentsForDebts(debtIds));
    }
  }, [dispatch, debtIds.join(',')]);

  // Aggregated summary
  const totalAmount = debts.reduce((sum, d) => sum + d.amount, 0);
  const totalPaid = debts.reduce(
    (sum, d) => sum + (d.amount - d.remainingAmount),
    0
  );
  const totalRemaining = debts.reduce(
    (sum, d) => sum + d.remainingAmount,
    0
  );
  const progress =
    totalAmount > 0 ? (totalPaid / totalAmount) * 100 : 0;

  const activeCount = debts.filter((d) => d.status !== 'settled').length;
  const settledCount = debts.filter((d) => d.status === 'settled').length;

  // Build unified timeline: debts created + payments received
  const timeline = useMemo(() => {
    const entries: Array<{
      id: string;
      date: string;
      type: 'debt' | 'payment';
      amount: number;
      description?: string;
      debtId?: number;
      status?: string;
    }> = [];

    debts.forEach((d) => {
      entries.push({
        id: `debt-${d.id}`,
        date: d.createdAt,
        type: 'debt',
        amount: d.amount,
        description: d.description ?? undefined,
        debtId: d.id,
        status: d.status,
      });
    });

    payments.forEach((p) => {
      entries.push({
        id: `payment-${p.id}`,
        date: p.date,
        type: 'payment',
        amount: p.amount,
        description: p.notes ?? undefined,
        debtId: p.debtId,
      });
    });

    return entries.sort((a, b) => b.date.localeCompare(a.date));
  }, [debts, payments]);

  const handleDeleteDebt = (debtId: number) => {
    Alert.alert(
      'Delete Debt',
      'This will delete this debt and all its payment records. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await dispatch(deleteDebt(debtId));
          },
        },
      ]
    );
  };

  const typeLabel = type === 'lent' ? 'Lent to' : 'Borrowed from';

  if (!contact) {
    return (
      <View
        style={[
          styles.center,
          { backgroundColor: theme.colors.background },
        ]}
      >
        <Stack.Screen options={{ title: 'Debt Details' }} />
        <Text variant="bodyLarge">Contact not found</Text>
      </View>
    );
  }

  return (
    <View
      style={[styles.flex, { backgroundColor: theme.colors.background }]}
    >
      <Stack.Screen
        options={{
          title: `${typeLabel} ${contact.name}`,
        }}
      />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        {/* Summary Card */}
        <Card
          style={[
            styles.card,
            { borderTopColor: typeColor, borderTopWidth: 3 },
          ]}
        >
          <Card.Content>
            <View style={styles.headerRow}>
              <MaterialCommunityIcons
                name="account-circle"
                size={40}
                color={typeColor}
              />
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text variant="labelMedium" style={{ color: theme.colors.outline }}>
                  {typeLabel}
                </Text>
                <Text variant="headlineSmall" style={{ fontWeight: '700' }}>
                  {contact.name}
                </Text>
              </View>
            </View>

            {/* Net Balance */}
            <View style={styles.balanceSection}>
              <View style={styles.balanceRow}>
                <View style={styles.balanceItem}>
                  <Text
                    variant="labelSmall"
                    style={{ color: theme.colors.outline }}
                  >
                    Total {type === 'lent' ? 'Lent' : 'Borrowed'}
                  </Text>
                  <Text
                    variant="titleLarge"
                    style={{ fontWeight: '700' }}
                  >
                    {formatCurrency(totalAmount, symbol)}
                  </Text>
                </View>
                <View style={styles.balanceItem}>
                  <Text
                    variant="labelSmall"
                    style={{ color: theme.colors.outline }}
                  >
                    Total Repaid
                  </Text>
                  <Text
                    variant="titleLarge"
                    style={{
                      fontWeight: '700',
                      color: theme.custom.income,
                    }}
                  >
                    {formatCurrency(totalPaid, symbol)}
                  </Text>
                </View>
              </View>

              <Divider style={{ marginVertical: 12 }} />

              <View style={styles.netRow}>
                <Text variant="titleMedium" style={{ fontWeight: '600' }}>
                  Net Balance
                </Text>
                <Text
                  variant="titleLarge"
                  style={{ fontWeight: '700', color: typeColor }}
                >
                  {formatCurrency(totalRemaining, symbol)}
                </Text>
              </View>
            </View>

            {/* Progress */}
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
            <View style={styles.progressLabel}>
              <Text
                variant="labelSmall"
                style={{ color: theme.colors.outline }}
              >
                {progress.toFixed(1)}% settled
              </Text>
              <Text
                variant="labelSmall"
                style={{ color: theme.colors.outline }}
              >
                {activeCount} active · {settledCount} settled
              </Text>
            </View>
          </Card.Content>
        </Card>

        {/* Individual Debts Section */}
        <Text
          variant="titleSmall"
          style={{
            fontWeight: '600',
            marginTop: 20,
            marginBottom: 12,
          }}
        >
          Individual Debts ({debts.length})
        </Text>
        {debts.map((debt) => {
          const debtProgress =
            debt.amount > 0
              ? ((debt.amount - debt.remainingAmount) / debt.amount) * 100
              : 0;

          const statusColor =
            debt.status === 'settled'
              ? theme.custom.income
              : debt.status === 'partial'
              ? theme.custom.warning
              : theme.colors.outline;

          return (
            <TouchableOpacity
              key={debt.id}
              onPress={() => router.push(`/debt/${debt.id}`)}
            >
              <Card style={[styles.debtItemCard, { marginBottom: 8 }]}>
                <Card.Content>
                  <View style={styles.debtItemHeader}>
                    <View style={{ flex: 1 }}>
                      <Text
                        variant="bodyMedium"
                        style={{ fontWeight: '600' }}
                      >
                        {formatCurrency(debt.amount, symbol)}
                      </Text>
                      {debt.description && (
                        <Text
                          variant="bodySmall"
                          style={{ color: theme.colors.outline }}
                          numberOfLines={1}
                        >
                          {debt.description}
                        </Text>
                      )}
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Badge
                        style={[
                          styles.statusBadge,
                          {
                            backgroundColor: statusColor + '20',
                          },
                        ]}
                      >
                        {debt.status.toUpperCase()}
                      </Badge>
                      <Text
                        variant="labelSmall"
                        style={{
                          color: theme.colors.outline,
                          marginTop: 4,
                        }}
                      >
                        {formatTransactionDate(debt.createdAt)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.debtItemProgressBg}>
                    <View
                      style={[
                        styles.debtItemProgressFill,
                        {
                          width: `${Math.min(debtProgress, 100)}%`,
                          backgroundColor: typeColor,
                        },
                      ]}
                    />
                  </View>
                  <Text
                    variant="labelSmall"
                    style={{ color: theme.colors.outline, marginTop: 4 }}
                  >
                    {formatCurrency(
                      debt.amount - debt.remainingAmount,
                      symbol
                    )}{' '}
                    of {formatCurrency(debt.amount, symbol)} paid
                    {debt.dueDate &&
                      ` · Due: ${formatTransactionDate(debt.dueDate)}`}
                  </Text>
                </Card.Content>
              </Card>
            </TouchableOpacity>
          );
        })}

        {/* Transaction History Section */}
        <Text
          variant="titleSmall"
          style={{
            fontWeight: '600',
            marginTop: 20,
            marginBottom: 12,
          }}
        >
          Full Transaction History ({timeline.length})
        </Text>
        {timeline.length === 0 ? (
          <Text
            variant="bodySmall"
            style={{
              color: theme.colors.outline,
              textAlign: 'center',
              padding: 24,
            }}
          >
            No transactions yet
          </Text>
        ) : (
          timeline.map((entry, idx) => {
            const isDebt = entry.type === 'debt';
            const icon = isDebt
              ? type === 'lent'
                ? 'arrow-top-right'
                : 'arrow-bottom-left'
              : type === 'lent'
              ? 'arrow-bottom-left'
              : 'arrow-top-right';
            const color = isDebt ? typeColor : theme.custom.income;
            const label = isDebt
              ? type === 'lent'
                ? 'Lent'
                : 'Borrowed'
              : 'Repayment';

            return (
              <View key={entry.id}>
                {idx > 0 && <Divider />}
                <View style={styles.timelineRow}>
                  <View
                    style={[
                      styles.timelineIcon,
                      { backgroundColor: color + '15' },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={icon}
                      size={18}
                      color={color}
                    />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <View style={styles.timelineContent}>
                      <View style={{ flex: 1 }}>
                        <Text
                          variant="bodyMedium"
                          style={{ fontWeight: '600' }}
                        >
                          {label}
                        </Text>
                        {entry.description && (
                          <Text
                            variant="bodySmall"
                            style={{ color: theme.colors.outline }}
                            numberOfLines={1}
                          >
                            {entry.description}
                          </Text>
                        )}
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text
                          variant="bodyMedium"
                          style={{ fontWeight: '700', color }}
                        >
                          {isDebt ? '+' : '-'}
                          {formatCurrency(entry.amount, symbol)}
                        </Text>
                        <Text
                          variant="labelSmall"
                          style={{ color: theme.colors.outline }}
                        >
                          {formatTransactionDate(entry.date)}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              </View>
            );
          })
        )}

        {/* Add New Debt button */}
        <Button
          mode="contained"
          icon="plus"
          onPress={() => router.push('/debt/add')}
          style={{ marginTop: 24 }}
        >
          Add New {type === 'lent' ? 'Lending' : 'Borrowing'}
        </Button>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: { borderRadius: 12, marginBottom: 8 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  balanceSection: {
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: 12,
    padding: 12,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  balanceItem: { flex: 1 },
  netRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E0E0E0',
    marginTop: 16,
  },
  progressFill: { height: 6, borderRadius: 3 },
  progressLabel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  debtItemCard: { borderRadius: 10 },
  debtItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  statusBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    height: 20,
  },
  debtItemProgressBg: {
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#E0E0E0',
    marginTop: 8,
  },
  debtItemProgressFill: { height: 3, borderRadius: 1.5 },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  timelineIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timelineContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
});
