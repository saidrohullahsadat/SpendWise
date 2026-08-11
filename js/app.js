/**
 * app.js
 * Renders the shared shell (sidebar + top header) on every page, wires up
 * the global "Add Expense" / "Settle Up" actions, and owns the Add/Edit
 * Expense modal so any page can open it.
 */

const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', icon: 'layout-dashboard', href: 'index.html' },
  { key: 'expenses', label: 'Expenses', icon: 'receipt', href: 'pages/expenses.html' },
  { key: 'categories', label: 'Categories', icon: 'tag', href: 'pages/categories.html' },
  { key: 'members', label: 'Members', icon: 'users', href: 'pages/members.html' },
  { key: 'settle-up', label: 'Settle Up', icon: 'handshake', href: 'pages/settle-up.html' },
  { key: 'reports', label: 'Reports', icon: 'bar-chart-2', href: 'pages/reports.html' },
  { key: 'reminders', label: 'Reminders', icon: 'bell', href: 'pages/reminders.html' },
  { key: 'settings', label: 'Settings', icon: 'settings', href: 'pages/settings.html' }
];

function rootPrefix() {
  return document.body.dataset.root === 'pages' ? '../' : '';
}

function resolveHref(href) {
  const prefix = rootPrefix();
  return prefix + href;
}

function applyAppearance() {
  const settings = Storage.settings.get();
  document.documentElement.dataset.theme = settings.appearance === 'dark' ? 'dark' : 'light';
}

function renderSidebar() {
  const mount = document.getElementById('sidebar-mount');
  if (!mount) return;
  const active = document.body.dataset.page;
  const balances = computeBalances();
  const you = getYouMember();
  const yourBalance = you ? (balances[you.id] || 0) : 0;
  const isPositive = yourBalance >= 0;

  mount.innerHTML = `
    <aside class="sidebar" id="sidebar">
      <div class="sidebar__brand">
        <div class="sidebar__brand-icon"><i data-lucide="home"></i></div>
        <div>
          <div class="sidebar__brand-name">RoomMate</div>
          <div class="sidebar__brand-tag">Easy Together</div>
        </div>
        <button class="sidebar__close" id="sidebar-close" aria-label="Close menu"><i data-lucide="x"></i></button>
      </div>

      <nav class="sidebar__nav" aria-label="Main navigation">
        ${NAV_ITEMS.map(item => `
          <a class="sidebar__link ${active === item.key ? 'sidebar__link--active' : ''}" href="${resolveHref(item.href)}">
            <i data-lucide="${item.icon}"></i>
            <span>${item.label}</span>
          </a>
        `).join('')}
      </nav>

      <div class="sidebar__balance">
        <div class="sidebar__balance-label">Current Balance</div>
        <div class="sidebar__balance-sub">${isPositive ? 'You will receive' : 'You owe'}</div>
        <div class="sidebar__balance-amount ${isPositive ? 'text-green' : 'text-red'}">${formatMoney(Math.abs(yourBalance))}</div>
      </div>
    </aside>
    <div class="sidebar__scrim" id="sidebar-scrim"></div>
  `;

  if (window.lucide) lucide.createIcons({ nodes: [mount] });

  document.getElementById('sidebar-scrim').addEventListener('click', closeSidebar);
  document.getElementById('sidebar-close').addEventListener('click', closeSidebar);
}

function openSidebar() {
  document.getElementById('sidebar').classList.add('sidebar--open');
  document.getElementById('sidebar-scrim').classList.add('sidebar__scrim--visible');
}
function closeSidebar() {
  const sidebar = document.getElementById('sidebar');
  const scrim = document.getElementById('sidebar-scrim');
  if (sidebar) sidebar.classList.remove('sidebar--open');
  if (scrim) scrim.classList.remove('sidebar__scrim--visible');
}

function renderHeader(titleOverride, subtitleOverride) {
  const mount = document.getElementById('header-mount');
  if (!mount) return;
  const settings = Storage.settings.get();
  const title = titleOverride || 'Room Expense Manager';
  const subtitle = subtitleOverride || 'Manage shared expenses easily';
  const reminders = Storage.reminders.all().filter(r => r.status !== 'paid');
  const dueSoon = reminders.filter(r => ['overdue', 'due-today'].includes(reminderStatus(r)));

  mount.innerHTML = `
    <header class="topheader">
      <div class="topheader__left">
        <button class="topheader__menu" id="menu-toggle" aria-label="Open menu"><i data-lucide="menu"></i></button>
        <div>
          <h1 class="topheader__title">${title}</h1>
          <p class="topheader__subtitle">${subtitle}</p>
        </div>
      </div>
      <div class="topheader__right">
        <div class="topheader__actions">
          <button class="btn btn--primary" id="btn-add-expense"><i data-lucide="plus"></i><span>Add Expense</span></button>
          <button class="btn btn--secondary" id="btn-settle-up"><i data-lucide="handshake"></i><span>Settle Up</span></button>
        </div>
        <button class="topheader__icon-btn" id="btn-notifications" aria-label="Notifications">
          <i data-lucide="bell"></i>
          ${dueSoon.length ? `<span class="badge">${dueSoon.length}</span>` : ''}
        </button>
        <div class="topheader__user">
          <div class="avatar" style="background:${settings.avatarColor || '#3B82F6'}">${getInitials(settings.profileName)}</div>
          <div class="topheader__user-info">
            <div class="topheader__user-name">${settings.profileName}</div>
            <div class="topheader__user-role">Admin</div>
          </div>
          <i data-lucide="chevron-down"></i>
        </div>
      </div>
    </header>
  `;

  if (window.lucide) lucide.createIcons({ nodes: [mount] });

  document.getElementById('menu-toggle').addEventListener('click', openSidebar);
  document.getElementById('btn-add-expense').addEventListener('click', () => openExpenseModal());
  document.getElementById('btn-settle-up').addEventListener('click', () => {
    window.location.href = resolveHref('pages/settle-up.html');
  });
  document.getElementById('btn-notifications').addEventListener('click', () => {
    window.location.href = resolveHref('pages/reminders.html');
  });
}

