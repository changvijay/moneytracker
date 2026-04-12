import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Alert, Platform } from 'react-native';
import {
  Text,
  List,
  Switch,
  useTheme,
  Divider,
  Button,
  Portal,
  Modal,
  RadioButton,
} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import DateTimePicker from '@react-native-community/datetimepicker';

import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchSettings, updateSettings } from '@/store/slices/settingsSlice';
import { CURRENCY_LIST } from '@/utils/currency';
import {
  scheduleDailyReminder,
  cancelDailyReminder,
} from '@/services/notifications';
import { db } from '@/db/client';
import { transactions, debts, debtPayments, contacts } from '@/db/schema';

export default function SettingsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const dispatch = useAppDispatch();

  const settings = useAppSelector((s) => s.settings.data);

  const [showCurrencyModal, setShowCurrencyModal] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  useEffect(() => {
    dispatch(fetchSettings());
  }, [dispatch]);

  if (!settings) return null;

  const handleToggleReminder = async (enabled: boolean) => {
    await dispatch(updateSettings({ reminderEnabled: enabled }));
    if (enabled) {
      const [h, m] = settings.reminderTime.split(':').map(Number);
      await scheduleDailyReminder(h, m);
    } else {
      await cancelDailyReminder();
    }
  };

  const handleTimeChange = async (_: any, date?: Date) => {
    setShowTimePicker(Platform.OS === 'ios');
    if (date) {
      const timeStr = `${date.getHours().toString().padStart(2, '0')}:${date
        .getMinutes()
        .toString()
        .padStart(2, '0')}`;
      await dispatch(updateSettings({ reminderTime: timeStr }));
      if (settings.reminderEnabled) {
        await scheduleDailyReminder(date.getHours(), date.getMinutes());
      }
    }
  };

  const handleCurrencySelect = async (code: string, symbol: string) => {
    await dispatch(updateSettings({ currency: code, currencySymbol: symbol }));
    setShowCurrencyModal(false);
  };

  const handleThemeChange = async (value: string) => {
    await dispatch(
      updateSettings({ theme: value as 'light' | 'dark' | 'system' })
    );
  };

  const handleResetData = () => {
    Alert.alert(
      'Reset All Data',
      'This will permanently delete all transactions, debts, contacts, and categories. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            await db.delete(debtPayments);
            await db.delete(debts);
            await db.delete(transactions);
            await db.delete(contacts);
            Alert.alert('Done', 'All data has been reset.');
          },
        },
      ]
    );
  };

  const reminderDate = (() => {
    const [h, m] = settings.reminderTime.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d;
  })();

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 32 }}>
        <View style={styles.header}>
          <Text variant="headlineSmall" style={{ fontWeight: '700' }}>
            Settings
          </Text>
        </View>

        {/* Currency */}
        <List.Section>
          <List.Subheader>General</List.Subheader>
          <List.Item
            title="Currency"
            description={`${settings.currencySymbol} ${settings.currency}`}
            left={(props) => <List.Icon {...props} icon="currency-usd" />}
            onPress={() => setShowCurrencyModal(true)}
          />
          <Divider />
          <List.Item
            title="Month Start Day"
            description={`Day ${settings.monthStartDay} of each month`}
            left={(props) => <List.Icon {...props} icon="calendar-month" />}
          />
        </List.Section>

        {/* Reminders */}
        <List.Section>
          <List.Subheader>Reminders</List.Subheader>
          <List.Item
            title="Daily Expense Reminder"
            description="Get reminded to log expenses"
            left={(props) => <List.Icon {...props} icon="bell-ring" />}
            right={() => (
              <Switch
                value={settings.reminderEnabled}
                onValueChange={handleToggleReminder}
              />
            )}
          />
          {settings.reminderEnabled && (
            <>
              <Divider />
              <List.Item
                title="Reminder Time"
                description={settings.reminderTime}
                left={(props) => <List.Icon {...props} icon="clock-outline" />}
                onPress={() => setShowTimePicker(true)}
              />
            </>
          )}
        </List.Section>

        {/* Appearance */}
        <List.Section>
          <List.Subheader>Appearance</List.Subheader>
          <RadioButton.Group
            value={settings.theme}
            onValueChange={handleThemeChange}
          >
            <RadioButton.Item label="System default" value="system" />
            <RadioButton.Item label="Light" value="light" />
            <RadioButton.Item label="Dark" value="dark" />
          </RadioButton.Group>
        </List.Section>

        {/* Data Management */}
        <List.Section>
          <List.Subheader>Data Management</List.Subheader>
          <List.Item
            title="Manage Categories"
            description="Create, edit and organize categories"
            left={(props) => <List.Icon {...props} icon="tag-multiple" />}
            onPress={() => router.push('/category/manage')}
          />
          <Divider />
          <List.Item
            title="Manage Contacts"
            description="Edit contacts for debts"
            left={(props) => <List.Icon {...props} icon="account-group" />}
            onPress={() => router.push('/contact/manage')}
          />
          <Divider />
          <List.Item
            title="Reset All Data"
            description="Delete all transactions, debts and contacts"
            left={(props) => (
              <List.Icon {...props} icon="delete-forever" color="#EF4444" />
            )}
            titleStyle={{ color: "#EF4444" }}
            onPress={handleResetData}
          />
        </List.Section>

        {/* About */}
        <List.Section>
          <List.Subheader>About</List.Subheader>
          <List.Item
            title="MoneyTracker"
            description="Version 1.0.0"
            left={(props) => <List.Icon {...props} icon="information" />}
          />
        </List.Section>
      </ScrollView>

      {/* Time Picker */}
      {showTimePicker && (
        <DateTimePicker
          value={reminderDate}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleTimeChange}
        />
      )}

      {/* Currency Modal */}
      <Portal>
        <Modal
          visible={showCurrencyModal}
          onDismiss={() => setShowCurrencyModal(false)}
          contentContainerStyle={[
            styles.modal,
            { backgroundColor: theme.colors.surface },
          ]}
        >
          <Text variant="titleLarge" style={{ fontWeight: '700', marginBottom: 16 }}>
            Select Currency
          </Text>
          <ScrollView style={{ maxHeight: 400 }}>
            {CURRENCY_LIST.map((c) => (
              <List.Item
                key={c.code}
                title={`${c.symbol} ${c.code}`}
                description={c.name}
                onPress={() => handleCurrencySelect(c.code, c.symbol)}
                right={() =>
                  settings.currency === c.code ? (
                    <MaterialCommunityIcons
                      name="check"
                      size={20}
                      color={theme.colors.primary}
                      style={{ alignSelf: 'center' }}
                    />
                  ) : null
                }
              />
            ))}
          </ScrollView>
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { paddingHorizontal: 16, marginBottom: 4 },
  modal: {
    margin: 16,
    borderRadius: 16,
    padding: 16,
    maxHeight: '80%',
  },
});
