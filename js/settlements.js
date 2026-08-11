/**
 * settlements.js
 * Shows the simplified "who owes whom" recommendations and lets the user
 * mark them as paid, recording each settlement in history.
 */

function renderSettleRecommendations() {
  const mount = document.getElementById('settle-recommendations');
  const debts = simplifyDebts();

  if (!debts.length) {
    mount.innerHTML = `<div class="empty-state"><i data-lucide="party-popper"></i><h4>Everyone's settled up!</h4><p>There are no outstanding balances in the room right now.</p></div>`;
    if (window.lucide) lucide.createIcons({ nodes: [mount] });
    return;
  }

  mount.innerHTML = debts.map(d => {
    const from = getMemberById(d.from);
    const to = getMemberById(d.to);
    if (!from || !to) return '';
    return `
      <div class="settle-card" data-from="${d.from}" data-to="${d.to}" data-amount="${d.amount}">
        <div class="avatar avatar--sm" style="background:${from.avatarColor}">${getInitials(from.name)}</div>
        <div class="settle-card__main">
          <div><strong>${from.name}${from.isYou ? ' (You)' : ''}</strong> owes <strong>${to.name}${to.isYou ? ' (You)' : ''}</strong></div>
          <div class="settle-card__amount text-red">${formatMoney(d.amount)}</div>
        </div>
        <div class="avatar avatar--sm" style="background:${to.avatarColor}">${getInitials(to.name)}</div>
        <button class="btn btn--primary btn--sm" data-action="mark-paid">Mark as Paid</button>
      </div>`;
  }).join('');

  if (window.lucide) lucide.createIcons({ nodes: [mount] });

  mount.querySelectorAll('[data-action="mark-paid"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const card = btn.closest('.settle-card');
      const from = card.dataset.from, to = card.dataset.to, amount = Number(card.dataset.amount);
      const fromM = getMemberById(from), toM = getMemberById(to);

      const ok = await confirmDialog({
        title: 'Confirm settlement',
        message: `Mark ${formatMoney(amount)} from ${fromM.name} to ${toM.name} as paid?`,
        confirmLabel: 'Mark as Paid',
        danger: false
      });
      if (!ok) return;

      btn.classList.add('btn--loading');
      setTimeout(() => {
        const settlements = Storage.settlements.all();
        settlements.unshift({
          id: generateId('s'), from, to, amount, status: 'completed', date: new Date().toISOString().slice(0, 10),
          createdAt: new Date().toISOString()
        });
        Storage.settlements.save(settlements);
        showToast(`Settlement of ${formatMoney(amount)} recorded.`);
        renderSettleRecommendations();
        renderSettlementHistory();
        renderSidebar();
      }, 350);
    });
  });
}

function renderSettlementHistory() {
  const mount = document.getElementById('settlement-history-body');
  const cardMount = document.getElementById('settlement-history-cards');
  const settlements = Storage.settlements.all().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  if (!settlements.length) {
    mount.innerHTML = '';
    cardMount.innerHTML = '';
    document.getElementById('settlement-history-empty').style.display = 'block';
    return;
  }
  document.getElementById('settlement-history-empty').style.display = 'none';

  mount.innerHTML = settlements.map(s => {
    const from = getMemberById(s.from), to = getMemberById(s.to);
    return `
      <tr>
        <td>${formatDate(s.date)}</td>
        <td>${from ? from.name : '—'}</td>
        <td>${to ? to.name : '—'}</td>
        <td><strong>${formatMoney(s.amount)}</strong></td>
        <td><span class="status-pill status-pill--active">Completed</span></td>
      </tr>`;
  }).join('');

  cardMount.innerHTML = settlements.map(s => {
    const from = getMemberById(s.from), to = getMemberById(s.to);
    return `
      <div class="data-card">
        <div class="data-card__row"><span>Date</span><strong>${formatDate(s.date)}</strong></div>
        <div class="data-card__row"><span>From</span><strong>${from ? from.name : '—'}</strong></div>
        <div class="data-card__row"><span>To</span><strong>${to ? to.name : '—'}</strong></div>
        <div class="data-card__row"><span>Amount</span><strong>${formatMoney(s.amount)}</strong></div>
      </div>`;
  }).join('');
}

document.addEventListener('DOMContentLoaded', () => {
  initShell({ title: 'Settle Up', subtitle: 'Clear outstanding balances between roommates' });
  renderSettleRecommendations();
  renderSettlementHistory();
});
