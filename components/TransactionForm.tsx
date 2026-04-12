import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Animated,
  Alert,
  KeyboardAvoidingView,
} from 'react-native';
import {
  Text,
  TextInput,
  Button,
  useTheme,
  Portal,
  Modal,
  IconButton,
} from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { fetchCategories, addCategory } from '@/store/slices/categoriesSlice';
import { fetchSettings } from '@/store/slices/settingsSlice';
import type { NewTransaction, Category } from '@/db/schema';
import { todayString } from '@/utils/dateHelpers';
import { format, addDays, parseISO, isAfter, startOfDay } from 'date-fns';
import { DEFAULT_CATEGORIES } from '@/constants/defaultCategories';

let DateTimePicker: any = null;
try {
  DateTimePicker = require('@react-native-community/datetimepicker').default;
} catch (error) {
  console.log('DateTimePicker not available in Expo Go - using fallback');
}

interface TransactionFormProps {
  initialData?: Partial<NewTransaction>;
  onSubmit: (data: NewTransaction) => void;
  onCancel: () => void;
  loading?: boolean;
}

const TYPE_CONFIG = {
  expense: {
    label: 'Expense',
    icon: 'arrow-up-circle' as const,
    color: '#E53935',
    light: '#FFF1F0',
    mid: '#FFCDD2',
    gradient: '#EF5350',
  },
  income: {
    label: 'Income',
    icon: 'arrow-down-circle' as const,
    color: '#00897B',
    light: '#E8F5E9',
    mid: '#A5D6A7',
    gradient: '#26A69A',
  },
};

