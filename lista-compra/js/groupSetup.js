// ============================================================
// Configuración de grupo (crear o unirse)
// ============================================================

function initGroupSetupScreen() {
  document.getElementById('btn-create-group').addEventListener('click', async () => {
    hideGroupSetupError();
    const name = document.getElementById('new-group-name').value.trim() || 'Nuestra compra';
    const btn = document.getElementById('btn-create-group');
    btn.textContent = 'Creando…';
    try {
      const { data, error } = await supabaseClient.rpc('create_group_with_defaults', { group_name: name });
      if (error) throw error;
      await loadGroupAndBoot(data);
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
      const { data, error } = await supabaseClient.rpc('join_group_by_code', { code });
      if (error) throw error;
      await loadGroupAndBoot(data);
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

// Comprueba si el usuario ya pertenece a un grupo; si es así lo carga.
async function findExistingGroup() {
  const { data, error } = await supabaseClient
    .from('group_members')
    .select('group_id, groups(id, name, invite_code)')
    .eq('user_id', AppState.session.user.id)
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data.groups;
}

async function loadGroupAndBoot(groupId) {
  const { data, error } = await supabaseClient
    .from('groups')
    .select('id, name, invite_code')
    .eq('id', groupId)
    .single();

  if (error) {
    showGroupSetupError('No se pudo cargar el grupo.');
    return;
  }
  AppState.group = data;
  await bootAfterGroup();
}
