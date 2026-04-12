import { configureStore } from '@reduxjs/toolkit';
import categoriesReducer from './slices/categoriesSlice';
import transactionsReducer from './slices/transactionsSlice';
import debtsReducer from './slices/debtsSlice';
import contactsReducer from './slices/contactsSlice';
import settingsReducer from './slices/settingsSlice';

export const store = configureStore({
  reducer: {
    categories: categoriesReducer,
    transactions: transactionsReducer,
    debts: debtsReducer,
    contacts: contactsReducer,
    settings: settingsReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
