// ============================================================
// App — arranque, navegación entre pantallas, auth state
// ============================================================

const SCREENS = ['auth', 'group-setup', 'shopping', 'foods', 'settings', 'loading'];

function showScreen(name) {
  SCREENS.forEach(s => {
    document.getElementById(`screen-${s}`).classList.toggle('hidden', s !== name);
  });
  const nav = document.getElementById('bottom-nav');
  const showNav = ['shopping', 'foods', 'settings'].includes(name);
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
  await Promise.all([loadCategories(), loadFoods(), loadShoppingList(), loadMembers()]);
  renderShoppingScreen();
  renderFoodsScreen();
  renderSettingsScreen();
  subscribeRealtime();
}

async function bootApp() {
  showScreen('loading');

  const { data: { session } } = await supabaseClient.auth.getSession();
  AppState.session = session;

  if (!session) {
    showScreen('auth');
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
  AppState.session = null;
  AppState.profile = null;
  AppState.group = null;
  AppState.myGroups = [];
  AppState.members = [];
  AppState.categories = [];
  AppState.foods = [];
  AppState.shoppingList = [];
  updateNavAvatar();
}

document.addEventListener('DOMContentLoaded', () => {
  initAuthScreen();
  initGroupSetupScreen();
  initFoodsScreen();
  initShoppingScreen();
  initSettingsScreen();
  initBottomNav();

  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') {
      resetAppState();
      showScreen('auth');
      return;
    }
    if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') {
      AppState.session = session;
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
