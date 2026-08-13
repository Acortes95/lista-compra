// ============================================================
// Catálogo de alimentos
// ============================================================

async function loadCategories() {
  const { data, error } = await supabaseClient
    .from('categories')
    .select('id, name, icon, sort_order')
    .eq('group_id', AppState.group.id)
    .order('sort_order');
  if (!error) AppState.categories = data;
}

async function loadFoods() {
  const { data, error } = await supabaseClient
    .from('foods')
    .select('id, category_id, name, unit, default_quantity, notes, created_at')
    .eq('group_id', AppState.group.id)
    .is('deleted_at', null)
    .order('name');
  if (!error) AppState.foods = data;
}

function initFoodsScreen() {
  document.getElementById('fab-add-food').addEventListener('click', () => openFoodSheet(null));
  document.getElementById('btn-cancel-food').addEventListener('click', closeFoodSheet);
  document.getElementById('sheet-food').addEventListener('click', (e) => {
    if (e.target.id === 'sheet-food') closeFoodSheet();
  });
  document.getElementById('form-food').addEventListener('submit', onSubmitFood);
}

function populateCategorySelect() {
  const select = document.getElementById('food-category');
  select.innerHTML = AppState.categories
    .map(c => `<option value="${c.id}">${c.icon} ${escapeHtml(c.name)}</option>`)
    .join('');
}

function openFoodSheet(food) {
  populateCategorySelect();
  document.getElementById('food-sheet-title').textContent = food ? 'Editar alimento' : 'Nuevo alimento';
  document.getElementById('food-id').value = food ? food.id : '';
  document.getElementById('food-name').value = food ? food.name : '';
  document.getElementById('food-category').value = food ? food.category_id : AppState.categories[0]?.id || '';
  document.getElementById('food-quantity').value = food ? food.default_quantity : 1;
  document.getElementById('food-unit').value = food ? food.unit : 'unidades';
  document.getElementById('food-notes').value = food ? (food.notes || '') : '';
  document.getElementById('sheet-food').classList.remove('hidden');
  setTimeout(() => document.getElementById('food-name').focus(), 50);
}

function closeFoodSheet() {
  document.getElementById('sheet-food').classList.add('hidden');
}

async function onSubmitFood(e) {
  e.preventDefault();
  const id = document.getElementById('food-id').value;
  const payload = {
    group_id: AppState.group.id,
    name: document.getElementById('food-name').value.trim(),
    category_id: document.getElementById('food-category').value,
    default_quantity: parseFloat(document.getElementById('food-quantity').value) || 1,
    unit: document.getElementById('food-unit').value.trim() || 'unidades',
    notes: document.getElementById('food-notes').value.trim() || null
  };

  const btn = document.getElementById('btn-save-food');
  btn.textContent = 'Guardando…';

  let error;
  if (id) {
    ({ error } = await supabaseClient.from('foods').update(payload).eq('id', id));
  } else {
    ({ error } = await supabaseClient.from('foods').insert(payload));
  }

  btn.textContent = 'Guardar';
  if (error) {
    showToast('No se pudo guardar el alimento.');
    return;
  }
  closeFoodSheet();
  showToast(id ? 'Alimento actualizado' : 'Alimento creado');
  await loadFoods();
  renderFoodsScreen();
  renderShoppingScreen();
}

async function deleteFood(foodId) {
  const { error } = await supabaseClient
    .from('foods')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', foodId);
  if (error) return showToast('No se pudo eliminar.');
  showToast('Alimento eliminado');
  await loadFoods();
  renderFoodsScreen();
}

// ---------------- Render ----------------

function renderFoodsScreen() {
  const container = document.getElementById('foods-content');
  document.getElementById('foods-count').textContent =
    `${AppState.foods.length} en catálogo`;

  if (AppState.foods.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="emoji">🥕</span>
        <p>Tu catálogo está vacío.</p>
        <p class="hint">Toca el botón + para crear tu primer alimento.</p>
      </div>`;
    return;
  }

  const byCategory = {};
  AppState.foods.forEach(f => {
    (byCategory[f.category_id] ||= []).push(f);
  });

  let html = '';
  AppState.categories.forEach(cat => {
    const items = byCategory[cat.id];
    if (!items || !items.length) return;
    const pal = categoryColor(cat.id);
    html += `<div class="category-group">
      <div class="category-header" style="--cat-color:${pal.color}">
        <span class="icon">${cat.icon}</span><span>${escapeHtml(cat.name)}</span>
        <span class="count">${items.length}</span>
      </div>`;
    items.forEach(f => {
      const inList = AppState.shoppingList.some(s => s.food_id === f.id && !s.purchased);
      html += `
        <div class="food-card" style="--cat-color:${pal.color}">
          <div class="item-body">
            <div class="food-name">${escapeHtml(f.name)}</div>
            <div class="food-meta">${formatQty(f.default_quantity)} ${escapeHtml(f.unit)}${f.notes ? ' · ' + escapeHtml(f.notes) : ''}</div>
          </div>
          <div class="food-actions">
            <button class="btn-add ${inList ? 'in-list' : ''}" data-add-food="${f.id}">${inList ? '✓ En lista' : '+ Añadir'}</button>
            <button class="icon-btn" data-edit-food="${f.id}">✏️</button>
            <button class="icon-btn" data-delete-food="${f.id}">🗑️</button>
          </div>
        </div>`;
    });
    html += `</div>`;
  });

  container.innerHTML = html || `<div class="empty-state"><span class="emoji">🥕</span><p>Nada por aquí todavía.</p></div>`;

  container.querySelectorAll('[data-add-food]').forEach(btn => {
    btn.addEventListener('click', () => addFoodToShoppingList(btn.dataset.addFood));
  });
  container.querySelectorAll('[data-edit-food]').forEach(btn => {
    btn.addEventListener('click', () => openFoodSheet(AppState.foodById(btn.dataset.editFood)));
  });
  container.querySelectorAll('[data-delete-food]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (confirm('¿Eliminar este alimento del catálogo?')) deleteFood(btn.dataset.deleteFood);
    });
  });
}

function formatQty(q) {
  const n = Number(q);
  return Number.isInteger(n) ? n : n.toFixed(1).replace(/\.0$/, '');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}
