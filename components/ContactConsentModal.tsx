import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
} from 'react-native';
import {
  Text,
  Button,
  Card,
  useTheme,
  Portal,
  Modal,
  IconButton,
  Checkbox,
} from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

interface ContactConsentModalProps {
  visible: boolean;
  onDismiss: () => void;
  onAccept: () => void;
  onDecline: () => void;
}

export default function ContactConsentModal({
  visible,
  onDismiss,
  onAccept,
  onDecline
}: ContactConsentModalProps) {
  const theme = useTheme();
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const handleAccept = () => {
    if (agreedToTerms) {
      onAccept();
    }
  };

  const benefits = [
    {
      icon: 'account-plus',
      title: 'Quick Contact Import',
      description: 'Import people from your phone contacts instead of typing names manually'
    },
    {
      icon: 'shield-check',
      title: 'Privacy Protected',
      description: 'Contact data stays on your device and is never uploaded to external servers'
    },
    {
      icon: 'link',
      title: 'Smart Debt Linking',
      description: 'Easily associate your lending and borrowing records with real contacts'
    },
    {
      icon: 'clock',
      title: 'Save Time',
      description: 'No more retyping names and phone numbers you already have'
    }
  ];

  const privacyPoints = [
    'Contact information is stored only on your device',
    'No data is transmitted to external servers',
    'You can revoke access at any time in device settings',
    'We only access basic contact info (name, phone, email)',
    'Contacts are used solely for debt tracking features'
  ];

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={[
          styles.modal,
          { backgroundColor: theme.colors.surface }
        ]}
      >
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <MaterialCommunityIcons
              name="contacts"
              size={24}
              color={theme.colors.primary}
            />
          </View>
          <Text variant="headlineSmall" style={styles.title}>
            Import Your Contacts
          </Text>
          <IconButton
            icon="close"
            size={20}
            onPress={onDismiss}
            iconColor={theme.colors.onSurfaceVariant}
          />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Benefits */}
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Why connect your contacts?
          </Text>
          
          {benefits.map((benefit, index) => (
            <View key={index} style={styles.benefitRow}>
              <View style={[styles.benefitIcon, { backgroundColor: theme.colors.primaryContainer }]}>
                <MaterialCommunityIcons
                  name={benefit.icon as any}
                  size={20}
                  color={theme.colors.primary}
                />
              </View>
              <View style={styles.benefitContent}>
                <Text variant="labelLarge" style={styles.benefitTitle}>
                  {benefit.title}
                </Text>
                <Text variant="bodySmall" style={styles.benefitDescription}>
                  {benefit.description}
                </Text>
              </View>
            </View>
          ))}

          {/* Privacy Information */}
          <Text variant="titleMedium" style={[styles.sectionTitle, styles.privacyTitle]}>
            Your Privacy Matters
          </Text>
          
          <Card style={styles.privacyCard}>
            <Card.Content>
              <View style={styles.privacyHeader}>
                <MaterialCommunityIcons
                  name="shield-lock"
                  size={20}
                  color={theme.colors.primary}
                />
                <Text variant="labelLarge" style={styles.privacyHeaderText}>
                  Privacy Commitment
                </Text>
              </View>
              
              {privacyPoints.map((point, index) => (
                <View key={index} style={styles.privacyPoint}>
                  <MaterialCommunityIcons
                    name="check-circle"
                    size={16}
                    color={theme.colors.primary}
                  />
                  <Text variant="bodySmall" style={styles.privacyPointText}>
                    {point}
                  </Text>
                </View>
              ))}
            </Card.Content>
          </Card>

          {/* Consent Checkbox */}
          <View style={styles.consentRow}>
            <Checkbox
              status={agreedToTerms ? 'checked' : 'unchecked'}
              onPress={() => setAgreedToTerms(!agreedToTerms)}
            />
            <Text variant="bodyMedium" style={styles.consentText}>
              I understand and agree to allow MoneyTracker to access my contacts for debt tracking purposes
            </Text>
          </View>
        </ScrollView>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <Button
            mode="outlined"
            onPress={onDecline}
            style={styles.declineButton}
          >
            Maybe Later
          </Button>
          <Button
            mode="contained"
            onPress={handleAccept}
            style={styles.acceptButton}
            disabled={!agreedToTerms}
          >
            Allow Access
          </Button>
        </View>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modal: {
    margin: 20,
    borderRadius: 16,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E3F2FD',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  title: {
    flex: 1,
    fontWeight: '700',
  },
  content: {
    maxHeight: 400,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 12,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  benefitIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  benefitContent: {
    flex: 1,
  },
  benefitTitle: {
    fontWeight: '600',
    marginBottom: 2,
  },
  benefitDescription: {
    color: '#666',
    lineHeight: 18,
  },
  privacyTitle: {
    marginTop: 24,
  },
  privacyCard: {
    marginBottom: 16,
  },
  privacyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  privacyHeaderText: {
    marginLeft: 8,
    fontWeight: '600',
  },
  privacyPoint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  privacyPointText: {
    flex: 1,
    marginLeft: 8,
    lineHeight: 18,
  },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 16,
  },
  consentText: {
    flex: 1,
    marginLeft: 8,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  declineButton: {
    flex: 1,
  },
  acceptButton: {
    flex: 1,
  },
});