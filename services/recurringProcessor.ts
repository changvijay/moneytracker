import { db } from '@/db/client';
import { recurringTransactions, transactions } from '@/db/schema';
import type { RecurringTransaction } from '@/db/schema';
import { eq } from 'drizzle-orm';
import {
  format,
  parseISO,
  addDays,
  addWeeks,
  addMonths,
  isAfter,
  isBefore,
  startOfDay,
  isSameDay,
} from 'date-fns';

/**
 * Compute the next occurrence date from a given date based on frequency.
 */
function getNextDate(
  fromDate: string,
  frequency: RecurringTransaction['frequency'],
  customIntervalDays?: number | null
): string {
  const d = parseISO(fromDate);
  switch (frequency) {
    case 'daily':
      return format(addDays(d, 1), 'yyyy-MM-dd');
    case 'weekly':
      return format(addWeeks(d, 1), 'yyyy-MM-dd');
    case 'monthly':
      return format(addMonths(d, 1), 'yyyy-MM-dd');
    case 'custom':
      return format(addDays(d, customIntervalDays ?? 1), 'yyyy-MM-dd');
    default:
      return format(addDays(d, 1), 'yyyy-MM-dd');
  }
}

/**
 * Process all active recurring transactions and generate missing entries
 * up to today. This handles missed runs by generating all overdue transactions.
 *
 * Call this on app startup and periodically (e.g. when app comes to foreground).
 */
export async function processRecurringTransactions(): Promise<number> {
  const today = format(startOfDay(new Date()), 'yyyy-MM-dd');

  // Fetch all active recurring rules
  const activeRules = await db
    .select()
    .from(recurringTransactions)
    .where(eq(recurringTransactions.isActive, true));

  let generatedCount = 0;

  for (const rule of activeRules) {
    // Determine the starting point for generation
    // If we've already generated some, start from the day after lastGeneratedDate
    // Otherwise, start from startDate
    let cursor = rule.lastGeneratedDate
      ? getNextDate(rule.lastGeneratedDate, rule.frequency, rule.customIntervalDays)
      : rule.startDate;

    let lastGenerated = rule.lastGeneratedDate;

    // Generate transactions for all missed dates up to today
    while (
      !isAfter(parseISO(cursor), parseISO(today)) &&
      (isBefore(parseISO(cursor), parseISO(today)) || isSameDay(parseISO(cursor), parseISO(today)))
    ) {
      // Respect end date
      if (rule.endDate && isAfter(parseISO(cursor), parseISO(rule.endDate))) {
        break;
      }

      // Insert the transaction
      await db.insert(transactions).values({
        type: rule.type,
        amount: rule.amount,
        categoryId: rule.categoryId,
        description: rule.description
          ? `${rule.description} (recurring)`
          : '(recurring)',
        date: cursor,
        recurringId: rule.id,
      });

      generatedCount++;
      lastGenerated = cursor;
      cursor = getNextDate(cursor, rule.frequency, rule.customIntervalDays);
    }

    // Update lastGeneratedDate if we generated anything
    if (lastGenerated && lastGenerated !== rule.lastGeneratedDate) {
      await db
        .update(recurringTransactions)
        .set({ lastGeneratedDate: lastGenerated })
        .where(eq(recurringTransactions.id, rule.id));
    }

    // Auto-deactivate if end date has passed and all transactions are generated
    if (rule.endDate && isAfter(parseISO(today), parseISO(rule.endDate))) {
      await db
        .update(recurringTransactions)
        .set({ isActive: false })
        .where(eq(recurringTransactions.id, rule.id));
    }
  }

  return generatedCount;
}

/**
 * Get a human-readable label for a recurrence frequency.
 */
export function getFrequencyLabel(
  frequency: string,
  customIntervalDays?: number | null
): string {
  switch (frequency) {
    case 'daily':
      return 'Daily';
    case 'weekly':
      return 'Weekly';
    case 'monthly':
      return 'Monthly';
    case 'custom':
      return customIntervalDays
        ? `Every ${customIntervalDays} day${customIntervalDays > 1 ? 's' : ''}`
        : 'Custom';
    default:
      return frequency;
  }
}
