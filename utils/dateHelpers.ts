import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  subMonths,
  subWeeks,
  subDays,
  isToday,
  isYesterday,
  isSameYear,
} from 'date-fns';

export type DateRangePreset =
  | 'this_week'
  | 'this_month'
  | 'last_3_months'
  | 'last_6_months'
  | 'this_year'
  | 'custom';

export function getDateRange(preset: DateRangePreset): {
  startDate: string;
  endDate: string;
  label: string;
} {
  const now = new Date();
  const endDate = format(now, 'yyyy-MM-dd');

  switch (preset) {
    case 'this_week':
      return {
        startDate: format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
        endDate,
        label: 'This Week',
      };
    case 'this_month':
      return {
        startDate: format(startOfMonth(now), 'yyyy-MM-dd'),
        endDate,
        label: 'This Month',
      };
    case 'last_3_months':
      return {
        startDate: format(subMonths(now, 3), 'yyyy-MM-dd'),
        endDate,
        label: 'Last 3 Months',
      };
    case 'last_6_months':
      return {
        startDate: format(subMonths(now, 6), 'yyyy-MM-dd'),
        endDate,
        label: 'Last 6 Months',
      };
    case 'this_year':
      return {
        startDate: format(new Date(now.getFullYear(), 0, 1), 'yyyy-MM-dd'),
        endDate,
        label: 'This Year',
      };
    default:
      return {
        startDate: format(startOfMonth(now), 'yyyy-MM-dd'),
        endDate,
        label: 'Custom',
      };
  }
}

export function formatTransactionDate(dateStr: string): string {
  const date = parseISO(dateStr);
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  if (isSameYear(date, new Date())) return format(date, 'MMM d');
  return format(date, 'MMM d, yyyy');
}

export function formatSectionDate(dateStr: string): string {
  const date = parseISO(dateStr);
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  if (isSameYear(date, new Date())) return format(date, 'EEEE, MMMM d');
  return format(date, 'EEEE, MMMM d, yyyy');
}

export function todayString(): string {
  return format(new Date(), 'yyyy-MM-dd');
}
