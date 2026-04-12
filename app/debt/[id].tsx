import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  FlatList,
  Alert,
} from 'react-native';
import {
  Text,
  Card,
  Button,
  TextInput,
  useTheme,
  Divider,
  Portal,
  Modal,
  Badge,
} from 'react-native-paper';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { format } from 'date-fns';

import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  fetchDebts,
  fetchPaymentsForDebt,
  addDebtPayment,
  updateDebt,
  deleteDebt,
} from '@/store/slices/debtsSlice';
import { fetchContacts } from '@/store/slices/contactsSlice';
import { formatCurrency } from '@/utils/currency';
import { formatTransactionDate, todayString } from '@/utils/dateHelpers';

export default function DebtDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme() as any;
  const router = useRouter();
  const dispatch = useAppDispatch();

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');

  const debt = useAppSelector((s) =>
    s.debts.items.find((d) => d.id === Number(id))
  );
  const payments = useAppSelector((s) =>
    s.debts.payments.filter((p) => p.debtId === Number(id))
  );
  const contacts = useAppSelector((s) => s.contacts.items);
  const settings = useAppSelector((s) => s.settings.data);
  const symbol = settings?.currencySymbol ?? '$';

  useEffect(() => {
    dispatch(fetchDebts());
    dispatch(fetchContacts());
    if (id) dispatch(fetchPaymentsForDebt(Number(id)));
  }, [dispatch, id]);

  if (!debt) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <Stack.Screen options={{ title: 'Debt Details' }} />
        <Text variant="bodyLarge">Debt not found</Text>
      </View>
    );
  }

  const contact = contacts.find((c) => c.id === debt.contactId);
  const progress =
    debt.amount > 0
      ? ((debt.amount - debt.remainingAmount) / debt.amount) * 100
      : 0;

  const handleRecordPayment = async () => {
    const numAmount = parseFloat(paymentAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      Alert.alert('Invalid amount', 'Please enter a valid payment amount.');
      return;
    }
    if (numAmount > debt.remainingAmount) {
      Alert.alert(
        'Too much',
        `Remaining amount is only ${formatCurrency(debt.remainingAmount, symbol)}`
      );
      return;
    }

    await dispatch(
      addDebtPayment({
        debtId: debt.id,
        payment: {
          debtId: debt.id,
          amount: numAmount,
          date: todayString(),
          notes: paymentNotes.trim() || undefined,
        },
      })
    );

    setPaymentAmount('');
    setPaymentNotes('');
    setShowPaymentModal(false);
    dispatch(fetchPaymentsForDebt(debt.id));
  };

  const handleSettle = () => {
    Alert.alert('Mark as Settled', 'This will mark the debt as fully settled.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Settle',
        onPress: () =>
          dispatch(
            updateDebt({
              id: debt.id,
              data: { remainingAmount: 0, status: 'settled' },
            })
          ),
      },
    ]);
  };

  const handleDelete = () => {
    Alert.alert('Delete Debt', 'Delete this debt and all payment records?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await dispatch(deleteDebt(debt.id));
          router.back();
        },
      },
    ]);
  };

  const typeColor = debt.type === 'lent' ? theme.custom.lent : theme.custom.borrowed;

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen
        options={{ title: `${debt.type === 'lent' ? 'Lent to' : 'Borrowed from'} ${contact?.name ?? 'Unknown'}` }}
      />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        {/* Summary Card */}
        <Card style={[styles.card, { borderTopColor: typeColor, borderTopWidth: 3 }]}>
          <Card.Content>
            <View style={styles.summaryRow}>
              <View>
                <Text variant="labelMedium" style={{ color: theme.colors.outline }}>
                  {debt.type === 'lent' ? 'Lent to' : 'Borrowed from'}
                </Text>
                <Text variant="headlineSmall" style={{ fontWeight: '700' }}>
                  {contact?.name ?? 'Unknown'}
                </Text>
              </View>
              <Badge
                style={[
                  styles.badge,
                  {
                    backgroundColor:
                      debt.status === 'settled'
                        ? theme.custom.income + '20'
                        : debt.status === 'partial'
                        ? theme.custom.warning + '20'
                        : theme.colors.surfaceVariant,
                  },
                ]}
              >
                {debt.status.toUpperCase()}
              </Badge>
            </View>

            {debt.description && (
              <Text variant="bodyMedium" style={{ marginTop: 8, color: theme.colors.outline }}>
                {debt.description}
              </Text>
            )}

            <View style={styles.amountRow}>
              <View>
                <Text variant="labelSmall" style={{ color: theme.colors.outline }}>
                  Original
                </Text>
                <Text variant="titleLarge" style={{ fontWeight: '700' }}>
                  {formatCurrency(debt.amount, symbol)}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text variant="labelSmall" style={{ color: theme.colors.outline }}>
                  Remaining
                </Text>
                <Text
                  variant="titleLarge"
                  style={{ fontWeight: '700', color: typeColor }}
                >
                  {formatCurrency(debt.remainingAmount, symbol)}
                </Text>
              </View>
            </View>

            {/* Progress */}
            <View style={styles.progressBg}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.min(progress, 100)}%`, backgroundColor: typeColor },
                ]}
              />
            </View>
            <Text variant="labelSmall" style={{ color: theme.colors.outline, marginTop: 4 }}>
              {progress.toFixed(1)}% paid
            </Text>

            {debt.dueDate && (
              <View style={styles.dueRow}>
                <MaterialCommunityIcons name="calendar-clock" size={16} color={theme.colors.outline} />
                <Text variant="bodySmall" style={{ marginLeft: 4, color: theme.colors.outline }}>
                  Due: {formatTransactionDate(debt.dueDate)}
                </Text>
              </View>
            )}
          </Card.Content>
        </Card>

        {/* Actions */}
        {debt.status !== 'settled' && (
          <View style={styles.actionRow}>
            <Button
              mode="contained"
              icon="cash-plus"
              onPress={() => setShowPaymentModal(true)}
              style={{ flex: 1, marginRight: 8 }}
            >
              Record Payment
            </Button>
            <Button
              mode="outlined"
              icon="check-circle"
              onPress={handleSettle}
              style={{ flex: 1 }}
            >
              Settle
            </Button>
          </View>
        )}

        {/* Payment History */}
        <Text variant="titleSmall" style={{ fontWeight: '600', marginTop: 16, marginBottom: 12 }}>
          Payment History ({payments.length})
        </Text>
        {payments.length === 0 ? (
          <Text variant="bodySmall" style={{ color: theme.colors.outline, textAlign: 'center', padding: 24 }}>
            No payments recorded yet
          </Text>
        ) : (
          payments.map((p, idx) => (
            <React.Fragment key={p.id}>
              {idx > 0 && <Divider />}
              <View style={styles.paymentRow}>
                <View style={[styles.paymentDot, { backgroundColor: typeColor }]} />
                <View style={{ flex: 1 }}>
                  <Text variant="bodyMedium" style={{ fontWeight: '500' }}>
                    {formatCurrency(p.amount, symbol)}
                  </Text>
                  {p.notes && (
                    <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                      {p.notes}
                    </Text>
                  )}
                </View>
                <Text variant="labelSmall" style={{ color: theme.colors.outline }}>
                  {formatTransactionDate(p.date)}
                </Text>
              </View>
            </React.Fragment>
          ))
        )}

        {/* Delete */}
        <Button
          mode="outlined"
          textColor={theme.custom.expense}
          onPress={handleDelete}
          icon="delete"
          style={{ marginTop: 24 }}
        >
          Delete Debt
        </Button>
      </ScrollView>

      {/* Payment Modal */}
      <Portal>
        <Modal
          visible={showPaymentModal}
          onDismiss={() => setShowPaymentModal(false)}
          contentContainerStyle={[
            styles.modal,
            { backgroundColor: theme.colors.surface },
          ]}
        >
          <Text variant="titleLarge" style={{ fontWeight: '700', marginBottom: 16 }}>
            Record Payment
          </Text>
          <TextInput
            label="Amount"
            value={paymentAmount}
            onChangeText={setPaymentAmount}
            keyboardType="decimal-pad"
            mode="outlined"
            left={<TextInput.Icon icon="currency-usd" />}
            style={{ marginBottom: 12 }}
          />
          <TextInput
            label="Notes (optional)"
            value={paymentNotes}
            onChangeText={setPaymentNotes}
            mode="outlined"
            left={<TextInput.Icon icon="text" />}
            style={{ marginBottom: 16 }}
          />
          <View style={styles.modalActions}>
            <Button
              mode="outlined"
              onPress={() => setShowPaymentModal(false)}
              style={{ flex: 1, marginRight: 8 }}
            >
              Cancel
            </Button>
            <Button mode="contained" onPress={handleRecordPayment} style={{ flex: 1 }}>
              Save
            </Button>
          </View>
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { borderRadius: 12, marginBottom: 16 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  badge: { paddingHorizontal: 8, borderRadius: 8, marginTop: 4 },
  amountRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  progressBg: { height: 6, borderRadius: 3, backgroundColor: '#E0E0E0', marginTop: 12 },
  progressFill: { height: 6, borderRadius: 3 },
  dueRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  actionRow: { flexDirection: 'row', marginBottom: 8 },
  paymentRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  paymentDot: { width: 8, height: 8, borderRadius: 4, marginRight: 12 },
  modal: { margin: 16, borderRadius: 16, padding: 16 },
  modalActions: { flexDirection: 'row' },
});