function reminderStatus(reminder) {
  if (reminder.status === 'paid') return 'paid';
  const days = daysUntil(reminder.dueDate);
  if (days < 0) return 'overdue';
  if (days === 0) return 'due-today';
  return 'upcoming';
}

/* ---------------------------------------------------------------------- *
 * ADD / EDIT EXPENSE MODAL — shared across every page
 * ---------------------------------------------------------------------- */

function openExpenseModal(expenseId = null) {
  const members = Storage.members.all();
  const categories = Storage.categories.all();
  const existing = expenseId ? Storage.expenses.all().find(e => e.id === expenseId) : null;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="expense-modal-title">
      <div class="modal__header">
        <h3 id="expense-modal-title">${existing ? 'Edit Expense' : 'Add Expense'}</h3>
        <button class="modal__close" type="button" data-action="close" aria-label="Close"><i data-lucide="x"></i></button>
      </div>
      <form class="modal__body" id="expense-form">
        <div class="form-group">
          <label for="f-name">Expense Name</label>
          <input type="text" id="f-name" placeholder="e.g. Dinner" value="${existing ? escapeHtml(existing.name) : ''}" required>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="f-category">Category</label>
            <select id="f-category">
              ${categories.map(c => `<option value="${c.id}" ${existing && existing.category === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label for="f-amount">Amount</label>
            <input type="number" id="f-amount" min="0.01" step="0.01" placeholder="30.00" value="${existing ? existing.amount : ''}" required>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="f-date">Date</label>
            <input type="date" id="f-date" value="${existing ? existing.date : new Date().toISOString().slice(0, 10)}" required>
          </div>
          <div class="form-group">
            <label for="f-paidby">Paid By</label>
            <select id="f-paidby">
              ${members.map(m => `<option value="${m.id}" ${existing ? existing.paidBy === m.id : m.isYou}>${m.name}${m.isYou ? ' (You)' : ''}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="form-group">
          <label>Split Between</label>
          <div class="checkbox-list" id="f-participants">
            ${members.map(m => `
              <label class="checkbox-item">
                <input type="checkbox" value="${m.id}" ${!existing || existing.participants.includes(m.id) ? 'checked' : ''}>
                <span>${m.name}${m.isYou ? ' (You)' : ''}</span>
              </label>
            `).join('')}
          </div>
        </div>

        <div class="form-group">
          <label>Split Type</label>
          <div class="segmented" id="f-split-type">
            <button type="button" class="segmented__option ${(!existing || existing.splitType === 'equal') ? 'segmented__option--active' : ''}" data-value="equal">Split Equally</button>
            <button type="button" class="segmented__option ${existing && existing.splitType === 'custom' ? 'segmented__option--active' : ''}" data-value="custom">Custom Amount</button>
          </div>
        </div>

        <div class="form-group" id="f-custom-wrap" style="display:${existing && existing.splitType === 'custom' ? 'block' : 'none'}">
          <label>Custom Amounts</label>
          <div id="f-custom-list" class="custom-split-list"></div>
          <div class="custom-split-total" id="f-custom-total"></div>
        </div>

        <div class="form-group">
          <label for="f-notes">Notes <span class="optional">(optional)</span></label>
          <textarea id="f-notes" rows="2" placeholder="Add a note...">${existing ? escapeHtml(existing.notes || '') : ''}</textarea>
        </div>

        <p class="form-error" id="f-error" hidden></p>
      </form>
      <div class="modal__footer">
        <button type="button" class="btn btn--ghost" data-action="close">Cancel</button>
        <button type="submit" form="expense-form" class="btn btn--primary" id="f-save">Save Expense</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  if (window.lucide) lucide.createIcons({ nodes: [overlay] });
  requestAnimationFrame(() => overlay.classList.add('modal-overlay--visible'));

  const close = () => {
    overlay.classList.remove('modal-overlay--visible');
    setTimeout(() => overlay.remove(), 200);
  };
  overlay.querySelectorAll('[data-action="close"]').forEach(b => b.addEventListener('click', close));
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  const splitTypeButtons = overlay.querySelectorAll('#f-split-type .segmented__option');
  const customWrap = overlay.querySelector('#f-custom-wrap');
  const customList = overlay.querySelector('#f-custom-list');
  const amountInput = overlay.querySelector('#f-amount');
  const participantsWrap = overlay.querySelector('#f-participants');

  function currentSplitType() {
    return overlay.querySelector('.segmented__option--active').dataset.value;
  }

  function checkedParticipants() {
    return Array.from(participantsWrap.querySelectorAll('input:checked')).map(i => i.value);
  }

  function renderCustomInputs() {
    const ids = checkedParticipants();
    const existingVals = existing && existing.customSplits ? existing.customSplits : {};
    customList.innerHTML = ids.map(id => {
      const m = getMemberById(id);
      const val = existingVals[id] !== undefined ? existingVals[id] : '';
      return `
        <div class="custom-split-row">
          <span>${m ? m.name : 'Member'}</span>
          <input type="number" min="0" step="0.01" class="custom-split-input" data-member="${id}" value="${val}" placeholder="0.00">
        </div>`;
    }).join('');
    updateCustomTotal();
    customList.querySelectorAll('.custom-split-input').forEach(inp => inp.addEventListener('input', updateCustomTotal));
  }

  function updateCustomTotal() {
    const totalEl = overlay.querySelector('#f-custom-total');
    const inputs = customList.querySelectorAll('.custom-split-input');
    let sum = 0;
    inputs.forEach(i => sum += Number(i.value) || 0);
    const target = Number(amountInput.value) || 0;
    const diff = Math.round((target - sum) * 100) / 100;
    totalEl.innerHTML = `Assigned: <strong>${formatMoney(sum)}</strong> of ${formatMoney(target)}` +
      (Math.abs(diff) > 0.005 ? ` <span class="text-red">(${diff > 0 ? 'remaining' : 'over by'} ${formatMoney(Math.abs(diff))})</span>` : ` <span class="text-green">✓ matches total</span>`);
  }

  splitTypeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      splitTypeButtons.forEach(b => b.classList.remove('segmented__option--active'));
      btn.classList.add('segmented__option--active');
      const isCustom = btn.dataset.value === 'custom';
      customWrap.style.display = isCustom ? 'block' : 'none';
      if (isCustom) renderCustomInputs();
    });
  });

  participantsWrap.querySelectorAll('input[type=checkbox]').forEach(cb => {
    cb.addEventListener('change', () => {
      if (currentSplitType() === 'custom') renderCustomInputs();
    });
  });

  amountInput.addEventListener('input', () => {
    if (currentSplitType() === 'custom') updateCustomTotal();
  });

  if (existing && existing.splitType === 'custom') renderCustomInputs();

  overlay.querySelector('#expense-form').addEventListener('submit', e => {
    e.preventDefault();
    const errorEl = overlay.querySelector('#f-error');
    errorEl.hidden = true;

    const name = overlay.querySelector('#f-name').value.trim();
    const category = overlay.querySelector('#f-category').value;
    const amount = Number(amountInput.value);
    const date = overlay.querySelector('#f-date').value;
    const paidBy = overlay.querySelector('#f-paidby').value;
    const participants = checkedParticipants();
    const splitType = currentSplitType();
    const notes = overlay.querySelector('#f-notes').value.trim();

    if (!name) return showError('Please enter an expense name.');
    if (!amount || amount <= 0) return showError('Please enter a valid amount greater than 0.');
    if (participants.length === 0) return showError('Select at least one participant to split between.');

    let customSplits = null;
    if (splitType === 'custom') {
      customSplits = {};
      let sum = 0;
      customList.querySelectorAll('.custom-split-input').forEach(inp => {
        const v = Number(inp.value) || 0;
        customSplits[inp.dataset.member] = v;
        sum += v;
      });
      if (Math.abs(sum - amount) > 0.01) {
        return showError(`Custom amounts must add up to ${formatMoney(amount)}. Currently ${formatMoney(sum)}.`);
      }
    }

    function showError(msg) {
      errorEl.textContent = msg;
      errorEl.hidden = false;
    }

    const expenses = Storage.expenses.all();
    if (existing) {
      const idx = expenses.findIndex(x => x.id === existing.id);
      expenses[idx] = { ...existing, name, category, amount, date, paidBy, participants, splitType, customSplits, notes };
      Storage.expenses.save(expenses);
      showToast('Expense updated successfully.');
    } else {
      expenses.unshift({
        id: generateId('e'), name, category, amount, date, paidBy, participants,
        splitType, customSplits, notes, createdAt: new Date().toISOString()
      });
      Storage.expenses.save(expenses);
      showToast('Expense added successfully.');
    }

    close();
    renderSidebar();
    if (typeof window.onDataChanged === 'function') window.onDataChanged();
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/* ---------------------------------------------------------------------- *
 * BOOT
 * ---------------------------------------------------------------------- */

function initShell(options = {}) {
  applyAppearance();
  renderSidebar();
  renderHeader(options.title, options.subtitle);
}

document.addEventListener('DOMContentLoaded', () => {
  if (typeof pageInit === 'function') {
    // Individual pages define pageInit(); app.js just wires the shell.
  }
});
