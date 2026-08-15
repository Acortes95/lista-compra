// ============================================================
// Estado global en memoria (nada de localStorage salvo la sesión
// que ya gestiona el propio SDK de Supabase internamente)
// ============================================================
const AppState = {
  session: null,
  profile: null,
  group: null,          // { id, name, invite_code, is_owner }
  myGroups: [],           // [{group_id, name, invite_code, is_owner, member_count}]
  members: [],             // miembros del grupo activo [{user_id, name, email, is_owner}]
  categories: [],        // [{id, name, icon, sort_order}]
  foods: [],              // catálogo completo (sin deleted_at)
  shoppingList: [],       // filas de shopping_list + join de food
  tasks: [],                // tareas del grupo activo (sin deleted_at)
  taskListItems: [],         // elementos de tareas tipo "lista"
  channel: null,          // canal realtime activo

  // Categorías plegadas, vista de tareas y mes visible del calendario
  // (solo visual, no se guarda en la BD)
  uiState: {
    collapsedFoodCategories: new Set(),
    collapsedShoppingCategories: new Set(),
    tasksView: 'list',
    calendarYear: new Date().getFullYear(),
    calendarMonth: new Date().getMonth() // 0-11
  },

  memberName(userId) {
    if (!userId) return null;
    const m = this.members.find(m => m.user_id === userId);
    return m ? m.name : null;
  },
  memberAvatar(userId) {
    const m = this.members.find(m => m.user_id === userId);
    return m ? m.avatar_id : DEFAULT_AVATAR_ID;
  },

  categoryById(id) {
    return this.categories.find(c => c.id === id);
  },
  foodById(id) {
    return this.foods.find(f => f.id === id);
  },
  taskById(id) {
    return this.tasks.find(t => t.id === id);
  },
  itemsForTask(taskId) {
    return this.taskListItems
      .filter(i => i.task_id === taskId)
      .sort((a, b) => a.sort_order - b.sort_order);
  }
};

// Paleta de color por posición de categoría (se repite si hay más
// categorías que colores — mantiene coherencia visual sin necesitar
// una columna extra en la base de datos)
const CATEGORY_PALETTE = [
  { color: '#3f7d4e', bg: '#e9f2ea' }, // verde
  { color: '#b6472f', bg: '#f7e9e5' }, // coral
  { color: '#b6472f', bg: '#f7e9e5' }, // coral (pescadería)
  { color: '#b9822a', bg: '#f6eede' }, // butter
  { color: '#b9822a', bg: '#f6eede' }, // butter (panadería)
  { color: '#3a5f8a', bg: '#e7edf3' }, // sky
  { color: '#3a5f8a', bg: '#e7edf3' },
  { color: '#3a5f8a', bg: '#e7edf3' },
  { color: '#6b4a7a', bg: '#eee6f0' }, // plum
  { color: '#6b4a7a', bg: '#eee6f0' },
  { color: '#6b4a7a', bg: '#eee6f0' },
  { color: '#5c6058', bg: '#f3f2ec' },
  { color: '#5c6058', bg: '#f3f2ec' }
];

function categoryColor(categoryId) {
  const idx = AppState.categories.findIndex(c => c.id === categoryId);
  if (idx === -1) return CATEGORY_PALETTE[CATEGORY_PALETTE.length - 1];
  return CATEGORY_PALETTE[idx % CATEGORY_PALETTE.length];
}

// ---------------- Tipos de tarea ----------------
const TASK_TYPE_META = {
  basica:     { icon: '✅', label: 'Básica',    color: '#3f7d4e' },
  lista:      { icon: '📝', label: 'Lista',      color: '#3a5f8a' },
  recurrente: { icon: '🔁', label: 'Recurrente', color: '#b9822a' },
  gestion:    { icon: '🔔', label: 'Gestión',    color: '#b6472f' },
  actividad:  { icon: '🎉', label: 'Actividad',  color: '#6b4a7a' }
};
