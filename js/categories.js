/**
 * categories.js
 * Category management: add/edit/delete with an icon + color picker.
 * Deleting a category in use prompts the user to choose what happens to
 * the expenses currently assigned to it.
 */

const ICON_CHOICES = ['coffee', 'utensils', 'moon', 'droplet', 'home', 'zap', 'wifi', 'cookie', 'car', 'more-horizontal', 'shopping-bag', 'film', 'gift', 'heart', 'book', 'plane'];
const COLOR_CHOICES = ['#3B82F6', '#8B5CF6', '#F59E0B', '#10B981', '#EF4444', '#06B6D4', '#F97316', '#6366F1', '#EAB308', '#64748B'];

function categoryUsageCount(categoryId) {
  return Storage.expenses.all().filter(e => e.category === categoryId).length;
}

function renderCategories() {
  const mount = document.getElementById('categories-grid');
  const categories = Storage.categories.all();

  if (!categories.length) {
    mount.innerHTML = `<div class="empty-state"><i data-lucide="tag"></i><h4>No categories</h4><p>Add a category to start organizing expenses.</p></div>`;
    return;
  }

  mount.innerHTML = categories.map(c => {
    const count = categoryUsageCount(c.id);
    return `
    <div class="category-card" data-id="${c.id}">
      <div class="category-card__icon" style="background:${hexToSoft(c.color)};color:${c.color}"><i data-lucide="${c.icon}"></i></div>
      <div>
        <div class="category-card__name">${c.name}</div>
        <div class="category-card__meta">${count} expense${count === 1 ? '' : 's'}</div>
      </div>
      <div class="category-card__actions">
        <button class="icon-btn" data-action="edit"><i data-lucide="edit-2"></i></button>
        <button class="icon-btn icon-btn--danger" data-action="delete"><i data-lucide="trash-2"></i></button>
      </div>
    </div>`;
  }).join('');

  if (window.lucide) lucide.createIcons({ nodes: [mount] });
  attachCategoryActions();
}

function attachCategoryActions() {
  document.querySelectorAll('#categories-grid [data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.closest('[data-id]').dataset.id;
      if (btn.dataset.action === 'edit') openCategoryModal(id);
      if (btn.dataset.action === 'delete') handleDeleteCategory(id);
    });
  });
}

