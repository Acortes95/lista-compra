// ============================================================
// Toast — pequeño aviso no intrusivo
// ============================================================
let toastTimer = null;

function showToast(message) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}
