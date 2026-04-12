import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { Provider as ReduxProvider } from 'react-redux';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme, StyleSheet, View, ActivityIndicator } from 'react-native';
import { store } from '@/store';
import { lightTheme, darkTheme } from '@/theme';
import { db } from '@/db/client';
import { seedDatabase } from '@/db/seed';
import {
  categories,
  transactions,
  contacts,
  debts,
  debtPayments,
  settings,
} from '@/db/schema';
import { sql } from 'drizzle-orm';

function InitDatabase({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function init() {
      // Create tables using raw SQL (since we're not using drizzle-kit migrations at runtime)
      const database = db as any;

      await database.run(sql`
        CREATE TABLE IF NOT EXISTS categories (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          icon TEXT NOT NULL DEFAULT 'help-circle-outline',
          color TEXT NOT NULL DEFAULT '#607D8B',
          type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
          budget_limit REAL,
          is_default INTEGER NOT NULL DEFAULT 0,
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `);

      // Migration: add sort_order column to existing databases
      try {
        await database.run(sql`ALTER TABLE categories ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0`);
      } catch (_) {
        // Column already exists — safe to ignore
      }

      await database.run(sql`
        CREATE TABLE IF NOT EXISTS transactions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
          amount REAL NOT NULL,
          category_id INTEGER REFERENCES categories(id),
          description TEXT,
          date TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `);

      await database.run(sql`
        CREATE TABLE IF NOT EXISTS contacts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          phone TEXT,
          email TEXT,
          notes TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `);

      await database.run(sql`
        CREATE TABLE IF NOT EXISTS debts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          type TEXT NOT NULL CHECK(type IN ('lent', 'borrowed')),
          contact_id INTEGER NOT NULL REFERENCES contacts(id),
          amount REAL NOT NULL,
          remaining_amount REAL NOT NULL,
          description TEXT,
          due_date TEXT,
          status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'partial', 'settled')),
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `);

      await database.run(sql`
        CREATE TABLE IF NOT EXISTS debt_payments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          debt_id INTEGER NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
          amount REAL NOT NULL,
          date TEXT NOT NULL,
          notes TEXT
        )
      `);

      await database.run(sql`
        CREATE TABLE IF NOT EXISTS settings (
          id INTEGER PRIMARY KEY DEFAULT 1,
          currency TEXT NOT NULL DEFAULT 'USD',
          currency_symbol TEXT NOT NULL DEFAULT '$',
          reminder_enabled INTEGER NOT NULL DEFAULT 0,
          reminder_time TEXT NOT NULL DEFAULT '21:00',
          month_start_day INTEGER NOT NULL DEFAULT 1,
          theme TEXT NOT NULL DEFAULT 'system' CHECK(theme IN ('light', 'dark', 'system')),
          onboarding_complete INTEGER NOT NULL DEFAULT 0
        )
      `);

      await seedDatabase();
      setReady(true);
    }

    init().catch(console.error);
  }, []);

  if (!ready) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#1B5E20" />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? darkTheme : lightTheme;

  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <ReduxProvider store={store}>
          <PaperProvider theme={theme}>
            <InitDatabase>
              <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="(tabs)" />
                <Stack.Screen
                  name="transaction/[id]"
                  options={{ presentation: 'modal', headerShown: true, title: 'Transaction' }}
                />
                <Stack.Screen
                  name="debt/add"
                  options={{ presentation: 'modal', headerShown: true, title: 'New Debt' }}
                />
                <Stack.Screen
                  name="debt/[id]"
                  options={{ presentation: 'modal', headerShown: true, title: 'Debt Details' }}
                />
                <Stack.Screen
                  name="category/manage"
                  options={{ headerShown: true, title: 'Manage Categories' }}
                />
                <Stack.Screen
                  name="category/[id]"
                  options={{ presentation: 'modal', headerShown: true, title: 'Edit Category' }}
                />
                <Stack.Screen
                  name="contact/manage"
                  options={{ headerShown: true, title: 'Manage Contacts' }}
                />
              </Stack>
            </InitDatabase>
          </PaperProvider>
        </ReduxProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
