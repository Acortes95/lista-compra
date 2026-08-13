// ============================================================
// Ajustes
// ============================================================

function initSettingsScreen() {
  document.getElementById('btn-logout').addEventListener('click', async () => {
    if (confirm('¿Cerrar sesión?')) await logout();
  });
}

function renderSettingsScreen() {
  document.getElementById('settings-name').textContent = AppState.profile?.name || '—';
  document.getElementById('settings-email').textContent = AppState.session?.user?.email || '—';
  document.getElementById('settings-invite-code').textContent = AppState.group?.invite_code || '—';
}
