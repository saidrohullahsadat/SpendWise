/**
 * reports.js
 * Monthly trend chart, category breakdown, member spending, and headline
 * statistics — all recomputed when the period filter changes.
 */

let monthlyChart = null, categoryChart = null, memberChart = null;
let reportPeriod = 'this-month';

function expensesInPeriod(period) {
  const all = Storage.expenses.all();
  const now = new Date();
  let filtered = all;

  if (period === 'this-week') {
    const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7);
    filtered = all.filter(e => new Date(e.date) >= weekAgo);
  } else if (period === 'this-month') {
    filtered = all.filter(e => { const d = new Date(e.date); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); });
  } else if (period === 'last-month') {
    const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    filtered = all.filter(e => { const d = new Date(e.date); return d.getMonth() === lm.getMonth() && d.getFullYear() === lm.getFullYear(); });
  } else if (period === 'last-3-months') {
    const start = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    filtered = all.filter(e => new Date(e.date) >= start);
  } else if (period === 'this-year') {
    filtered = all.filter(e => new Date(e.date).getFullYear() === now.getFullYear());
  }

  // If nothing falls in the selected window (e.g. sample data is dated in
  // the past relative to "today"), fall back to the full history so the
  // report page is never misleadingly empty on first load.
  return filtered.length ? filtered : all;
}

function renderStats(list) {
  const totalExpenses = list.reduce((s, e) => s + Number(e.amount), 0);

  const byMonth = {};
  list.forEach(e => { const k = e.date.slice(0, 7); byMonth[k] = (byMonth[k] || 0) + Number(e.amount); });
  const months = Object.keys(byMonth).length || 1;
  const avgMonthly = totalExpenses / months;

  const byCategory = {};
  list.forEach(e => { byCategory[e.category] = (byCategory[e.category] || 0) + Number(e.amount); });
  const highestCategoryId = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0];

  const byMember = {};
  list.forEach(e => { byMember[e.paidBy] = (byMember[e.paidBy] || 0) + Number(e.amount); });
  const highestSpenderId = Object.entries(byMember).sort((a, b) => b[1] - a[1])[0];

  const settlements = Storage.settlements.all().filter(s => s.status === 'completed');
  const totalSettled = settlements.reduce((s, x) => s + Number(x.amount), 0);
  const balances = computeBalances();
  const totalOutstanding = Object.values(balances).filter(b => b > 0).reduce((s, b) => s + b, 0);

  document.getElementById('stat-total').textContent = formatMoney(totalExpenses);
  document.getElementById('stat-avg').textContent = formatMoney(avgMonthly);
  document.getElementById('stat-highest-category').textContent = highestCategoryId ? getCategoryById(highestCategoryId[0]).name : '—';
  document.getElementById('stat-highest-spender').textContent = highestSpenderId ? (getMemberById(highestSpenderId[0])?.name || '—') : '—';
  document.getElementById('stat-settled').textContent = formatMoney(totalSettled);
  document.getElementById('stat-outstanding').textContent = formatMoney(totalOutstanding);
}

function renderMonthlyChart(list) {
  const byDay = {};
  const isShortRange = ['this-week', 'this-month', 'last-month'].includes(reportPeriod);
  list.forEach(e => {
    const key = isShortRange ? e.date : e.date.slice(0, 7);
    byDay[key] = (byDay[key] || 0) + Number(e.amount);
  });
  const keys = Object.keys(byDay).sort();
  const labels = keys.map(k => isShortRange ? formatDate(k) : k);
  const data = keys.map(k => byDay[k]);

  const ctx = document.getElementById('monthly-chart');
  if (monthlyChart) monthlyChart.destroy();
  monthlyChart = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [{ label: 'Expenses', data, backgroundColor: '#2563EB', borderRadius: 6, maxBarThickness: 36 }] },
    options: {
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => formatMoney(c.raw) } } },
      scales: { y: { beginAtZero: true, ticks: { callback: v => formatMoney(v) } } }
    }
  });
}

function renderCategoryChart(list) {
  const byCategory = {};
  list.forEach(e => { byCategory[e.category] = (byCategory[e.category] || 0) + Number(e.amount); });
  const entries = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
  const labels = entries.map(([cat]) => getCategoryById(cat).name);
  const data = entries.map(([, amt]) => amt);
  const colors = entries.map(([cat], i) => getCategoryById(cat).color || CHART_COLORS[i % CHART_COLORS.length]);

  const ctx = document.getElementById('category-chart');
  if (categoryChart) categoryChart.destroy();
  categoryChart = new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 0 }] },
    options: { cutout: '65%', plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } } } }
  });
}

function renderMemberChart(list) {
  const members = Storage.members.all();
  const byMember = {};
  members.forEach(m => byMember[m.id] = 0);
  list.forEach(e => { byMember[e.paidBy] = (byMember[e.paidBy] || 0) + Number(e.amount); });

  const ctx = document.getElementById('member-chart');
  if (memberChart) memberChart.destroy();
  memberChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: members.map(m => m.name),
      datasets: [{ data: members.map(m => byMember[m.id] || 0), backgroundColor: members.map(m => m.avatarColor), borderRadius: 6, maxBarThickness: 44 }]
    },
    options: {
      indexAxis: 'y',
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => formatMoney(c.raw) } } },
      scales: { x: { beginAtZero: true, ticks: { callback: v => formatMoney(v) } } }
    }
  });
}

function renderReports() {
  const list = expensesInPeriod(reportPeriod);
  renderStats(list);
  renderMonthlyChart(list);
  renderCategoryChart(list);
  renderMemberChart(list);
}

document.addEventListener('DOMContentLoaded', () => {
  initShell({ title: 'Reports', subtitle: 'Understand spending patterns across the room' });
  renderReports();
  document.getElementById('report-period').addEventListener('change', e => {
    reportPeriod = e.target.value;
    renderReports();
  });
});
