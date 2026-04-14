import React, { useEffect, useCallback, useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Dimensions,
    Modal as RNModal,

} from 'react-native';
import {
  Text,
  Card,
  FAB,
  useTheme,
  Portal,
  Modal,
  Surface,
  Divider,
  ProgressBar,
  IconButton
} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Svg, { G, Path } from 'react-native-svg';

import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchTransactions, addTransaction } from '@/store/slices/transactionsSlice';
import { fetchCategories } from '@/store/slices/categoriesSlice';
import { fetchDebts } from '@/store/slices/debtsSlice';
import { fetchSettings } from '@/store/slices/settingsSlice';
import {
  selectCurrentMonthTotals,
  selectPreviousMonthTotals,
  selectBudgetAlerts,
  selectDebtSummary,
  selectSavingsRate,
  selectSpendingVelocity,
  selectExpenseByCategoryCurrentMonth,
} from '@/store/selectors/insightsSelectors';
import { formatCurrency } from '@/utils/currency';
import { formatTransactionDate } from '@/utils/dateHelpers';
import TransactionForm from '@/components/TransactionForm';
import type { NewTransaction } from '@/db/schema';
import type { AppTheme } from '@/theme';
import { sendBudgetAlert } from '@/services/notifications';

const SCREEN_WIDTH = Dimensions.get('window').width;
const PIE_SIZE = SCREEN_WIDTH * 0.42;
const PIE_RADIUS = PIE_SIZE / 2;
const INNER_RADIUS = PIE_RADIUS * 0.58;

function buildPiePaths(data: { amount: number; color: string }[]) {
  const total = data.reduce((s, d) => s + d.amount, 0);
  if (total === 0) return [];
  let startAngle = -Math.PI / 2;
  return data.map((d) => {
    const slice = (d.amount / total) * 2 * Math.PI;
    const endAngle = startAngle + slice;
    const x1 = PIE_RADIUS + PIE_RADIUS * Math.cos(startAngle);
    const y1 = PIE_RADIUS + PIE_RADIUS * Math.sin(startAngle);
    const x2 = PIE_RADIUS + PIE_RADIUS * Math.cos(endAngle);
    const y2 = PIE_RADIUS + PIE_RADIUS * Math.sin(endAngle);
    const ix1 = PIE_RADIUS + INNER_RADIUS * Math.cos(startAngle);
    const iy1 = PIE_RADIUS + INNER_RADIUS * Math.sin(startAngle);
    const ix2 = PIE_RADIUS + INNER_RADIUS * Math.cos(endAngle);
    const iy2 = PIE_RADIUS + INNER_RADIUS * Math.sin(endAngle);
    const large = slice > Math.PI ? 1 : 0;
    const path =
      `M ${ix1} ${iy1} L ${x1} ${y1} ` +
      `A ${PIE_RADIUS} ${PIE_RADIUS} 0 ${large} 1 ${x2} ${y2} ` +
      `L ${ix2} ${iy2} ` +
      `A ${INNER_RADIUS} ${INNER_RADIUS} 0 ${large} 0 ${ix1} ${iy1} Z`;
    const result = { path, color: d.color, startAngle };
    startAngle = endAngle;
    return result;
  });
}

