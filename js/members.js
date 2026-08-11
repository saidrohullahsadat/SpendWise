/**
 * members.js
 * Member directory: paid/share/balance stats, plus add / edit / remove.
 * Removing a member that appears in existing expenses requires confirmation
 * because it would silently change historical split data.
 */

const AVATAR_COLORS = ['#3B82F6', '#8B5CF6', '#F59E0B', '#10B981', '#EF4444', '#06B6D4', '#F97316', '#6366F1'];

function memberStats(memberId) {
  const expenses = Storage.expenses.all();
  const balances = computeBalances();
  const totalPaid = expenses.filter(e => e.paidBy === memberId).reduce((s, e) => s + Number(e.amount), 0);
  const totalShare = expenses.reduce((s, e) => {
    const shares = computeShares(e);
    return s + (shares[memberId] || 0);
  }, 0);
  return { totalPaid, totalShare, balance: balances[memberId] || 0 };
}

function memberIsReferenced(memberId) {
  return Storage.expenses.all().some(e => e.paidBy === memberId || e.participants.includes(memberId)) ||
    Storage.settlements.all().some(s => s.from === memberId || s.to === memberId);
}

function renderMembers() {
  const mount = document.getElementById('members-grid');
  const members = Storage.members.all();

  if (!members.length) {
    mount.innerHTML = `<div class="empty-state"><i data-lucide="users"></i><h4>No members yet</h4><p>Add your first roommate to start tracking expenses.</p></div>`;
    return;
  }

  mount.innerHTML = members.map(m => {
    const stats = memberStats(m.id);
    const positive = stats.balance >= 0.005;
    const zero = Math.abs(stats.balance) < 0.005;
    return `
    <div class="card" data-id="${m.id}">
      <div class="card__body">
        <div class="cell-flex" style="margin-bottom:14px">
          <div class="avatar avatar--lg" style="background:${m.avatarColor}">${getInitials(m.name)}</div>
          <div>
            <div class="cell-title" style="font-size:15px">${m.name}${m.isYou ? ' <span class="text-muted" style="font-weight:600">(You)</span>' : ''}</div>
            <div class="cell-sub">${m.email || 'No email set'}</div>
          </div>
          <span class="status-pill status-pill--active" style="margin-left:auto">Active</span>
        </div>
        <div class="divider"></div>
        <div class="data-card__row"><span>Total Paid</span><strong>${formatMoney(stats.totalPaid)}</strong></div>
        <div class="data-card__row"><span>Total Share</span><strong>${formatMoney(stats.totalShare)}</strong></div>
        <div class="data-card__row"><span>Current Balance</span><strong class="${zero ? '' : positive ? 'text-green' : 'text-red'}">${zero ? 'Settled' : (positive ? '+' : '-') + formatMoney(Math.abs(stats.balance))}</strong></div>
        <div class="data-card__actions">
          <button class="btn btn--ghost btn--sm" data-action="edit"><i data-lucide="edit-2"></i>Edit</button>
          <button class="btn btn--ghost btn--sm" data-action="remove" style="color:var(--red-600)"><i data-lucide="trash-2"></i>Remove</button>
        </div>
      </div>
    </div>`;
  }).join('');

  if (window.lucide) lucide.createIcons({ nodes: [mount] });
  attachMemberActions();
}

function attachMemberActions() {
  document.querySelectorAll('#members-grid [data-action]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.closest('[data-id]').dataset.id;
      if (btn.dataset.action === 'edit') openMemberModal(id);
      if (btn.dataset.action === 'remove') {
        const referenced = memberIsReferenced(id);
        const ok = await confirmDialog({
          title: 'Remove this member?',
          message: referenced
            ? 'This member is linked to existing expenses or settlements. Removing them will not delete that history, but they will no longer appear in new splits. Continue?'
            : 'This roommate will be permanently removed from the room.',
          confirmLabel: 'Remove Member'
        });
        if (ok) {
          const list = Storage.members.all().filter(m => m.id !== id);
          Storage.members.save(list);
          showToast('Member removed.');
          renderMembers();
          renderSidebar();
        }
      }
    });
  });
}

function openMemberModal(memberId = null) {
  const existing = memberId ? Storage.members.all().find(m => m.id === memberId) : null;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <div class="modal__header">
        <h3>${existing ? 'Edit Member' : 'Add Member'}</h3>
        <button class="modal__close" data-action="close"><i data-lucide="x"></i></button>
      </div>
      <form class="modal__body" id="member-form">
        <div class="form-group">
          <label for="mf-name">Full Name</label>
          <input type="text" id="mf-name" value="${existing ? escapeHtml(existing.name) : ''}" placeholder="e.g. Jordan Lee" required>
        </div>
        <div class="form-group">
          <label for="mf-email">Email</label>
          <input type="email" id="mf-email" value="${existing ? escapeHtml(existing.email || '') : ''}" placeholder="jordan@email.com">
        </div>
        <div class="form-group">
          <label>Avatar Color</label>
          <div class="color-swatches" id="mf-colors">
            ${AVATAR_COLORS.map(c => `<button type="button" class="color-swatch ${existing && existing.avatarColor === c ? 'color-swatch--active' : ''}" style="background:${c}" data-color="${c}"></button>`).join('')}
          </div>
        </div>
        <p class="form-error" id="mf-error" hidden></p>
      </form>
      <div class="modal__footer">
        <button class="btn btn--ghost" data-action="close">Cancel</button>
        <button type="submit" form="member-form" class="btn btn--primary">${existing ? 'Save Changes' : 'Add Member'}</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  if (window.lucide) lucide.createIcons({ nodes: [overlay] });
  requestAnimationFrame(() => overlay.classList.add('modal-overlay--visible'));

  let selectedColor = existing ? existing.avatarColor : AVATAR_COLORS[Storage.members.all().length % AVATAR_COLORS.length];
  overlay.querySelectorAll('.color-swatch').forEach(sw => {
    if (sw.dataset.color === selectedColor) sw.classList.add('color-swatch--active');
    sw.addEventListener('click', () => {
      overlay.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('color-swatch--active'));
      sw.classList.add('color-swatch--active');
      selectedColor = sw.dataset.color;
    });
  });

  const close = () => { overlay.classList.remove('modal-overlay--visible'); setTimeout(() => overlay.remove(), 200); };
  overlay.querySelectorAll('[data-action="close"]').forEach(b => b.addEventListener('click', close));
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  overlay.querySelector('#member-form').addEventListener('submit', e => {
    e.preventDefault();
    const name = overlay.querySelector('#mf-name').value.trim();
    const email = overlay.querySelector('#mf-email').value.trim();
    const errorEl = overlay.querySelector('#mf-error');
    if (!name) { errorEl.textContent = 'Please enter a name.'; errorEl.hidden = false; return; }

    const members = Storage.members.all();
    if (existing) {
      const idx = members.findIndex(m => m.id === existing.id);
      members[idx] = { ...existing, name, email, avatarColor: selectedColor };
      showToast('Member updated.');
    } else {
      members.push({ id: generateId('m'), name, email, isYou: false, avatarColor: selectedColor, joinedAt: new Date().toISOString().slice(0, 10) });
      showToast('Member added.');
    }
    Storage.members.save(members);
    close();
    renderMembers();
    renderSidebar();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initShell({ title: 'Members', subtitle: 'Everyone sharing expenses in the room' });
  renderMembers();
  document.getElementById('add-member-btn').addEventListener('click', () => openMemberModal());
});