export default function TransactionForm({
  initialData,
  onSubmit,
  onCancel,
  loading,
}: TransactionFormProps) {
  const theme = useTheme();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const categories = useAppSelector((s) => s.categories.items);
  const categoriesLoading = useAppSelector((s) => s.categories.loading);
  const settings = useAppSelector((s) => s.settings.data);

  const [type, setType] = useState<'income' | 'expense'>(
    initialData?.type ?? 'expense'
  );
  const [amount, setAmount] = useState(initialData?.amount?.toString() ?? '');
  const [categoryId, setCategoryId] = useState<number | null>(
    initialData?.categoryId ?? null
  );
  const [description, setDescription] = useState(initialData?.description ?? '');
  const [date, setDate] = useState(initialData?.date ?? todayString());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempDate, setTempDate] = useState(new Date());

  const slideAnim = useRef(new Animated.Value(type === 'expense' ? 0 : 1)).current;
  const amountScale = useRef(new Animated.Value(1)).current;
  const cardFadeAnim = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollView>(null);

  const today = startOfDay(new Date());
  const selectedDate = parseISO(date);
  const isToday = format(selectedDate, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
  const isYesterday =
    format(selectedDate, 'yyyy-MM-dd') === format(addDays(today, -1), 'yyyy-MM-dd');

  const filteredCategories = categories.filter((c) => c.type === type);

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: type === 'expense' ? 0 : 1,
      useNativeDriver: false,
      damping: 18,
      stiffness: 220,
    }).start();
  }, [type]);

  useEffect(() => {
    Animated.timing(cardFadeAnim, {
      toValue: 1,
      duration: 350,
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    dispatch(fetchCategories());
    dispatch(fetchSettings());
  }, [dispatch]);

  useEffect(() => {
    if (!categoriesLoading && categories.length === 0) {
      const defaults = [
        ...DEFAULT_CATEGORIES.filter((c) => c.type === 'expense').slice(0, 3),
        ...DEFAULT_CATEGORIES.filter((c) => c.type === 'income').slice(0, 2),
      ];
      defaults.forEach((cat) => dispatch(addCategory(cat)));
    }
  }, [categoriesLoading, categories.length, dispatch]);

  const getDateDisplayText = () => {
    if (isToday) return 'Today';
    if (isYesterday) return 'Yesterday';
    return format(selectedDate, 'MMM d, yyyy');
  };

  const setQuickDate = (qt: 'today' | 'yesterday') => {
    if (qt === 'today') setDate(format(today, 'yyyy-MM-dd'));
    else setDate(format(addDays(today, -1), 'yyyy-MM-dd'));
  };

  const incrementDate = (days: number) => {
    const newDate = addDays(parseISO(date), days);
    if (isAfter(startOfDay(newDate), today)) return;
    setDate(format(newDate, 'yyyy-MM-dd'));
  };

  const canIncrementDate = () => !isAfter(startOfDay(addDays(parseISO(date), 1)), today);
  const canDecrementDate = () => !isAfter(startOfDay(addDays(parseISO(date), -1)), today);

  const openDatePicker = () => {
    if (!DateTimePicker) {
      Alert.prompt(
        'Enter Date',
        'Format: YYYY-MM-DD',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Set',
            onPress: (inputText?: string) => {
              if (inputText && /^\d{4}-\d{2}-\d{2}$/.test(inputText)) {
                const inputDate = parseISO(inputText);
                if (!isAfter(startOfDay(inputDate), today) && !isNaN(inputDate.getTime())) {
                  setDate(inputText);
                } else {
                  Alert.alert('Invalid Date', 'Date cannot be in the future.');
                }
              } else {
                Alert.alert('Invalid Format', 'Use YYYY-MM-DD format.');
              }
            },
          },
        ],
        'plain-text',
        date
      );
      return;
    }
    setTempDate(parseISO(date));
    setShowDatePicker(true);
  };

  const confirmDateChange = () => {
    setDate(format(tempDate, 'yyyy-MM-dd'));
    setShowDatePicker(false);
  };

  const cancelDateChange = () => setShowDatePicker(false);

  const handleAmountChange = (val: string) => {
    setAmount(val);
    Animated.sequence([
      Animated.spring(amountScale, { toValue: 1.04, useNativeDriver: true, damping: 6 }),
      Animated.spring(amountScale, { toValue: 1, useNativeDriver: true, damping: 10 }),
    ]).start();
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    const num = parseFloat(amount);
    if (!amount || isNaN(num) || num <= 0) errs.amount = 'Enter a valid amount greater than 0';
    if (!categoryId && filteredCategories.length > 0) errs.category = 'Select a category';
    if (!date) errs.date = 'Select a date';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    onSubmit({
      type,
      amount: parseFloat(amount),
      categoryId: categoryId!,
      description: description.trim() || undefined,
      date,
    });
  };

  const cfg = TYPE_CONFIG[type];

  // Interpolated toggle thumb position
  const thumbLeft = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['2%', '51%'],
  });

  return (
    <Animated.View style={[styles.root, { opacity: cardFadeAnim }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
      >
        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          style={styles.scrollContainer}
        >

        {/* ── Hero Amount Block ── */}
        <View style={[styles.heroBlock, { backgroundColor: cfg.light, borderColor: cfg.mid }]}>
          {/* Type Toggle inside hero */}
          <View style={styles.typeToggleWrap}>
            <Animated.View style={[styles.toggleThumb, { left: thumbLeft, backgroundColor: cfg.color }]} />
            {(['expense', 'income'] as const).map((t) => {
              const c = TYPE_CONFIG[t];
              const active = type === t;
              return (
                <TouchableOpacity
                  key={t}
                  style={styles.toggleOption}
                  onPress={() => { setType(t); setCategoryId(null); setErrors({}); }}
                  activeOpacity={0.9}
                >
                  <MaterialCommunityIcons
                    name={c.icon}
                    size={15}
                    color={active ? '#fff' : '#9CA3AF'}
                  />
                  <Text style={[styles.toggleLabel, { color: active ? '#fff' : '#9CA3AF' }]}>
                    {c.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Large Amount */}
          <Animated.View style={[styles.amountRow, { transform: [{ scale: amountScale }] }]}>
            <Text style={[styles.currencyBig, { color: cfg.color }]}>
              {settings?.currencySymbol || '₹'}
            </Text>
            <TextInput
              value={amount}
              onChangeText={handleAmountChange}
              keyboardType="decimal-pad"
              mode="flat"
              placeholder="0.00"
              placeholderTextColor={cfg.mid}
              style={[styles.amountInput, { color: cfg.color }]}
              underlineColor="transparent"
              activeUnderlineColor="transparent"
              contentStyle={styles.amountContent}
            />
            {amount ? (
              <TouchableOpacity onPress={() => setAmount('')} style={styles.clearBtn}>
                <MaterialCommunityIcons name="close-circle" size={22} color={cfg.color + '80'} />
              </TouchableOpacity>
            ) : null}
          </Animated.View>

          {errors.amount && (
            <View style={styles.errorRow}>
              <MaterialCommunityIcons name="alert-circle-outline" size={13} color="#E53935" />
              <Text style={styles.errorTxt}>{errors.amount}</Text>
            </View>
          )}
        </View>

        {/* ── Date Stepper ── */}
        <View style={styles.card}>
          <View style={styles.cardLabelRow}>
            <MaterialCommunityIcons name="calendar-blank-outline" size={14} color="#9CA3AF" />
            <Text style={styles.cardLabel}>DATE</Text>
          </View>
          <View style={styles.dateRow}>
            <TouchableOpacity
              style={[styles.stepBtn, !canDecrementDate() && styles.stepBtnDisabled]}
              onPress={() => incrementDate(-1)}
              disabled={!canDecrementDate()}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons
                name="chevron-left"
                size={22}
                color={!canDecrementDate() ? '#E5E7EB' : '#111827'}
              />
            </TouchableOpacity>

            <TouchableOpacity style={styles.dateCenter} onPress={openDatePicker} activeOpacity={0.8}>
              <Text style={styles.dateValueText}>{getDateDisplayText()}</Text>
              <Text style={styles.dateDayText}>{format(selectedDate, 'EEEE, MMM d')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.stepBtn, !canIncrementDate() && styles.stepBtnDisabled]}
              onPress={() => incrementDate(1)}
              disabled={!canIncrementDate()}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons
                name="chevron-right"
                size={22}
                color={!canIncrementDate() ? '#E5E7EB' : '#111827'}
              />
            </TouchableOpacity>
          </View>

          {/* Quick chips */}
          <View style={styles.quickRow}>
            {['today', 'yesterday'].map((q) => {
              const isActive = q === 'today' ? isToday : isYesterday;
              return (
                <TouchableOpacity
                  key={q}
                  style={[styles.quickChip, isActive && { backgroundColor: cfg.color, borderColor: cfg.color }]}
                  onPress={() => setQuickDate(q as any)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.quickChipText, { color: isActive ? '#fff' : '#6B7280' }]}>
                    {q.charAt(0).toUpperCase() + q.slice(1)}
                  </Text>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              style={styles.quickChip}
              onPress={openDatePicker}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="calendar-search" size={13} color="#6B7280" />
              <Text style={[styles.quickChipText, { color: '#6B7280' }]}>Pick</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Category ── */}
        <View style={styles.card}>
          <View style={styles.cardLabelRow}>
            <MaterialCommunityIcons name="shape-outline" size={14} color="#9CA3AF" />
            <Text style={styles.cardLabel}>CATEGORY</Text>
            <TouchableOpacity 
              style={styles.manageBtn}
              onPress={() => {
                onCancel();
                router.push('/category/manage');
              }}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="cog-outline" size={14} color="#6B7280" />
              <Text style={styles.manageBtnText}>Manage</Text>
            </TouchableOpacity>
          </View>
          {errors.category && (
            <View style={[styles.errorRow, { marginBottom: 8 }]}>
              <MaterialCommunityIcons name="alert-circle-outline" size={13} color="#E53935" />
              <Text style={styles.errorTxt}>{errors.category}</Text>
            </View>
          )}

          {categoriesLoading ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTxt}>Loading…</Text>
            </View>
          ) : filteredCategories.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="shape-plus" size={28} color="#D1D5DB" />
              <Text style={styles.emptyTxt}>No {type} categories yet</Text>
              <TouchableOpacity style={styles.goSettingsBtn} onPress={onCancel}>
                <Text style={styles.goSettingsTxt}>Go to Settings →</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.catScrollContent}
            >
              {filteredCategories.map((cat, index) => {
                const selected = categoryId === cat.id;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.catChip,
                      {
                        backgroundColor: selected ? cat.color : '#F9FAFB',
                        borderColor: selected ? cat.color : '#F3F4F6',
                      },
                    ]}
                    onPress={() => {
                      setCategoryId(cat.id);
                      setErrors((e) => ({ ...e, category: '' }));
                    }}
                    activeOpacity={0.8}
                  >
                    <View
                      style={[
                        styles.catIconWrap,
                        { backgroundColor: selected ? 'rgba(255,255,255,0.25)' : cat.color + '18' },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={cat.icon as any}
                        size={16}
                        color={selected ? '#fff' : cat.color}
                      />
                    </View>
                    <Text
                      numberOfLines={1}
                      style={[styles.catChipLabel, { color: selected ? '#fff' : '#374151' }]}
                    >
                      {cat.name}
                    </Text>
                    {selected && (
                      <View style={styles.catCheck}>
                        <MaterialCommunityIcons name="check" size={9} color={cfg.color} />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>

        {/* ── Note ── */}
        <View style={styles.card}>
          <View style={styles.cardLabelRow}>
            <MaterialCommunityIcons name="text-box-check-outline" size={14} color="#9CA3AF" />
            <Text style={styles.cardLabel}>NOTE <Text style={styles.optionalTag}>· optional</Text></Text>
          </View>
          <TextInput
            value={description}
            onChangeText={setDescription}
            mode="flat"
            placeholder="What was this for?"
            placeholderTextColor="#D1D5DB"
            multiline
            numberOfLines={2}
            style={styles.noteInput}
            underlineColor="transparent"
            activeUnderlineColor={cfg.color}
            contentStyle={styles.noteContent}
            onFocus={() => {
              setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300);
            }}
          />
        </View>

        {/* ── Actions ── */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} activeOpacity={0.8}>
            <Text style={styles.cancelTxt}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: cfg.color }, loading && styles.submitDisabled]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <MaterialCommunityIcons name="loading" size={18} color="#fff" />
            ) : (
              <MaterialCommunityIcons name="check" size={18} color="#fff" />
            )}
            <Text style={styles.submitTxt}>{loading ? 'Saving…' : 'Save'}</Text>
          </TouchableOpacity>
        </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Calendar Modal ── */}
      <Portal>
        <Modal
          visible={showDatePicker}
          onDismiss={cancelDateChange}
          contentContainerStyle={styles.calendarModal}
        >
          <View style={styles.calendarHeader}>
            <Text style={styles.calendarTitle}>Select Date</Text>
            <IconButton icon="close" onPress={cancelDateChange} iconColor="#9CA3AF" size={18} />
          </View>

          <View style={styles.calendarBody}>
            <View style={styles.calendarNav}>
              <TouchableOpacity
                style={styles.calNavBtn}
                onPress={() => setTempDate(addDays(tempDate, -7))}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name="chevron-double-left" size={18} color="#374151" />
                <Text style={styles.calNavTxt}>−7</Text>
              </TouchableOpacity>

              <View style={styles.calDateDisplay}>
                <Text style={styles.calDateMain}>{format(tempDate, 'MMM d, yyyy')}</Text>
                <Text style={styles.calDateSub}>{format(tempDate, 'EEEE')}</Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.calNavBtn,
                  isAfter(addDays(tempDate, 7), today) && styles.calNavDisabled,
                ]}
                onPress={() => {
                  const nd = addDays(tempDate, 7);
                  if (!isAfter(nd, today)) setTempDate(nd);
                }}
                disabled={isAfter(addDays(tempDate, 7), today)}
                activeOpacity={0.7}
              >
                <Text style={[styles.calNavTxt, isAfter(addDays(tempDate, 7), today) && { color: '#D1D5DB' }]}>+7</Text>
                <MaterialCommunityIcons
                  name="chevron-double-right"
                  size={18}
                  color={isAfter(addDays(tempDate, 7), today) ? '#D1D5DB' : '#374151'}
                />
              </TouchableOpacity>
            </View>

            {DateTimePicker ? (
              <DateTimePicker
                value={tempDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'compact' : 'default'}
                onChange={(_, selectedDate) => {
                  if (selectedDate && !isAfter(startOfDay(selectedDate), today)) {
                    setTempDate(selectedDate);
                    if (Platform.OS === 'android') {
                      setDate(format(selectedDate, 'yyyy-MM-dd'));
                      setShowDatePicker(false);
                    }
                  }
                }}
                maximumDate={new Date()}
                style={styles.datePickerComponent}
              />
            ) : (
              <View style={styles.fallbackPicker}>
                <MaterialCommunityIcons name="calendar-remove" size={40} color="#E5E7EB" />
                <Text style={styles.fallbackTxt}>Not available in Expo Go</Text>
                <Text style={styles.fallbackSub}>Use the stepper buttons instead</Text>
              </View>
            )}

            <View style={styles.calQuickRow}>
              {[
                { label: 'Today', date: today },
                { label: 'Yesterday', date: addDays(today, -1) },
              ].map(({ label, date: d }) => (
                <TouchableOpacity
                  key={label}
                  style={styles.calQuickChip}
                  onPress={() => {
                    setTempDate(d);
                    setDate(format(d, 'yyyy-MM-dd'));
                    setShowDatePicker(false);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.calQuickTxt}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {Platform.OS === 'ios' && DateTimePicker && (
            <View style={styles.calActions}>
              <TouchableOpacity style={styles.calCancelBtn} onPress={cancelDateChange}>
                <Text style={styles.calCancelTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.calConfirmBtn, { backgroundColor: cfg.color }]}
                onPress={confirmDateChange}
              >
                <Text style={styles.calConfirmTxt}>Confirm</Text>
              </TouchableOpacity>
            </View>
          )}
        </Modal>
      </Portal>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F7F8FA',
  },
  scrollContainer: { flex: 1 },
  scroll: {
    padding: 14,
    paddingBottom: 24,
    gap: 10,
  },

  /* ── Hero Amount Block ── */
  heroBlock: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 14,
    paddingBottom: 12,
    marginBottom: 0,
  },

  /* Type Toggle */
  typeToggleWrap: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 3,
    marginBottom: 14,
    position: 'relative',
    height: 36,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  toggleThumb: {
    position: 'absolute',
    top: 3,
    width: '48%',
    height: 30,
    borderRadius: 7,
    zIndex: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  toggleOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    zIndex: 1,
    borderRadius: 7,
  },
  toggleLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.1,
  },

  /* Amount */
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  currencyBig: {
    fontSize: 26,
    fontWeight: '300',
    marginRight: 2,
    lineHeight: 40,
  },
  amountInput: {
    flex: 1,
    backgroundColor: 'transparent',
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  amountContent: {
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  clearBtn: { padding: 6 },

  /* ── Card ── */
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  cardLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 10,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 1.2,
    flex: 1,
  },
  manageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  manageBtnText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6B7280',
    letterSpacing: 0.3,
  },
  optionalTag: {
    fontWeight: '400',
    color: '#C4C9D4',
    letterSpacing: 0.5,
    textTransform: 'none',
  },

  /* ── Date ── */
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  stepBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnDisabled: {
    backgroundColor: '#FAFAFA',
  },
  dateCenter: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  dateValueText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.2,
  },
  dateDayText: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '500',
    marginTop: 1,
  },
  quickRow: {
    flexDirection: 'row',
    gap: 8,
  },
  quickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 14,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  quickChipText: {
    fontSize: 12,
    fontWeight: '600',
  },

  /* ── Category ── */
  catScrollContent: {
    paddingVertical: 4,
    gap: 8,
  },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    marginRight: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  catIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catChipLabel: {
    fontSize: 12,
    fontWeight: '600',
    maxWidth: 68,
  },
  catCheck: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Empty */
  emptyState: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  emptyTxt: {
    fontSize: 13,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  goSettingsBtn: {
    marginTop: 4,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  goSettingsTxt: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },

  /* ── Note ── */
  noteInput: {
    backgroundColor: '#F9FAFB',
    fontSize: 14,
    borderRadius: 10,
  },
  noteContent: {
    paddingTop: 8,
    paddingHorizontal: 10,
    minHeight: 48,
  },

  /* ── Errors ── */
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  errorTxt: {
    fontSize: 12,
    color: '#E53935',
    fontWeight: '500',
  },

  /* ── Actions ── */
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  cancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelTxt: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  submitBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  submitDisabled: { opacity: 0.6 },
  submitTxt: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.1,
  },

  /* ── Calendar Modal ── */
  calendarModal: {
    backgroundColor: '#fff',
    margin: 20,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.18,
    shadowRadius: 30,
    elevation: 20,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  calendarTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.3,
  },
  calendarBody: {
    padding: 20,
    gap: 16,
  },
  calendarNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  calNavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
  },
  calNavDisabled: {
    opacity: 0.4,
  },
  calNavTxt: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
  },
  calDateDisplay: {
    flex: 1,
    alignItems: 'center',
  },
  calDateMain: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.3,
  },
  calDateSub: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '500',
    marginTop: 2,
  },
  datePickerComponent: {
    alignSelf: 'center',
    height: 200,
    minWidth: 300,
  },
  fallbackPicker: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  fallbackTxt: {
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  fallbackSub: {
    fontSize: 12,
    color: '#D1D5DB',
    textAlign: 'center',
  },
  calQuickRow: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
  },
  calQuickChip: {
    paddingVertical: 9,
    paddingHorizontal: 20,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
  },
  calQuickTxt: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  calActions: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  calCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  calCancelTxt: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  calConfirmBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14,
    shadowRadius: 8,
    elevation: 4,
  },
  calConfirmTxt: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
});