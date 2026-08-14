// ============================================================
// Cuenta — perfil, mis grupos, grupo activo, miembros
// ============================================================

function initSettingsScreen() {
  document.getElementById('btn-logout').addEventListener('click', async () => {
    if (confirm('¿Cerrar sesión?')) await logout();
  });

  document.getElementById('btn-open-add-group').addEventListener('click', openAddGroupSheet);
  document.getElementById('btn-view-members').addEventListener('click', openMembersSheet);
  document.getElementById('btn-leave-group').addEventListener('click', onLeaveGroupClick);
  document.getElementById('btn-delete-group').addEventListener('click', onDeleteGroupClick);

  document.querySelectorAll('[data-group-tab]').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('[data-group-tab]').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const isCreate = tab.dataset.groupTab === 'create';
      document.getElementById('form-create-group-sheet').classList.toggle('hidden', !isCreate);
      document.getElementById('form-join-group-sheet').classList.toggle('hidden', isCreate);
      hideAddGroupError();
    });
  });

  document.querySelectorAll('[data-close-add-group]').forEach(btn => {
    btn.addEventListener('click', closeAddGroupSheet);
  });
  document.getElementById('sheet-add-group').addEventListener('click', (e) => {
    if (e.target.id === 'sheet-add-group') closeAddGroupSheet();
  });
  document.getElementById('sheet-members').addEventListener('click', (e) => {
    if (e.target.id === 'sheet-members') closeMembersSheet();
  });
  document.getElementById('btn-change-avatar').addEventListener('click', openAvatarPicker);
  document.getElementById('sheet-avatar-picker').addEventListener('click', (e) => {
    if (e.target.id === 'sheet-avatar-picker') closeAvatarPicker();
  });

  document.getElementById('form-create-group-sheet').addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAddGroupError();
    const name = document.getElementById('sheet-new-group-name').value.trim() || 'Nuevo grupo';
    const btn = e.target.querySelector('button[type="submit"]');
    btn.textContent = 'Creando…';
    try {
      const groupId = await createGroupFlow(name);
      await selectActiveGroupAndBoot(groupId);
      closeAddGroupSheet();
      showScreen('shopping');
      showToast('Grupo creado');
    } catch (err) {
      showAddGroupError(err.message || 'No se pudo crear el grupo.');
    } finally {
      btn.textContent = 'Crear';
    }
  });

  document.getElementById('form-join-group-sheet').addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAddGroupError();
    const code = document.getElementById('sheet-join-group-code').value.trim();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.textContent = 'Uniéndome…';
    try {
      const groupId = await joinGroupFlow(code);
      await selectActiveGroupAndBoot(groupId);
      closeAddGroupSheet();
      showScreen('shopping');
      showToast('Te has unido al grupo');
    } catch (err) {
      showAddGroupError('Código no válido. Comprueba que lo has escrito bien.');
    } finally {
      btn.textContent = 'Unirme';
    }
  });
}

function renderSettingsScreen() {
  document.getElementById('settings-name').textContent = AppState.profile?.name || '—';
  document.getElementById('settings-email').textContent = AppState.session?.user?.email || '—';
  document.getElementById('profile-avatar-img').src = avatarUrl(AppState.profile?.avatar_id);
  renderMyGroupsList();
  renderActiveGroupCard();
}

// ---------------- Mis grupos ----------------

function renderMyGroupsList() {
  const container = document.getElementById('my-groups-list');
  if (!container) return;

  if (!AppState.myGroups.length) {
    container.innerHTML = `<p style="font-size:13px;color:var(--ink-soft);margin:4px 0 0;">Aún no perteneces a ningún grupo.</p>`;
    return;
  }

  container.innerHTML = AppState.myGroups.map(g => {
    const isActive = AppState.group && AppState.group.id === g.group_id;
    return `
      <div class="settings-row" data-select-group="${g.group_id}" style="cursor:pointer;">
        <span style="${isActive ? 'font-weight:700;' : ''}">
          ${isActive ? '✓ ' : ''}${escapeHtml(g.name)}
          ${g.is_owner ? '<span style="color:var(--ink-soft);font-size:11px;font-weight:400;"> · Propietario</span>' : ''}
        </span>
        <span class="label">${g.member_count} ${g.member_count === 1 ? 'miembro' : 'miembros'}</span>
      </div>`;
  }).join('');

  container.querySelectorAll('[data-select-group]').forEach(row => {
    row.addEventListener('click', () => switchGroup(row.dataset.selectGroup));
  });
}

// ---------------- Grupo activo ----------------

