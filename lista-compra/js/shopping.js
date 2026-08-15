// ============================================================
// Lista de la compra
// ============================================================

async function loadShoppingList() {
  const { data, error } = await supabaseClient
    .from('shopping_list')
    .select('id, food_id, quantity, purchased, created_at, purchased_at, added_by, assigned_to, foods(id, name, unit, category_id)')
    .eq('group_id', AppState.group.id)
    .order('created_at');
  if (!error) AppState.shoppingList = data;
}

function initShoppingScreen() {
  document.getElementById('fab-add-item').addEventListener('click', openQuickAddSheet);
  document.getElementById('sheet-quick-add').addEventListener('click', (e) => {
    if (e.target.id === 'sheet-quick-add') closeQuickAddSheet();
  });
  document.getElementById('sheet-assign').addEventListener('click', (e) => {
    if (e.target.id === 'sheet-assign') closeAssignSheet();
  });
}

// Añade un alimento del catálogo a la lista con un click.
// Si ya está pendiente, suma la cantidad habitual en vez de duplicar.
async function addFoodToShoppingList(foodId) {
  const food = AppState.foodById(foodId);
  if (!food) return;

  const existing = AppState.shoppingList.find(s => s.food_id === foodId && !s.purchased);

  if (existing) {
    await updateShoppingQuantity(existing.id, existing.quantity + food.default_quantity);
    showToast(`${food.name}: cantidad aumentada`);
    return;
  }

  const { error } = await supabaseClient.from('shopping_list').insert({
    group_id: AppState.group.id,
    food_id: foodId,
    quantity: food.default_quantity,
    added_by: AppState.session.user.id
  });

  if (error) {
    // Carrera con el índice único: si ya existe, recarga y suma.
    await loadShoppingList();
    const nowExisting = AppState.shoppingList.find(s => s.food_id === foodId && !s.purchased);
    if (nowExisting) await updateShoppingQuantity(nowExisting.id, nowExisting.quantity + food.default_quantity);
    return;
  }

  showToast(`${food.name} añadido a la compra`);
  await loadShoppingList();
  renderShoppingScreen();
  renderFoodsScreen();
}

async function updateShoppingQuantity(itemId, newQty) {
  if (newQty <= 0) return deleteShoppingItem(itemId);
  // Actualización optimista
  const item = AppState.shoppingList.find(i => i.id === itemId);
  if (item) item.quantity = newQty;
  renderShoppingScreen();

  const { error } = await supabaseClient
    .from('shopping_list')
    .update({ quantity: newQty })
    .eq('id', itemId);
  if (error) {
    await loadShoppingList();
    renderShoppingScreen();
  }
}

async function togglePurchased(itemId) {
  const item = AppState.shoppingList.find(i => i.id === itemId);
  if (!item) return;
  const purchased = !item.purchased;

  // Optimista
  item.purchased = purchased;
  renderShoppingScreen();
  renderFoodsScreen();

  const { error } = await supabaseClient
    .from('shopping_list')
    .update({ purchased, purchased_at: purchased ? new Date().toISOString() : null })
    .eq('id', itemId);

  if (error) {
    item.purchased = !purchased;
    renderShoppingScreen();
  }
}

async function deleteShoppingItem(itemId) {
  AppState.shoppingList = AppState.shoppingList.filter(i => i.id !== itemId);
  renderShoppingScreen();
  renderFoodsScreen();
  const { error } = await supabaseClient.from('shopping_list').delete().eq('id', itemId);
  if (error) {
    await loadShoppingList();
    renderShoppingScreen();
  }
}

async function clearPurchased() {
  const ids = AppState.shoppingList.filter(i => i.purchased).map(i => i.id);
  if (!ids.length) return;
  AppState.shoppingList = AppState.shoppingList.filter(i => !i.purchased);
  renderShoppingScreen();
  renderFoodsScreen();
  await supabaseClient.from('shopping_list').delete().in('id', ids);
}

// ---------------- Quick add sheet ----------------

