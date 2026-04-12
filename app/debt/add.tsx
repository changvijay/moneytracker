import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import {
  Text,
  TextInput,
  Button,
  SegmentedButtons,
  useTheme,
  List,
  Portal,
  Modal,
} from 'react-native-paper';
import { useRouter, Stack } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';

import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { addDebt } from '@/store/slices/debtsSlice';
import { fetchContacts, addContact } from '@/store/slices/contactsSlice';
import { scheduleDebtReminder } from '@/services/notifications';
import { todayString } from '@/utils/dateHelpers';
import type { NewDebt, NewContact } from '@/db/schema';

export default function AddDebtScreen() {
  const theme = useTheme() as any;
  const router = useRouter();
  const dispatch = useAppDispatch();

  const contacts = useAppSelector((s) => s.contacts.items);

  const [type, setType] = useState<'lent' | 'borrowed'>('lent');
  const [contactId, setContactId] = useState<number | null>(null);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    dispatch(fetchContacts());
  }, [dispatch]);

  const selectedContact = contacts.find((c) => c.id === contactId);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    const numAmount = parseFloat(amount);
    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      errs.amount = 'Enter a valid amount';
    }
    if (!contactId) {
      errs.contact = 'Select a contact';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    const data: NewDebt = {
      type,
      contactId: contactId!,
      amount: parseFloat(amount),
      remainingAmount: parseFloat(amount),
      description: description.trim() || undefined,
      dueDate: dueDate || undefined,
    };

    const result = await dispatch(addDebt(data));

    // Schedule reminder if due date is set
    if (dueDate && selectedContact && result.meta.requestStatus === 'fulfilled') {
      scheduleDebtReminder(
        (result.payload as any).id,
        selectedContact.name,
        dueDate,
        type
      );
    }

    router.back();
  };

  const handleAddContact = async () => {
    if (!newContactName.trim()) return;
    const result = await dispatch(
      addContact({ name: newContactName.trim() })
    );
    if (result.meta.requestStatus === 'fulfilled') {
      setContactId((result.payload as any).id);
      setNewContactName('');
      setShowContactModal(false);
    }
  };

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen options={{ title: 'New Debt' }} />
      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
        <SegmentedButtons
          value={type}
          onValueChange={(v) => setType(v as 'lent' | 'borrowed')}
          buttons={[
            { value: 'lent', label: 'Money Lent' },
            { value: 'borrowed', label: 'Money Borrowed' },
          ]}
          style={styles.segment}
        />

        {/* Contact Picker */}
        <Text variant="labelLarge" style={styles.label}>
          Contact
        </Text>
        <TouchableOpacity onPress={() => setShowContactModal(true)}>
          <TextInput
            value={selectedContact?.name ?? ''}
            placeholder="Select a contact"
            mode="outlined"
            editable={false}
            left={<TextInput.Icon icon="account" />}
            right={<TextInput.Icon icon="chevron-down" />}
            error={!!errors.contact}
            style={styles.input}
            pointerEvents="none"
          />
        </TouchableOpacity>
        {errors.contact && (
          <Text variant="labelSmall" style={{ color: theme.colors.error, marginBottom: 8 }}>
            {errors.contact}
          </Text>
        )}

        {/* Amount */}
        <TextInput
          label="Amount"
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          mode="outlined"
          left={<TextInput.Icon icon="currency-usd" />}
          error={!!errors.amount}
          style={styles.input}
        />
        {errors.amount && (
          <Text variant="labelSmall" style={{ color: theme.colors.error, marginBottom: 8 }}>
            {errors.amount}
          </Text>
        )}

        {/* Description */}
        <TextInput
          label="Description (optional)"
          value={description}
          onChangeText={setDescription}
          mode="outlined"
          left={<TextInput.Icon icon="text" />}
          style={styles.input}
        />

        {/* Due Date */}
        <TouchableOpacity onPress={() => setShowDatePicker(true)}>
          <TextInput
            label="Due Date (optional)"
            value={dueDate}
            mode="outlined"
            editable={false}
            left={<TextInput.Icon icon="calendar" />}
            style={styles.input}
            pointerEvents="none"
          />
        </TouchableOpacity>
        {showDatePicker && (
          <DateTimePicker
            value={dueDate ? new Date(dueDate) : new Date()}
            mode="date"
            minimumDate={new Date()}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(_, selectedDate) => {
              setShowDatePicker(Platform.OS === 'ios');
              if (selectedDate) {
                setDueDate(format(selectedDate, 'yyyy-MM-dd'));
              }
            }}
          />
        )}

        {/* Actions */}
        <View style={styles.actions}>
          <Button mode="outlined" onPress={() => router.back()} style={styles.actionBtn}>
            Cancel
          </Button>
          <Button mode="contained" onPress={handleSubmit} style={styles.actionBtn}>
            Save
          </Button>
        </View>
      </ScrollView>

      {/* Contact Picker Modal */}
      <Portal>
        <Modal
          visible={showContactModal}
          onDismiss={() => setShowContactModal(false)}
          contentContainerStyle={[
            styles.modal,
            { backgroundColor: theme.colors.surface },
          ]}
        >
          <Text variant="titleLarge" style={{ fontWeight: '700', marginBottom: 16 }}>
            Select Contact
          </Text>

          {/* Quick add contact */}
          <View style={styles.addContactRow}>
            <TextInput
              value={newContactName}
              onChangeText={setNewContactName}
              placeholder="New contact name"
              mode="outlined"
              dense
              style={{ flex: 1, marginRight: 8 }}
            />
            <Button mode="contained" onPress={handleAddContact} compact>
              Add
            </Button>
          </View>

          <ScrollView style={{ maxHeight: 300 }}>
            {contacts.map((c) => (
              <List.Item
                key={c.id}
                title={c.name}
                description={c.phone || c.email || undefined}
                left={(props) => <List.Icon {...props} icon="account" />}
                onPress={() => {
                  setContactId(c.id);
                  setShowContactModal(false);
                }}
              />
            ))}
            {contacts.length === 0 && (
              <Text
                variant="bodyMedium"
                style={{ textAlign: 'center', padding: 24, color: theme.colors.outline }}
              >
                No contacts yet. Add one above.
              </Text>
            )}
          </ScrollView>
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, padding: 16 },
  segment: { marginBottom: 16 },
  label: { marginBottom: 8 },
  input: { marginBottom: 12 },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    gap: 12,
  },
  actionBtn: { flex: 1 },
  modal: {
    margin: 16,
    borderRadius: 16,
    padding: 16,
    maxHeight: '80%',
  },
  addContactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
});
