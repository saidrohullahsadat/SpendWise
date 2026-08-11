/**
 * utils.js
 * Formatting helpers, id generation, the core balance-calculation engine,
 * and small reusable UI helpers (toasts, confirm modal, initials).
 */

function generateId(prefix) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

function currencySymbol() {
  const s = Storage.settings.get();
  return s.currencySymbol || '$';
}

function formatMoney(amount) {
  const n = Number(amount) || 0;
  return `${currencySymbol()}${n.toFixed(2)}`;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + (dateStr.length === 10 ? 'T00:00:00' : ''));
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function daysUntil(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + 'T00:00:00');
  const diff = Math.round((target - today) / (1000 * 60 * 60 * 24));
  return diff;
}

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getMemberById(id) {
  return Storage.members.all().find(m => m.id === id);
}

function getCategoryById(id) {
  return Storage.categories.all().find(c => c.id === id) ||
    { id: 'others', name: 'Others', icon: 'more-horizontal', color: '#64748B' };
}

function getYouMember() {
  return Storage.members.all().find(m => m.isYou) || Storage.members.all()[0];
}

/* ---------------------------------------------------------------------- *
 * BALANCE ENGINE
 * ---------------------------------------------------------------------- *
 * For every expense:
 *   - the payer is credited the full amount they fronted
 *   - every participant (including the payer, if they took part) is
 *     debited their share of the expense
 * For every settlement marked "paid":
 *   - the person who paid the settlement is credited that amount
 *     (it reduces what they owe / increases what they're owed)
 *   - the person who received it is debited that amount
 *
 * The result is a single net balance per member:
 *   > 0  => the room owes this member money (they should receive)
 *   < 0  => this member owes the room money
 * ---------------------------------------------------------------------- */

function computeShares(expense) {
  // Returns { memberId: shareAmount } for a single expense.
  const shares = {};
  if (expense.splitType === 'custom' && expense.customSplits) {
    expense.participants.forEach(id => {
      shares[id] = Number(expense.customSplits[id]) || 0;
    });
  } else {
    const count = expense.participants.length || 1;
    const per = expense.amount / count;
    expense.participants.forEach(id => {
      shares[id] = per;
    });
  }
  return shares;
}

function computeBalances() {
  const members = Storage.members.all();
  const expenses = Storage.expenses.all();
  const settlements = Storage.settlements.all();

  const balances = {};
  members.forEach(m => { balances[m.id] = 0; });

  expenses.forEach(exp => {
    if (balances[exp.paidBy] === undefined) balances[exp.paidBy] = 0;
    balances[exp.paidBy] += Number(exp.amount);
    const shares = computeShares(exp);
    Object.entries(shares).forEach(([id, share]) => {
      if (balances[id] === undefined) balances[id] = 0;
      balances[id] -= share;
    });
  });

  settlements.forEach(s => {
    if (s.status !== 'completed') return;
    if (balances[s.from] === undefined) balances[s.from] = 0;
    if (balances[s.to] === undefined) balances[s.to] = 0;
    balances[s.from] += Number(s.amount); // paying down what they owe
    balances[s.to] -= Number(s.amount);   // received money they were owed
  });

  // Round to avoid floating point dust (e.g. 19.999999999998)
  Object.keys(balances).forEach(id => {
    balances[id] = Math.round(balances[id] * 100) / 100;
  });

  return balances;
}

/**
 * Simplifies the web of balances into the minimum number of
 * "X owes Y $Z" recommendations using a greedy debtor/creditor match.
 */
function simplifyDebts() {
  const balances = computeBalances();
  const debtors = [];
  const creditors = [];

  Object.entries(balances).forEach(([id, bal]) => {
    if (bal < -0.005) debtors.push({ id, amount: -bal });
    else if (bal > 0.005) creditors.push({ id, amount: bal });
  });

  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const result = [];
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    const amount = Math.min(debtor.amount, creditor.amount);

    if (amount > 0.005) {
      result.push({ from: debtor.id, to: creditor.id, amount: Math.round(amount * 100) / 100 });
    }

    debtor.amount -= amount;
    creditor.amount -= amount;

    if (debtor.amount < 0.005) i++;
    if (creditor.amount < 0.005) j++;
  }

  return result;
}

/* ---------------------------------------------------------------------- *
 * TOASTS
 * ---------------------------------------------------------------------- */

function showToast(message, type = 'success') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  const icon = type === 'success' ? 'check-circle' : type === 'error' ? 'alert-circle' : 'info';
  toast.innerHTML = `<i data-lucide="${icon}"></i><span>${message}</span>`;
  container.appendChild(toast);
  if (window.lucide) lucide.createIcons({ nodes: [toast] });

  requestAnimationFrame(() => toast.classList.add('toast--visible'));
  setTimeout(() => {
    toast.classList.remove('toast--visible');
    setTimeout(() => toast.remove(), 250);
  }, 3200);
}

/* ---------------------------------------------------------------------- *
 * CONFIRM MODAL (returns a Promise<boolean>)
 * ---------------------------------------------------------------------- */

function confirmDialog({ title, message, confirmLabel = 'Confirm', danger = true }) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal modal--small" role="dialog" aria-modal="true">
        <div class="modal__body">
          <div class="confirm-icon ${danger ? 'confirm-icon--danger' : ''}">
            <i data-lucide="${danger ? 'alert-triangle' : 'help-circle'}"></i>
          </div>
          <h3>${title}</h3>
          <p>${message}</p>
        </div>
        <div class="modal__footer">
          <button type="button" class="btn btn--ghost" data-action="cancel">Cancel</button>
          <button type="button" class="btn ${danger ? 'btn--danger' : 'btn--primary'}" data-action="confirm">${confirmLabel}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    if (window.lucide) lucide.createIcons({ nodes: [overlay] });
    requestAnimationFrame(() => overlay.classList.add('modal-overlay--visible'));

    function close(result) {
      overlay.classList.remove('modal-overlay--visible');
      setTimeout(() => overlay.remove(), 200);
      resolve(result);
    }

    overlay.querySelector('[data-action="cancel"]').addEventListener('click', () => close(false));
    overlay.querySelector('[data-action="confirm"]').addEventListener('click', () => close(true));
    overlay.addEventListener('click', e => { if (e.target === overlay) close(false); });
  });
}

const CHART_COLORS = ['#2563EB', '#7C3AED', '#F59E0B', '#06B6D4', '#F97316', '#16A34A', '#EF4444', '#64748B'];

function hexToSoft(hex) {
  if (!hex) return '#F1F5F9';
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16), g = parseInt(c.substring(2, 4), 16), b = parseInt(c.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, 0.12)`;
}

function debounce(fn, wait = 250) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}
