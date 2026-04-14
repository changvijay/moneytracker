import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { db } from '@/db/client';
import { debts, debtPayments } from '@/db/schema';
import type { Debt, NewDebt, DebtPayment, NewDebtPayment } from '@/db/schema';
import { eq, desc, inArray } from 'drizzle-orm';

interface DebtsState {
  items: Debt[];
  payments: DebtPayment[];
  loading: boolean;
  error: string | null;
}

const initialState: DebtsState = {
  items: [],
  payments: [],
  loading: false,
  error: null,
};

export const fetchDebts = createAsyncThunk('debts/fetchAll', async () => {
  return await db.select().from(debts).orderBy(desc(debts.createdAt));
});

export const addDebt = createAsyncThunk(
  'debts/add',
  async (data: NewDebt) => {
    const result = await db.insert(debts).values(data).returning();
    return result[0];
  }
);

export const updateDebt = createAsyncThunk(
  'debts/update',
  async ({ id, data }: { id: number; data: Partial<NewDebt> }) => {
    const result = await db
      .update(debts)
      .set(data)
      .where(eq(debts.id, id))
      .returning();
    return result[0];
  }
);

export const deleteDebt = createAsyncThunk(
  'debts/delete',
  async (id: number) => {
    await db.delete(debtPayments).where(eq(debtPayments.debtId, id));
    await db.delete(debts).where(eq(debts.id, id));
    return id;
  }
);

export const fetchPaymentsForDebt = createAsyncThunk(
  'debts/fetchPayments',
  async (debtId: number) => {
    return await db
      .select()
      .from(debtPayments)
      .where(eq(debtPayments.debtId, debtId))
      .orderBy(desc(debtPayments.date));
  }
);

export const fetchPaymentsForDebts = createAsyncThunk(
  'debts/fetchPaymentsForDebts',
  async (debtIds: number[]) => {
    if (debtIds.length === 0) return [];
    return await db
      .select()
      .from(debtPayments)
      .where(inArray(debtPayments.debtId, debtIds))
      .orderBy(desc(debtPayments.date));
  }
);

export const addDebtPayment = createAsyncThunk(
  'debts/addPayment',
  async ({ payment, debtId }: { payment: NewDebtPayment; debtId: number }) => {
    const paymentResult = await db
      .insert(debtPayments)
      .values(payment)
      .returning();

    // Update the debt's remaining amount and status
    const currentDebt = await db
      .select()
      .from(debts)
      .where(eq(debts.id, debtId));

    if (currentDebt.length > 0) {
      const newRemaining = currentDebt[0].remainingAmount - payment.amount;
      const newStatus = newRemaining <= 0 ? 'settled' : 'partial';
      await db
        .update(debts)
        .set({
          remainingAmount: Math.max(0, newRemaining),
          status: newStatus,
        })
        .where(eq(debts.id, debtId));
    }

    return {
      payment: paymentResult[0],
      debtId,
      newRemaining: Math.max(
        0,
        (currentDebt[0]?.remainingAmount ?? 0) - payment.amount
      ),
    };
  }
);

const debtsSlice = createSlice({
  name: 'debts',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchDebts.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDebts.fulfilled, (state, action) => {
        state.items = action.payload;
        state.loading = false;
      })
      .addCase(fetchDebts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? 'Failed to fetch debts';
      })
      .addCase(addDebt.fulfilled, (state, action) => {
        state.items.unshift(action.payload);
      })
      .addCase(updateDebt.fulfilled, (state, action) => {
        const idx = state.items.findIndex((d) => d.id === action.payload.id);
        if (idx !== -1) state.items[idx] = action.payload;
      })
      .addCase(deleteDebt.fulfilled, (state, action) => {
        state.items = state.items.filter((d) => d.id !== action.payload);
        state.payments = state.payments.filter(
          (p) => p.debtId !== action.payload
        );
      })
      .addCase(fetchPaymentsForDebt.fulfilled, (state, action) => {
        // Replace payments for this debt
        const debtIds = new Set(action.payload.map((p) => p.debtId));
        state.payments = [
          ...state.payments.filter((p) => !debtIds.has(p.debtId)),
          ...action.payload,
        ];
      })
      .addCase(fetchPaymentsForDebts.fulfilled, (state, action) => {
        const debtIds = new Set(action.payload.map((p) => p.debtId));
        state.payments = [
          ...state.payments.filter((p) => !debtIds.has(p.debtId)),
          ...action.payload,
        ];
      })
      .addCase(addDebtPayment.fulfilled, (state, action) => {
        state.payments.unshift(action.payload.payment);
        const debt = state.items.find((d) => d.id === action.payload.debtId);
        if (debt) {
          debt.remainingAmount = action.payload.newRemaining;
          debt.status = action.payload.newRemaining <= 0 ? 'settled' : 'partial';
        }
      });
  },
});

export default debtsSlice.reducer;
