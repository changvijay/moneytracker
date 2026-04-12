import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { db } from '@/db/client';
import { transactions } from '@/db/schema';
import type { Transaction, NewTransaction } from '@/db/schema';
import { eq, desc, and, gte, lte, like } from 'drizzle-orm';

interface TransactionsState {
  items: Transaction[];
  loading: boolean;
  error: string | null;
}

const initialState: TransactionsState = {
  items: [],
  loading: false,
  error: null,
};

export const fetchTransactions = createAsyncThunk(
  'transactions/fetchAll',
  async () => {
    return await db
      .select()
      .from(transactions)
      .orderBy(desc(transactions.date), desc(transactions.id));
  }
);

export const fetchTransactionsByDateRange = createAsyncThunk(
  'transactions/fetchByDateRange',
  async ({ startDate, endDate }: { startDate: string; endDate: string }) => {
    return await db
      .select()
      .from(transactions)
      .where(and(gte(transactions.date, startDate), lte(transactions.date, endDate)))
      .orderBy(desc(transactions.date), desc(transactions.id));
  }
);

export const addTransaction = createAsyncThunk(
  'transactions/add',
  async (data: NewTransaction) => {
    const result = await db.insert(transactions).values(data).returning();
    return result[0];
  }
);

export const updateTransaction = createAsyncThunk(
  'transactions/update',
  async ({ id, data }: { id: number; data: Partial<NewTransaction> }) => {
    const result = await db
      .update(transactions)
      .set(data)
      .where(eq(transactions.id, id))
      .returning();
    return result[0];
  }
);

export const deleteTransaction = createAsyncThunk(
  'transactions/delete',
  async (id: number) => {
    await db.delete(transactions).where(eq(transactions.id, id));
    return id;
  }
);

const transactionsSlice = createSlice({
  name: 'transactions',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchTransactions.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchTransactions.fulfilled, (state, action) => {
        state.items = action.payload;
        state.loading = false;
      })
      .addCase(fetchTransactions.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? 'Failed to fetch transactions';
      })
      .addCase(fetchTransactionsByDateRange.fulfilled, (state, action) => {
        state.items = action.payload;
        state.loading = false;
      })
      .addCase(addTransaction.fulfilled, (state, action) => {
        state.items.unshift(action.payload);
      })
      .addCase(updateTransaction.fulfilled, (state, action) => {
        const idx = state.items.findIndex((t) => t.id === action.payload.id);
        if (idx !== -1) state.items[idx] = action.payload;
      })
      .addCase(deleteTransaction.fulfilled, (state, action) => {
        state.items = state.items.filter((t) => t.id !== action.payload);
      });
  },
});

export default transactionsSlice.reducer;