export default function DashboardScreen() {
  const theme = useTheme<AppTheme>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const dispatch = useAppDispatch();

  const [showAddModal, setShowAddModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const transactions = useAppSelector((s) => s.transactions.items);
  const categories = useAppSelector((s) => s.categories.items);
  const settings = useAppSelector((s) => s.settings.data);
  const currentTotals = useAppSelector(selectCurrentMonthTotals);
  const prevTotals = useAppSelector(selectPreviousMonthTotals);
  const budgetAlerts = useAppSelector(selectBudgetAlerts);
  const debtSummary = useAppSelector(selectDebtSummary);
  const savingsRate = useAppSelector(selectSavingsRate);
  const velocity = useAppSelector(selectSpendingVelocity);
  const categoryBreakdown = useAppSelector(selectExpenseByCategoryCurrentMonth);
  const symbol = settings?.currencySymbol ?? '$';
  const recentTransactions = transactions.slice(0, 5);
  const allTransactions = useAppSelector((s) => s.transactions.items);

  const lastTransactionDate = allTransactions[0]?.date ?? null;
  // Pie chart slices (top 5 + Others)
  const pieSlices = useMemo(() => {
    if (categoryBreakdown.length === 0) return [];
    const top = categoryBreakdown.slice(0, 5);
    const otherTotal = categoryBreakdown.slice(5).reduce((s, c) => s + c.amount, 0);
    const items = otherTotal > 0
      ? [...top, { name: 'Others', color: '#9E9E9E', amount: otherTotal, categoryId: -1, icon: 'dots-horizontal', budgetLimit: null, budgetUsage: null }]
      : top;
    return buildPiePaths(items.map((c) => ({ amount: c.amount, color: c.color })))
      .map((p, i) => ({ ...p, name: items[i].name, amount: items[i].amount, color: items[i].color }));
  }, [categoryBreakdown]);

  const loadData = useCallback(async () => {
    await Promise.all([
      dispatch(fetchTransactions()),
      dispatch(fetchCategories()),
      dispatch(fetchDebts()),
      dispatch(fetchSettings()),
    ]);
  }, [dispatch]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleAddTransaction = async (data: NewTransaction) => {
    await dispatch(addTransaction(data));
    setShowAddModal(false);

    // Refresh transactions to get updated data for budget check
    await dispatch(fetchTransactions());
    
    // Check budget alerts after adding and refreshing
    const category = categories.find((c) => c.id === data.categoryId);
    if (category?.budgetLimit && data.type === 'expense') {
      const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
      const updatedTransactions = await dispatch(fetchTransactions()).unwrap();
      
      const categoryExpenses = updatedTransactions
        .filter(
          (t) =>
            t.type === 'expense' &&
            t.categoryId === data.categoryId &&
            t.date.startsWith(currentMonth)
        )
        .reduce((sum, t) => sum + t.amount, 0);

      const pct = (categoryExpenses / category.budgetLimit) * 100;
      if (pct >= 80) {
        sendBudgetAlert(category.name, pct);
      }
    }
  };

  const getCategory = (catId: number | null) =>
    categories.find((c) => c.id === catId);

  const balanceTrend =
    prevTotals.balance !== 0
      ? ((currentTotals.balance - prevTotals.balance) / Math.abs(prevTotals.balance)) * 100
      : 0;




  const handleAdd = async (data: NewTransaction) => {
      await dispatch(addTransaction(data));
      setShowAddModal(false);
    };

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text variant="headlineSmall" style={{ fontWeight: '700' }}>
            MoneyTracker
          </Text>
          <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
            {new Date().toLocaleDateString(undefined, {
              month: 'long',
              year: 'numeric',
            })}
          </Text>
        </View>

        {/* Balance Card */}
        <Card style={[styles.balanceCard, { backgroundColor: theme.colors.primary }]}>
          <Card.Content>
            <Text variant="labelLarge" style={styles.whiteText}>
              Net Balance This Month
            </Text>
            <Text variant="headlineLarge" style={[styles.whiteText, { fontWeight: '700' }]}>
              {formatCurrency(currentTotals.balance, symbol)}
            </Text>
            <View style={styles.balanceRow}>
              <View style={styles.balanceStat}>
                <MaterialCommunityIcons name="arrow-down-circle" size={16} color="#81C784" />
                <Text variant="bodySmall" style={styles.whiteText}>
                  {' '}
                  Income: {formatCurrency(currentTotals.income, symbol)}
                </Text>
              </View>
              <View style={styles.balanceStat}>
                <MaterialCommunityIcons name="arrow-up-circle" size={16} color="#EF9A9A" />
                <Text variant="bodySmall" style={styles.whiteText}>
                  {' '}
                  Expenses: {formatCurrency(currentTotals.expenses, symbol)}
                </Text>
              </View>
            </View>
            {balanceTrend !== 0 && (
              <View style={styles.trendRow}>
                <MaterialCommunityIcons
                  name={balanceTrend > 0 ? 'trending-up' : 'trending-down'}
                  size={16}
                  color={balanceTrend > 0 ? '#81C784' : '#EF9A9A'}
                />
                <Text variant="labelSmall" style={styles.whiteText}>
                  {' '}
                  {Math.abs(balanceTrend).toFixed(1)}% vs last month
                </Text>
              </View>
            )}
          </Card.Content>
        </Card>

        {/* Quick Stats Row */}
        <View style={styles.statsRow}>
          <Surface style={[styles.statCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
            <Text variant="labelSmall" style={{ color: theme.colors.outline }}>
              Savings Rate
            </Text>
            <Text
              variant="titleMedium"
              style={{
                fontWeight: '700',
                color: savingsRate >= 0 ? '#2E7D32' : '#C62828',
              }}
            >
              {savingsRate.toFixed(1)}%
            </Text>
          </Surface>
          <Surface style={[styles.statCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
            <Text variant="labelSmall" style={{ color: theme.colors.outline }}>
              Projected Spend
            </Text>
            <Text
              variant="titleMedium"
              style={{
                fontWeight: '700',
                color:
                  velocity.pace > 100
                    ? '#C62828'
                    : '#2E7D32',
              }}
            >
              {formatCurrency(velocity.projected, symbol, 0)}
            </Text>
          </Surface>
        </View>

        {/* Budget Alerts */}
        {budgetAlerts.length > 0 && (
          <Card style={[styles.card, { borderLeftColor: '#F57F17', borderLeftWidth: 4 }]}>
            <Card.Content>
              <View style={styles.sectionHeader}>
                <MaterialCommunityIcons name="alert-circle" size={20} color="#F57F17" />
                <Text variant="titleSmall" style={{ marginLeft: 8, fontWeight: '600', flex: 1 }}>
                  Budget Alerts
                </Text>
                <Text variant="labelSmall" style={{ color: theme.colors.outline }}>
                  {budgetAlerts.filter((a) => (a.budgetUsage ?? 0) >= 100).length > 0
                    ? `${budgetAlerts.filter((a) => (a.budgetUsage ?? 0) >= 100).length} exceeded`
                    : `${budgetAlerts.length} warning`}
                </Text>
              </View>
              {budgetAlerts.map((alert) => {
                const exceeded = (alert.budgetUsage ?? 0) >= 100;
                const pct = Math.min(alert.budgetUsage ?? 0, 100) / 100;
                return (
                  <View key={alert.categoryId} style={styles.alertRow}>
                    <View
                      style={[
                        styles.alertBadge,
                        { backgroundColor: exceeded ? '#FFEBEE' : '#FFF8E1' },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={exceeded ? 'alert-octagon' : 'alert'}
                        size={14}
                        color={exceeded ? '#C62828' : '#F57F17'}
                      />
                    </View>
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <View style={styles.alertLabelRow}>
                        <Text variant="bodySmall" style={{ fontWeight: '600', flex: 1 }}>
                          {alert.name}
                        </Text>
                        <Text
                          variant="labelSmall"
                          style={{
                            color: exceeded ? '#C62828' : '#F57F17',
                            fontWeight: '700',
                          }}
                        >
                          {(alert.budgetUsage ?? 0).toFixed(0)}%{exceeded ? ' EXCEEDED' : ''}
                        </Text>
                      </View>
                      <ProgressBar
                        progress={pct}
                        color={exceeded ? '#C62828' : '#F57F17'}
                        style={{ height: 4, borderRadius: 2, marginTop: 4 }}
                      />
                    </View>
                  </View>
                );
              })}
            </Card.Content>
          </Card>
        )}

        {/* Spending Pie Chart */}
        {categoryBreakdown.length > 0 && (
          <Card style={styles.card}>
            <Card.Content>
              <Text variant="titleSmall" style={{ fontWeight: '600', marginBottom: 12 }}>
                Spending by Category
              </Text>
              <View style={styles.pieRow}>
                {/* Donut chart with center label */}
                <View style={{ width: PIE_SIZE, height: PIE_SIZE }}>
                  <Svg width={PIE_SIZE} height={PIE_SIZE} style={{ position: 'absolute' }}>
                    <G>
                      {pieSlices.map((slice, i) => (
                        <Path key={i} d={slice.path} fill={slice.color} />
                      ))}
                    </G>
                  </Svg>
                  {/* Center label overlay */}
                  <View style={styles.pieCenterLabel} pointerEvents="none">
                    <Text variant="labelSmall" style={{ color: '#888', textAlign: 'center' }}>
                      Spend
                    </Text>
                    <Text variant="labelMedium" style={{ fontWeight: '700', textAlign: 'center' }}>
                      {formatCurrency(currentTotals.expenses, symbol, 0)}
                    </Text>
                  </View>
                </View>
                {/* Legend */}
                <View style={styles.pieLegend}>
                  {pieSlices.map((slice) => {
                    const pct =
                      currentTotals.expenses > 0
                        ? ((slice.amount / currentTotals.expenses) * 100).toFixed(0)
                        : '0';
                    return (
                      <View key={slice.name} style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: slice.color }]} />
                        <View style={{ flex: 1 }}>
                          <Text variant="labelSmall" numberOfLines={1} style={{ fontWeight: '600' }}>
                            {slice.name}
                          </Text>
                          <Text variant="labelSmall" style={{ color: theme.colors.outline }}>
                            {formatCurrency(slice.amount, symbol, 0)} · {pct}%
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            </Card.Content>
          </Card>
        )}

        {/* Debt Summary */}
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="handshake" size={20} color={theme.colors.primary} />
              <Text variant="titleSmall" style={{ marginLeft: 8, fontWeight: '600', flex: 1 }}>
                Debts &amp; Loans
              </Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/debts')}>
                <Text variant="labelMedium" style={{ color: theme.colors.primary }}>
                  Manage
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.debtRow}>
              {/* Lent */}
              <View style={[styles.debtBox, { backgroundColor: '#FFF3E0' }]}>
                <MaterialCommunityIcons name="arrow-top-right" size={18} color="#E65100" />
                <Text variant="labelSmall" style={{ color: '#E65100', marginTop: 4 }}>
                  Total Lent
                </Text>
                <Text variant="titleMedium" style={{ fontWeight: '700', color: '#E65100' }}>
                  {formatCurrency(debtSummary.totalLent, symbol, 0)}
                </Text>
                <Text variant="labelSmall" style={{ color: theme.colors.outline }}>
                  {debtSummary.activeLentCount} active
                </Text>
              </View>
              {/* Borrowed */}
              <View style={[styles.debtBox, { backgroundColor: '#E3F2FD' }]}>
                <MaterialCommunityIcons name="arrow-bottom-left" size={18} color="#1565C0" />
                <Text variant="labelSmall" style={{ color: '#1565C0', marginTop: 4 }}>
                  Total Borrowed
                </Text>
                <Text variant="titleMedium" style={{ fontWeight: '700', color: '#1565C0' }}>
                  {formatCurrency(debtSummary.totalBorrowed, symbol, 0)}
                </Text>
                <Text variant="labelSmall" style={{ color: theme.colors.outline }}>
                  {debtSummary.activeBorrowedCount} active
                </Text>
              </View>
            </View>
            {debtSummary.totalLent === 0 && debtSummary.totalBorrowed === 0 && (
              <Text
                variant="bodySmall"
                style={{ color: theme.colors.outline, textAlign: 'center', marginTop: 8 }}
              >
                No active debts — all clear!
              </Text>
            )}
          </Card.Content>
        </Card>

        {/* Recent Transactions */}
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.sectionHeader}>
              <Text variant="titleSmall" style={{ fontWeight: '600', flex: 1 }}>
                Recent Transactions
              </Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/transactions')}>
                <Text variant="labelMedium" style={{ color: theme.colors.primary }}>
                  See All
                </Text>
              </TouchableOpacity>
            </View>
            {recentTransactions.length === 0 ? (
              <Text
                variant="bodyMedium"
                style={{ color: theme.colors.outline, textAlign: 'center', padding: 24 }}
              >
                No transactions yet. Tap + to add one!
              </Text>
            ) : (
              recentTransactions.map((txn, idx) => {
                const cat = getCategory(txn.categoryId);
                return (
                  <React.Fragment key={txn.id}>
                    {idx > 0 && <Divider />}
                    <TouchableOpacity
                      style={styles.txnRow}
                      onPress={() => router.push(`/transaction/${txn.id}`)}
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
                        <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                          {txn.description || formatTransactionDate(txn.date)}
                        </Text>
                      </View>
                      <Text
                        variant="titleSmall"
                        style={{
                          fontWeight: '600',
                          color:
                            txn.type === 'income'
                              ? '#2E7D32'
                              : '#C62828',
                        }}
                      >
                        {txn.type === 'income' ? '+' : '-'}
                        {formatCurrency(txn.amount, symbol)}
                      </Text>
                    </TouchableOpacity>
                  </React.Fragment>
                );
              })
            )}
          </Card.Content>
        </Card>
      </ScrollView>

      {/* FAB */}
      
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
      

      {/* Add Transaction Modal */}
      
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
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  fullScreenModal: {
    flex: 1,
    margin: 0,
    width: '100%',
    height: '100%',
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
  flex: { flex: 1 },
  header: { paddingHorizontal: 16, marginBottom: 12 },
  balanceCard: { marginHorizontal: 16, marginBottom: 16, borderRadius: 16 },
  whiteText: { color: '#fff' },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  balanceStat: { flexDirection: 'row', alignItems: 'center' },
  trendRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, opacity: 0.85 },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  card: { marginHorizontal: 16, marginBottom: 16, borderRadius: 12 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  alertBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  debtRow: { flexDirection: 'row', gap: 12 },
  debtBox: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  pieRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pieLegend: {
    flex: 1,
    gap: 6,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  pieCenterLabel: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  txnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
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
    right: 16,
    borderRadius: 16,
  },
  modal: {
    margin: 16,
    borderRadius: 16,
    maxHeight: '90%',
    paddingTop: 16,
  },
  modalContent: {
    flex: 1,
  },
});
