import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { routesApi } from '../api/routes.js';
import { publishingApi } from '../api/publishing.js';

export const useRouteStore = defineStore('routes', () => {
  const routes = ref([]);
  const pendingChanges = ref([]);
  const globalConfig = ref({});
  const loading = ref(false);
  const currentFileId = ref(null);

  const hasPending = computed(() => pendingChanges.value.length > 0);

  async function loadRoutes(fileId) {
    loading.value = true;
    currentFileId.value = fileId;
    try {
      const data = await routesApi.list(fileId);
      routes.value = data.routes;
      globalConfig.value = data.globalConfig;
      pendingChanges.value = [];
    } finally {
      loading.value = false;
    }
  }

  function addRoute(routeData) {
    const newRoute = {
      ...routeData,
      routeId: routeData.routeId || crypto.randomUUID?.() || `route-${Date.now()}`,
      isEnabled: true,
    };
    routes.value.push(newRoute);
    pendingChanges.value.push({
      kind: 'add',
      text: `Nueva ruta "${newRoute.displayName}": ${newRoute.upstreamHttpMethods.join(', ')} ${newRoute.upstreamPathTemplate}`,
    });
  }

  function updateRoute(routeId, routeData) {
    const index = routes.value.findIndex(route => route.routeId === routeId);
    if (index < 0) return;
    routes.value[index] = { ...routes.value[index], ...routeData };
    pendingChanges.value.push({
      kind: 'mod',
      text: `Modificada "${routeData.displayName || routes.value[index].displayName}"`,
    });
  }

  function removeRoute(routeId) {
    const route = routes.value.find(route => route.routeId === routeId);
    if (!route) return;
    routes.value = routes.value.filter(route => route.routeId !== routeId);
    pendingChanges.value.push({
      kind: 'del',
      text: `Eliminada "${route.displayName}" (${route.upstreamPathTemplate})`,
    });
  }

  function toggleRoute(routeId) {
    const route = routes.value.find(route => route.routeId === routeId);
    if (!route) return;
    route.isEnabled = !route.isEnabled;
    pendingChanges.value.push({
      kind: 'mod',
      text: `${route.isEnabled ? 'Habilitada' : 'Deshabilitada'} "${route.displayName}"`,
    });
  }

  function updateRouteCache(routeId, ttlSeconds) {
    const route = routes.value.find(route => route.routeId === routeId);
    if (!route) return;

    const nextTtl = Number(ttlSeconds);
    route.fileCacheOptions = Number.isFinite(nextTtl) && nextTtl > 0
      ? { ...(route.fileCacheOptions || {}), TtlSeconds: Math.trunc(nextTtl) }
      : null;

    pendingChanges.value.push({
      kind: 'mod',
      text: route.fileCacheOptions
        ? `Cache de "${route.displayName}" configurado a ${route.fileCacheOptions.TtlSeconds} segundos`
        : `Cache deshabilitado en "${route.displayName}"`,
    });
  }

  function updateGlobalConfig(config) {
    globalConfig.value = config || {};
    pendingChanges.value.push({
      kind: 'mod',
      text: 'GlobalConfiguration actualizada',
    });
  }

  async function publish(comment, user) {
    const result = await publishingApi.publish({
      fileId: currentFileId.value,
      routes: routes.value,
      globalConfig: globalConfig.value,
      comment,
      user,
      changes: pendingChanges.value,
    });
    pendingChanges.value = [];
    return result;
  }

  function discardChanges() {
    pendingChanges.value = [];
    // Recargar desde disco
    if (currentFileId.value) loadRoutes(currentFileId.value);
  }

  function clearRoutes() {
    routes.value = [];
    pendingChanges.value = [];
    globalConfig.value = {};
    currentFileId.value = null;
  }

  return {
    routes, pendingChanges, globalConfig, loading, currentFileId,
    hasPending,
    loadRoutes, addRoute, updateRoute, removeRoute, toggleRoute,
    updateRouteCache, updateGlobalConfig, publish, discardChanges, clearRoutes,
  };
});
