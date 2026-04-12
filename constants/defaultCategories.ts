import type { NewCategory } from '@/db/schema';

export const DEFAULT_CATEGORIES: NewCategory[] = [
  // Expense categories
  { name: 'Food & Dining', icon: 'food', color: '#E53935', type: 'expense', isDefault: true },
  { name: 'Transport', icon: 'car', color: '#1E88E5', type: 'expense', isDefault: true },
  { name: 'Entertainment', icon: 'movie', color: '#8E24AA', type: 'expense', isDefault: true },
  { name: 'Health', icon: 'hospital-box', color: '#00ACC1', type: 'expense', isDefault: true },
  { name: 'Shopping', icon: 'cart', color: '#F4511E', type: 'expense', isDefault: true },
  { name: 'Education', icon: 'school', color: '#3949AB', type: 'expense', isDefault: true },
  { name: 'Subscriptions', icon: 'credit-card-clock', color: '#546E7A', type: 'expense', isDefault: true },
  { name: 'Other Expense', icon: 'dots-horizontal-circle', color: '#757575', type: 'expense', isDefault: true },

  // Income categories
  { name: 'Salary', icon: 'cash', color: '#2E7D32', type: 'income', isDefault: true },
  { name: 'Freelance', icon: 'laptop', color: '#00897B', type: 'income', isDefault: true },
  { name: 'Investments', icon: 'chart-line', color: '#5E35B1', type: 'income', isDefault: true },
  { name: 'Gifts', icon: 'gift', color: '#C62828', type: 'income', isDefault: true },
  { name: 'Rental Income', icon: 'home-city', color: '#4E342E', type: 'income', isDefault: true },
  { name: 'Other Income', icon: 'dots-horizontal-circle', color: '#757575', type: 'income', isDefault: true },
];

export const CATEGORY_ICONS = [
  'food', 'car', 'home', 'flash', 'movie', 'hospital-box', 'cart', 'school',
  'face-woman', 'credit-card-clock', 'cash', 'laptop', 'chart-line', 'gift',
  'home-city', 'dots-horizontal-circle', 'airplane', 'baby-carriage', 'basketball',
  'beer', 'bike', 'book-open-variant', 'briefcase', 'bus', 'camera', 'cat',
  'cellphone', 'coffee', 'dog', 'dumbbell', 'fire', 'flower', 'football',
  'gamepad-variant', 'gas-station', 'guitar-acoustic', 'hammer', 'heart',
  'ice-cream', 'key', 'leaf', 'lightbulb', 'lock', 'map-marker', 'medical-bag',
  'microphone', 'music', 'palette', 'paw', 'phone', 'pill', 'pizza', 'printer',
  'ring', 'rocket', 'run', 'scissors-cutting', 'shield', 'shoe-formal',
  'silverware-fork-knife', 'smoking', 'snowflake', 'sofa', 'star', 'stethoscope',
  'store', 'swim', 'tag', 'television', 'tennis', 'ticket', 'tools', 'train',
  'tshirt-crew', 'umbrella', 'walk', 'washing-machine', 'water', 'wifi', 'wrench',
];

export const CATEGORY_COLORS = [
  '#E53935', '#D81B60', '#8E24AA', '#5E35B1', '#3949AB',
  '#1E88E5', '#00ACC1', '#00897B', '#43A047', '#2E7D32',
  '#7CB342', '#C0CA33', '#FDD835', '#FFB300', '#FB8C00',
  '#F4511E', '#6D4C41', '#546E7A', '#757575', '#F06292',
];
