// ============================================================
// Sincronización en tiempo real (Supabase Realtime)
// ============================================================

function subscribeRealtime() {
  if (AppState.channel) {
    supabaseClient.removeChannel(AppState.channel);
  }

  AppState.channel = supabaseClient
    .channel(`group-${AppState.group.id}`)
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'shopping_list', filter: `group_id=eq.${AppState.group.id}` },
      async () => {
        await loadShoppingList();
        renderShoppingScreen();
        renderFoodsScreen();
      }
    )
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'foods', filter: `group_id=eq.${AppState.group.id}` },
      async () => {
        await loadFoods();
        renderFoodsScreen();
        renderShoppingScreen();
      }
    )
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'categories', filter: `group_id=eq.${AppState.group.id}` },
      async () => {
        await loadCategories();
        renderFoodsScreen();
        renderShoppingScreen();
      }
    )
    .subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        console.log('[realtime] conectado al grupo', AppState.group.id);
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.warn('[realtime] problema de conexión:', status, err);
      }
    });
}

function unsubscribeRealtime() {
  if (AppState.channel) {
    supabaseClient.removeChannel(AppState.channel);
    AppState.channel = null;
  }
}
