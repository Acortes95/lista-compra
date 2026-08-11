// ============================================================
// Autenticación
// ============================================================

function initAuthScreen() {
  const tabs = document.querySelectorAll('.auth-tab');
  const formLogin = document.getElementById('form-login');
  const formSignup = document.getElementById('form-signup');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const isLogin = tab.dataset.tab === 'login';
      formLogin.classList.toggle('hidden', !isLogin);
      formSignup.classList.toggle('hidden', isLogin);
      hideAuthError();
    });
  });

  formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAuthError();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const btn = formLogin.querySelector('button[type="submit"]');
    btn.textContent = 'Entrando…';
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    btn.textContent = 'Entrar';
    if (error) return showAuthError(translateAuthError(error));
    // onAuthStateChange en app.js se encarga del resto
  });

  formSignup.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAuthError();
    const name = document.getElementById('signup-name').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;
    const btn = formSignup.querySelector('button[type="submit"]');
    btn.textContent = 'Creando…';
    const { error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: { data: { name } }
    });
    btn.textContent = 'Crear cuenta';
    if (error) return showAuthError(translateAuthError(error));
    showToast('Cuenta creada. ¡Bienvenido/a!');
  });
}

function showAuthError(msg) {
  const el = document.getElementById('auth-error');
  el.textContent = msg;
  el.classList.remove('hidden');
}
function hideAuthError() {
  document.getElementById('auth-error').classList.add('hidden');
}

function translateAuthError(error) {
  const msg = error.message || '';
  if (msg.includes('Invalid login credentials')) return 'Email o contraseña incorrectos.';
  if (msg.includes('User already registered')) return 'Ya existe una cuenta con ese email.';
  if (msg.includes('Password should be')) return 'La contraseña debe tener al menos 6 caracteres.';
  return 'Ha ocurrido un error. Inténtalo de nuevo.';
}

async function logout() {
  await supabaseClient.auth.signOut();
}
