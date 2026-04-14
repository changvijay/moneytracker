import { sqliteTable, integer, text, real } from 'drizzle-orm/sqlite-core';

// ─── Categories ────────────────────────────────────────────
export const categories = sqliteTable('categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  icon: text('icon').notNull().default('help-circle-outline'),
  color: text('color').notNull().default('#607D8B'),
  type: text('type', { enum: ['income', 'expense'] }).notNull(),
  budgetLimit: real('budget_limit'),
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: text('created_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

// ─── Transactions ──────────────────────────────────────────
export const transactions = sqliteTable('transactions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  type: text('type', { enum: ['income', 'expense'] }).notNull(),
  amount: real('amount').notNull(),
  categoryId: integer('category_id').references(() => categories.id),
  description: text('description'),
  date: text('date').notNull(),
  recurringId: integer('recurring_id'),
  createdAt: text('created_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

// ─── Contacts ──────────────────────────────────────────────
export const contacts = sqliteTable('contacts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  phone: text('phone'),
  email: text('email'),
  notes: text('notes'),
  createdAt: text('created_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

// ─── Debts (Lent & Borrowed) ──────────────────────────────
export const debts = sqliteTable('debts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  type: text('type', { enum: ['lent', 'borrowed'] }).notNull(),
  contactId: integer('contact_id')
    .notNull()
    .references(() => contacts.id),
  amount: real('amount').notNull(),
  remainingAmount: real('remaining_amount').notNull(),
  description: text('description'),
  dueDate: text('due_date'),
  status: text('status', { enum: ['active', 'partial', 'settled'] })
    .notNull()
    .default('active'),
  createdAt: text('created_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

// ─── Debt Payments ─────────────────────────────────────────
export const debtPayments = sqliteTable('debt_payments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  debtId: integer('debt_id')
    .notNull()
    .references(() => debts.id, { onDelete: 'cascade' }),
  amount: real('amount').notNull(),
  date: text('date').notNull(),
  notes: text('notes'),
});

// ─── Recurring Transactions ────────────────────────────────
export const recurringTransactions = sqliteTable('recurring_transactions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  type: text('type', { enum: ['income', 'expense'] }).notNull(),
  amount: real('amount').notNull(),
  categoryId: integer('category_id').references(() => categories.id),
  description: text('description'),
  frequency: text('frequency', {
    enum: ['daily', 'weekly', 'monthly', 'custom'],
  }).notNull(),
  customIntervalDays: integer('custom_interval_days'),
  startDate: text('start_date').notNull(),
  endDate: text('end_date'),
  lastGeneratedDate: text('last_generated_date'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

// ─── Settings (Singleton) ─────────────────────────────────
export const settings = sqliteTable('settings', {
  id: integer('id').primaryKey(),
  currency: text('currency').notNull().default('USD'),
  currencySymbol: text('currency_symbol').notNull().default('$'),
  reminderEnabled: integer('reminder_enabled', { mode: 'boolean' })
    .notNull()
    .default(false),
  reminderTime: text('reminder_time').notNull().default('21:00'),
  monthStartDay: integer('month_start_day').notNull().default(1),
  theme: text('theme', { enum: ['light', 'dark', 'system'] })
    .notNull()
    .default('system'),
  onboardingComplete: integer('onboarding_complete', { mode: 'boolean' })
    .notNull()
    .default(false),
});

// ─── Type Exports ──────────────────────────────────────────
export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type Contact = typeof contacts.$inferSelect;
export type NewContact = typeof contacts.$inferInsert;
export type Debt = typeof debts.$inferSelect;
export type NewDebt = typeof debts.$inferInsert;
export type DebtPayment = typeof debtPayments.$inferSelect;
export type NewDebtPayment = typeof debtPayments.$inferInsert;
export type Settings = typeof settings.$inferSelect;
export type RecurringTransaction = typeof recurringTransactions.$inferSelect;
export type NewRecurringTransaction = typeof recurringTransactions.$inferInsert;
