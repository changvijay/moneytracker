import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { db } from '@/db/client';
import { categories } from '@/db/schema';
import type { Category, NewCategory } from '@/db/schema';
import { eq, asc } from 'drizzle-orm';

interface CategoriesState {
  items: Category[];
  loading: boolean;
  error: string | null;
}

const initialState: CategoriesState = {
  items: [],
  loading: false,
  error: null,
};

export const fetchCategories = createAsyncThunk(
  'categories/fetchAll',
  async () => {
    return await db
      .select()
      .from(categories)
      .orderBy(asc(categories.sortOrder), asc(categories.id));
  }
);

export const reorderCategories = createAsyncThunk(
  'categories/reorder',
  async (orderedIds: number[]) => {
    await Promise.all(
      orderedIds.map((id, index) =>
        db.update(categories).set({ sortOrder: index }).where(eq(categories.id, id))
      )
    );
    return orderedIds;
  }
);

export const addCategory = createAsyncThunk(
  'categories/add',
  async (data: NewCategory) => {
    const result = await db.insert(categories).values(data).returning();
    return result[0];
  }
);

export const updateCategory = createAsyncThunk(
  'categories/update',
  async ({ id, data }: { id: number; data: Partial<NewCategory> }) => {
    const result = await db
      .update(categories)
      .set(data)
      .where(eq(categories.id, id))
      .returning();
    return result[0];
  }
);

export const deleteCategory = createAsyncThunk(
  'categories/delete',
  async (id: number) => {
    await db.delete(categories).where(eq(categories.id, id));
    return id;
  }
);

const categoriesSlice = createSlice({
  name: 'categories',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchCategories.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCategories.fulfilled, (state, action) => {
        state.items = action.payload;
        state.loading = false;
      })
      .addCase(fetchCategories.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? 'Failed to fetch categories';
      })
      .addCase(addCategory.fulfilled, (state, action) => {
        state.items.push(action.payload);
      })
      .addCase(updateCategory.fulfilled, (state, action) => {
        const idx = state.items.findIndex((c) => c.id === action.payload.id);
        if (idx !== -1) state.items[idx] = action.payload;
      })
      .addCase(deleteCategory.fulfilled, (state, action) => {
        state.items = state.items.filter((c) => c.id !== action.payload);
      })
      .addCase(reorderCategories.pending, (state, action) => {
        // Optimistic reorder: update sortOrder and re-sort the array
        const orderedIds = action.meta.arg;
        orderedIds.forEach((id, index) => {
          const item = state.items.find((c) => c.id === id);
          if (item) item.sortOrder = index;
        });
        state.items.sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
      })
      .addCase(reorderCategories.fulfilled, (state) => {
        // Re-sort to ensure consistency with DB
        state.items.sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
      });
  },
});

export default categoriesSlice.reducer;
