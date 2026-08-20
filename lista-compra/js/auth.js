// ============================================================
// Autenticación
// ============================================================

let lastSignupEmail = '';

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
    if (error) {
      if ((error.message || '').includes('Email not confirmed')) {
        lastSignupEmail = email;
        showCheckEmailScreen(email);
        return;
      }
      if ((error.message || '').includes('Invalid login credentials')) {
        const { data: exists } = await supabaseClient.rpc('email_has_account', { check_email: email });
        return showAuthError(exists ? 'Contraseña incorrecta.' : 'No existe ninguna cuenta con ese email.');
      }
      return showAuthError(translateAuthError(error));
    }
    // onAuthStateChange en app.js se encarga del resto
  });

  formSignup.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAuthError();
    const name = document.getElementById('signup-name').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;
    const passwordConfirm = document.getElementById('signup-password-confirm').value;

    if (password !== passwordConfirm) {
      return showAuthError('Las contraseñas no coinciden.');
    }

    const btn = formSignup.querySelector('button[type="submit"]');
    btn.textContent = 'Creando…';
    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: { data: { name } }
    });
    btn.textContent = 'Crear cuenta';
    if (error) return showAuthError(translateAuthError(error));

    lastSignupEmail = email;

    if (!data.session) {
      // Confirmación de email activada: aún no hay sesión, hay que confirmar primero.
      showCheckEmailScreen(email);
    } else {
      // Confirmación de email desactivada: entra directamente.
      showToast('Cuenta creada. ¡Bienvenido/a!');
    }
  });

  document.getElementById('btn-resend-confirmation').addEventListener('click', async () => {
    const btn = document.getElementById('btn-resend-confirmation');
    const msg = document.getElementById('resend-msg');
    btn.disabled = true;
    btn.textContent = 'Enviando…';
    const { error } = await supabaseClient.auth.resend({ type: 'signup', email: lastSignupEmail });
    btn.disabled = false;
    btn.textContent = 'Reenviar email';
    if (error) {
      showToast('No se pudo reenviar. Inténtalo en un minuto.');
      return;
    }
    msg.classList.remove('hidden');
    setTimeout(() => msg.classList.add('hidden'), 4000);
  });

  document.getElementById('btn-back-to-login').addEventListener('click', () => {
    document.getElementById('auth-check-email').classList.add('hidden');
    document.querySelector('#screen-auth .auth-tabs').classList.remove('hidden');
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    document.querySelector('[data-tab="login"]').classList.add('active');
    formLogin.classList.remove('hidden');
    formSignup.classList.add('hidden');
    document.getElementById('login-email').value = lastSignupEmail;
  });

  // ---------------- Olvidé mi contraseña ----------------

  document.getElementById('btn-open-forgot-password').addEventListener('click', () => {
    document.getElementById('forgot-password-email').value = document.getElementById('login-email').value.trim();
    hideForgotPasswordError();
    document.getElementById('forgot-password-form-wrap').classList.remove('hidden');
    document.getElementById('forgot-password-sent').classList.add('hidden');
    document.getElementById('sheet-forgot-password').classList.remove('hidden');
  });

  document.getElementById('sheet-forgot-password').addEventListener('click', (e) => {
    if (e.target.id === 'sheet-forgot-password') closeForgotPasswordSheet();
  });
  document.getElementById('btn-close-forgot-password').addEventListener('click', closeForgotPasswordSheet);

  document.getElementById('btn-send-reset-link').addEventListener('click', async () => {
    hideForgotPasswordError();
    const email = document.getElementById('forgot-password-email').value.trim();
    if (!email) return showForgotPasswordError('Escribe tu email.');

    const btn = document.getElementById('btn-send-reset-link');
    btn.disabled = true;
    btn.textContent = 'Enviando…';

    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + window.location.pathname
    });

    btn.disabled = false;
    btn.textContent = 'Enviar enlace';

    if (error) {
      showForgotPasswordError('No se pudo enviar el enlace. Inténtalo de nuevo en un momento.');
      return;
    }

    document.getElementById('forgot-password-form-wrap').classList.add('hidden');
    document.getElementById('forgot-password-sent').classList.remove('hidden');
  });

  // ---------------- Formulario: establecer nueva contraseña ----------------
  // (pantalla a la que se llega tras pulsar el enlace del email de recuperación)

  document.getElementById('form-reset-password').addEventListener('submit', async (e) => {
    e.preventDefault();
    hideResetPasswordError();
    const newPassword = document.getElementById('reset-password-new').value;
    const confirm = document.getElementById('reset-password-confirm').value;

    if (newPassword !== confirm) {
      return showResetPasswordError('Las contraseñas no coinciden.');
    }

    const form = document.getElementById('form-reset-password');
    const btn = form.querySelector('button[type="submit"]');
    btn.textContent = 'Guardando…';

    const { error } = await supabaseClient.auth.updateUser({ password: newPassword });

    btn.textContent = 'Guardar contraseña';

    if (error) {
      const msg = (error.message || '').toLowerCase();
      if (msg.includes('session') || msg.includes('token') || msg.includes('expired') || msg.includes('invalid')) {
        return showResetPasswordError('Este enlace ya no es válido (puede haber caducado o haberse usado ya). Vuelve a pedir uno nuevo desde "¿Olvidaste tu contraseña?".');
      }
      if (msg.includes('should be at least') || msg.includes('password should')) {
        return showResetPasswordError('La contraseña debe tener al menos 6 caracteres.');
      }
      if (msg.includes('different from the old password')) {
        return showResetPasswordError('La nueva contraseña debe ser distinta de la actual.');
      }
      return showResetPasswordError(`No se pudo guardar la contraseña: ${error.message || 'error desconocido'}`);
    }

    passwordRecoveryMode = false;
    showToast('Contraseña actualizada');
    await bootApp();
  });
}

function closeForgotPasswordSheet() {
  document.getElementById('sheet-forgot-password').classList.add('hidden');
}
function showForgotPasswordError(msg) {
  const el = document.getElementById('forgot-password-error');
  el.textContent = msg;
  el.classList.remove('hidden');
}
function hideForgotPasswordError() {
  document.getElementById('forgot-password-error').classList.add('hidden');
}

function showResetPasswordError(msg) {
  const el = document.getElementById('reset-password-error');
  el.textContent = msg;
  el.classList.remove('hidden');
}
function hideResetPasswordError() {
  document.getElementById('reset-password-error').classList.add('hidden');
}

function showCheckEmailScreen(email) {
  document.querySelector('#screen-auth .auth-tabs').classList.add('hidden');
  document.getElementById('form-login').classList.add('hidden');
  document.getElementById('form-signup').classList.add('hidden');
  document.getElementById('check-email-address').textContent = email;
  document.getElementById('auth-check-email').classList.remove('hidden');
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
  if (msg.includes('Email not confirmed')) return 'Debes confirmar tu email antes de entrar.';
  return 'Ha ocurrido un error. Inténtalo de nuevo.';
}

async function logout() {
  await supabaseClient.auth.signOut();
}
