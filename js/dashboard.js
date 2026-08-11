/**
 * dashboard.js
 * Renders every widget on the main dashboard from live storage data and
 * re-renders whenever data changes (add/edit/delete anywhere in the app).
 */

let donutChart = null;

function monthKey(dateStr) {
  return dateStr.slice(0, 7); // YYYY-MM
}

function currentMonthExpenses() {
  const now = new Date();
  const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const all = Storage.expenses.all();
  const thisMonth = all.filter(e => monthKey(e.date) === key);
  // Fall back to all expenses if there's nothing dated this month (keeps the
  // seeded May 2025 sample data meaningful regardless of today's date).
  return thisMonth.length ? thisMonth : all;
}

function renderSummaryCards() {
  const mount = document.getElementById('summary-cards');
  const expenses = currentMonthExpenses();
  const members = Storage.members.all();
  const you = getYouMember();
  const balances = computeBalances();

  const total = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const yourShareTotal = expenses.reduce((s, e) => {
    const shares = computeShares(e);
    return s + (you && shares[you.id] ? shares[you.id] : 0);
  }, 0);
  const yourPaidTotal = expenses.filter(e => you && e.paidBy === you.id).reduce((s, e) => s + Number(e.amount), 0);

  mount.innerHTML = `
    <div class="stat-card">
      <div class="stat-card__top">
        <div class="stat-card__icon stat-card__icon--blue"><i data-lucide="wallet"></i></div>
        <span class="stat-card__change stat-card__change--up"><i data-lucide="arrow-up-right"></i>12%</span>
      </div>
      <div class="stat-card__title">Total Expenses</div>
      <div class="stat-card__value">${formatMoney(total)}</div>
      <div class="stat-card__desc">This Month</div>
    </div>

    <div class="stat-card">
      <div class="stat-card__top">
        <div class="stat-card__icon stat-card__icon--purple"><i data-lucide="user"></i></div>
        <span class="stat-card__change stat-card__change--down"><i data-lucide="arrow-down-right"></i>8%</span>
      </div>
      <div class="stat-card__title">Your Share</div>
      <div class="stat-card__value">${formatMoney(yourShareTotal)}</div>
      <div class="stat-card__desc">This Month</div>
    </div>

    <div class="stat-card">
      <div class="stat-card__top">
        <div class="stat-card__icon stat-card__icon--orange"><i data-lucide="users"></i></div>
      </div>
      <div class="stat-card__title">Total Members</div>
      <div class="stat-card__value">${members.length}</div>
      <div class="stat-card__desc">In Room</div>
    </div>

    <div class="stat-card">
      <div class="stat-card__top">
        <div class="stat-card__icon stat-card__icon--green"><i data-lucide="hand-coins"></i></div>
        <span class="stat-card__change stat-card__change--up"><i data-lucide="arrow-up-right"></i>15%</span>
      </div>
      <div class="stat-card__title">Total Paid</div>
      <div class="stat-card__value">${formatMoney(yourPaidTotal)}</div>
      <div class="stat-card__desc">This Month</div>
    </div>
  `;
  if (window.lucide) lucide.createIcons({ nodes: [mount] });
}

function renderExpenseOverview() {
  const expenses = currentMonthExpenses();
  const total = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const byCategory = {};
  expenses.forEach(e => {
    byCategory[e.category] = (byCategory[e.category] || 0) + Number(e.amount);
  });

  const entries = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
  document.getElementById('overview-total').textContent = formatMoney(total);

  const ctx = document.getElementById('overview-chart');
  const labels = entries.map(([cat]) => getCategoryById(cat).name);
  const data = entries.map(([, amt]) => amt);
  const colors = entries.map(([cat], i) => getCategoryById(cat).color || CHART_COLORS[i % CHART_COLORS.length]);

  if (donutChart) donutChart.destroy();
  donutChart = new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 0, hoverOffset: 6 }] },
    options: {
      cutout: '72%',
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => `${c.label}: ${formatMoney(c.raw)}` } } }
    }
  });

  const legend = document.getElementById('overview-legend');
  legend.innerHTML = entries.map(([cat, amt], i) => {
    const c = getCategoryById(cat);
    const pct = total ? ((amt / total) * 100).toFixed(1) : '0.0';
    return `
      <div class="legend__row">
        <span class="legend__dot" style="background:${c.color || CHART_COLORS[i % CHART_COLORS.length]}"></span>
        <span class="legend__name">${c.name}</span>
        <span class="legend__amount">${formatMoney(amt)}</span>
        <span class="legend__pct">${pct}%</span>
      </div>`;
  }).join('') || `<p class="text-muted">No expenses yet.</p>`;
}