function openQuickAddSheet() {
  const list = document.getElementById('quick-add-list');
  if (!AppState.foods.length) {
    list.innerHTML = `<div class="empty-state">
      <span class="emoji">🥕</span>
      <p>Aún no tienes alimentos en el catálogo.</p>
      <p class="hint">Ve a la pestaña Alimentos para crear el primero.</p>
    </div>`;
  } else {
    const pendingIds = new Set(AppState.shoppingList.filter(i => !i.purchased).map(i => i.food_id));
    list.innerHTML = AppState.foods.map(f => {
      const pal = categoryColor(f.category_id);
      const inList = pendingIds.has(f.id);
      return `<div class="food-card" style="--cat-color:${pal.color}">
        <div class="item-body">
          <div class="food-name">${escapeHtml(f.name)}</div>
          <div class="food-meta">${formatQty(f.default_quantity)} ${escapeHtml(f.unit)}</div>
        </div>
        <button class="btn-add ${inList ? 'in-list' : ''}" data-quick-add="${f.id}">${inList ? '✓ En lista' : '+ Añadir'}</button>
      </div>`;
    }).join('');
    list.querySelectorAll('[data-quick-add]').forEach(btn => {
      btn.addEventListener('click', async () => {
        await addFoodToShoppingList(btn.dataset.quickAdd);
        openQuickAddSheet(); // refresca estado de botones
      });
    });
  }
  document.getElementById('sheet-quick-add').classList.remove('hidden');
}

function closeQuickAddSheet() {
  document.getElementById('sheet-quick-add').classList.add('hidden');
}

// ---------------- Render ----------------

function renderShoppingScreen() {
  const container = document.getElementById('shopping-content');
  const pending = AppState.shoppingList.filter(i => !i.purchased);
  const purchased = AppState.shoppingList.filter(i => i.purchased);

  document.getElementById('pending-count').textContent = `${pending.length} pendientes`;

  if (!AppState.shoppingList.length) {
    container.innerHTML = `<div class="empty-state">
      <span class="emoji">🧺</span>
      <p>Tu lista está vacía.</p>
      <p class="hint">Toca + para añadir productos desde tu catálogo.</p>
    </div>`;
    return;
  }

  const byCategory = {};
  pending.forEach(item => {
    const catId = item.foods?.category_id;
    (byCategory[catId] ||= []).push(item);
  });

  let html = '';
  if (pending.length === 0) {
    html += `<div class="empty-state">
      <span class="emoji">✅</span>
      <p>¡Todo comprado!</p>
      <p class="hint">Añade más productos cuando los necesites.</p>
    </div>`;
  } else {
    AppState.categories.forEach(cat => {
      const items = byCategory[cat.id];
      if (!items || !items.length) return;
      const pal = categoryColor(cat.id);
      const collapsed = AppState.uiState.collapsedShoppingCategories.has(cat.id);
      html += `<div class="category-group ${collapsed ? 'collapsed' : ''}">
        <div class="category-header" style="--cat-color:${pal.color}" data-cat-toggle="${cat.id}">
          <span class="icon">${cat.icon}</span><span>${escapeHtml(cat.name)}</span>
          <span class="count">${items.length}</span>
          <span class="chevron">▾</span>
        </div>
        <div class="category-items">`;
      items.forEach(item => { html += renderItemRow(item, pal); });
      html += `</div></div>`;
    });
  }

  if (purchased.length) {
    html += `<div class="purchased-section">
      <div class="purchased-section-header">
        <h2>Comprados (${purchased.length})</h2>
        <button class="link-btn" id="btn-clear-purchased">Limpiar</button>
      </div>`;
    purchased.forEach(item => {
      const pal = categoryColor(item.foods?.category_id);
      html += renderItemRow(item, pal);
    });
    html += `</div>`;
  }

  container.innerHTML = html;
  attachShoppingListeners(container);
}

