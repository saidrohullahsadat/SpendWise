/**
 * expenses.js
 * Full expense list: search, filters (category / member / date), sorting,
 * table view on desktop + card view on mobile, and row actions.
 */

let expenseFilters = { search: '', category: 'all', member: 'all', date: 'all', sort: 'date-desc' };

function populateExpenseFilterOptions() {
  const categories = Storage.categories.all();
  const members = Storage.members.all();

  document.getElementById('filter-category').innerHTML =
    `<option value="all">All Categories</option>` +
    categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

  document.getElementById('filter-member').innerHTML =
    `<option value="all">All Members</option>` +
    members.map(m => `<option value="${m.id}">${m.name}${m.isYou ? ' (You)' : ''}</option>`).join('');
}

function getFilteredExpenses() {
  let list = [...Storage.expenses.all()];
  const { search, category, member, date, sort } = expenseFilters;

  if (search.trim()) {
    const q = search.trim().toLowerCase();
    list = list.filter(e => e.name.toLowerCase().includes(q) || (e.notes || '').toLowerCase().includes(q));
  }
  if (category !== 'all') list = list.filter(e => e.category === category);
  if (member !== 'all') list = list.filter(e => e.paidBy === member || e.participants.includes(member));

  if (date !== 'all') {
    const now = new Date();
    list = list.filter(e => {
      const d = new Date(e.date + 'T00:00:00');
      if (date === 'this-week') {
        const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7);
        return d >= weekAgo;
      }
      if (date === 'this-month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      if (date === 'last-month') {
        const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        return d.getMonth() === lm.getMonth() && d.getFullYear() === lm.getFullYear();
      }
      return true;
    });
  }

  const sorters = {
    'date-desc': (a, b) => new Date(b.date) - new Date(a.date),
    'date-asc': (a, b) => new Date(a.date) - new Date(b.date),
    'amount-desc': (a, b) => b.amount - a.amount,
    'amount-asc': (a, b) => a.amount - b.amount,
    'name-asc': (a, b) => a.name.localeCompare(b.name)
  };
  list.sort(sorters[sort] || sorters['date-desc']);
  return list;
}

function renderExpensesTable() {
  const list = getFilteredExpenses();
  const tbody = document.getElementById('expenses-tbody');
  const cardList = document.getElementById('expenses-cards');
  const emptyEl = document.getElementById('expenses-empty');
  const countEl = document.getElementById('expenses-count');

  countEl.textContent = `${list.length} expense${list.length === 1 ? '' : 's'}`;

  if (!list.length) {
    tbody.innerHTML = '';
    cardList.innerHTML = '';
    emptyEl.style.display = 'block';
    return;
  }
  emptyEl.style.display = 'none';

  tbody.innerHTML = list.map(e => rowHtml(e)).join('');
  cardList.innerHTML = list.map(e => cardHtml(e)).join('');

  if (window.lucide) lucide.createIcons({ nodes: [tbody, cardList] });
  attachRowActions();
}

function rowHtml(e) {
  const cat = getCategoryById(e.category);
  const payer = getMemberById(e.paidBy);
  const participants = e.participants.map(id => getMemberById(id)).filter(Boolean);
  return `
    <tr data-id="${e.id}">
      <td>
        <div class="cell-flex">
          <div class="list-icon" style="width:34px;height:34px;background:${hexToSoft(cat.color)};color:${cat.color}"><i data-lucide="${cat.icon}" style="width:16px;height:16px"></i></div>
          <div>
            <div class="cell-title">${escapeHtml(e.name)}</div>
            ${e.notes ? `<div class="cell-sub">${escapeHtml(e.notes)}</div>` : ''}
          </div>
        </div>
      </td>
      <td><span class="tag-pill" style="background:${hexToSoft(cat.color)};color:${cat.color}"><span class="dot" style="background:${cat.color}"></span>${cat.name}</span></td>
      <td><strong>${formatMoney(e.amount)}</strong></td>
      <td>${payer ? payer.name : '—'}</td>
      <td>${participants.length} member${participants.length === 1 ? '' : 's'}</td>
      <td>${formatDate(e.date)}</td>
      <td>${e.splitType === 'custom' ? 'Custom' : 'Equal'}</td>
      <td>
        <div class="actions-cell">
          <button class="icon-btn" data-action="view" title="View"><i data-lucide="eye"></i></button>
          <button class="icon-btn" data-action="edit" title="Edit"><i data-lucide="edit-2"></i></button>
          <button class="icon-btn icon-btn--danger" data-action="delete" title="Delete"><i data-lucide="trash-2"></i></button>
        </div>
      </td>
    </tr>`;
}

