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
    .select('id, name')
    .eq('id', AppState.session.user.id)
    .single();
  if (!error) AppState.profile = data;
}

// Se ejecuta una vez que sabemos que el usuario ya tiene grupo asignado
async function bootAfterGroup() {
  showScreen('loading');
  await Promise.all([loadCategories(), loadFoods(), loadShoppingList()]);
  renderShoppingScreen();
  renderFoodsScreen();
  renderSettingsScreen();
  subscribeRealtime();
  showScreen('shopping');
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
  const existingGroup = await findExistingGroup();

  if (!existingGroup) {
    showScreen('group-setup');
    return;
  }

  AppState.group = existingGroup;
  await bootAfterGroup();
}

function resetAppState() {
  unsubscribeRealtime();
  AppState.session = null;
  AppState.profile = null;
  AppState.group = null;
  AppState.categories = [];
  AppState.foods = [];
  AppState.shoppingList = [];
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