function renderItemRow(item, pal) {
  const name = item.foods?.name || '(eliminado)';
  const unit = item.foods?.unit || '';
  const assignedName = AppState.memberName(item.assigned_to);
  const assignedLabel = assignedName
    ? `<span class="assign-chip"><img class="assign-avatar" src="${avatarUrl(AppState.memberAvatar(item.assigned_to))}" alt="">${escapeHtml(assignedName)}</span>`
    : `<span>Sin asignar</span>`;
  return `
    <div class="item-row ${item.purchased ? 'purchased' : ''}" style="--cat-color:${pal.color}">
      <button class="item-check ${item.purchased ? 'checked' : ''}" data-toggle="${item.id}">✓</button>
      <div class="item-body" data-assign="${item.id}">
        <div class="item-name">${escapeHtml(name)}</div>
        <div class="item-meta">
          <span>${formatQty(item.quantity)} ${escapeHtml(unit)}</span>
          <span class="meta-sep">·</span>
          ${assignedLabel}
        </div>
      </div>
      ${!item.purchased ? `
      <div class="qty-stepper">
        <button data-decr="${item.id}">−</button>
        <span class="qty-val">${formatQty(item.quantity)}</span>
        <button data-incr="${item.id}">+</button>
      </div>` : ''}
      <button class="item-delete" data-delete="${item.id}">✕</button>
    </div>`;
}

function attachShoppingListeners(container) {
  container.querySelectorAll('[data-toggle]').forEach(btn => {
    btn.addEventListener('click', () => togglePurchased(btn.dataset.toggle));
  });
  container.querySelectorAll('[data-incr]').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = AppState.shoppingList.find(i => i.id === btn.dataset.incr);
      const step = item?.foods?.unit && ['kg', 'l'].includes(item.foods.unit) ? 0.5 : 1;
      updateShoppingQuantity(btn.dataset.incr, item.quantity + step);
    });
  });
  container.querySelectorAll('[data-decr]').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = AppState.shoppingList.find(i => i.id === btn.dataset.decr);
      const step = item?.foods?.unit && ['kg', 'l'].includes(item.foods.unit) ? 0.5 : 1;
      updateShoppingQuantity(btn.dataset.decr, item.quantity - step);
    });
  });
  container.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', () => deleteShoppingItem(btn.dataset.delete));
  });
  container.querySelectorAll('[data-assign]').forEach(el => {
    el.addEventListener('click', () => openAssignSheet(el.dataset.assign));
  });
  const clearBtn = document.getElementById('btn-clear-purchased');
  if (clearBtn) clearBtn.addEventListener('click', clearPurchased);
  container.querySelectorAll('[data-cat-toggle]').forEach(el => {
    el.addEventListener('click', () => toggleShoppingCategory(el.dataset.catToggle));
  });
}

async function updateAssignment(itemId, userId) {
  // Optimista
  const item = AppState.shoppingList.find(i => i.id === itemId);
  if (item) item.assigned_to = userId;
  renderShoppingScreen();
  closeAssignSheet();

  const { error } = await supabaseClient
    .from('shopping_list')
    .update({ assigned_to: userId })
    .eq('id', itemId);

  if (error) {
    showToast('No se pudo asignar el producto.');
    await loadShoppingList();
    renderShoppingScreen();
  }
}

function openAssignSheet(itemId) {
  const item = AppState.shoppingList.find(i => i.id === itemId);
  if (!item) return;
  const list = document.getElementById('assign-list');

  const rows = [{ user_id: null, name: 'Sin asignar', avatar_id: null }, ...AppState.members];

  list.innerHTML = rows.map(m => {
    const selected = (item.assigned_to || null) === (m.user_id || null);
    const avatarImg = m.avatar_id
      ? `<img class="member-avatar" src="${avatarUrl(m.avatar_id)}" alt="">`
      : `<span class="member-avatar" style="display:inline-flex;align-items:center;justify-content:center;background:var(--paper-dim);">—</span>`;
    return `
      <div class="settings-row member-row-flex" data-pick-assignee="${m.user_id ?? ''}" style="cursor:pointer;">
        ${avatarImg}
        <span style="${selected ? 'font-weight:700;' : ''}">${selected ? '✓ ' : ''}${escapeHtml(m.name)}</span>
      </div>`;
  }).join('');

  list.querySelectorAll('[data-pick-assignee]').forEach(row => {
    row.addEventListener('click', () => {
      updateAssignment(itemId, row.dataset.pickAssignee || null);
    });
  });

  document.getElementById('sheet-assign').classList.remove('hidden');
}

function closeAssignSheet() {
  document.getElementById('sheet-assign').classList.add('hidden');
}

function toggleShoppingCategory(catId) {
  const set = AppState.uiState.collapsedShoppingCategories;
  if (set.has(catId)) set.delete(catId); else set.add(catId);
  renderShoppingScreen();
}