function cardHtml(e) {
  const cat = getCategoryById(e.category);
  const payer = getMemberById(e.paidBy);
  return `
    <div class="data-card" data-id="${e.id}">
      <div class="data-card__top">
        <div class="cell-flex">
          <div class="list-icon" style="width:36px;height:36px;background:${hexToSoft(cat.color)};color:${cat.color}"><i data-lucide="${cat.icon}" style="width:16px;height:16px"></i></div>
          <div>
            <div class="cell-title">${escapeHtml(e.name)}</div>
            <div class="cell-sub">${cat.name} · ${formatDate(e.date)}</div>
          </div>
        </div>
        <strong>${formatMoney(e.amount)}</strong>
      </div>
      <div class="data-card__row"><span>Paid by</span><strong>${payer ? payer.name : '—'}</strong></div>
      <div class="data-card__row"><span>Participants</span><strong>${e.participants.length}</strong></div>
      <div class="data-card__row"><span>Split</span><strong>${e.splitType === 'custom' ? 'Custom' : 'Equal'}</strong></div>
      <div class="data-card__actions">
        <button class="btn btn--ghost btn--sm" data-action="view">View</button>
        <button class="btn btn--ghost btn--sm" data-action="edit">Edit</button>
        <button class="btn btn--ghost btn--sm" data-action="delete" style="color:var(--red-600)">Delete</button>
      </div>
    </div>`;
}

function attachRowActions() {
  document.querySelectorAll('#expenses-tbody [data-action], #expenses-cards [data-action]').forEach(btn => {
    btn.addEventListener('click', async e => {
      const container = btn.closest('[data-id]');
      const id = container.dataset.id;
      const action = btn.dataset.action;
      if (action === 'edit') openExpenseModal(id);
      if (action === 'view') openExpenseViewModal(id);
      if (action === 'delete') {
        const ok = await confirmDialog({
          title: 'Delete this expense?',
          message: 'This will permanently remove the expense and recalculate everyone\'s balances.',
          confirmLabel: 'Delete Expense'
        });
        if (ok) {
          const list = Storage.expenses.all().filter(x => x.id !== id);
          Storage.expenses.save(list);
          showToast('Expense deleted.');
          renderExpensesTable();
          renderSidebar();
        }
      }
    });
  });
}

function openExpenseViewModal(id) {
  const e = Storage.expenses.all().find(x => x.id === id);
  if (!e) return;
  const cat = getCategoryById(e.category);
  const payer = getMemberById(e.paidBy);
  const shares = computeShares(e);

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <div class="modal__header">
        <h3>${escapeHtml(e.name)}</h3>
        <button class="modal__close" data-action="close"><i data-lucide="x"></i></button>
      </div>
      <div class="modal__body">
        <div class="data-card__row"><span>Category</span><strong>${cat.name}</strong></div>
        <div class="data-card__row"><span>Amount</span><strong>${formatMoney(e.amount)}</strong></div>
        <div class="data-card__row"><span>Date</span><strong>${formatDate(e.date)}</strong></div>
        <div class="data-card__row"><span>Paid by</span><strong>${payer ? payer.name : '—'}</strong></div>
        <div class="data-card__row"><span>Split type</span><strong>${e.splitType === 'custom' ? 'Custom' : 'Equal'}</strong></div>
        <div class="divider"></div>
        <label>Shares</label>
        ${Object.entries(shares).map(([id, amt]) => {
    const m = getMemberById(id);
    return `<div class="data-card__row"><span>${m ? m.name : id}</span><strong>${formatMoney(amt)}</strong></div>`;
  }).join('')}
        ${e.notes ? `<div class="divider"></div><label>Notes</label><p class="text-muted">${escapeHtml(e.notes)}</p>` : ''}
      </div>
      <div class="modal__footer">
        <button class="btn btn--ghost" data-action="close">Close</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  if (window.lucide) lucide.createIcons({ nodes: [overlay] });
  requestAnimationFrame(() => overlay.classList.add('modal-overlay--visible'));
  const close = () => { overlay.classList.remove('modal-overlay--visible'); setTimeout(() => overlay.remove(), 200); };
  overlay.querySelectorAll('[data-action="close"]').forEach(b => b.addEventListener('click', close));
  overlay.addEventListener('click', e2 => { if (e2.target === overlay) close(); });
}

window.onDataChanged = () => {
  populateExpenseFilterOptions();
  renderExpensesTable();
  renderSidebar();
};

document.addEventListener('DOMContentLoaded', () => {
  initShell({ title: 'Expenses', subtitle: 'Every shared expense in one place' });
  populateExpenseFilterOptions();
  renderExpensesTable();

  document.getElementById('search-input').addEventListener('input', debounce(e => {
    expenseFilters.search = e.target.value;
    renderExpensesTable();
  }, 200));
  document.getElementById('filter-category').addEventListener('change', e => { expenseFilters.category = e.target.value; renderExpensesTable(); });
  document.getElementById('filter-member').addEventListener('change', e => { expenseFilters.member = e.target.value; renderExpensesTable(); });
  document.getElementById('filter-date').addEventListener('change', e => { expenseFilters.date = e.target.value; renderExpensesTable(); });
  document.getElementById('filter-sort').addEventListener('change', e => { expenseFilters.sort = e.target.value; renderExpensesTable(); });
  document.getElementById('page-add-expense').addEventListener('click', () => openExpenseModal());
});
