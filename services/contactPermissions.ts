import * as Contacts from 'expo-contacts';
import { Platform, Alert, Linking } from 'react-native';

export interface PermissionResult {
  granted: boolean;
  canAskAgain: boolean;
  message?: string;
}

export interface PhoneContact {
  id: string;
  name: string;
  phoneNumbers?: Array<{ number: string; label?: string }>;
  emails?: Array<{ email: string; label?: string }>;
}

class ContactPermissionsService {
  private permissionStatus: PermissionResult | null = null;

  /**
   * Request permission to access contacts with user-friendly messaging
   */
  async requestContactPermission(): Promise<PermissionResult> {
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      
      const result: PermissionResult = {
        granted: status === 'granted',
        canAskAgain: status !== 'denied',
        message: this.getPermissionMessage(status)
      };

      this.permissionStatus = result;
      return result;
    } catch (error) {
      console.error('Contact permission request failed:', error);
      return {
        granted: false,
        canAskAgain: false,
        message: 'Failed to request contact permission. Please try again.'
      };
    }
  }

  /**
   * Check current permission status without requesting
   */
  async checkContactPermission(): Promise<PermissionResult> {
    if (this.permissionStatus) {
      return this.permissionStatus;
    }

    try {
      const { status } = await Contacts.getPermissionsAsync();
      
      const result: PermissionResult = {
        granted: status === 'granted',
        canAskAgain: status !== 'denied',
        message: this.getPermissionMessage(status)
      };

      this.permissionStatus = result;
      return result;
    } catch (error) {
      console.error('Contact permission check failed:', error);
      return {
        granted: false,
        canAskAgain: false,
        message: 'Unable to check contact permission status.'
      };
    }
  }

  /**
   * Import contacts from phone
   */
  async importContacts(options?: {
    limit?: number;
    includePhoneNumbers?: boolean;
    includeEmails?: boolean;
  }): Promise<PhoneContact[]> {
    console.log('Checking contact permission for import...');
    
    // Check if we're running on a simulator
    if (!Contacts.getContactsAsync) {
      throw new Error('Contact access is not available on simulators. Please test on a physical device.');
    }

    const permission = await this.checkContactPermission();
    
    if (!permission.granted) {
      console.error('Contact permission not granted:', permission);
      throw new Error('Contact permission not granted');
    }

    console.log('Permission granted, importing contacts...');

    try {
      const { data } = await Contacts.getContactsAsync({
        fields: [
          Contacts.Fields.Name,
          ...(options?.includePhoneNumbers !== false ? [Contacts.Fields.PhoneNumbers] : []),
          ...(options?.includeEmails !== false ? [Contacts.Fields.Emails] : [])
        ],
        sort: Contacts.SortTypes.FirstName,
        ...(options?.limit && { pageSize: options.limit })
      });

      console.log(`Raw contacts from device: ${data.length}`);

      const filteredContacts = data
        .filter(contact => contact.name && contact.name.trim())
        .map(contact => ({
          id: contact.id,
          name: contact.name || 'Unknown Contact',
          phoneNumbers: contact.phoneNumbers?.map(phone => ({
            number: phone.number || '',
            label: phone.label || undefined
          })),
          emails: contact.emails?.map(email => ({
            email: email.email || '',
            label: email.label || undefined
          }))
        }));

      console.log(`Filtered contacts: ${filteredContacts.length}`);
      
      if (filteredContacts.length === 0) {
        throw new Error('No contacts found on your device. Please add some contacts to your phone first.');
      }
      
      return filteredContacts;
    } catch (error) {
      console.error('Failed to import contacts:', error);
      
      // Provide more specific error messages
      if (error instanceof Error) {
        if (error.message.includes('permission')) {
          throw new Error('Contact permission was denied. Please enable contact access in device settings.');
        } else if (error.message.includes('network')) {
          throw new Error('Network error while accessing contacts. Please try again.');
        } else if (error.message.includes('No contacts found')) {
          throw error; // Re-throw our custom message
        }
      }
      
      throw new Error('Failed to import contacts from your phone. Please try again.');
    }
  }

  /**
   * Show permission explanation dialog
   */
  showPermissionExplanation(): Promise<boolean> {
    return new Promise((resolve) => {
      Alert.alert(
        'Contact Access',
        'MoneyTracker would like to access your contacts to help you:\n\n• Quickly add people you lend money to or borrow from\n• Import existing contacts to avoid retyping names\n• Keep your debt records organized\n\nYour contact information stays private and is only stored on your device.',
        [
          {
            text: 'Not Now',
            style: 'cancel',
            onPress: () => resolve(false)
          },
          {
            text: 'Allow Access',
            style: 'default',
            onPress: () => resolve(true)
          }
        ]
      );
    });
  }

  /**
   * Show settings redirect dialog when permission is permanently denied
   */
  showSettingsRedirect(): Promise<boolean> {
    return new Promise((resolve) => {
      Alert.alert(
        'Contact Access Denied',
        'To import contacts, please enable contact access in your device settings.\n\nSettings > Privacy > Contacts > MoneyTracker',
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => resolve(false)
          },
          {
            text: 'Open Settings',
            style: 'default',
            onPress: () => {
              Linking.openSettings();
              resolve(true);
            }
          }
        ]
      );
    });
  }

  private getPermissionMessage(status: string): string {
    switch (status) {
      case 'granted':
        return 'Contact access granted';
      case 'denied':
        return 'Contact access denied. You can enable it in device settings.';
      case 'undetermined':
        return 'Contact permission not yet requested';
      default:
        return 'Contact permission status unknown';
    }
  }

  /**
   * Reset cached permission status (useful after app returns from settings)
   */
  resetPermissionCache() {
    this.permissionStatus = null;
  }
}

export const contactPermissions = new ContactPermissionsService();