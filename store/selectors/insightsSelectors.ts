import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from '../index';
import {
  startOfMonth,
  endOfMonth,
  subMonths,
  format,
  parseISO,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  eachMonthOfInterval,
} from 'date-fns';

const selectTransactions = (state: RootState) => state.transactions.items;
const selectCategories = (state: RootState) => state.categories.items;
const selectDebts = (state: RootState) => state.debts.items;
const selectSettings = (state: RootState) => state.settings.data;
const selectContacts = (state: RootState) => state.contacts.items;

// Current month transactions
export const selectCurrentMonthTransactions = createSelector(
  [selectTransactions],
  (txns) => {
    const now = new Date();
    const start = format(startOfMonth(now), 'yyyy-MM-dd');
    const end = format(endOfMonth(now), 'yyyy-MM-dd');
    return txns.filter((t) => t.date >= start && t.date <= end);
  }
);

// Previous month transactions
export const selectPreviousMonthTransactions = createSelector(
  [selectTransactions],
  (txns) => {
    const prevMonth = subMonths(new Date(), 1);
    const start = format(startOfMonth(prevMonth), 'yyyy-MM-dd');
    const end = format(endOfMonth(prevMonth), 'yyyy-MM-dd');
    return txns.filter((t) => t.date >= start && t.date <= end);
  }
);

// Totals for current month
export const selectCurrentMonthTotals = createSelector(
  [selectCurrentMonthTransactions],
  (txns) => {
    const income = txns
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    const expenses = txns
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
    return { income, expenses, balance: income - expenses };
  }
);

// Previous month totals (for trend comparison)
export const selectPreviousMonthTotals = createSelector(
  [selectPreviousMonthTransactions],
  (txns) => {
    const income = txns
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    const expenses = txns
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
    return { income, expenses, balance: income - expenses };
  }
);

// Category breakdown for expenses
export const selectExpenseByCategoryCurrentMonth = createSelector(
  [selectCurrentMonthTransactions, selectCategories],
  (txns, cats) => {
    const expenseTxns = txns.filter((t) => t.type === 'expense');
    const map = new Map<number, number>();
    expenseTxns.forEach((t) => {
      if (t.categoryId) {
        map.set(t.categoryId, (map.get(t.categoryId) ?? 0) + t.amount);
      }
    });

    return Array.from(map.entries())
      .map(([catId, total]) => {
        const cat = cats.find((c) => c.id === catId);
        return {
          categoryId: catId,
          name: cat?.name ?? 'Unknown',
          icon: cat?.icon ?? 'help-circle',
          color: cat?.color ?? '#757575',
          amount: total,
          budgetLimit: cat?.budgetLimit ?? null,
          budgetUsage: cat?.budgetLimit ? (total / cat.budgetLimit) * 100 : null,
        };
      })
      .sort((a, b) => b.amount - a.amount);
  }
);

// Budget alerts (categories >80% spent)
export const selectBudgetAlerts = createSelector(
  [selectExpenseByCategoryCurrentMonth],
  (breakdown) => {
    return breakdown.filter(
      (c) => c.budgetUsage !== null && c.budgetUsage >= 80
    );
  }
);

// Daily spending data for line chart
export const selectDailySpendingTrend = createSelector(
  [selectTransactions],
  (txns) => {
    const now = new Date();
    const start = startOfMonth(now);
    const end = new Date();
    const days = eachDayOfInterval({ start, end });

    return days.map((day) => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const dayTotal = txns
        .filter((t) => t.type === 'expense' && t.date === dateStr)
        .reduce((sum, t) => sum + t.amount, 0);
      return { date: dateStr, label: format(day, 'dd'), amount: dayTotal };
    });
  }
);

// Monthly income vs expense comparison (last 6 months)
export const selectMonthlyComparison = createSelector(
  [selectTransactions],
  (txns) => {
    const now = new Date();
    const months = eachMonthOfInterval({
      start: subMonths(now, 5),
      end: now,
    });

    return months.map((month) => {
      const start = format(startOfMonth(month), 'yyyy-MM-dd');
      const end = format(endOfMonth(month), 'yyyy-MM-dd');
      const monthTxns = txns.filter((t) => t.date >= start && t.date <= end);

      const income = monthTxns
        .filter((t) => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);
      const expenses = monthTxns
        .filter((t) => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);

      return {
        month: format(month, 'MMM'),
        income,
        expenses,
        net: income - expenses,
      };
    });
  }
);

