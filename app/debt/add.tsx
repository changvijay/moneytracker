import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Alert,
  FlatList,
  Keyboard,
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
  Divider,
  ActivityIndicator,
  Searchbar,
} from 'react-native-paper';
import { useRouter, Stack } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { addDebt } from '@/store/slices/debtsSlice';
import { fetchContacts, addContact } from '@/store/slices/contactsSlice';
import { scheduleDebtReminder } from '@/services/notifications';
import { todayString } from '@/utils/dateHelpers';
import { contactPermissions, PhoneContact } from '@/services/contactPermissions';
import ContactConsentModal from '@/components/ContactConsentModal';
import { selectFrequentContacts } from '@/store/selectors/insightsSelectors';
import type { NewDebt, NewContact, Contact } from '@/db/schema';

export default function AddDebtScreen() {
  const theme = useTheme() as any;
  const router = useRouter();
  const dispatch = useAppDispatch();

  const contacts = useAppSelector((s) => s.contacts.items);
  const frequentContacts = useAppSelector(selectFrequentContacts);

  const [type, setType] = useState<'lent' | 'borrowed'>('lent');
  const [contactId, setContactId] = useState<number | null>(null);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Smart contact picker states
  const [searchQuery, setSearchQuery] = useState('');
  const [phoneResults, setPhoneResults] = useState<PhoneContact[]>([]);
  const [searchingPhone, setSearchingPhone] = useState(false);
  const [phoneSearchAttempted, setPhoneSearchAttempted] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    dispatch(fetchContacts());
  }, [dispatch]);

  const selectedContact = contacts.find((c) => c.id === contactId);

  // Filter app contacts by search query
  const filteredAppContacts = useMemo(() => {
    if (!searchQuery.trim()) return frequentContacts;
    const q = searchQuery.toLowerCase();
    return contacts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q)
    );
  }, [contacts, frequentContacts, searchQuery]);

  // Debounced phone contact search
  const triggerPhoneSearch = useCallback(
    async (query: string) => {
      if (query.trim().length < 2) {
        setPhoneResults([]);
        setPhoneSearchAttempted(false);
        return;
      }

      // Only search phone when no app contacts match
      const q = query.toLowerCase();
      const hasAppMatch = contacts.some(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.phone?.toLowerCase().includes(q)
      );
      if (hasAppMatch) {
        setPhoneResults([]);
        setPhoneSearchAttempted(false);
        return;
      }

      setSearchingPhone(true);
      setPhoneSearchAttempted(true);
      try {
        const results = await contactPermissions.searchPhoneContacts(query);
        // Filter out contacts already in app
        const existingNames = new Set(contacts.map((c) => c.name.toLowerCase()));
        setPhoneResults(
          results.filter((r) => !existingNames.has(r.name.toLowerCase()))
        );
      } catch (err: any) {
        if (err?.message === 'PERMISSION_REQUIRED') {
          // Will prompt permission lazily when user taps "Search phone contacts"
          setPhoneResults([]);
        }
      } finally {
        setSearchingPhone(false);
      }
    },
    [contacts]
  );

  const onSearchChange = (query: string) => {
    setSearchQuery(query);
    setShowManualAdd(false);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => triggerPhoneSearch(query), 400);
  };

  const handleSelectAppContact = (c: Contact) => {
    setContactId(c.id);
    setShowContactModal(false);
    resetPickerState();
  };

  const handleSelectPhoneContact = async (pc: PhoneContact) => {
    // Import this single contact into the app
    const result = await dispatch(
      addContact({
        name: pc.name,
        phone: pc.phoneNumbers?.[0]?.number || undefined,
        email: pc.emails?.[0]?.email || undefined,
        notes: 'Imported from phone contacts',
      })
    );
    if (result.meta.requestStatus === 'fulfilled') {
      setContactId((result.payload as any).id);
      setShowContactModal(false);
      resetPickerState();
    }
  };

  const handleSearchPhoneContacts = async () => {
    const permission = await contactPermissions.checkContactPermission();
    if (permission.granted) {
      triggerPhoneSearch(searchQuery);
    } else if (permission.canAskAgain) {
      setShowContactModal(false);
      setShowConsentModal(true);
    } else {
      await contactPermissions.showSettingsRedirect();
      contactPermissions.resetPermissionCache();
    }
  };

  const handleConsentAccept = async () => {
    setShowConsentModal(false);
    try {
      const permission = await contactPermissions.requestContactPermission();
      setShowContactModal(true);
      if (permission.granted) {
        triggerPhoneSearch(searchQuery);
      }
    } catch {
      setShowContactModal(true);
    }
  };

  const handleConsentDecline = () => {
    setShowConsentModal(false);
    setShowContactModal(true);
  };

  const handleManualAdd = async () => {
    if (!newContactName.trim()) return;
    const result = await dispatch(
      addContact({
        name: newContactName.trim(),
        phone: newContactPhone.trim() || undefined,
      })
    );
    if (result.meta.requestStatus === 'fulfilled') {
      setContactId((result.payload as any).id);
      setShowContactModal(false);
      resetPickerState();
    }
  };

  const resetPickerState = () => {
    setSearchQuery('');
    setPhoneResults([]);
    setPhoneSearchAttempted(false);
    setShowManualAdd(false);
    setNewContactName('');
    setNewContactPhone('');
  };

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

      {/* Smart Contact Picker Modal */}
      <Portal>
        <Modal
          visible={showContactModal}
          onDismiss={() => { setShowContactModal(false); resetPickerState(); }}
          contentContainerStyle={[
            styles.modal,
            { backgroundColor: theme.colors.surface },
          ]}
        >
          <Text variant="titleLarge" style={{ fontWeight: '700', marginBottom: 12 }}>
            Select Contact
          </Text>

          {/* Search Bar */}
          <Searchbar
            placeholder="Search contacts..."
            value={searchQuery}
            onChangeText={onSearchChange}
            style={styles.searchbar}
            inputStyle={{ fontSize: 14 }}
            autoFocus
          />

          {/* Contact List */}
          <ScrollView
            style={{ maxHeight: 320 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Section: Frequent / Filtered App Contacts */}
            {filteredAppContacts.length > 0 && (
              <>
                <Text
                  variant="labelMedium"
                  style={[styles.sectionLabel, { color: theme.colors.outline }]}
                >
                  {searchQuery.trim() ? 'Matching contacts' : 'Frequent contacts'}
                </Text>
                {filteredAppContacts.map((c) => (
                  <List.Item
                    key={c.id}
                    title={c.name}
                    description={c.phone || c.email || undefined}
                    left={(props) => <List.Icon {...props} icon="account" />}
                    onPress={() => handleSelectAppContact(c)}
                    style={styles.listItem}
                  />
                ))}
              </>
            )}

            {/* Section: Phone Results (shown only when searching and no app match) */}
            {searchingPhone && (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" />
                <Text variant="bodySmall" style={{ marginLeft: 8, color: theme.colors.outline }}>
                  Searching phone contacts...
                </Text>
              </View>
            )}

            {phoneResults.length > 0 && (
              <>
                <Divider style={{ marginVertical: 4 }} />
                <Text
                  variant="labelMedium"
                  style={[styles.sectionLabel, { color: theme.colors.outline }]}
                >
                  From phone contacts
                </Text>
                {phoneResults.map((pc) => (
                  <List.Item
                    key={pc.id}
                    title={pc.name}
                    description={pc.phoneNumbers?.[0]?.number || pc.emails?.[0]?.email || undefined}
                    left={(props) => (
                      <List.Icon {...props} icon="cellphone" />
                    )}
                    right={() => (
                      <MaterialCommunityIcons
                        name="plus-circle-outline"
                        size={20}
                        color={theme.colors.primary}
                        style={{ alignSelf: 'center' }}
                      />
                    )}
                    onPress={() => handleSelectPhoneContact(pc)}
                    style={styles.listItem}
                  />
                ))}
              </>
            )}

            {/* Prompt to search phone contacts when no app-matches and not yet searched */}
            {searchQuery.trim().length >= 2 &&
              filteredAppContacts.length === 0 &&
              phoneResults.length === 0 &&
              !searchingPhone &&
              !phoneSearchAttempted && (
                <View style={styles.noResultsSection}>
                  <Text variant="bodyMedium" style={{ color: theme.colors.outline, marginBottom: 8 }}>
                    No matching contacts in the app
                  </Text>
                  <Button
                    mode="outlined"
                    icon="cellphone"
                    onPress={handleSearchPhoneContacts}
                    compact
                  >
                    Search Phone Contacts
                  </Button>
                </View>
              )}

            {/* No results anywhere */}
            {searchQuery.trim().length >= 2 &&
              filteredAppContacts.length === 0 &&
              phoneResults.length === 0 &&
              !searchingPhone &&
              phoneSearchAttempted && (
                <View style={styles.noResultsSection}>
                  <MaterialCommunityIcons
                    name="account-question"
                    size={36}
                    color={theme.colors.outline}
                  />
                  <Text
                    variant="bodyMedium"
                    style={{ color: theme.colors.outline, marginTop: 8, textAlign: 'center' }}
                  >
                    No contacts found for "{searchQuery}"
                  </Text>
                </View>
              )}

            {/* Empty state — no contacts at all */}
            {contacts.length === 0 && !searchQuery.trim() && (
              <View style={styles.noResultsSection}>
                <MaterialCommunityIcons
                  name="account-group"
                  size={40}
                  color={theme.colors.outline}
                />
                <Text
                  variant="bodyMedium"
                  style={{ color: theme.colors.outline, marginTop: 8, textAlign: 'center' }}
                >
                  No contacts yet
                </Text>
                <Text
                  variant="bodySmall"
                  style={{ color: theme.colors.outline, textAlign: 'center', marginTop: 4 }}
                >
                  Search for a name above or add one manually
                </Text>
              </View>
            )}
          </ScrollView>

          {/* Manual add — always available as fallback */}
          <Divider style={{ marginVertical: 8 }} />
          {!showManualAdd ? (
            <Button
              mode="text"
              icon="account-plus"
              onPress={() => {
                setShowManualAdd(true);
                setNewContactName(searchQuery.trim());
              }}
              compact
            >
              Add New Contact Manually
            </Button>
          ) : (
            <View>
              <Text variant="labelLarge" style={{ marginBottom: 8 }}>
                New Contact
              </Text>
              <TextInput
                value={newContactName}
                onChangeText={setNewContactName}
                placeholder="Name *"
                mode="outlined"
                dense
                style={{ marginBottom: 8 }}
                autoFocus
              />
              <TextInput
                value={newContactPhone}
                onChangeText={setNewContactPhone}
                placeholder="Phone (optional)"
                mode="outlined"
                dense
                keyboardType="phone-pad"
                style={{ marginBottom: 8 }}
              />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button
                  mode="outlined"
                  onPress={() => setShowManualAdd(false)}
                  compact
                  style={{ flex: 1 }}
                >
                  Cancel
                </Button>
                <Button
                  mode="contained"
                  onPress={handleManualAdd}
                  compact
                  disabled={!newContactName.trim()}
                  style={{ flex: 1 }}
                >
                  Add & Select
                </Button>
              </View>
            </View>
          )}
        </Modal>
      </Portal>

      {/* Contact Consent Modal — shown only when phone search needs permission */}
      <ContactConsentModal
        visible={showConsentModal}
        onDismiss={() => { setShowConsentModal(false); setShowContactModal(true); }}
        onAccept={handleConsentAccept}
        onDecline={handleConsentDecline}
      />
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
    maxHeight: '85%',
  },
  searchbar: {
    marginBottom: 8,
    elevation: 0,
    borderRadius: 12,
  },
  sectionLabel: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
    fontWeight: '600',
  },
  listItem: {
    paddingVertical: 2,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  noResultsSection: {
    alignItems: 'center',
    padding: 24,
  },
});