async function handleDeleteCategory(id) {
  const count = categoryUsageCount(id);
  const cat = getCategoryById(id);

  if (count === 0) {
    const ok = await confirmDialog({ title: 'Delete category?', message: `"${cat.name}" isn't used by any expenses. Delete it?`, confirmLabel: 'Delete' });
    if (ok) {
      Storage.categories.save(Storage.categories.all().filter(c => c.id !== id));
      showToast('Category deleted.');
      renderCategories();
    }
    return;
  }

  // Category is in use — ask what to do with those expenses.
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal modal--small" role="dialog" aria-modal="true">
      <div class="modal__body">
        <div class="confirm-icon confirm-icon--danger"><i data-lucide="alert-triangle"></i></div>
        <h3>"${cat.name}" is in use</h3>
        <p>${count} expense${count === 1 ? '' : 's'} use this category. Choose what should happen to them before deleting it.</p>
        <div class="form-group" style="text-align:left;margin-top:16px">
          <label for="reassign-select">Move those expenses to</label>
          <select id="reassign-select">
            ${Storage.categories.all().filter(c => c.id !== id).map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="modal__footer">
        <button class="btn btn--ghost" data-action="cancel">Cancel</button>
        <button class="btn btn--danger" data-action="confirm">Reassign &amp; Delete</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  if (window.lucide) lucide.createIcons({ nodes: [overlay] });
  requestAnimationFrame(() => overlay.classList.add('modal-overlay--visible'));
  const close = () => { overlay.classList.remove('modal-overlay--visible'); setTimeout(() => overlay.remove(), 200); };
  overlay.querySelector('[data-action="cancel"]').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  overlay.querySelector('[data-action="confirm"]').addEventListener('click', () => {
    const targetId = overlay.querySelector('#reassign-select').value;
    const expenses = Storage.expenses.all().map(e => e.category === id ? { ...e, category: targetId } : e);
    Storage.expenses.save(expenses);
    Storage.categories.save(Storage.categories.all().filter(c => c.id !== id));
    showToast('Expenses reassigned and category deleted.');
    close();
    renderCategories();
  });
}

function openCategoryModal(categoryId = null) {
  const existing = categoryId ? Storage.categories.all().find(c => c.id === categoryId) : null;
  let selectedIcon = existing ? existing.icon : ICON_CHOICES[0];
  let selectedColor = existing ? existing.color : COLOR_CHOICES[0];

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <div class="modal__header">
        <h3>${existing ? 'Edit Category' : 'Add Category'}</h3>
        <button class="modal__close" data-action="close"><i data-lucide="x"></i></button>
      </div>
      <form class="modal__body" id="category-form">
        <div class="form-group">
          <label for="cf-name">Category Name</label>
          <input type="text" id="cf-name" value="${existing ? escapeHtml(existing.name) : ''}" placeholder="e.g. Cleaning Supplies" required>
        </div>
        <div class="form-group">
          <label>Icon</label>
          <div class="color-swatches" id="cf-icons">
            ${ICON_CHOICES.map(icon => `<button type="button" class="icon-btn ${icon === selectedIcon ? 'icon-btn--danger' : ''}" data-icon="${icon}" style="width:36px;height:36px"><i data-lucide="${icon}"></i></button>`).join('')}
          </div>
        </div>
        <div class="form-group">
          <label>Color</label>
          <div class="color-swatches" id="cf-colors">
            ${COLOR_CHOICES.map(c => `<button type="button" class="color-swatch ${c === selectedColor ? 'color-swatch--active' : ''}" style="background:${c}" data-color="${c}"></button>`).join('')}
          </div>
        </div>
        <p class="form-error" id="cf-error" hidden></p>
      </form>
      <div class="modal__footer">
        <button class="btn btn--ghost" data-action="close">Cancel</button>
        <button type="submit" form="category-form" class="btn btn--primary">${existing ? 'Save Changes' : 'Add Category'}</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  if (window.lucide) lucide.createIcons({ nodes: [overlay] });
  requestAnimationFrame(() => overlay.classList.add('modal-overlay--visible'));

  overlay.querySelectorAll('#cf-icons button').forEach(b => {
    b.addEventListener('click', () => {
      overlay.querySelectorAll('#cf-icons button').forEach(x => x.classList.remove('icon-btn--danger'));
      b.classList.add('icon-btn--danger');
      selectedIcon = b.dataset.icon;
    });
  });
  overlay.querySelectorAll('#cf-colors button').forEach(b => {
    b.addEventListener('click', () => {
      overlay.querySelectorAll('#cf-colors button').forEach(x => x.classList.remove('color-swatch--active'));
      b.classList.add('color-swatch--active');
      selectedColor = b.dataset.color;
    });
  });

  const close = () => { overlay.classList.remove('modal-overlay--visible'); setTimeout(() => overlay.remove(), 200); };
  overlay.querySelectorAll('[data-action="close"]').forEach(b => b.addEventListener('click', close));
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  overlay.querySelector('#category-form').addEventListener('submit', e => {
    e.preventDefault();
    const name = overlay.querySelector('#cf-name').value.trim();
    if (!name) {
      const err = overlay.querySelector('#cf-error');
      err.textContent = 'Please enter a category name.';
      err.hidden = false;
      return;
    }
    const categories = Storage.categories.all();
    if (existing) {
      const idx = categories.findIndex(c => c.id === existing.id);
      categories[idx] = { ...existing, name, icon: selectedIcon, color: selectedColor };
      showToast('Category updated.');
    } else {
      categories.push({ id: generateId('cat'), name, icon: selectedIcon, color: selectedColor });
      showToast('Category added.');
    }
    Storage.categories.save(categories);
    close();
    renderCategories();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initShell({ title: 'Categories', subtitle: 'Organize how expenses are grouped' });
  renderCategories();
  document.getElementById('add-category-btn').addEventListener('click', () => openCategoryModal());
});
