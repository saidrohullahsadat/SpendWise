/**
 * reminders.js
 * Bill reminders with computed status (upcoming / due today / overdue / paid).
 */

function renderReminders() {
  const mount = document.getElementById('reminders-list');
  const reminders = [...Storage.reminders.all()].sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

  if (!reminders.length) {
    mount.innerHTML = `<div class="empty-state"><i data-lucide="bell-off"></i><h4>No reminders yet</h4><p>Create a reminder so nobody forgets a bill.</p></div>`;
    if (window.lucide) lucide.createIcons({ nodes: [mount] });
    return;
  }

  mount.innerHTML = reminders.map(r => {
    const cat = getCategoryById(r.category);
    const status = reminderStatus(r);
    const days = daysUntil(r.dueDate);
    let label;
    if (status === 'paid') label = 'Paid';
    else if (status === 'overdue') label = `${Math.abs(days)}d overdue`;
    else if (status === 'due-today') label = 'Due today';
    else label = `In ${days} day${days === 1 ? '' : 's'}`;

    return `
      <div class="list-row" data-id="${r.id}">
        <div class="list-icon" style="background:${hexToSoft(cat.color)};color:${cat.color}"><i data-lucide="${cat.icon}"></i></div>
        <div class="list-row__main">
          <div class="list-row__title">${escapeHtml(r.title)}</div>
          <div class="list-row__sub">${formatDate(r.dueDate)} · ${formatMoney(r.amount)}${r.notes ? ' · ' + escapeHtml(r.notes) : ''}</div>
        </div>
        <span class="reminder-pill reminder-pill--${status}">${label}</span>
        <div class="actions-cell">
          ${status !== 'paid' ? `<button class="icon-btn" data-action="paid" title="Mark as Paid"><i data-lucide="check"></i></button>` : ''}
          <button class="icon-btn" data-action="edit" title="Edit"><i data-lucide="edit-2"></i></button>
          <button class="icon-btn icon-btn--danger" data-action="delete" title="Delete"><i data-lucide="trash-2"></i></button>
        </div>
      </div>`;
  }).join('');

  if (window.lucide) lucide.createIcons({ nodes: [mount] });
  attachReminderActions();
}

function attachReminderActions() {
  document.querySelectorAll('#reminders-list [data-action]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.closest('[data-id]').dataset.id;
      const action = btn.dataset.action;
      if (action === 'edit') openReminderModal(id);
      if (action === 'paid') {
        const reminders = Storage.reminders.all();
        const idx = reminders.findIndex(r => r.id === id);
        reminders[idx].status = 'paid';
        Storage.reminders.save(reminders);
        showToast('Reminder marked as paid.');
        renderReminders();
      }
      if (action === 'delete') {
        const ok = await confirmDialog({ title: 'Delete this reminder?', message: 'This reminder will be permanently removed.', confirmLabel: 'Delete' });
        if (ok) {
          Storage.reminders.save(Storage.reminders.all().filter(r => r.id !== id));
          showToast('Reminder deleted.');
          renderReminders();
        }
      }
    });
  });
}

function openReminderModal(reminderId = null) {
  const existing = reminderId ? Storage.reminders.all().find(r => r.id === reminderId) : null;
  const categories = Storage.categories.all();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <div class="modal__header">
        <h3>${existing ? 'Edit Reminder' : 'New Reminder'}</h3>
        <button class="modal__close" data-action="close"><i data-lucide="x"></i></button>
      </div>
      <form class="modal__body" id="reminder-form">
        <div class="form-group">
          <label for="rf-title">Title</label>
          <input type="text" id="rf-title" value="${existing ? escapeHtml(existing.title) : ''}" placeholder="e.g. Rent Due" required>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="rf-amount">Amount</label>
            <input type="number" id="rf-amount" min="0" step="0.01" value="${existing ? existing.amount : ''}" placeholder="900.00" required>
          </div>
          <div class="form-group">
            <label for="rf-due">Due Date</label>
            <input type="date" id="rf-due" value="${existing ? existing.dueDate : ''}" required>
          </div>
        </div>
        <div class="form-group">
          <label for="rf-category">Category</label>
          <select id="rf-category">
            ${categories.map(c => `<option value="${c.id}" ${existing && existing.category === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label for="rf-notes">Notes <span class="optional">(optional)</span></label>
          <textarea id="rf-notes" rows="2">${existing ? escapeHtml(existing.notes || '') : ''}</textarea>
        </div>
        <p class="form-error" id="rf-error" hidden></p>
      </form>
      <div class="modal__footer">
        <button class="btn btn--ghost" data-action="close">Cancel</button>
        <button type="submit" form="reminder-form" class="btn btn--primary">${existing ? 'Save Changes' : 'Create Reminder'}</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  if (window.lucide) lucide.createIcons({ nodes: [overlay] });
  requestAnimationFrame(() => overlay.classList.add('modal-overlay--visible'));
  const close = () => { overlay.classList.remove('modal-overlay--visible'); setTimeout(() => overlay.remove(), 200); };
  overlay.querySelectorAll('[data-action="close"]').forEach(b => b.addEventListener('click', close));
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  overlay.querySelector('#reminder-form').addEventListener('submit', e => {
    e.preventDefault();
    const title = overlay.querySelector('#rf-title').value.trim();
    const amount = Number(overlay.querySelector('#rf-amount').value);
    const dueDate = overlay.querySelector('#rf-due').value;
    const category = overlay.querySelector('#rf-category').value;
    const notes = overlay.querySelector('#rf-notes').value.trim();
    const errorEl = overlay.querySelector('#rf-error');

    if (!title) { errorEl.textContent = 'Please enter a title.'; errorEl.hidden = false; return; }
    if (!dueDate) { errorEl.textContent = 'Please choose a due date.'; errorEl.hidden = false; return; }

    const reminders = Storage.reminders.all();
    if (existing) {
      const idx = reminders.findIndex(r => r.id === existing.id);
      reminders[idx] = { ...existing, title, amount, dueDate, category, notes };
      showToast('Reminder updated.');
    } else {
      reminders.push({ id: generateId('r'), title, amount, dueDate, category, notes, status: 'upcoming', createdAt: new Date().toISOString() });
      showToast('Reminder created.');
    }
    Storage.reminders.save(reminders);
    close();
    renderReminders();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initShell({ title: 'Reminders', subtitle: 'Never miss a shared bill again' });
  renderReminders();
  document.getElementById('add-reminder-btn').addEventListener('click', () => openReminderModal());
});
