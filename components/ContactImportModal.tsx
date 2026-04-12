import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Alert,
} from 'react-native';
import {
  Text,
  Button,
  Card,
  useTheme,
  Portal,
  Modal,
  IconButton,
  Searchbar,
  Checkbox,
  ActivityIndicator,
} from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useAppDispatch } from '@/store/hooks';
import { addContact } from '@/store/slices/contactsSlice';
import { contactPermissions, PhoneContact } from '@/services/contactPermissions';

interface ContactImportModalProps {
  visible: boolean;
  onDismiss: () => void;
  onImportComplete: (importedCount: number) => void;
}

interface SelectableContact extends PhoneContact {
  selected: boolean;
  primaryPhone?: string;
  primaryEmail?: string;
}

export default function ContactImportModal({
  visible,
  onDismiss,
  onImportComplete
}: ContactImportModalProps) {
  const theme = useTheme();
  const dispatch = useAppDispatch();
  
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [phoneContacts, setPhoneContacts] = useState<SelectableContact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<SelectableContact[]>([]);
  
  useEffect(() => {
    if (visible) {
      loadContacts();
    } else {
      // Reset state when modal closes
      setPhoneContacts([]);
      setFilteredContacts([]);
      setSearchQuery('');
    }
  }, [visible]);

  useEffect(() => {
    // Filter contacts based on search query
    if (searchQuery.trim()) {
      const filtered = phoneContacts.filter(contact =>
        contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        contact.primaryPhone?.includes(searchQuery) ||
        contact.primaryEmail?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredContacts(filtered);
    } else {
      setFilteredContacts(phoneContacts);
    }
  }, [searchQuery, phoneContacts]);

  const loadContacts = async () => {
    setLoading(true);
    try {
      console.log('Loading contacts from phone...');
      const contacts = await contactPermissions.importContacts({
        includePhoneNumbers: true,
        includeEmails: true
      });

      console.log(`Loaded ${contacts.length} contacts from phone`);
      
      const selectableContacts: SelectableContact[] = contacts.map(contact => ({
        ...contact,
        selected: false,
        primaryPhone: contact.phoneNumbers?.[0]?.number,
        primaryEmail: contact.emails?.[0]?.email,
      }));

      setPhoneContacts(selectableContacts);
      setFilteredContacts(selectableContacts);
    } catch (error) {
      console.error('Failed to load contacts:', error);
      Alert.alert(
        'Import Error',
        error instanceof Error ? error.message : 'Failed to load contacts from your phone'
      );
      onDismiss();
    } finally {
      setLoading(false);
    }
  };

  const toggleContact = (contactId: string) => {
    const updatedContacts = phoneContacts.map(contact =>
      contact.id === contactId
        ? { ...contact, selected: !contact.selected }
        : contact
    );
    setPhoneContacts(updatedContacts);
  };

  const selectAll = () => {
    const allSelected = filteredContacts.every(contact => contact.selected);
    const updatedContacts = phoneContacts.map(contact => {
      const isInFiltered = filteredContacts.some(filtered => filtered.id === contact.id);
      return isInFiltered
        ? { ...contact, selected: !allSelected }
        : contact;
    });
    setPhoneContacts(updatedContacts);
  };

  const importSelectedContacts = async () => {
    const selectedContacts = phoneContacts.filter(contact => contact.selected);
    
    if (selectedContacts.length === 0) {
      Alert.alert('No Selection', 'Please select contacts to import');
      return;
    }

    console.log(`Importing ${selectedContacts.length} selected contacts...`);
    setImporting(true);
    let importedCount = 0;

    try {
      for (const contact of selectedContacts) {
        try {
          console.log('Importing contact:', contact.name, { phone: contact.primaryPhone, email: contact.primaryEmail });
          
          const result = await dispatch(addContact({
            name: contact.name,
            phone: contact.primaryPhone || undefined,
            email: contact.primaryEmail || undefined,
            notes: `Imported from phone contacts`
          })).unwrap();
          
          console.log('Successfully imported:', result);
          importedCount++;
        } catch (error) {
          console.error(`Failed to import contact ${contact.name}:`, error);
        }
      }

      console.log(`Import complete: ${importedCount} of ${selectedContacts.length} contacts imported`);
      
      onImportComplete(importedCount);
      onDismiss();

      if (importedCount > 0) {
        Alert.alert(
          'Import Successful',
          `Successfully imported ${importedCount} of ${selectedContacts.length} contacts`
        );
      } else {
        Alert.alert(
          'Import Failed',
          'No contacts were imported. Please try again.'
        );
      }
    } catch (error) {
      console.error('General import error:', error);
      Alert.alert(
        'Import Error',
        'An error occurred while importing contacts'
      );
    } finally {
      setImporting(false);
    }
  };

  const renderContact = ({ item }: { item: SelectableContact }) => (
    <Card
      style={[
        styles.contactCard,
        { 
          backgroundColor: item.selected 
            ? theme.colors.primaryContainer 
            : theme.colors.surface 
        }
      ]}
      onPress={() => toggleContact(item.id)}
    >
      <Card.Content style={styles.contactContent}>
        <View style={styles.contactInfo}>
          <View style={styles.avatar}>
            <MaterialCommunityIcons
              name="account"
              size={24}
              color={item.selected ? theme.colors.primary : theme.colors.onSurfaceVariant}
            />
          </View>
          <View style={styles.contactDetails}>
            <Text
              variant="labelLarge"
              style={[
                styles.contactName,
                { color: item.selected ? theme.colors.primary : theme.colors.onSurface }
              ]}
            >
              {item.name}
            </Text>
            {item.primaryPhone && (
              <Text variant="bodySmall" style={styles.contactInfo}>
                📞 {item.primaryPhone}
              </Text>
            )}
            {item.primaryEmail && (
              <Text variant="bodySmall" style={styles.contactInfo}>
                ✉️ {item.primaryEmail}
              </Text>
            )}
          </View>
        </View>
        <Checkbox
          status={item.selected ? 'checked' : 'unchecked'}
          onPress={() => toggleContact(item.id)}
        />
      </Card.Content>
    </Card>
  );

  const selectedCount = filteredContacts.filter(c => c.selected).length;
  const allSelected = filteredContacts.length > 0 && filteredContacts.every(c => c.selected);

  if (loading) {
    return (
      <Portal>
        <Modal
          visible={visible}
          onDismiss={onDismiss}
          contentContainerStyle={[styles.modal, { backgroundColor: theme.colors.surface }]}
        >
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" />
            <Text variant="bodyLarge" style={styles.loadingText}>
              Loading your contacts...
            </Text>
          </View>
        </Modal>
      </Portal>
    );
  }

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={[styles.modal, { backgroundColor: theme.colors.surface }]}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text variant="headlineSmall" style={styles.title}>
            Import Contacts
          </Text>
          <IconButton
            icon="close"
            size={20}
            onPress={onDismiss}
            iconColor={theme.colors.onSurfaceVariant}
          />
        </View>

        {/* Search */}
        <Searchbar
          placeholder="Search contacts..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={styles.searchbar}
          inputStyle={{ fontSize: 14 }}
        />

        {/* Select All */}
        <Card style={styles.selectAllCard} onPress={selectAll}>
          <Card.Content style={styles.selectAllContent}>
            <Text variant="labelLarge">
              Select All ({filteredContacts.length} contacts)
            </Text>
            <Checkbox
              status={
                selectedCount === 0 ? 'unchecked' :
                allSelected ? 'checked' : 'indeterminate'
              }
              onPress={selectAll}
            />
          </Card.Content>
        </Card>

        {/* Contact List */}
        <FlatList
          data={filteredContacts}
          renderItem={renderContact}
          keyExtractor={(item) => item.id}
          style={styles.contactList}
          contentContainerStyle={styles.contactListContent}
          showsVerticalScrollIndicator={false}
        />

        {/* Actions */}
        <View style={styles.actions}>
          <Text variant="bodyMedium" style={styles.selectionText}>
            {selectedCount} contact{selectedCount !== 1 ? 's' : ''} selected
          </Text>
          <View style={styles.actionButtons}>
            <Button
              mode="outlined"
              onPress={onDismiss}
              style={styles.cancelButton}
              disabled={importing}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={importSelectedContacts}
              style={styles.importButton}
              disabled={selectedCount === 0 || importing}
              loading={importing}
            >
              Import {selectedCount > 0 ? `(${selectedCount})` : ''}
            </Button>
          </View>
        </View>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modal: {
    margin: 16,
    borderRadius: 16,
    maxHeight: '90%',
    flex: 1,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: {
    fontWeight: '700',
  },
  searchbar: {
    marginHorizontal: 16,
    marginBottom: 8,
    elevation: 0,
  },
  selectAllCard: {
    marginHorizontal: 16,
    marginBottom: 8,
  },
  selectAllContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  contactList: {
    flex: 1,
  },
  contactListContent: {
    padding: 16,
    gap: 8,
  },
  contactCard: {
    elevation: 1,
  },
  contactContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  contactInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  contactDetails: {
    flex: 1,
  },
  contactName: {
    fontWeight: '600',
    marginBottom: 2,
  },
  actions: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  selectionText: {
    textAlign: 'center',
    marginBottom: 12,
    color: '#666',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
  },
  importButton: {
    flex: 1,
  },
});