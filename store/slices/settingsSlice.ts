import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { db } from '@/db/client';
import { settings } from '@/db/schema';
import type { Settings } from '@/db/schema';
import { eq } from 'drizzle-orm';

interface SettingsState {
  data: Settings | null;
  loading: boolean;
  error: string | null;
}

const initialState: SettingsState = {
  data: null,
  loading: false,
  error: null,
};

export const fetchSettings = createAsyncThunk(
  'settings/fetch',
  async () => {
    const result = await db.select().from(settings).where(eq(settings.id, 1));
    return result[0] ?? null;
  }
);

export const updateSettings = createAsyncThunk(
  'settings/update',
  async (data: Partial<Settings>) => {
    const result = await db
      .update(settings)
      .set(data)
      .where(eq(settings.id, 1))
      .returning();
    return result[0];
  }
);

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchSettings.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchSettings.fulfilled, (state, action) => {
        state.data = action.payload;
        state.loading = false;
      })
      .addCase(fetchSettings.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? 'Failed to fetch settings';
      })
      .addCase(updateSettings.fulfilled, (state, action) => {
        state.data = action.payload;
      });
  },
});

export default settingsSlice.reducer;
