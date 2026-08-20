// ============================================================
// App — arranque, navegación entre pantallas, auth state
// ============================================================

const SCREENS = ['auth', 'reset-password', 'group-setup', 'shopping', 'foods', 'tasks', 'settings', 'loading'];
let passwordRecoveryMode = false;

// Comprueba la URL directamente (en vez de fiarnos solo del evento
// PASSWORD_RECOVERY, que a veces llega antes de que empecemos a escuchar,
// o se "camufla" como un simple inicio de sesión normal). Supabase incluye
// "type=recovery" tanto en el fragmento #hash como en la query string,
// según el formato de enlace que use el proyecto.
function urlIndicatesPasswordRecovery() {
  const hash = window.location.hash || '';
  const search = window.location.search || '';
  return hash.includes('type=recovery') || search.includes('type=recovery');
}

// Si Supabase redirige con un error en la URL (enlace caducado, ya usado,
// etc.), lo capturamos aquí para mostrarlo en la pantalla de login, y
// limpiamos la URL para que no se quede pegado ni se reprocese al recargar.
let pendingAuthHashError = null;
function checkAuthHashError() {
  const hash = window.location.hash || '';
  if (!hash.includes('error=')) return;

  const params = new URLSearchParams(hash.substring(1));
  const code = params.get('error_code');
  const description = params.get('error_description');

  pendingAuthHashError = (code === 'otp_expired')
    ? 'El enlace ha caducado o ya se ha usado. Pide uno nuevo.'
    : (description ? decodeURIComponent(description.replace(/\+/g, ' ')) : 'El enlace no es válido. Pide uno nuevo.');

  history.replaceState(null, '', window.location.pathname + window.location.search);
}

function showScreen(name) {
  SCREENS.forEach(s => {
    document.getElementById(`screen-${s}`).classList.toggle('hidden', s !== name);
  });
  const nav = document.getElementById('bottom-nav');
  const showNav = ['shopping', 'foods', 'tasks', 'settings'].includes(name);
  nav.classList.toggle('hidden', !showNav);
  if (showNav) {
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.screen === name);
    });
  }
}

function initBottomNav() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      showScreen(btn.dataset.screen);
      if (btn.dataset.screen === 'settings') renderSettingsScreen();
      if (btn.dataset.screen === 'tasks') renderTasksScreen();
    });
  });
}

async function loadProfile() {
  const { data, error } = await supabaseClient
    .from('profiles')
    .select('id, name, avatar_id')
    .eq('id', AppState.session.user.id)
    .single();
  if (!error) AppState.profile = data;
  updateNavAvatar();
}

function updateNavAvatar() {
  const img = document.getElementById('nav-avatar-icon');
  if (img) img.src = avatarUrl(AppState.profile?.avatar_id);
}

// Se ejecuta una vez que sabemos que el usuario ya tiene grupo asignado.
// Solo carga datos y renderiza — la navegación la decide quien llama.
async function bootAfterGroup() {
  showScreen('loading');
  await Promise.all([loadCategories(), loadFoods(), loadShoppingList(), loadMembers(), loadTasks()]);
  renderShoppingScreen();
  renderFoodsScreen();
  renderSettingsScreen();
  renderTasksScreen();
  subscribeRealtime();
  startReminderWatch();
}

async function bootApp() {
  showScreen('loading');

  const { data: { session } } = await supabaseClient.auth.getSession();
  AppState.session = session;

  if (!session) {
    showScreen('auth');
    if (pendingAuthHashError) {
      showAuthError(pendingAuthHashError);
      pendingAuthHashError = null;
    }
    return;
  }

  await loadProfile();
  await loadMyGroups();

  if (!AppState.myGroups.length) {
    showScreen('group-setup');
    return;
  }

  const savedId = getSavedActiveGroupId();
  const target = AppState.myGroups.find(g => g.group_id === savedId) || AppState.myGroups[0];
  await selectActiveGroupAndBoot(target.group_id);
  showScreen('shopping');
}

function resetAppState() {
  unsubscribeRealtime();
  stopReminderWatch();
  AppState.session = null;
  AppState.profile = null;
  AppState.group = null;
  AppState.myGroups = [];
  AppState.members = [];
  AppState.categories = [];
  AppState.foods = [];
  AppState.shoppingList = [];
  AppState.tasks = [];
  AppState.taskListItems = [];
  updateNavAvatar();
}

document.addEventListener('DOMContentLoaded', () => {
  initAuthScreen();
  initGroupSetupScreen();
  initFoodsScreen();
  initShoppingScreen();
  initTasksScreen();
  initSettingsScreen();
  initBottomNav();

  if (urlIndicatesPasswordRecovery()) {
    passwordRecoveryMode = true;
    showScreen('reset-password');
  } else {
    checkAuthHashError();
  }

  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') {
      // El usuario ha vuelto desde el enlace de "recuperar contraseña" del
      // email. Hay una sesión temporal válida, pero antes de dejarle entrar
      // a la app le pedimos que elija una contraseña nueva.
      passwordRecoveryMode = true;
      AppState.session = session;
      showScreen('reset-password');
      return;
    }
    if (event === 'SIGNED_OUT') {
      passwordRecoveryMode = false;
      resetAppState();
      showScreen('auth');
      return;
    }
    if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') {
      AppState.session = session;
      if (passwordRecoveryMode) return; // Esperamos a que complete el formulario de nueva contraseña.
      if (event !== 'TOKEN_REFRESHED') bootApp();
    }
  });

  registerServiceWorker();
});

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {
        // Silencioso: la app funciona igual sin SW, solo pierde el modo offline básico.
      });
    });
  }
}
