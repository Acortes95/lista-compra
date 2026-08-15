// ============================================================
// Tareas — vista lista, vista calendario, tipos de tarea,
// checklist ("lista"), recurrencia y recordatorios en la app.
// ============================================================

const WEEKDAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MONTH_NAMES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

// ---------------- Helpers de fecha (siempre en local, nunca UTC) ----------------

function formatDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function todayStr() { return formatDateStr(new Date()); }
function parseDateStr(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function addDaysStr(s, n) {
  const d = parseDateStr(s);
  d.setDate(d.getDate() + n);
  return formatDateStr(d);
}
function formatDateHuman(dateStr) {
  const d = parseDateStr(dateStr);
  const today = todayStr();
  if (dateStr === today) return 'Hoy';
  if (dateStr === addDaysStr(today, 1)) return 'Mañana';
  if (dateStr === addDaysStr(today, -1)) return 'Ayer';
  return `${WEEKDAY_NAMES[d.getDay()]}, ${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
}
function datesBetweenMatchingWeekdays(startStr, endStr, weekdays) {
  const start = parseDateStr(startStr);
  const end = parseDateStr(endStr);
  const result = [];
  const cur = new Date(start);
  while (cur <= end) {
    if (weekdays.includes(cur.getDay())) result.push(formatDateStr(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return result;
}

// ---------------- Carga de datos ----------------

async function loadTasks() {
  const pastLimit = addDaysStr(todayStr(), -31);

  const { data, error } = await supabaseClient
    .from('tasks')
    .select('*')
    .eq('group_id', AppState.group.id)
    .is('deleted_at', null)
    .gte('date', pastLimit)
    .order('date', { ascending: true })
    .order('time_start', { ascending: true, nullsFirst: false });
  AppState.tasks = error ? [] : data;

  const { data: items, error: itemsError } = await supabaseClient
    .from('task_list_items')
    .select('*')
    .eq('group_id', AppState.group.id)
    .order('sort_order', { ascending: true });
  AppState.taskListItems = itemsError ? [] : items;
}

function tasksOnDate(dateStr) {
  return AppState.tasks.filter(t => {
    if (t.type === 'actividad') {
      const end = t.end_date || t.date;
      return dateStr >= t.date && dateStr <= end;
    }
    return t.date === dateStr;
  });
}

// ---------------- Inicialización de listeners ----------------

let taskFormDraftItems = [];
let dayTasksSheetDate = null;
let checklistTaskId = null;

function initTasksScreen() {
  // Alternar vista lista / calendario
  document.querySelectorAll('#screen-tasks .segmented-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      AppState.uiState.tasksView = btn.dataset.tasksView;
      renderTasksScreen();
    });
  });

  document.getElementById('fab-add-task').addEventListener('click', () => openTaskSheet(null, null));

  // Calendario: navegación
  document.getElementById('btn-cal-prev').addEventListener('click', () => shiftCalendarMonth(-1));
  document.getElementById('btn-cal-next').addEventListener('click', () => shiftCalendarMonth(1));
  document.getElementById('btn-cal-month-label').addEventListener('click', openMonthPickerSheet);

  document.getElementById('btn-cancel-month-picker').addEventListener('click', closeMonthPickerSheet);
  document.getElementById('btn-go-month-picker').addEventListener('click', () => {
    AppState.uiState.calendarMonth = parseInt(document.getElementById('picker-month').value, 10);
    AppState.uiState.calendarYear = parseInt(document.getElementById('picker-year').value, 10) || AppState.uiState.calendarYear;
    closeMonthPickerSheet();
    renderTasksCalendarView();
  });
  document.getElementById('sheet-month-picker').addEventListener('click', (e) => {
    if (e.target.id === 'sheet-month-picker') closeMonthPickerSheet();
  });

  // Sheet: tareas de un día
  document.getElementById('sheet-day-tasks').addEventListener('click', (e) => {
    if (e.target.id === 'sheet-day-tasks') closeDayTasksSheet();
  });
  document.getElementById('btn-add-task-for-day').addEventListener('click', () => {
    const d = dayTasksSheetDate;
    closeDayTasksSheet();
    openTaskSheet(null, d);
  });

  // Sheet: crear/editar tarea
  document.getElementById('sheet-task').addEventListener('click', (e) => {
    if (e.target.id === 'sheet-task') closeTaskSheet();
  });
  document.getElementById('btn-cancel-task').addEventListener('click', closeTaskSheet);
  document.getElementById('form-task').addEventListener('submit', onSubmitTask);

  document.querySelectorAll('#task-type-selector .type-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      document.querySelectorAll('#task-type-selector .type-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      updateTaskFormFieldsForType(btn.dataset.taskType);
    });
  });

  document.querySelectorAll('#task-weekday-selector .weekday-pill').forEach(btn => {
    btn.addEventListener('click', () => btn.classList.toggle('active'));
  });

  document.getElementById('task-reminder-enabled').addEventListener('change', (e) => {
    document.getElementById('task-reminder-detail').classList.toggle('hidden', !e.target.checked);
  });

  document.getElementById('btn-add-task-item').addEventListener('click', addDraftListItem);
  document.getElementById('task-new-item-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addDraftListItem(); }
  });

  document.getElementById('btn-delete-task').addEventListener('click', async () => {
    const id = document.getElementById('task-id').value;
    const task = AppState.taskById(id);
    if (!task) return;
    if (!confirm('¿Eliminar esta tarea?')) return;
    await deleteTask(task);
    closeTaskSheet();
  });

  // Sheet: checklist (tipo "lista")
  document.getElementById('sheet-task-checklist').addEventListener('click', (e) => {
    if (e.target.id === 'sheet-task-checklist') closeChecklistSheet();
  });
  document.getElementById('btn-add-checklist-item').addEventListener('click', addChecklistItemFromInput);
  document.getElementById('checklist-new-item-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addChecklistItemFromInput(); }
  });
  document.getElementById('btn-edit-checklist-task').addEventListener('click', () => {
    const task = AppState.taskById(checklistTaskId);
    closeChecklistSheet();
    if (task) openTaskSheet(task);
  });
  document.getElementById('btn-delete-checklist-task').addEventListener('click', async () => {
    const task = AppState.taskById(checklistTaskId);
    if (!task) return;
    if (!confirm('¿Eliminar esta tarea y toda su lista?')) return;
    await deleteTask(task);
    closeChecklistSheet();
  });
}

// ---------------- Render principal ----------------

function renderTasksScreen() {
  document.querySelectorAll('#screen-tasks .segmented-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tasksView === AppState.uiState.tasksView);
  });
  document.getElementById('tasks-list-view').classList.toggle('hidden', AppState.uiState.tasksView !== 'list');
  document.getElementById('tasks-calendar-view').classList.toggle('hidden', AppState.uiState.tasksView !== 'calendar');

  if (AppState.uiState.tasksView === 'list') renderTasksListView();
  else renderTasksCalendarView();
}

function renderTaskRow(task) {
  const meta = TASK_TYPE_META[task.type] || TASK_TYPE_META.basica;
  const assignedName = AppState.memberName(task.assigned_to);
  const timeLabel = task.time_start
    ? task.time_start.slice(0, 5) + (task.time_end ? '–' + task.time_end.slice(0, 5) : '')
    : '';

  let statusHtml;
  if (task.type === 'basica' || task.type === 'recurrente') {
    statusHtml = `<button class="item-check ${task.completed ? 'checked' : ''}" data-toggle-task="${task.id}">✓</button>`;
  } else if (task.type === 'lista') {
    const items = AppState.itemsForTask(task.id);
    const done = items.filter(i => i.completed).length;
    statusHtml = `<div class="task-list-progress">${done}/${items.length}</div>`;
  } else {
    statusHtml = `<div class="task-type-icon">${meta.icon}</div>`;
  }

  const rangeLabel = (task.type === 'actividad' && task.end_date && task.end_date !== task.date)
    ? ` · hasta ${formatDateHuman(task.end_date)}` : '';

  const assignedTag = assignedName
    ? `<img class="member-avatar" src="${avatarUrl(AppState.memberAvatar(task.assigned_to))}" alt="" title="${escapeHtml(assignedName)}">`
    : '';

  const doneClass = (task.type === 'basica' || task.type === 'recurrente') && task.completed ? 'task-done' : '';

  return `
    <div class="item-row task-row ${doneClass}" style="--cat-color:${meta.color}" data-open-task="${task.id}">
      ${statusHtml}
      <div class="item-body">
        <div class="item-name">${escapeHtml(task.title)}</div>
        <div class="item-meta">${meta.icon} ${meta.label}${timeLabel ? ' · ' + timeLabel : ''}${rangeLabel}</div>
      </div>
      ${assignedTag}
    </div>`;
}

function attachTaskRowListeners(container) {
  container.querySelectorAll('[data-toggle-task]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleTaskCompleted(btn.dataset.toggleTask);
    });
  });
  container.querySelectorAll('[data-open-task]').forEach(el => {
    el.addEventListener('click', () => openTaskDetail(el.dataset.openTask));
  });
}

function openTaskDetail(taskId) {
  const task = AppState.taskById(taskId);
  if (!task) return;
  if (task.type === 'lista') openChecklistSheet(task);
  else openTaskSheet(task);
}

// ---------------- Vista lista ----------------

function renderTasksListView() {
  const container = document.getElementById('tasks-list-content');
  if (!AppState.tasks.length) {
    container.innerHTML = `<div class="empty-state">
      <span class="emoji">🗒️</span>
      <p>No hay tareas todavía.</p>
      <p class="hint">Toca + para crear la primera.</p>
    </div>`;
    return;
  }

  const byDate = {};
  AppState.tasks.forEach(t => { (byDate[t.date] ||= []).push(t); });
  const dates = Object.keys(byDate).sort();

  let html = '';
  dates.forEach(date => {
    html += `<div class="task-date-group">
      <div class="task-date-header">${formatDateHuman(date)}</div>`;
    byDate[date].forEach(t => { html += renderTaskRow(t); });
    html += `</div>`;
  });

  container.innerHTML = html;
  attachTaskRowListeners(container);
}

// ---------------- Vista calendario ----------------

function shiftCalendarMonth(delta) {
  let m = AppState.uiState.calendarMonth + delta;
  let y = AppState.uiState.calendarYear;
  if (m < 0) { m = 11; y--; }
  if (m > 11) { m = 0; y++; }
  AppState.uiState.calendarMonth = m;
  AppState.uiState.calendarYear = y;
  renderTasksCalendarView();
}

function renderTasksCalendarView() {
  const y = AppState.uiState.calendarYear;
  const m = AppState.uiState.calendarMonth;
  const label = `${MONTH_NAMES[m].charAt(0).toUpperCase()}${MONTH_NAMES[m].slice(1)} ${y}`;
  document.getElementById('btn-cal-month-label').textContent = label;

  const firstOfMonth = new Date(y, m, 1);
  const startOffset = (firstOfMonth.getDay() + 6) % 7; // semana empieza en lunes
  const daysInMonth = new Date(y, m + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const today = todayStr();
  let html = '';
  cells.forEach(dayNum => {
    if (dayNum === null) { html += `<div class="calendar-day empty"></div>`; return; }
    const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    const dayTasks = tasksOnDate(dateStr);
    const pending = dayTasks.filter(t => t.type !== 'actividad' && !t.completed).length;
    const hasActivity = dayTasks.some(t => t.type === 'actividad');
    const isToday = dateStr === today;
    html += `
      <button class="calendar-day ${isToday ? 'today' : ''} ${hasActivity ? 'has-activity' : ''}" data-cal-day="${dateStr}">
        <span class="calendar-day-num">${dayNum}</span>
        ${pending > 0 ? `<span class="calendar-day-badge">${pending}</span>` : ''}
      </button>`;
  });

  document.getElementById('calendar-grid').innerHTML = html;
  document.querySelectorAll('#calendar-grid [data-cal-day]').forEach(btn => {
    btn.addEventListener('click', () => openDayTasksSheet(btn.dataset.calDay));
  });
}

function openMonthPickerSheet() {
  document.getElementById('picker-month').value = AppState.uiState.calendarMonth;
  document.getElementById('picker-year').value = AppState.uiState.calendarYear;
  document.getElementById('sheet-month-picker').classList.remove('hidden');
}
function closeMonthPickerSheet() {
  document.getElementById('sheet-month-picker').classList.add('hidden');
}

function openDayTasksSheet(dateStr) {
  dayTasksSheetDate = dateStr;
  const d = parseDateStr(dateStr);
  document.getElementById('day-tasks-title').textContent =
    `${formatDateHuman(dateStr)} · ${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;

  const list = document.getElementById('day-tasks-list');
  const dayTasks = tasksOnDate(dateStr);
  list.innerHTML = dayTasks.length
    ? dayTasks.map(t => renderTaskRow(t)).join('')
    : `<p class="field-hint">No hay tareas este día.</p>`;
  attachTaskRowListeners(list);

  document.getElementById('sheet-day-tasks').classList.remove('hidden');
}
function closeDayTasksSheet() {
  document.getElementById('sheet-day-tasks').classList.add('hidden');
}

// ---------------- Sheet: crear / editar tarea ----------------

function updateTaskFormFieldsForType(type) {
  document.getElementById('task-date-single').classList.toggle('hidden', type === 'actividad');
  document.getElementById('task-date-range').classList.toggle('hidden', type !== 'actividad');
  document.getElementById('task-recurrence-fields').classList.toggle('hidden', type !== 'recurrente');
  document.getElementById('task-reminder-fields').classList.toggle('hidden', type !== 'gestion');

  const editingId = document.getElementById('task-id').value;
  document.getElementById('task-list-items-fields').classList.toggle('hidden', !(type === 'lista' && !editingId));

  document.getElementById('task-date').required = type !== 'actividad';
  document.getElementById('task-date-start').required = type === 'actividad';
  document.getElementById('task-date-end').required = type === 'actividad';
}

function setSelectedWeekdays(days) {
  document.querySelectorAll('#task-weekday-selector .weekday-pill').forEach(b => {
    b.classList.toggle('active', days.includes(parseInt(b.dataset.day, 10)));
  });
}
function getSelectedWeekdays() {
  return Array.from(document.querySelectorAll('#task-weekday-selector .weekday-pill.active'))
    .map(b => parseInt(b.dataset.day, 10));
}

function populateTaskAssignSelect() {
  const select = document.getElementById('task-assigned');
  select.innerHTML = `<option value="">Sin asignar</option>` +
    AppState.members.map(m => `<option value="${m.user_id}">${escapeHtml(m.name)}</option>`).join('');
}

function renderTaskItemsBuilder() {
  const box = document.getElementById('task-list-items-builder');
  box.innerHTML = taskFormDraftItems.length
    ? taskFormDraftItems.map((it, idx) => `
      <div class="draft-item-row">
        <span>${escapeHtml(it.text)}</span>
        <button type="button" class="icon-btn" data-remove-draft-item="${idx}">✕</button>
      </div>`).join('')
    : `<p class="field-hint">Añade elementos con el campo de abajo.</p>`;

  box.querySelectorAll('[data-remove-draft-item]').forEach(btn => {
    btn.addEventListener('click', () => {
      taskFormDraftItems.splice(parseInt(btn.dataset.removeDraftItem, 10), 1);
      renderTaskItemsBuilder();
    });
  });
}
function addDraftListItem() {
  const input = document.getElementById('task-new-item-input');
  const text = input.value.trim();
  if (!text) return;
  taskFormDraftItems.push({ text });
  input.value = '';
  renderTaskItemsBuilder();
}

function openTaskSheet(task, prefillDate) {
  populateTaskAssignSelect();
  taskFormDraftItems = [];

  document.getElementById('form-task').reset();
  document.getElementById('task-id').value = task ? task.id : '';
  document.getElementById('task-sheet-title').textContent = task ? 'Editar tarea' : 'Nueva tarea';
  document.getElementById('btn-delete-task').classList.toggle('hidden', !task);

  const type = task ? task.type : 'basica';
  document.querySelectorAll('#task-type-selector .type-pill').forEach(b => {
    b.classList.toggle('active', b.dataset.taskType === type);
    b.disabled = !!task; // el tipo no se puede cambiar una vez creada
  });

  document.getElementById('task-title').value = task ? task.title : '';
  document.getElementById('task-description').value = task ? (task.description || '') : '';

  const baseDate = task ? task.date : (prefillDate || todayStr());
  document.getElementById('task-date').value = type === 'actividad' ? '' : baseDate;
  document.getElementById('task-date-start').value = type === 'actividad' ? baseDate : '';
  document.getElementById('task-date-end').value = type === 'actividad' ? (task ? (task.end_date || task.date) : baseDate) : '';

  document.getElementById('task-time-start').value = task?.time_start ? task.time_start.slice(0, 5) : '';
  document.getElementById('task-time-end').value = task?.time_end ? task.time_end.slice(0, 5) : '';

  setSelectedWeekdays(task?.recurrence_days || []);
  document.getElementById('task-repeat-until').value = '';

  document.getElementById('task-reminder-enabled').checked = !!task?.reminder_enabled;
  document.getElementById('task-reminder-detail').classList.toggle('hidden', !task?.reminder_enabled);
  document.getElementById('task-reminder-minutes').value = task?.reminder_minutes_before ?? 0;
  document.getElementById('task-reminder-repeat').value = task?.reminder_repeat || 'none';

  document.getElementById('task-assigned').value = task?.assigned_to || '';

  renderTaskItemsBuilder();
  updateTaskFormFieldsForType(type);

  document.getElementById('sheet-task').classList.remove('hidden');
}

function closeTaskSheet() {
  document.getElementById('sheet-task').classList.add('hidden');
}

async function onSubmitTask(e) {
  e.preventDefault();
  const id = document.getElementById('task-id').value;
  const type = id ? AppState.taskById(id)?.type : document.querySelector('#task-type-selector .type-pill.active').dataset.taskType;
  const title = document.getElementById('task-title').value.trim();
  const description = document.getElementById('task-description').value.trim() || null;
  const timeStart = document.getElementById('task-time-start').value || null;
  const timeEnd = document.getElementById('task-time-end').value || null;
  const assignedTo = document.getElementById('task-assigned').value || null;

  const btn = document.getElementById('btn-save-task');
  btn.textContent = 'Guardando…';

  try {
    if (type === 'actividad') {
      const dateStart = document.getElementById('task-date-start').value;
      const dateEnd = document.getElementById('task-date-end').value || dateStart;
      if (!dateStart) throw new Error('Falta la fecha de inicio.');

      if (id) {
        const { error } = await supabaseClient.from('tasks').update({
          title, description, date: dateStart, end_date: dateEnd,
          time_start: timeStart, time_end: timeEnd, assigned_to: assignedTo
        }).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabaseClient.from('tasks').insert({
          group_id: AppState.group.id, type, title, description,
          date: dateStart, end_date: dateEnd, time_start: timeStart, time_end: timeEnd,
          assigned_to: assignedTo, created_by: AppState.session.user.id
        });
        if (error) throw error;
      }

    } else if (type === 'recurrente') {
      if (id) {
        const { error } = await supabaseClient.from('tasks').update({
          title, description, time_start: timeStart, time_end: timeEnd, assigned_to: assignedTo
        }).eq('id', id);
        if (error) throw error;
      } else {
        const startDate = document.getElementById('task-date').value;
        const untilDate = document.getElementById('task-repeat-until').value;
        const weekdays = getSelectedWeekdays();
        if (!startDate) throw new Error('Falta la fecha de inicio.');
        if (!untilDate) throw new Error('Indica hasta cuándo se repite.');
        if (!weekdays.length) throw new Error('Elige al menos un día de la semana.');

        const dates = datesBetweenMatchingWeekdays(startDate, untilDate, weekdays);
        if (!dates.length) throw new Error('Ninguna fecha coincide con esos días.');
        if (dates.length > 200) throw new Error('Demasiadas repeticiones (máx. 200). Acorta "Repetir hasta".');

        const recurrenceGroupId = crypto.randomUUID();
        const rows = dates.map(d => ({
          group_id: AppState.group.id, type, title, description,
          date: d, time_start: timeStart, time_end: timeEnd, assigned_to: assignedTo,
          created_by: AppState.session.user.id,
          recurrence_group_id: recurrenceGroupId, recurrence_days: weekdays
        }));
        const { error } = await supabaseClient.from('tasks').insert(rows);
        if (error) throw error;
      }

    } else {
      // basica, lista, gestion
      const date = document.getElementById('task-date').value;
      if (!date) throw new Error('Falta la fecha.');

      const payload = { title, description, date, time_start: timeStart, time_end: timeEnd, assigned_to: assignedTo };
      if (type === 'gestion') {
        payload.reminder_enabled = document.getElementById('task-reminder-enabled').checked;
        payload.reminder_minutes_before = parseInt(document.getElementById('task-reminder-minutes').value, 10);
        payload.reminder_repeat = document.getElementById('task-reminder-repeat').value;
      }

      let taskId = id;
      if (id) {
        const { error } = await supabaseClient.from('tasks').update(payload).eq('id', id);
        if (error) throw error;
      } else {
        const { data, error } = await supabaseClient.from('tasks')
          .insert({ ...payload, group_id: AppState.group.id, type, created_by: AppState.session.user.id })
          .select('id').single();
        if (error) throw error;
        taskId = data.id;
      }

      if (type === 'lista' && !id && taskFormDraftItems.length) {
        const itemRows = taskFormDraftItems.map((it, idx) => ({
          task_id: taskId, group_id: AppState.group.id, text: it.text, sort_order: idx
        }));
        const { error } = await supabaseClient.from('task_list_items').insert(itemRows);
        if (error) throw error;
      }
    }

    closeTaskSheet();
    showToast(id ? 'Tarea actualizada' : 'Tarea creada');
    await loadTasks();
    renderTasksScreen();
  } catch (err) {
    showToast(err.message || 'No se pudo guardar la tarea.');
  } finally {
    btn.textContent = 'Guardar';
  }
}

async function toggleTaskCompleted(taskId) {
  const task = AppState.taskById(taskId);
  if (!task) return;
  const completed = !task.completed;
  task.completed = completed; // optimista
  renderTasksScreen();

  const { error } = await supabaseClient
    .from('tasks')
    .update({ completed, completed_at: completed ? new Date().toISOString() : null })
    .eq('id', taskId);

  if (error) {
    task.completed = !completed;
    renderTasksScreen();
    showToast('No se pudo actualizar la tarea.');
  }
}

async function deleteTask(task) {
  const { error } = await supabaseClient
    .from('tasks')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', task.id);
  if (error) { showToast('No se pudo eliminar la tarea.'); return; }
  showToast('Tarea eliminada');
  await loadTasks();
  renderTasksScreen();
}

// ---------------- Sheet: checklist (tipo "lista") ----------------

function openChecklistSheet(task) {
  checklistTaskId = task.id;
  document.getElementById('checklist-task-title').textContent = task.title;

  const descEl = document.getElementById('checklist-task-description');
  if (task.description) {
    descEl.textContent = task.description;
    descEl.classList.remove('hidden');
  } else {
    descEl.classList.add('hidden');
  }

  renderChecklistItems();
  document.getElementById('sheet-task-checklist').classList.remove('hidden');
}
function closeChecklistSheet() {
  document.getElementById('sheet-task-checklist').classList.add('hidden');
  checklistTaskId = null;
}

function renderChecklistItems() {
  const list = document.getElementById('checklist-items-list');
  const items = AppState.itemsForTask(checklistTaskId);
  list.innerHTML = items.length
    ? items.map(it => `
      <div class="item-row" style="--cat-color: var(--sky)">
        <button class="item-check ${it.completed ? 'checked' : ''}" data-toggle-item="${it.id}">✓</button>
        <div class="item-body">
          <div class="item-name" style="${it.completed ? 'text-decoration:line-through;opacity:.6;' : ''}">${escapeHtml(it.text)}</div>
        </div>
        <button class="item-delete" data-delete-item="${it.id}">✕</button>
      </div>`).join('')
    : `<p class="field-hint">Sin elementos todavía.</p>`;

  list.querySelectorAll('[data-toggle-item]').forEach(btn => {
    btn.addEventListener('click', () => toggleChecklistItem(btn.dataset.toggleItem));
  });
  list.querySelectorAll('[data-delete-item]').forEach(btn => {
    btn.addEventListener('click', () => deleteChecklistItem(btn.dataset.deleteItem));
  });
}

async function toggleChecklistItem(itemId) {
  const item = AppState.taskListItems.find(i => i.id === itemId);
  if (!item) return;
  item.completed = !item.completed;
  renderChecklistItems();
  renderTasksScreen();

  const { error } = await supabaseClient.from('task_list_items').update({ completed: item.completed }).eq('id', itemId);
  if (error) {
    item.completed = !item.completed;
    renderChecklistItems();
    renderTasksScreen();
  }
}

async function deleteChecklistItem(itemId) {
  AppState.taskListItems = AppState.taskListItems.filter(i => i.id !== itemId);
  renderChecklistItems();
  renderTasksScreen();
  await supabaseClient.from('task_list_items').delete().eq('id', itemId);
}

async function addChecklistItemFromInput() {
  const input = document.getElementById('checklist-new-item-input');
  const text = input.value.trim();
  if (!text || !checklistTaskId) return;
  input.value = '';

  const sortOrder = AppState.itemsForTask(checklistTaskId).length;
  const { data, error } = await supabaseClient
    .from('task_list_items')
    .insert({ task_id: checklistTaskId, group_id: AppState.group.id, text, sort_order: sortOrder })
    .select()
    .single();

  if (!error && data) {
    AppState.taskListItems.push(data);
    renderChecklistItems();
    renderTasksScreen();
  }
}

// ---------------- Recordatorios dentro de la app ----------------
// Importante: esto NO son notificaciones push del sistema operativo.
// Solo avisan (con un toast) si tienes la app abierta en ese momento.

let reminderInterval = null;
const remindersShownThisSession = new Set();

function startReminderWatch() {
  checkDueReminders();
  reminderInterval = setInterval(checkDueReminders, 60000);
}
function stopReminderWatch() {
  if (reminderInterval) clearInterval(reminderInterval);
  reminderInterval = null;
  remindersShownThisSession.clear();
}
function checkDueReminders() {
  if (!AppState.group) return;
  const now = new Date();

  AppState.tasks.forEach(task => {
    if (task.type !== 'gestion' || !task.reminder_enabled || task.completed) return;
    if (remindersShownThisSession.has(task.id)) return;

    const base = parseDateStr(task.date);
    if (task.time_start) {
      const [hh, mm] = task.time_start.split(':').map(Number);
      base.setHours(hh, mm, 0, 0);
    } else {
      base.setHours(9, 0, 0, 0);
    }
    const remindAt = new Date(base.getTime() - (task.reminder_minutes_before || 0) * 60000);

    if (now >= remindAt && now.getTime() - remindAt.getTime() < 60 * 60000) {
      remindersShownThisSession.add(task.id);
      showToast(`🔔 Recordatorio: ${task.title}`);
    }
  });
}