function renderActiveGroupCard() {
  const card = document.getElementById('active-group-card');
  if (!AppState.group) {
    card.classList.add('hidden');
    return;
  }
  card.classList.remove('hidden');
  document.getElementById('active-group-name').textContent = AppState.group.name;
  document.getElementById('settings-invite-code').textContent = AppState.group.invite_code || '—';
  document.getElementById('btn-delete-group').classList.toggle('hidden', !AppState.group.is_owner);
}

// ---------------- Sheet: añadir grupo ----------------

function openAddGroupSheet() {
  document.getElementById('sheet-add-group').classList.remove('hidden');
}
function closeAddGroupSheet() {
  document.getElementById('sheet-add-group').classList.add('hidden');
  document.getElementById('form-create-group-sheet').reset();
  document.getElementById('form-join-group-sheet').reset();
  hideAddGroupError();
}
function showAddGroupError(msg) {
  const el = document.getElementById('add-group-error');
  el.textContent = msg;
  el.classList.remove('hidden');
}
function hideAddGroupError() {
  document.getElementById('add-group-error').classList.add('hidden');
}

// ---------------- Sheet: miembros ----------------

function openMembersSheet() {
  const list = document.getElementById('members-list');
  if (!AppState.members.length) {
    list.innerHTML = `<p style="font-size:13px;color:var(--ink-soft)">No se pudo cargar la lista de miembros.</p>`;
  } else {
    list.innerHTML = AppState.members.map(m => `
      <div class="settings-row">
        <span class="member-row-flex">
          <img class="member-avatar" src="${avatarUrl(m.avatar_id)}" alt="">
          <span>
            ${escapeHtml(m.name)}${m.is_owner ? ' 👑' : ''}<br>
            <span style="font-size:11.5px;color:var(--ink-soft);font-weight:400;">${escapeHtml(m.email || '')}</span>
          </span>
        </span>
        ${m.is_owner ? '<span class="label">Propietario</span>' : ''}
      </div>`).join('');
  }
  document.getElementById('sheet-members').classList.remove('hidden');
}
function closeMembersSheet() {
  document.getElementById('sheet-members').classList.add('hidden');
}

// ---------------- Sheet: elegir avatar ----------------

function openAvatarPicker() {
  const grid = document.getElementById('avatar-picker-grid');
  const current = AppState.profile?.avatar_id || DEFAULT_AVATAR_ID;
  grid.innerHTML = AVATAR_IDS.map(id => `
    <button class="avatar-option ${id === current ? 'selected' : ''}" data-pick-avatar="${id}">
      <img src="${avatarUrl(id)}" alt="${id}">
    </button>`).join('');
  grid.querySelectorAll('[data-pick-avatar]').forEach(btn => {
    btn.addEventListener('click', () => saveAvatar(btn.dataset.pickAvatar));
  });
  document.getElementById('sheet-avatar-picker').classList.remove('hidden');
}

function closeAvatarPicker() {
  document.getElementById('sheet-avatar-picker').classList.add('hidden');
}

async function saveAvatar(avatarId) {
  if (!AppState.profile || AppState.profile.avatar_id === avatarId) {
    closeAvatarPicker();
    return;
  }
  const previous = AppState.profile.avatar_id;
  // Optimista
  AppState.profile.avatar_id = avatarId;
  document.getElementById('profile-avatar-img').src = avatarUrl(avatarId);
  updateNavAvatar();
  closeAvatarPicker();

  const { error } = await supabaseClient
    .from('profiles')
    .update({ avatar_id: avatarId })
    .eq('id', AppState.session.user.id);

  if (error) {
    AppState.profile.avatar_id = previous;
    document.getElementById('profile-avatar-img').src = avatarUrl(previous);
    updateNavAvatar();
    showToast('No se pudo guardar el avatar.');
    return;
  }
  showToast('Avatar actualizado');
  await loadMembers();
  renderShoppingScreen();
}

// ---------------- Salir / eliminar grupo ----------------

async function onLeaveGroupClick() {
  if (!AppState.group) return;
  const isOnlyGroup = AppState.myGroups.length <= 1;
  const extra = isOnlyGroup ? '\n\nEs tu único grupo: tendrás que crear uno nuevo o unirte a otro después.' : '';
  if (!confirm(`¿Salir del grupo "${AppState.group.name}"?${extra}`)) return;
  await leaveGroupFlow(AppState.group.id);
}

async function onDeleteGroupClick() {
  if (!AppState.group) return;
  if (!confirm(`¿Eliminar el grupo "${AppState.group.name}"?\n\nSe borrarán todos sus productos, alimentos y categorías para todos los miembros. Esta acción no se puede deshacer.`)) return;
  await deleteGroupFlow(AppState.group.id);
}
