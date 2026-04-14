import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Alert,
} from 'react-native';
import {
  Text,
  FAB,
  useTheme,
  Card,
  IconButton,
  Portal,
  Modal,
  TextInput,
  Button,
  Divider,
  Menu,
} from 'react-native-paper';
import { Stack } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  fetchContacts,
  addContact,
  updateContact,
  deleteContact,
} from '@/store/slices/contactsSlice';
import type { Contact, NewContact } from '@/db/schema';
import { contactPermissions } from '@/services/contactPermissions';
import ContactConsentModal from '@/components/ContactConsentModal';
import ContactImportModal from '@/components/ContactImportModal';

export default function ManageContactsScreen() {
  const theme = useTheme() as any;
  const dispatch = useAppDispatch();

  const contacts = useAppSelector((s) => s.contacts.items);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');

  // Contact import states
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showFabMenu, setShowFabMenu] = useState(false);

  useEffect(() => {
    dispatch(fetchContacts());
  }, [dispatch]);

  const openAdd = () => {
    setEditing(null);
    setName('');
    setPhone('');
    setEmail('');
    setNotes('');
    setShowModal(true);
    setShowFabMenu(false);
  };

  const openEdit = (c: Contact) => {
    setEditing(c);
    setName(c.name);
    setPhone(c.phone ?? '');
    setEmail(c.email ?? '');
    setNotes(c.notes ?? '');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Contact name is required');
      return;
    }
    const data: NewContact = {
      name: name.trim(),
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      notes: notes.trim() || undefined,
    };

    if (editing) {
      await dispatch(updateContact({ id: editing.id, data }));
    } else {
      await dispatch(addContact(data));
    }
    setShowModal(false);
  };

  const handleDelete = (c: Contact) => {
    Alert.alert('Delete Contact', `Delete "${c.name}"? Associated debts will remain.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => dispatch(deleteContact(c.id)),
      },
    ]);
  };

  const handleImportRequest = async () => {
    setShowFabMenu(false);
    
    try {
      // Check current permission status
      const permission = await contactPermissions.checkContactPermission();
      
      if (permission.granted) {
        // Permission already granted, show import modal directly
        setShowImportModal(true);
      } else if (permission.canAskAgain) {
        // Show consent modal first
        setShowConsentModal(true);
      } else {
        // Permission permanently denied, show settings redirect
        const shouldOpenSettings = await contactPermissions.showSettingsRedirect();
        if (shouldOpenSettings) {
          // User went to settings, reset permission cache for next check
          contactPermissions.resetPermissionCache();
        }
      }
    } catch (error) {
      Alert.alert(
        'Permission Error',
        'Unable to check contact permissions. Please try again.'
      );
    }
  };

  const handleConsentAccept = async () => {
    setShowConsentModal(false);
    
    try {
      const permission = await contactPermissions.requestContactPermission();
      
      if (permission.granted) {
        setShowImportModal(true);
      } else {
        Alert.alert(
          'Permission Required',
          permission.message || 'Contact access is required to import contacts from your phone.'
        );
      }
    } catch (error) {
      Alert.alert(
        'Permission Error',
        'Failed to request contact permission. Please try again.'
      );
    }
  };

  const handleConsentDecline = () => {
    setShowConsentModal(false);
  };

  const handleImportComplete = (importedCount: number) => {
    // Refresh contacts list
    dispatch(fetchContacts());
  };

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen 
        options={{ 
          title: 'Manage Contacts',
          headerRight: () => (
            <IconButton
              icon="help-circle-outline"
              size={20}
              onPress={() => {
                Alert.alert(
                  'About Contacts',
                  'Import contacts from your phone to quickly add people you lend money to or borrow from. Your contact information stays private and is only stored on your device.',
                  [{ text: 'Got it' }]
                );
              }}
            />
          ),
        }} 
      />
      
      <FlatList
        data={contacts}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <Card.Content style={styles.cardContent}>
              <View
                style={[
                  styles.avatar,
                  { backgroundColor: theme.colors.primaryContainer },
                ]}
              >
                <MaterialCommunityIcons
                  name="account"
                  size={24}
                  color={theme.colors.primary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="bodyLarge" style={{ fontWeight: '500' }}>
                  {item.name}
                </Text>
                {item.phone && (
                  <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                    📞 {item.phone}
                  </Text>
                )}
                {item.email && (
                  <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                    ✉️ {item.email}
                  </Text>
                )}
                {item.notes?.includes('Imported from phone') && (
                  <Text variant="bodySmall" style={{ color: theme.colors.primary, fontStyle: 'italic' }}>
                    📱 Imported
                  </Text>
                )}
              </View>
              <IconButton
                icon="pencil"
                size={18}
                onPress={() => openEdit(item)}
              />
              <IconButton
                icon="delete-outline"
                size={18}
                iconColor={theme.custom.expense}
                onPress={() => handleDelete(item)}
              />
            </Card.Content>
          </Card>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons
              name="account-group"
              size={60}
              color={theme.colors.outline}
            />
            <Text variant="bodyMedium" style={{ color: theme.colors.outline, marginTop: 12 }}>
              No contacts yet
            </Text>
            <Text variant="bodySmall" style={{ color: theme.colors.outline, marginTop: 8, textAlign: 'center', paddingHorizontal: 20 }}>
              Import contacts from your phone or add them manually to start tracking debts
            </Text>
            <Button
              mode="contained"
              icon="contacts"
              onPress={handleImportRequest}
              style={{ marginTop: 20 }}
            >
              Import from Phone
            </Button>
            <Button
              mode="outlined"
              icon="account-plus"
              onPress={openAdd}
              style={{ marginTop: 10 }}
            >
              Add Manually
            </Button>
          </View>
        }
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
      />

      {/* Enhanced FAB with menu */}
      <Portal>
        <Menu
          visible={showFabMenu}
          onDismiss={() => setShowFabMenu(false)}
          anchorPosition="top"
          contentStyle={styles.menuContent}
          anchor={
            <FAB
              icon="plus"
              style={[styles.fab, { backgroundColor: theme.colors.primary }]}
              color="white"
              onPress={() => setShowFabMenu(true)}
            />
          }
        >
          <Menu.Item
            leadingIcon="account-plus"
            title="Add Manually"
            onPress={openAdd}
          />
          <Menu.Item
            leadingIcon="contacts"
            title="Import from Phone"
            onPress={handleImportRequest}
          />
        </Menu>
      </Portal>

      {/* Manual Add/Edit Modal */}
      <Portal>
        <Modal
          visible={showModal}
          onDismiss={() => setShowModal(false)}
          contentContainerStyle={[
            styles.modal,
            { backgroundColor: theme.colors.surface },
          ]}
        >
          <Text variant="titleLarge" style={{ fontWeight: '700', marginBottom: 16 }}>
            {editing ? 'Edit Contact' : 'New Contact'}
          </Text>
          <TextInput
            label="Name"
            value={name}
            onChangeText={setName}
            mode="outlined"
            style={styles.input}
          />
          <TextInput
            label="Phone (optional)"
            value={phone}
            onChangeText={setPhone}
            mode="outlined"
            keyboardType="phone-pad"
            style={styles.input}
          />
          <TextInput
            label="Email (optional)"
            value={email}
            onChangeText={setEmail}
            mode="outlined"
            keyboardType="email-address"
            style={styles.input}
          />
          <TextInput
            label="Notes (optional)"
            value={notes}
            onChangeText={setNotes}
            mode="outlined"
            multiline
            numberOfLines={3}
            style={styles.input}
          />
          
          <Divider style={{ marginVertical: 16 }} />
          
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Button
              mode="outlined"
              onPress={() => setShowModal(false)}
              style={{ flex: 1 }}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={handleSave}
              style={{ flex: 1 }}
            >
              {editing ? 'Update' : 'Add'}
            </Button>
          </View>
        </Modal>
      </Portal>

      {/* Contact Consent Modal */}
      <ContactConsentModal
        visible={showConsentModal}
        onDismiss={() => setShowConsentModal(false)}
        onAccept={handleConsentAccept}
        onDecline={handleConsentDecline}
      />

      {/* Contact Import Modal */}
      <ContactImportModal
        visible={showImportModal}
        onDismiss={() => setShowImportModal(false)}
        onImportComplete={handleImportComplete}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { borderRadius: 12 },
  cardContent: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  empty: { alignItems: 'center', padding: 48 },
  fab: { position: 'absolute', bottom: 24, right: 16, borderRadius: 16 },
  modal: { margin: 16, borderRadius: 16, padding: 16 },
  input: { marginBottom: 10 },
  modalActions: { flexDirection: 'row', marginTop: 8 },
  menuContent: {
    position: 'absolute',
    bottom: 80,
    right: 16,
    borderRadius: 12,
  },
});