// Savings rate
export const selectSavingsRate = createSelector(
  [selectCurrentMonthTotals],
  (totals) => {
    if (totals.income === 0) return 0;
    return ((totals.income - totals.expenses) / totals.income) * 100;
  }
);

// Debt summary
export const selectDebtSummary = createSelector([selectDebts], (debts) => {
  const activeDebts = debts.filter((d) => d.status !== 'settled');
  const totalLent = activeDebts
    .filter((d) => d.type === 'lent')
    .reduce((sum, d) => sum + d.remainingAmount, 0);
  const totalBorrowed = activeDebts
    .filter((d) => d.type === 'borrowed')
    .reduce((sum, d) => sum + d.remainingAmount, 0);
  return {
    totalLent,
    totalBorrowed,
    netExposure: totalLent - totalBorrowed,
    activeLentCount: activeDebts.filter((d) => d.type === 'lent').length,
    activeBorrowedCount: activeDebts.filter((d) => d.type === 'borrowed').length,
  };
});

// Average daily spending
export const selectAverageDailySpending = createSelector(
  [selectCurrentMonthTransactions],
  (txns) => {
    const expenses = txns
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
    const now = new Date();
    const dayOfMonth = now.getDate();
    return dayOfMonth > 0 ? expenses / dayOfMonth : 0;
  }
);

// Spending velocity (projected month-end spend)
export const selectSpendingVelocity = createSelector(
  [selectCurrentMonthTotals, selectAverageDailySpending],
  (totals, avgDaily) => {
    const now = new Date();
    const daysInMonth = endOfMonth(now).getDate();
    const projectedExpenses = avgDaily * daysInMonth;
    return {
      current: totals.expenses,
      projected: projectedExpenses,
      pace: totals.income > 0 ? (projectedExpenses / totals.income) * 100 : 0,
    };
  }
);

// Frequent contacts — contacts sorted by number of associated debts (descending)
export const selectFrequentContacts = createSelector(
  [selectDebts, selectContacts],
  (debts, contacts) => {
    const countMap = new Map<number, number>();
    debts.forEach((d) => {
      countMap.set(d.contactId, (countMap.get(d.contactId) ?? 0) + 1);
    });

    return [...contacts].sort((a, b) => {
      const cntA = countMap.get(a.id) ?? 0;
      const cntB = countMap.get(b.id) ?? 0;
      return cntB - cntA;
    });
  }
);

// Grouped debts by contact for a given type
export interface DebtGroup {
  contactId: number;
  contactName: string;
  type: 'lent' | 'borrowed';
  totalAmount: number;
  totalRemaining: number;
  totalPaid: number;
  debtCount: number;
  activeCount: number;
  latestDate: string;
  hasSettled: boolean;
  allSettled: boolean;
}

const selectPayments = (state: RootState) => state.debts.payments;

export const selectGroupedDebts = createSelector(
  [selectDebts, selectContacts, selectPayments],
  (debts, contacts, payments) => {
    const groups = new Map<string, DebtGroup>();

    debts.forEach((d) => {
      const key = `${d.type}-${d.contactId}`;
      const contact = contacts.find((c) => c.id === d.contactId);

      if (!groups.has(key)) {
        groups.set(key, {
          contactId: d.contactId,
          contactName: contact?.name ?? 'Unknown',
          type: d.type as 'lent' | 'borrowed',
          totalAmount: 0,
          totalRemaining: 0,
          totalPaid: 0,
          debtCount: 0,
          activeCount: 0,
          latestDate: d.createdAt,
          hasSettled: false,
          allSettled: true,
        });
      }

      const group = groups.get(key)!;
      group.totalAmount += d.amount;
      group.totalRemaining += d.remainingAmount;
      group.totalPaid += d.amount - d.remainingAmount;
      group.debtCount += 1;
      if (d.status !== 'settled') group.activeCount += 1;
      if (d.status === 'settled') group.hasSettled = true;
      if (d.status !== 'settled') group.allSettled = false;
      if (d.createdAt > group.latestDate) group.latestDate = d.createdAt;
    });

    return Array.from(groups.values()).sort(
      (a, b) => b.latestDate.localeCompare(a.latestDate)
    );
  }
);

export const selectGroupedDebtsByType = createSelector(
  [selectGroupedDebts],
  (groups) => ({
    lent: groups.filter((g) => g.type === 'lent'),
    borrowed: groups.filter((g) => g.type === 'borrowed'),
  })
);
