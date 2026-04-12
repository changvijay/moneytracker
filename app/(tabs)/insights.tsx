import React, { useEffect, useState, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { Text, Card, Chip, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchTransactions } from '@/store/slices/transactionsSlice';
import { fetchCategories } from '@/store/slices/categoriesSlice';
import { fetchDebts } from '@/store/slices/debtsSlice';
import {
  selectCurrentMonthTotals,
  selectExpenseByCategoryCurrentMonth,
  selectDailySpendingTrend,
  selectMonthlyComparison,
  selectSavingsRate,
  selectAverageDailySpending,
  selectSpendingVelocity,
  selectDebtSummary,
  selectBudgetAlerts,
} from '@/store/selectors/insightsSelectors';
import { formatCurrency } from '@/utils/currency';
import type { DateRangePreset } from '@/utils/dateHelpers';
import EmptyState from '@/components/EmptyState';

const screenWidth = Dimensions.get('window').width;

type TimeRange = 'this_week' | 'this_month' | 'last_3_months' | 'this_year';

export default function InsightsScreen() {
  const theme = useTheme() as any;
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();

  const [timeRange, setTimeRange] = useState<TimeRange>('this_month');

  const transactions = useAppSelector((s) => s.transactions.items);
  const categories = useAppSelector((s) => s.categories.items);
  const settings = useAppSelector((s) => s.settings.data);
  const currentTotals = useAppSelector(selectCurrentMonthTotals);
  const categoryBreakdown = useAppSelector(selectExpenseByCategoryCurrentMonth);
  const dailyTrend = useAppSelector(selectDailySpendingTrend);
  const monthlyComparison = useAppSelector(selectMonthlyComparison);
  const savingsRate = useAppSelector(selectSavingsRate);
  const avgDaily = useAppSelector(selectAverageDailySpending);
  const velocity = useAppSelector(selectSpendingVelocity);
  const debtSummary = useAppSelector(selectDebtSummary);
  const budgetAlerts = useAppSelector(selectBudgetAlerts);

  const symbol = settings?.currencySymbol ?? '$';

  useEffect(() => {
    dispatch(fetchTransactions());
    dispatch(fetchCategories());
    dispatch(fetchDebts());
  }, [dispatch]);

  const maxDailySpend = Math.max(...dailyTrend.map((d) => d.amount), 1);
  const maxMonthlyVal = Math.max(
    ...monthlyComparison.flatMap((m) => [m.income, m.expenses]),
    1
  );

  if (transactions.length === 0) {
    return (
      <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
        <View style={{ paddingTop: insets.top + 16, paddingHorizontal: 16 }}>
          <Text variant="headlineSmall" style={{ fontWeight: '700' }}>
            Insights
          </Text>
        </View>
        <EmptyState
          icon="chart-arc"
          title="No Data Yet"
          subtitle="Add some transactions to see detailed insights and analytics"
        />
      </View>
    );
  }

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 32 }}>
        <View style={styles.header}>
          <Text variant="headlineSmall" style={{ fontWeight: '700' }}>
            Insights
          </Text>
        </View>

        {/* Time Range Chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
          {[
            { key: 'this_week', label: 'Week' },
            { key: 'this_month', label: 'Month' },
            { key: 'last_3_months', label: '3 Months' },
            { key: 'this_year', label: 'Year' },
          ].map((r) => (
            <Chip
              key={r.key}
              selected={timeRange === r.key}
              onPress={() => setTimeRange(r.key as TimeRange)}
              style={styles.chip}
              compact
            >
              {r.label}
            </Chip>
          ))}
        </ScrollView>

        {/* Key Metrics Row */}
        <View style={styles.metricsRow}>
          <Card style={styles.metricCard}>
            <Card.Content style={styles.metricContent}>
              <MaterialCommunityIcons name="piggy-bank" size={20} color={theme.custom.income} />
              <Text variant="labelSmall" style={{ color: theme.colors.outline }}>
                Savings Rate
              </Text>
              <Text variant="titleMedium" style={{ fontWeight: '700', color: savingsRate >= 0 ? theme.custom.income : theme.custom.expense }}>
                {savingsRate.toFixed(1)}%
              </Text>
            </Card.Content>
          </Card>
          <Card style={styles.metricCard}>
            <Card.Content style={styles.metricContent}>
              <MaterialCommunityIcons name="calendar-today" size={20} color={theme.colors.primary} />
              <Text variant="labelSmall" style={{ color: theme.colors.outline }}>
                Avg Daily
              </Text>
              <Text variant="titleMedium" style={{ fontWeight: '700' }}>
                {formatCurrency(avgDaily, symbol, 0)}
              </Text>
            </Card.Content>
          </Card>
          <Card style={styles.metricCard}>
            <Card.Content style={styles.metricContent}>
              <MaterialCommunityIcons name="speedometer" size={20} color={velocity.pace > 100 ? theme.custom.expense : theme.custom.income} />
              <Text variant="labelSmall" style={{ color: theme.colors.outline }}>
                Burn Rate
              </Text>
              <Text variant="titleMedium" style={{ fontWeight: '700', color: velocity.pace > 100 ? theme.custom.expense : theme.custom.income }}>
                {velocity.pace.toFixed(0)}%
              </Text>
            </Card.Content>
          </Card>
        </View>

        {/* Daily Spending Trend (Bar chart) */}
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleSmall" style={{ fontWeight: '600', marginBottom: 12 }}>
              Daily Spending
            </Text>
            <View style={styles.barChart}>
              {dailyTrend.slice(-14).map((day, i) => (
                <View key={day.date} style={styles.barCol}>
                  <View
                    style={[
                      styles.bar,
                      {
                        height: Math.max((day.amount / maxDailySpend) * 100, 2),
                        backgroundColor:
                          day.amount > avgDaily * 1.5
                            ? theme.custom.expense
                            : theme.colors.primary,
                      },
                    ]}
                  />
                  <Text style={styles.barLabel}>{day.label}</Text>
                </View>
              ))}
            </View>
          </Card.Content>
        </Card>

        {/* Monthly Income vs Expense */}
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleSmall" style={{ fontWeight: '600', marginBottom: 12 }}>
              Income vs Expense (6 months)
            </Text>
            <View style={styles.barChart}>
              {monthlyComparison.map((m) => (
                <View key={m.month} style={styles.barGroupCol}>
                  <View style={styles.barGroup}>
                    <View
                      style={[
                        styles.barGroupItem,
                        {
                          height: Math.max((m.income / maxMonthlyVal) * 80, 2),
                          backgroundColor: theme.custom.income,
                        },
                      ]}
                    />
                    <View
                      style={[
                        styles.barGroupItem,
                        {
                          height: Math.max((m.expenses / maxMonthlyVal) * 80, 2),
                          backgroundColor: theme.custom.expense,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.barLabel}>{m.month}</Text>
                </View>
              ))}
            </View>
            <View style={styles.legend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: theme.custom.income }]} />
                <Text variant="labelSmall">Income</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: theme.custom.expense }]} />
                <Text variant="labelSmall">Expense</Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Category Breakdown */}
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleSmall" style={{ fontWeight: '600', marginBottom: 12 }}>
              Spending by Category
            </Text>
            {categoryBreakdown.length === 0 ? (
              <Text variant="bodySmall" style={{ color: theme.colors.outline, textAlign: 'center', padding: 16 }}>
                No expenses this month
              </Text>
            ) : (
              categoryBreakdown.map((cat) => {
                const totalExpense = currentTotals.expenses;
                const pct = totalExpense > 0 ? (cat.amount / totalExpense) * 100 : 0;
                return (
                  <View key={cat.categoryId} style={styles.catRow}>
                    <View style={[styles.catIcon, { backgroundColor: cat.color + '20' }]}>
                      <MaterialCommunityIcons name={cat.icon as any} size={18} color={cat.color} />
                    </View>
                    <View style={styles.catInfo}>
                      <View style={styles.catHeader}>
                        <Text variant="bodyMedium" style={{ fontWeight: '500', flex: 1 }}>
                          {cat.name}
                        </Text>
                        <Text variant="bodyMedium" style={{ fontWeight: '600' }}>
                          {formatCurrency(cat.amount, symbol)}
                        </Text>
                      </View>
                      <View style={styles.catProgressBg}>
                        <View
                          style={[
                            styles.catProgressFill,
                            {
                              width: `${Math.min(pct, 100)}%`,
                              backgroundColor: cat.color,
                            },
                          ]}
                        />
                      </View>
                      <View style={styles.catFooter}>
                        <Text variant="labelSmall" style={{ color: theme.colors.outline }}>
                          {pct.toFixed(1)}% of total
                        </Text>
                        {cat.budgetLimit && (
                          <Text
                            variant="labelSmall"
                            style={{
                              color:
                                (cat.budgetUsage ?? 0) > 100
                                  ? theme.custom.expense
                                  : (cat.budgetUsage ?? 0) > 80
                                  ? theme.custom.warning
                                  : theme.colors.outline,
                              fontWeight: '600',
                            }}
                          >
                            Budget: {cat.budgetUsage?.toFixed(0)}%
                          </Text>
                        )}
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </Card.Content>
        </Card>

        {/* Budget Utilization */}
        {budgetAlerts.length > 0 && (
          <Card style={styles.card}>
            <Card.Content>
              <Text variant="titleSmall" style={{ fontWeight: '600', marginBottom: 12 }}>
                Budget Utilization
              </Text>
              <View style={styles.budgetGrid}>
                {categoryBreakdown
                  .filter((c) => c.budgetLimit)
                  .map((cat) => {
                    const pct = cat.budgetUsage ?? 0;
                    const ringColor =
                      pct > 100
                        ? theme.custom.expense
                        : pct > 80
                        ? theme.custom.warning
                        : theme.custom.income;
                    return (
                      <View key={cat.categoryId} style={styles.budgetItem}>
                        <View style={styles.ringOuter}>
                          <View
                            style={[
                              styles.ringInner,
                              { borderColor: ringColor, borderWidth: 3 },
                            ]}
                          >
                            <Text variant="labelSmall" style={{ fontWeight: '700', color: ringColor }}>
                              {Math.min(pct, 999).toFixed(0)}%
                            </Text>
                          </View>
                        </View>
                        <Text variant="labelSmall" numberOfLines={1} style={{ textAlign: 'center', marginTop: 4 }}>
                          {cat.name}
                        </Text>
                      </View>
                    );
                  })}
              </View>
            </Card.Content>
          </Card>
        )}

        {/* Net Cash Flow */}
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleSmall" style={{ fontWeight: '600', marginBottom: 12 }}>
              Net Cash Flow (6 months)
            </Text>
            <View style={styles.cashFlowChart}>
              {monthlyComparison.map((m) => {
                const maxNet = Math.max(
                  ...monthlyComparison.map((mc) => Math.abs(mc.net)),
                  1
                );
                const barHeight = Math.max(
                  (Math.abs(m.net) / maxNet) * 60,
                  4
                );
                return (
                  <View key={m.month} style={styles.cashFlowCol}>
                    <View
                      style={[
                        styles.cashFlowBar,
                        {
                          height: barHeight,
                          backgroundColor:
                            m.net >= 0 ? theme.custom.income : theme.custom.expense,
                          opacity: 0.85,
                        },
                      ]}
                    />
                    <Text style={styles.barLabel}>{m.month}</Text>
                    <Text style={[styles.barLabel, { fontSize: 9 }]}>
                      {m.net >= 0 ? '+' : ''}
                      {formatCurrency(m.net, symbol, 0)}
                    </Text>
                  </View>
                );
              })}
            </View>
          </Card.Content>
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { paddingHorizontal: 16, marginBottom: 8 },
  chipScroll: { paddingHorizontal: 16, marginBottom: 12 },
  chip: { marginRight: 8, borderRadius: 20 },
  metricsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 16,
  },
  metricCard: { flex: 1, borderRadius: 12 },
  metricContent: { alignItems: 'center', gap: 2, paddingVertical: 8 },
  card: { marginHorizontal: 16, marginBottom: 16, borderRadius: 12 },
  barChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    height: 120,
    paddingTop: 8,
  },
  barCol: { alignItems: 'center', flex: 1 },
  bar: { width: 12, borderRadius: 4, minHeight: 2 },
  barLabel: { fontSize: 9, marginTop: 4, color: '#888' },
  barGroupCol: { alignItems: 'center', flex: 1 },
  barGroup: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  barGroupItem: { width: 10, borderRadius: 3, minHeight: 2 },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  catRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  catIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  catInfo: { flex: 1 },
  catHeader: { flexDirection: 'row', alignItems: 'center' },
  catProgressBg: { height: 4, borderRadius: 2, backgroundColor: '#E0E0E0', marginTop: 4 },
  catProgressFill: { height: 4, borderRadius: 2 },
  catFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  budgetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    justifyContent: 'center',
  },
  budgetItem: { alignItems: 'center', width: 72 },
  ringOuter: { width: 56, height: 56, justifyContent: 'center', alignItems: 'center' },
  ringInner: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cashFlowChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    height: 100,
  },
  cashFlowCol: { alignItems: 'center', flex: 1 },
  cashFlowBar: { width: 20, borderRadius: 4 },
});
