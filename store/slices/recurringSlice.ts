import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { db } from '@/db/client';
import { recurringTransactions } from '@/db/schema';
import type { RecurringTransaction, NewRecurringTransaction } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { processRecurringTransactions } from '@/services/recurringProcessor';

interface RecurringState {
  items: RecurringTransaction[];
  loading: boolean;
  error: string | null;
  lastProcessed: string | null;
}

const initialState: RecurringState = {
  items: [],
  loading: false,
  error: null,
  lastProcessed: null,
};

export const fetchRecurringTransactions = createAsyncThunk(
  'recurring/fetchAll',
  async () => {
    return await db
      .select()
      .from(recurringTransactions)
      .orderBy(desc(recurringTransactions.createdAt));
  }
);

export const addRecurringTransaction = createAsyncThunk(
  'recurring/add',
  async (data: NewRecurringTransaction) => {
    const result = await db
      .insert(recurringTransactions)
      .values(data)
      .returning();
    return result[0];
  }
);

export const updateRecurringTransaction = createAsyncThunk(
  'recurring/update',
  async ({
    id,
    data,
  }: {
    id: number;
    data: Partial<NewRecurringTransaction>;
  }) => {
    const result = await db
      .update(recurringTransactions)
      .set(data)
      .where(eq(recurringTransactions.id, id))
      .returning();
    return result[0];
  }
);

export const deleteRecurringTransaction = createAsyncThunk(
  'recurring/delete',
  async (id: number) => {
    await db
      .delete(recurringTransactions)
      .where(eq(recurringTransactions.id, id));
    return id;
  }
);

export const toggleRecurringTransaction = createAsyncThunk(
  'recurring/toggle',
  async ({ id, isActive }: { id: number; isActive: boolean }) => {
    const result = await db
      .update(recurringTransactions)
      .set({ isActive })
      .where(eq(recurringTransactions.id, id))
      .returning();
    return result[0];
  }
);

export const processRecurring = createAsyncThunk(
  'recurring/process',
  async () => {
    const count = await processRecurringTransactions();
    return { count, processedAt: new Date().toISOString() };
  }
);

const recurringSlice = createSlice({
  name: 'recurring',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchRecurringTransactions.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchRecurringTransactions.fulfilled, (state, action) => {
        state.items = action.payload;
        state.loading = false;
      })
      .addCase(fetchRecurringTransactions.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? 'Failed to fetch recurring transactions';
      })
      .addCase(addRecurringTransaction.fulfilled, (state, action) => {
        state.items.unshift(action.payload);
      })
      .addCase(updateRecurringTransaction.fulfilled, (state, action) => {
        const idx = state.items.findIndex((t) => t.id === action.payload.id);
        if (idx !== -1) state.items[idx] = action.payload;
      })
      .addCase(deleteRecurringTransaction.fulfilled, (state, action) => {
        state.items = state.items.filter((t) => t.id !== action.payload);
      })
      .addCase(toggleRecurringTransaction.fulfilled, (state, action) => {
        const idx = state.items.findIndex((t) => t.id === action.payload.id);
        if (idx !== -1) state.items[idx] = action.payload;
      })
      .addCase(processRecurring.fulfilled, (state, action) => {
        state.lastProcessed = action.payload.processedAt;
      });
  },
});

export default recurringSlice.reducer;