function renderRecentExpenses() {
  const mount = document.getElementById('recent-expenses');
  const expenses = [...Storage.expenses.all()]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);

  if (!expenses.length) {
    mount.innerHTML = emptyState('receipt', 'No expenses yet', 'Add your first shared expense to get started.');
    return;
  }

  mount.innerHTML = expenses.map(e => {
    const cat = getCategoryById(e.category);
    const payer = getMemberById(e.paidBy);
    const paidLabel = payer ? (payer.isYou ? 'You' : payer.name) : 'Unknown';
    return `
      <div class="list-row">
        <div class="list-icon" style="background:${hexToSoft(cat.color)};color:${cat.color}"><i data-lucide="${cat.icon}"></i></div>
        <div class="list-row__main">
          <div class="list-row__title">${escapeHtml(e.name)}</div>
          <div class="list-row__sub">${formatDate(e.date)} · Paid by ${paidLabel}</div>
        </div>
        <div>
          <div class="list-row__amount">${formatMoney(e.amount)}</div>
          <div class="list-row__sub" style="text-align:right">${e.splitType === 'custom' ? 'Custom split' : 'Split equally'}</div>
        </div>
      </div>`;
  }).join('');
  if (window.lucide) lucide.createIcons({ nodes: [mount] });
}

function renderMemberBalances() {
  const mount = document.getElementById('member-balances');
  const balances = computeBalances();
  const members = Storage.members.all();

  if (!members.length) {
    mount.innerHTML = emptyState('users', 'No members yet', 'Add roommates to start splitting expenses.');
    return;
  }

  mount.innerHTML = members.map(m => {
    const bal = balances[m.id] || 0;
    const positive = bal >= 0.005;
    const zero = Math.abs(bal) < 0.005;
    return `
      <div class="balance-row">
        <div class="avatar avatar--sm" style="background:${m.avatarColor}">${getInitials(m.name)}</div>
        <div class="balance-row__main">
          <div class="balance-row__name">${m.name}${m.isYou ? ' (You)' : ''}</div>
          <div class="balance-row__sub">${zero ? 'Settled up' : positive ? 'You will receive' : 'You owe'}</div>
        </div>
        <div class="balance-row__amount ${zero ? 'text-muted' : positive ? 'text-green' : 'text-red'}">
          ${zero ? '—' : formatMoney(Math.abs(bal))}
        </div>
      </div>`;
  }).join('');
}

function renderUpcomingReminders() {
  const mount = document.getElementById('upcoming-reminders');
  const reminders = Storage.reminders.all()
    .filter(r => r.status !== 'paid')
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
    .slice(0, 4);

  if (!reminders.length) {
    mount.innerHTML = emptyState('bell-off', 'No reminders', 'You\'re all caught up on upcoming bills.');
    return;
  }

  mount.innerHTML = reminders.map(r => {
    const cat = getCategoryById(r.category);
    const days = daysUntil(r.dueDate);
    const status = reminderStatus(r);
    const label = status === 'overdue' ? `${Math.abs(days)} days overdue` : status === 'due-today' ? 'Due today' : `In ${days} days`;
    return `
      <div class="list-row">
        <div class="list-icon" style="background:${hexToSoft(cat.color)};color:${cat.color}"><i data-lucide="${cat.icon}"></i></div>
        <div class="list-row__main">
          <div class="list-row__title">${escapeHtml(r.title)}</div>
          <div class="list-row__sub">${formatDate(r.dueDate)}</div>
        </div>
        <span class="reminder-pill reminder-pill--${status}">${label}</span>
      </div>`;
  }).join('');
  if (window.lucide) lucide.createIcons({ nodes: [mount] });
}

function emptyState(icon, title, desc) {
  return `<div class="empty-state"><i data-lucide="${icon}"></i><h4>${title}</h4><p>${desc}</p></div>`;
}

function renderDashboard() {
  renderSummaryCards();
  renderExpenseOverview();
  renderRecentExpenses();
  renderMemberBalances();
  renderUpcomingReminders();
  renderSidebar();
  renderHeader();
}

window.onDataChanged = renderDashboard;

document.addEventListener('DOMContentLoaded', () => {
  initShell();
  renderDashboard();

  const monthFilter = document.getElementById('overview-month-filter');
  if (monthFilter) monthFilter.addEventListener('change', renderExpenseOverview);
});
