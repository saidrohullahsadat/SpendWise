/**
 * storage.js
 * A thin wrapper around localStorage that owns every collection RoomMate
 * needs (members, expenses, settlements, categories, reminders, settings).
 * Nothing else in the app talks to localStorage directly.
 */

const STORAGE_KEYS = {
  members: 'rm_members',
  expenses: 'rm_expenses',
  settlements: 'rm_settlements',
  categories: 'rm_categories',
  reminders: 'rm_reminders',
  settings: 'rm_settings',
  seeded: 'rm_seeded_v1'
};

const Storage = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS[key]);
      if (raw === null) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      console.error('Storage read failed for', key, e);
      return fallback;
    }
  },

  set(key, value) {
    try {
      localStorage.setItem(STORAGE_KEYS[key], JSON.stringify(value));
      return true;
    } catch (e) {
      console.error('Storage write failed for', key, e);
      return false;
    }
  },

  members: {
    all() { return Storage.get('members', []); },
    save(list) { Storage.set('members', list); }
  },
  expenses: {
    all() { return Storage.get('expenses', []); },
    save(list) { Storage.set('expenses', list); }
  },
  settlements: {
    all() { return Storage.get('settlements', []); },
    save(list) { Storage.set('settlements', list); }
  },
  categories: {
    all() { return Storage.get('categories', []); },
    save(list) { Storage.set('categories', list); }
  },
  reminders: {
    all() { return Storage.get('reminders', []); },
    save(list) { Storage.set('reminders', list); }
  },
  settings: {
    get() { return Storage.get('settings', DEFAULT_SETTINGS); },
    save(obj) { Storage.set('settings', obj); }
  }
};

const DEFAULT_SETTINGS = {
  roomName: 'Our Apartment',
  currency: 'USD',
  currencySymbol: '$',
  defaultSplit: 'equal',
  profileName: 'Said Rohullah',
  profileEmail: 'said@roommate.app',
  notifyExpenses: true,
  notifyReminders: true,
  notifySettlements: true,
  appearance: 'light'
};

const DEFAULT_CATEGORIES = [
  { id: 'breakfast', name: 'Breakfast', icon: 'coffee', color: '#F59E0B' },
  { id: 'lunch', name: 'Lunch', icon: 'utensils', color: '#3B82F6' },
  { id: 'dinner', name: 'Dinner', icon: 'moon', color: '#8B5CF6' },
  { id: 'water', name: 'Water', icon: 'droplet', color: '#06B6D4' },
  { id: 'rent', name: 'Rent', icon: 'home', color: '#EF4444' },
  { id: 'electricity', name: 'Electricity', icon: 'zap', color: '#EAB308' },
  { id: 'internet', name: 'Internet', icon: 'wifi', color: '#10B981' },
  { id: 'snacks', name: 'Snacks', icon: 'cookie', color: '#F97316' },
  { id: 'transportation', name: 'Transportation', icon: 'car', color: '#6366F1' },
  { id: 'others', name: 'Others', icon: 'more-horizontal', color: '#64748B' }
];

/**
 * Seed the app with the sample data described in the brief. This only ever
 * runs once (guarded by rm_seeded_v1) so real user data is never overwritten.
 */
function seedInitialData() {
  if (localStorage.getItem(STORAGE_KEYS.seeded)) return;

  const members = [
    { id: 'm_said', name: 'Said Rohullah', email: 'said@roommate.app', isYou: true, avatarColor: '#3B82F6', joinedAt: '2025-01-01' },
    { id: 'm_ali', name: 'Ali', email: 'ali@roommate.app', isYou: false, avatarColor: '#8B5CF6', joinedAt: '2025-01-01' },
    { id: 'm_faisal', name: 'Faisal', email: 'faisal@roommate.app', isYou: false, avatarColor: '#F59E0B', joinedAt: '2025-01-01' }
  ];

  const allIds = members.map(m => m.id);

  const expenses = [
    {
      id: 'e_1', name: 'Dinner', category: 'dinner', amount: 28.50, date: '2025-05-25',
      paidBy: 'm_said', participants: allIds, splitType: 'equal', customSplits: null,
      notes: '', createdAt: '2025-05-25T19:00:00.000Z'
    },
    {
      id: 'e_2', name: 'Lunch', category: 'lunch', amount: 18.75, date: '2025-05-25',
      paidBy: 'm_ali', participants: allIds, splitType: 'equal', customSplits: null,
      notes: '', createdAt: '2025-05-25T13:00:00.000Z'
    },
    {
      id: 'e_3', name: 'Water', category: 'water', amount: 6.00, date: '2025-05-24',
      paidBy: 'm_faisal', participants: allIds, splitType: 'equal', customSplits: null,
      notes: '', createdAt: '2025-05-24T10:00:00.000Z'
    },
    {
      id: 'e_4', name: 'Breakfast', category: 'breakfast', amount: 12.00, date: '2025-05-24',
      paidBy: 'm_said', participants: allIds, splitType: 'equal', customSplits: null,
      notes: '', createdAt: '2025-05-24T08:00:00.000Z'
    },
    {
      id: 'e_5', name: 'Snacks', category: 'snacks', amount: 9.50, date: '2025-05-23',
      paidBy: 'm_ali', participants: allIds, splitType: 'equal', customSplits: null,
      notes: '', createdAt: '2025-05-23T17:00:00.000Z'
    },
    {
      id: 'e_6', name: 'Groceries Lunch', category: 'lunch', amount: 216.65, date: '2025-05-20',
      paidBy: 'm_said', participants: allIds, splitType: 'equal', customSplits: null,
      notes: 'Big weekly shop', createdAt: '2025-05-20T12:00:00.000Z'
    },
    {
      id: 'e_7', name: 'Dinner Out', category: 'dinner', amount: 181.50, date: '2025-05-18',
      paidBy: 'm_faisal', participants: allIds, splitType: 'equal', customSplits: null,
      notes: '', createdAt: '2025-05-18T20:00:00.000Z'
    },
    {
      id: 'e_8', name: 'Breakfast Cafe', category: 'breakfast', amount: 73.50, date: '2025-05-15',
      paidBy: 'm_ali', participants: allIds, splitType: 'equal', customSplits: null,
      notes: '', createdAt: '2025-05-15T09:00:00.000Z'
    },
    {
      id: 'e_9', name: 'Misc Supplies', category: 'others', amount: 40.00, date: '2025-05-10',
      paidBy: 'm_said', participants: allIds, splitType: 'equal', customSplits: null,
      notes: '', createdAt: '2025-05-10T15:00:00.000Z'
    }
  ];

  const settlements = [];

  const reminders = [
    { id: 'r_1', title: 'Rent Due', amount: 900, dueDate: '2025-06-01', category: 'rent', notes: 'Monthly rent for the apartment', status: 'upcoming', createdAt: '2025-05-01T00:00:00.000Z' },
    { id: 'r_2', title: 'Water Bill', amount: 45, dueDate: '2025-06-03', category: 'water', notes: '', status: 'upcoming', createdAt: '2025-05-01T00:00:00.000Z' }
  ];

  Storage.members.save(members);
  Storage.expenses.save(expenses);
  Storage.settlements.save(settlements);
  Storage.categories.save(DEFAULT_CATEGORIES);
  Storage.reminders.save(reminders);
  Storage.settings.save(DEFAULT_SETTINGS);

  localStorage.setItem(STORAGE_KEYS.seeded, '1');
}

seedInitialData();
