import { MD3LightTheme, MD3DarkTheme } from 'react-native-paper';

const brandColors = {
  primary: '#1B5E20',
  primaryLight: '#4C8C4A',
  primaryDark: '#003300',
  secondary: '#00695C',
  accent: '#FFC107',
  income: '#2E7D32',
  expense: '#C62828',
  lent: '#E65100',
  borrowed: '#1565C0',
  warning: '#F57F17',
  success: '#2E7D32',
  danger: '#C62828',
  surface: '#FFFFFF',
  background: '#F5F5F5',
};

export const lightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: brandColors.primary,
    primaryContainer: '#C8E6C9',
    secondary: brandColors.secondary,
    secondaryContainer: '#B2DFDB',
    tertiary: brandColors.accent,
    surface: brandColors.surface,
    background: brandColors.background,
    error: brandColors.danger,
    surfaceVariant: '#E8F5E9',
    outline: '#BDBDBD',
  },
  custom: brandColors,
};

export const darkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#66BB6A',
    primaryContainer: '#1B5E20',
    secondary: '#4DB6AC',
    secondaryContainer: '#00695C',
    tertiary: '#FFD54F',
    surface: '#1E1E1E',
    background: '#121212',
    error: '#EF5350',
    surfaceVariant: '#2E2E2E',
    outline: '#616161',
  },
  custom: {
    ...brandColors,
    income: '#66BB6A',
    expense: '#EF5350',
    surface: '#1E1E1E',
    background: '#121212',
  },
};

export type AppTheme = typeof lightTheme;
