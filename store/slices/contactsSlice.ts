import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { db } from '@/db/client';
import { contacts } from '@/db/schema';
import type { Contact, NewContact } from '@/db/schema';
import { eq } from 'drizzle-orm';

interface ContactsState {
  items: Contact[];
  loading: boolean;
  error: string | null;
}

const initialState: ContactsState = {
  items: [],
  loading: false,
  error: null,
};

export const fetchContacts = createAsyncThunk(
  'contacts/fetchAll',
  async () => {
    return await db.select().from(contacts);
  }
);

export const addContact = createAsyncThunk(
  'contacts/add',
  async (data: NewContact) => {
    const result = await db.insert(contacts).values(data).returning();
    return result[0];
  }
);

export const updateContact = createAsyncThunk(
  'contacts/update',
  async ({ id, data }: { id: number; data: Partial<NewContact> }) => {
    const result = await db
      .update(contacts)
      .set(data)
      .where(eq(contacts.id, id))
      .returning();
    return result[0];
  }
);

export const deleteContact = createAsyncThunk(
  'contacts/delete',
  async (id: number) => {
    await db.delete(contacts).where(eq(contacts.id, id));
    return id;
  }
);

const contactsSlice = createSlice({
  name: 'contacts',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchContacts.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchContacts.fulfilled, (state, action) => {
        state.items = action.payload;
        state.loading = false;
      })
      .addCase(fetchContacts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? 'Failed to fetch contacts';
      })
      .addCase(addContact.fulfilled, (state, action) => {
        state.items.push(action.payload);
      })
      .addCase(updateContact.fulfilled, (state, action) => {
        const idx = state.items.findIndex((c) => c.id === action.payload.id);
        if (idx !== -1) state.items[idx] = action.payload;
      })
      .addCase(deleteContact.fulfilled, (state, action) => {
        state.items = state.items.filter((c) => c.id !== action.payload);
      });
  },
});

export default contactsSlice.reducer;
