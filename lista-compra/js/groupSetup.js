// ============================================================
// Grupos — crear, unirse, listar, cambiar, salir, eliminar
// ============================================================

function initGroupSetupScreen() {
  document.getElementById('btn-create-group').addEventListener('click', async () => {
    hideGroupSetupError();
    const name = document.getElementById('new-group-name').value.trim() || 'Nuestra compra';
    const btn = document.getElementById('btn-create-group');
    btn.textContent = 'Creando…';
    try {
      const groupId = await createGroupFlow(name);
      await selectActiveGroupAndBoot(groupId);
      showScreen('shopping');
    } catch (err) {
      showGroupSetupError(err.message || 'No se pudo crear el grupo.');
    } finally {
      btn.textContent = 'Crear grupo';
    }
  });

  document.getElementById('btn-join-group').addEventListener('click', async () => {
    hideGroupSetupError();
    const code = document.getElementById('join-group-code').value.trim();
    if (!code) return showGroupSetupError('Introduce un código de invitación.');
    const btn = document.getElementById('btn-join-group');
    btn.textContent = 'Uniéndome…';
    try {
      const groupId = await joinGroupFlow(code);
      await selectActiveGroupAndBoot(groupId);
      showScreen('shopping');
    } catch (err) {
      showGroupSetupError('Código no válido. Comprueba que lo has escrito bien.');
    } finally {
      btn.textContent = 'Unirme';
    }
  });
}

function showGroupSetupError(msg) {
  const el = document.getElementById('group-setup-error');
  el.textContent = msg;
  el.classList.remove('hidden');
}
function hideGroupSetupError() {
  document.getElementById('group-setup-error').classList.add('hidden');
}

// ---------------- Operaciones compartidas (onboarding + Cuenta) ----------------

async function createGroupFlow(name) {
  const { data, error } = await supabaseClient.rpc('create_group_with_defaults', { group_name: name });
  if (error) throw error;
  return data; // uuid del nuevo grupo
}

async function joinGroupFlow(code) {
  const { data, error } = await supabaseClient.rpc('join_group_by_code', { code });
  if (error) throw error;
  return data; // uuid del grupo al que te has unido
}

async function loadMyGroups() {
  const { data, error } = await supabaseClient.rpc('get_my_groups');
  if (!error) AppState.myGroups = data || [];
}

async function loadMembers() {
  if (!AppState.group) { AppState.members = []; return; }
  const { data, error } = await supabaseClient.rpc('get_group_members', { target_group_id: AppState.group.id });
  if (!error) AppState.members = data || [];
}

function saveActiveGroupId(id) {
  try { localStorage.setItem('activeGroupId', id); } catch (e) { /* ignorar */ }
}
function getSavedActiveGroupId() {
  try { return localStorage.getItem('activeGroupId'); } catch (e) { return null; }
}
function clearSavedActiveGroupId() {
  try { localStorage.removeItem('activeGroupId'); } catch (e) { /* ignorar */ }
}

// Marca un grupo como el activo, recarga sus datos y se suscribe a realtime.
// No navega de pantalla — eso lo decide quien la llama.
async function selectActiveGroupAndBoot(groupId) {
  await loadMyGroups();
  const g = AppState.myGroups.find(g => g.group_id === groupId);
  if (!g) {
    showToast('No se pudo cargar ese grupo.');
    return;
  }
  AppState.group = { id: g.group_id, name: g.name, invite_code: g.invite_code, is_owner: g.is_owner };
  saveActiveGroupId(g.group_id);
  await bootAfterGroup();
}

async function switchGroup(groupId) {
  if (AppState.group && AppState.group.id === groupId) return;
  await selectActiveGroupAndBoot(groupId);
  showScreen('shopping');
  showToast('Has cambiado de grupo');
}

async function leaveGroupFlow(groupId) {
  const { error } = await supabaseClient.rpc('leave_group', { target_group_id: groupId });
  if (error) {
    showToast('No se pudo abandonar el grupo.');
    return;
  }
  showToast('Has salido del grupo');
  await afterLeavingOrDeleting(groupId);
}

async function deleteGroupFlow(groupId) {
  const { error } = await supabaseClient.from('groups').delete().eq('id', groupId);
  if (error) {
    showToast('No se pudo eliminar el grupo.');
    return;
  }
  showToast('Grupo eliminado');
  await afterLeavingOrDeleting(groupId);
}

// Tras salir/eliminar el grupo activo: pasa a otro grupo tuyo si tienes,
// o vuelve a la pantalla de crear/unirse si te has quedado sin ninguno.
async function afterLeavingOrDeleting(affectedGroupId) {
  await loadMyGroups();
  if (AppState.group && AppState.group.id === affectedGroupId) {
    if (AppState.myGroups.length) {
      await selectActiveGroupAndBoot(AppState.myGroups[0].group_id);
    } else {
      resetGroupState();
      showScreen('group-setup');
      return;
    }
  }
  renderSettingsScreen();
}

function resetGroupState() {
  unsubscribeRealtime();
  AppState.group = null;
  AppState.categories = [];
  AppState.foods = [];
  AppState.shoppingList = [];
  AppState.members = [];
  clearSavedActiveGroupId();
}
