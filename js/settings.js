/**
 * settings.js
 * Room settings, profile, notification toggles, light/dark appearance,
 * and data export / clear (with confirmation before destructive action).
 */

const CURRENCIES = [
  { code: 'USD', symbol: '$', label: 'USD — US Dollar' },
  { code: 'EUR', symbol: '€', label: 'EUR — Euro' },
  { code: 'GBP', symbol: '£', label: 'GBP — British Pound' },
  { code: 'CAD', symbol: 'CA$', label: 'CAD — Canadian Dollar' },
  { code: 'INR', symbol: '₹', label: 'INR — Indian Rupee' },
  { code: 'AFN', symbol: '؋', label: 'AFN — Afghan Afghani' }
];

function loadSettingsForm() {
  const s = Storage.settings.get();

  document.getElementById('set-room-name').value = s.roomName;
  document.getElementById('set-currency').innerHTML = CURRENCIES.map(c => `<option value="${c.code}" ${c.code === s.currency ? 'selected' : ''}>${c.label}</option>`).join('');
  document.getElementById('set-split').value = s.defaultSplit;
  document.getElementById('set-name').value = s.profileName;
  document.getElementById('set-email').value = s.profileEmail;

  document.getElementById('set-notify-expenses').checked = s.notifyExpenses;
  document.getElementById('set-notify-reminders').checked = s.notifyReminders;
  document.getElementById('set-notify-settlements').checked = s.notifySettlements;

  document.querySelectorAll('.theme-option').forEach(opt => {
    opt.classList.toggle('theme-option--active', opt.dataset.theme === s.appearance);
  });
}

function saveField(patch) {
  const s = Storage.settings.get();
  Storage.settings.save({ ...s, ...patch });
}

document.addEventListener('DOMContentLoaded', () => {
  initShell({ title: 'Settings', subtitle: 'Configure your room and preferences' });
  loadSettingsForm();

  document.getElementById('room-settings-form').addEventListener('submit', e => {
    e.preventDefault();
    const currency = document.getElementById('set-currency').value;
    const currencyInfo = CURRENCIES.find(c => c.code === currency);
    saveField({
      roomName: document.getElementById('set-room-name').value.trim() || 'Our Apartment',
      currency,
      currencySymbol: currencyInfo ? currencyInfo.symbol : '$',
      defaultSplit: document.getElementById('set-split').value
    });
    showToast('Room settings saved.');
    renderSidebar();
    renderHeader();
  });

  document.getElementById('profile-form').addEventListener('submit', e => {
    e.preventDefault();
    saveField({
      profileName: document.getElementById('set-name').value.trim() || 'Roommate',
      profileEmail: document.getElementById('set-email').value.trim()
    });
    showToast('Profile updated.');
    renderHeader();
  });

  ['expenses', 'reminders', 'settlements'].forEach(key => {
    document.getElementById(`set-notify-${key}`).addEventListener('change', e => {
      saveField({ [`notify${key.charAt(0).toUpperCase() + key.slice(1)}`]: e.target.checked });
      showToast('Notification preference saved.');
    });
  });

  document.querySelectorAll('.theme-option').forEach(opt => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('.theme-option').forEach(o => o.classList.remove('theme-option--active'));
      opt.classList.add('theme-option--active');
      saveField({ appearance: opt.dataset.theme });
      applyAppearance();
      showToast(`Switched to ${opt.dataset.theme} mode.`);
    });
  });

  document.getElementById('export-data-btn').addEventListener('click', () => {
    const payload = {
      members: Storage.members.all(),
      expenses: Storage.expenses.all(),
      settlements: Storage.settlements.all(),
      categories: Storage.categories.all(),
      reminders: Storage.reminders.all(),
      settings: Storage.settings.get(),
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'roommate-data-export.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast('Data exported.');
  });

  document.getElementById('clear-data-btn').addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: 'Clear all data?',
      message: 'This will permanently delete every member, expense, settlement, and reminder. This cannot be undone.',
      confirmLabel: 'Clear Everything'
    });
    if (!ok) return;
    Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k));
    showToast('All data cleared. Reloading...');
    setTimeout(() => window.location.reload(), 900);
  });
});
