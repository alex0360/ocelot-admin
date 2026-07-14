<template>
  <main class="main-content">
    <!-- Empty state: no file selected -->
    <div v-if="!envStore.activeFile" class="empty-state">
      <div class="empty-icon" aria-hidden="true">CN</div>
      <h3>Selecciona un archivo de configuracion</h3>
      <p>Elige un archivo en la barra lateral para ver y editar sus rutas.</p>
    </div>

    <!-- File selected -->
    <template v-else>
      <header class="topbar">
        <div class="topbar-title">
          <span class="eyebrow">API Gateway</span>
          <h2>{{ envStore.activeFile.displayName }}</h2>
          <p>Puerta de Enlace para los microservicios</p>
        </div>
        <span class="badge env">{{ envStore.activeEnvironment?.name }}</span>
        <div class="spacer"></div>
        <span v-if="routeStore.hasPending" class="pending-pill">
          {{ routeStore.pendingChanges.length }} pendiente(s)
        </span>
        <button
          v-if="routeStore.hasPending"
          class="btn btn-outline btn-sm"
          :disabled="publishing"
          @click="openDiscardModal"
        >
          Descartar
        </button>
        <button v-if="authStore.canEdit" class="btn btn-outline btn-sm" @click="openGlobalConfigEditor">
          Global config
        </button>
        <button v-if="authStore.canEdit" class="btn btn-outline btn-sm" @click="openRouteEditor()">
          + Nueva ruta
        </button>
        <button
          class="btn btn-primary btn-sm"
          :disabled="!routeStore.hasPending || !authStore.canPublish || publishing"
          @click="openPublishModal"
        >
          {{ publishing ? 'Publicando...' : 'Publicar' }}
        </button>
      </header>

      <!-- Search -->
      <div class="toolbar">
        <div class="search-box">
          <span class="search-icon" aria-hidden="true">/</span>
          <input v-model="searchQuery" type="text" placeholder="Buscar por nombre o ruta...">
        </div>
        <label class="sort-control">
          <span>Ordenar por</span>
          <select v-model="sortMode">
            <option value="ocelot">Posicion en Ocelot</option>
            <option value="alphabetic">Orden alfabetico</option>
            <option value="port">Puerto</option>
          </select>
        </label>
        <label class="sort-control sort-direction">
          <span>Direccion</span>
          <select v-model="sortDirection">
            <option value="asc">Ascendente</option>
            <option value="desc">Descendente</option>
          </select>
        </label>
      </div>

      <!-- Routes list -->
      <div class="route-list">
        <div v-if="loading" class="empty-state"><p>Cargando rutas...</p></div>
        <div v-else-if="!filteredRoutes.length" class="empty-state">
          <h3>{{ searchQuery ? 'Sin resultados' : 'Archivo vacio' }}</h3>
          <p>{{ searchQuery ? 'Prueba otro termino.' : 'Crea una ruta con "+ Nueva ruta".' }}</p>
        </div>

        <div
          v-for="route in filteredRoutes"
          :key="route.routeId"
          class="route-card"
          :class="{ disabled: !route.isEnabled }"
        >
          <div class="route-body">
            <div class="route-header">
              <div class="route-title">
                <h3>{{ route.displayName }}</h3>
                <span class="route-status" :class="{ off: !route.isEnabled }">
                  {{ route.isEnabled ? 'Activa' : 'Deshabilitada' }}
                </span>
              </div>
              <div class="method-list" aria-label="Metodos HTTP">
                <span
                  v-for="method in route.upstreamHttpMethods"
                  :key="method"
                  class="method-chip"
                  :class="route.isEnabled ? method : 'off'"
                >
                  {{ method }}
                </span>
              </div>
            </div>
            <div class="flow-map" :class="{ 'with-actions': authStore.canEdit }">
              <div class="flow-group">
                <span class="flow-label">Entrada</span>
                <span class="flow-node upstream">{{ route.upstreamPathTemplate }}</span>
              </div>
              <span class="flow-arrow">-></span>
              <div class="flow-group downstream-group">
                <span class="flow-label">Destino</span>
                <span class="flow-node downstream">
                  {{ route.downstreamHost }}:{{ route.downstreamPort }}{{ route.downstreamPathTemplate }}
                </span>
              </div>
              <div class="route-actions" v-if="authStore.canEdit">
                <button
                  class="toggle-btn"
                  :class="{ on: route.isEnabled }"
                  @click="routeStore.toggleRoute(route.routeId)"
                  :title="route.isEnabled ? 'Deshabilitar' : 'Habilitar'"
                  :aria-label="route.isEnabled ? 'Deshabilitar ruta' : 'Habilitar ruta'"
                ></button>
                <button class="action-btn icon-btn" title="Editar ruta" aria-label="Editar ruta" @click="openRouteEditor(route)">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5Z" />
                  </svg>
                  <span class="sr-only">Editar</span>
                </button>
                <button class="action-btn icon-btn danger" title="Eliminar ruta" aria-label="Eliminar ruta" @click="deleteRoute(route)">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M3 6h18" />
                    <path d="M8 6V4h8v2" />
                    <path d="M6 6l1 15h10l1-15" />
                    <path d="M10 11v6" />
                    <path d="M14 11v6" />
                  </svg>
                  <span class="sr-only">Eliminar</span>
                </button>
              </div>
            </div>
            <div class="route-meta">
              <span class="meta-pill">
                <span>Puerto</span>
                <strong>{{ route.downstreamPort }}</strong>
              </span>
              <span class="meta-pill">
                <span>Cache</span>
                <strong :class="{ 'cache-on': hasCache(route) }">
                  {{ hasCache(route) ? `${cacheTtl(route)} seg` : 'Off' }}
                </strong>
              </span>
              <span class="meta-pill">
                <span>Auth</span>
                <strong :class="{ 'cache-on': hasAuth(route) }">
                  {{ hasAuth(route) ? authLabel(route) : 'Off' }}
                </strong>
              </span>
            </div>
          </div>
        </div>
      </div>
    </template>

    <RouteEditorModal
      v-if="routeEditorOpen"
      :route="editingRoute"
      :routes="routeStore.routes"
      @close="closeRouteEditor"
      @save="saveRoute"
    />
    <GlobalConfigurationModal
      v-if="globalConfigEditorOpen"
      :config="routeStore.globalConfig"
      @close="globalConfigEditorOpen = false"
      @save="saveGlobalConfig"
    />
    <PublishModal
      v-if="publishModalOpen"
      :pending-changes="routeStore.pendingChanges"
      :submitting="publishing"
      :error="publishError"
      :error-details="publishErrorDetails"
      @close="closePublishModal"
      @publish="publishChanges"
    />
    <DiscardChangesModal
      v-if="discardModalOpen"
      :pending-count="routeStore.pendingChanges.length"
      @close="discardModalOpen = false"
      @confirm="discardPendingChanges"
    />
  </main>
</template>

<script setup>
import { ref, computed } from 'vue';
import DiscardChangesModal from '../components/DiscardChangesModal.vue';
import GlobalConfigurationModal from '../components/GlobalConfigurationModal.vue';
import PublishModal from '../components/PublishModal.vue';
import RouteEditorModal from '../components/RouteEditorModal.vue';
import { useEnvironmentStore } from '../stores/environmentStore.js';
import { useRouteStore } from '../stores/routeStore.js';
import { useAuthStore } from '../stores/authStore.js';

const envStore = useEnvironmentStore();
const routeStore = useRouteStore();
const authStore = useAuthStore();

const searchQuery = ref('');
const sortMode = ref('ocelot');
const sortDirection = ref('asc');
const publishing = ref(false);
const publishModalOpen = ref(false);
const publishError = ref('');
const publishErrorDetails = ref([]);
const discardModalOpen = ref(false);
const routeEditorOpen = ref(false);
const globalConfigEditorOpen = ref(false);
const editingRoute = ref(null);
const loading = computed(() => routeStore.loading);

const filteredRoutes = computed(() => {
  const query = searchQuery.value.toLowerCase();
  return routeStore.routes
    .map((route, index) => ({ route, index }))
    .filter(({ route }) =>
      !query
      || route.displayName?.toLowerCase().includes(query)
      || route.upstreamPathTemplate?.toLowerCase().includes(query)
      || route.downstreamHost?.toLowerCase().includes(query)
      || route.authenticationOptions?.AllowedScopes?.some(scope => scope.toLowerCase().includes(query))
      || String(route.downstreamPort || '').includes(query)
    )
    .sort((left, right) => compareRoutes(left, right))
    .map(({ route }) => route);
});

function compareRoutes(left, right) {
  const direction = sortDirection.value === 'desc' ? -1 : 1;

  if (sortMode.value === 'alphabetic') {
    const leftName = (left.route.displayName || left.route.upstreamPathTemplate || '').toLowerCase();
    const rightName = (right.route.displayName || right.route.upstreamPathTemplate || '').toLowerCase();
    return (leftName.localeCompare(rightName) || left.index - right.index) * direction;
  }

  if (sortMode.value === 'port') {
    const leftPort = Number(left.route.downstreamPort) || 0;
    const rightPort = Number(right.route.downstreamPort) || 0;
    return ((leftPort - rightPort) || left.index - right.index) * direction;
  }

  return (left.index - right.index) * direction;
}

function openRouteEditor(route = null) {
  editingRoute.value = route;
  routeEditorOpen.value = true;
}

function closeRouteEditor() {
  routeEditorOpen.value = false;
  editingRoute.value = null;
}

function saveRoute(routeData) {
  if (editingRoute.value) {
    routeStore.updateRoute(editingRoute.value.routeId, routeData);
  } else {
    routeStore.addRoute(routeData);
  }
  closeRouteEditor();
}

function openGlobalConfigEditor() {
  globalConfigEditorOpen.value = true;
}

function saveGlobalConfig(config) {
  routeStore.updateGlobalConfig(config);
  globalConfigEditorOpen.value = false;
}

function deleteRoute(route) {
  if (!confirm(`Eliminar "${route.displayName}"? Este cambio no toca el archivo hasta publicar.`)) return;
  routeStore.removeRoute(route.routeId);
}

function hasCache(route) {
  return Boolean(cacheTtl(route));
}

function cacheTtl(route) {
  return route.fileCacheOptions?.TtlSeconds || null;
}

function hasAuth(route) {
  return Boolean(route.authenticationOptions?.AuthenticationProviderKeys?.length);
}

function authLabel(route) {
  const providers = route.authenticationOptions?.AuthenticationProviderKeys || [];
  const scopes = route.authenticationOptions?.AllowedScopes || [];
  return scopes.length ? `${providers.join(', ')} Â· ${scopes.length} scope(s)` : providers.join(', ');
}

function openPublishModal() {
  publishError.value = '';
  publishErrorDetails.value = [];
  publishModalOpen.value = true;
}

function closePublishModal() {
  if (publishing.value) return;
  publishModalOpen.value = false;
  publishError.value = '';
  publishErrorDetails.value = [];
}

function openDiscardModal() {
  discardModalOpen.value = true;
}

function discardPendingChanges() {
  closePublishModal();
  closeRouteEditor();
  globalConfigEditorOpen.value = false;
  discardModalOpen.value = false;
  routeStore.discardChanges();
}

async function publishChanges(comment) {
  publishError.value = '';
  publishErrorDetails.value = [];
  publishing.value = true;
  try {
    await routeStore.publish(comment, authStore.user);
    publishModalOpen.value = false;
  } catch (error) {
    publishError.value = error.response?.data?.error || error.message || 'No se pudo publicar.';
    publishErrorDetails.value = error.response?.data?.details || error.response?.data?.warnings || [];
  } finally {
    publishing.value = false;
  }
}
</script>

<style scoped>
.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow-y: auto;
  background:
    radial-gradient(circle at 82% 0%, rgba(0, 182, 200, .16), transparent 28%),
    var(--app-bg);
}
.empty-state {
  text-align: center;
  padding: 80px 20px;
  color: var(--muted);
}
.empty-icon {
  width: 52px;
  height: 52px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  margin: 0 auto 16px;
  background: linear-gradient(135deg, var(--brand-teal), var(--brand-purple));
  color: #fff;
  font-weight: 800;
}
.empty-state h3 { color: var(--text); margin-bottom: 6px; font-weight: 800; }
.topbar {
  background: linear-gradient(135deg, var(--brand-navy), #211F4B);
  border-bottom: 1px solid rgba(226, 224, 219, .18);
  padding: 20px 28px;
  display: flex;
  align-items: center;
  gap: 12px;
  color: #fff;
  box-shadow: 0 14px 36px rgba(42, 40, 95, .18);
}
.topbar-title {
  min-width: 0;
  display: grid;
  gap: 4px;
}
.eyebrow {
  color: var(--brand-teal);
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 1.2px;
}
.topbar h2 {
  font-size: 20px;
  font-weight: 800;
  color: #fff;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.topbar p {
  color: rgba(255, 255, 255, .76);
  font-size: 12px;
  font-weight: 500;
}
.badge {
  font-size: 11px;
  font-weight: 800;
  padding: 5px 11px;
  border-radius: 20px;
}
.badge.env {
  background: var(--brand-yellow);
  color: var(--brand-navy);
  border: 1px solid rgba(255, 255, 255, .22);
}
.spacer { flex: 1; }
.pending-pill {
  background: rgba(255, 223, 0, .18);
  color: #fff;
  border: 1px solid rgba(255, 223, 0, .55);
  font-size: 12px;
  font-weight: 800;
  padding: 5px 14px;
  border-radius: 20px;
}
.btn {
  font-family: inherit;
  font-size: 13px;
  font-weight: 800;
  border-radius: 8px;
  padding: 9px 18px;
  cursor: pointer;
  border: 1px solid transparent;
}
.btn-sm { font-size: 12px; padding: 7px 14px; }
.btn-primary { background: var(--brand-teal); color: #fff; }
.btn-primary:hover { background: var(--brand-teal-dark); }
.btn-primary:disabled { opacity: .45; cursor: not-allowed; }
.btn-outline { background: transparent; border-color: var(--border); color: var(--muted); }
.btn-outline:hover { border-color: var(--brand-teal); color: var(--text); }
.topbar .btn-outline {
  border-color: rgba(226, 224, 219, .45);
  color: #fff;
  background: rgba(255, 255, 255, .06);
}
.topbar .btn-outline:hover {
  border-color: var(--brand-teal);
  color: #fff;
}
.toolbar {
  padding: 18px 28px 0;
  background: linear-gradient(180deg, rgba(42, 40, 95, .10), transparent);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}
.search-box {
  width: min(460px, 100%);
  position: relative;
}
.search-icon {
  position: absolute;
  left: 13px;
  top: 50%;
  transform: translateY(-50%);
  width: 20px;
  height: 20px;
  border-radius: 6px;
  display: grid;
  place-items: center;
  background: rgba(0, 182, 200, .12);
  color: var(--brand-teal);
  font-weight: 800;
}
.search-box input {
  width: 100%;
  padding: 12px 14px 12px 42px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  font-family: inherit;
  font-size: 13px;
  outline: none;
  box-shadow: var(--shadow-soft);
}
.search-box input:focus {
  border-color: var(--brand-teal);
  box-shadow: 0 0 0 3px rgba(0, 182, 200, .18);
}
.sort-control {
  min-width: 230px;
  display: grid;
  gap: 6px;
}
.sort-direction {
  min-width: 170px;
}
.sort-control span {
  color: var(--muted);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 1px;
  text-transform: uppercase;
}
.sort-control select {
  min-height: 42px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  font-weight: 800;
  outline: none;
  padding: 0 12px;
  box-shadow: var(--shadow-soft);
}
.sort-control select:focus {
  border-color: var(--brand-teal);
  box-shadow: 0 0 0 3px rgba(0, 182, 200, .18);
}
.route-list { padding: 18px 28px 40px; }
.route-card {
  position: relative;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 14px 16px 14px 18px;
  margin-bottom: 12px;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 18px;
  transition: border-color .15s, opacity .2s, transform .15s, box-shadow .15s;
  box-shadow: 0 12px 30px rgba(42, 40, 95, .08);
  overflow: hidden;
}
.route-card::before {
  content: "";
  position: absolute;
  inset: 0 auto 0 0;
  width: 4px;
  background: var(--brand-teal);
  opacity: .9;
}
.route-card:hover {
  border-color: var(--brand-teal);
  transform: translateY(-1px);
  box-shadow: 0 18px 40px rgba(42, 40, 95, .12);
}
.route-card.disabled { opacity: .5; }
.route-body {
  min-width: 0;
  display: grid;
  gap: 10px;
}
.route-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
}
.route-title {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.route-header h3 {
  min-width: 0;
  font-size: 15px;
  font-weight: 800;
  color: var(--text);
  overflow-wrap: anywhere;
  line-height: 1.25;
}
.route-status {
  border: 1px solid rgba(0, 182, 200, .34);
  border-radius: 999px;
  background: rgba(0, 182, 200, .12);
  color: var(--text);
  font-size: 10px;
  font-weight: 800;
  padding: 3px 8px;
}
.route-status.off {
  background: var(--surface-alt);
  border-color: var(--border);
  color: var(--muted);
}
.method-list {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  min-height: 34px;
}
.method-chip {
  align-items: center;
  display: inline-flex;
  font-family: ui-monospace, monospace;
  font-size: 9.5px;
  font-weight: 900;
  min-height: 22px;
  padding: 0 8px;
  border: 1px solid transparent;
  border-radius: 7px;
  letter-spacing: .4px;
  line-height: 1;
  box-shadow: 0 1px 0 rgba(255, 255, 255, .12) inset;
}
.method-chip.GET {
  background: var(--brand-teal);
  border-color: rgba(0, 182, 200, .75);
  color: #051A2F;
}
.method-chip.POST {
  background: var(--brand-purple);
  border-color: rgba(131, 66, 215, .78);
  color: #fff;
}
.method-chip.PUT {
  background: var(--brand-yellow);
  border-color: rgba(255, 223, 0, .78);
  color: var(--brand-navy);
}
.method-chip.PATCH {
  background: #E2E0DB;
  border-color: rgba(226, 224, 219, .78);
  color: var(--brand-navy);
}
.method-chip.DELETE {
  background: var(--brand-coral);
  border-color: rgba(240, 86, 116, .78);
  color: #fff;
}
.method-chip.OPTIONS {
  background: var(--brand-navy);
  border-color: rgba(0, 182, 200, .55);
  color: #fff;
}
.method-chip.off {
  background: var(--surface-alt);
  border-color: var(--border);
  color: var(--muted);
  box-shadow: none;
}
.flow-map {
  display: grid;
  grid-template-columns: minmax(220px, .95fr) auto minmax(280px, 1.25fr);
  align-items: end;
  gap: 10px;
}
.flow-map.with-actions {
  grid-template-columns: minmax(220px, .95fr) auto minmax(280px, 1.25fr) auto;
}
.flow-group {
  min-width: 0;
  display: grid;
  gap: 5px;
}
.flow-label {
  color: var(--muted);
  font-size: 9.5px;
  font-weight: 800;
  letter-spacing: .9px;
  text-transform: uppercase;
}
.flow-node {
  align-items: center;
  font-family: ui-monospace, monospace;
  font-size: 12px;
  min-height: 34px;
  padding: 7px 10px;
  border-radius: 6px;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: flex;
}
.upstream { background: var(--brand-navy); color: #fff; }
.downstream {
  background: rgba(0, 182, 200, .14);
  color: var(--text);
  border: 1px solid rgba(0, 182, 200, .34);
}
.flow-arrow {
  align-self: center;
  color: var(--muted);
  font-size: 13px;
  font-weight: 800;
  padding-top: 17px;
}
.route-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  color: var(--muted);
}
.meta-pill {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface-alt);
  font-size: 11px;
  font-weight: 800;
  padding: 4px 10px;
}
.meta-pill span {
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: .7px;
  font-size: 9.5px;
}
.meta-pill strong {
  color: var(--text);
}
.meta-pill strong.cache-on {
  color: var(--brand-teal);
}
.route-actions {
  display: flex;
  align-items: center;
  align-self: end;
  gap: 8px;
  padding-top: 0;
  flex-shrink: 0;
  min-height: 34px;
}
.toggle-btn {
  position: relative;
  width: 44px;
  height: 24px;
  border-radius: 999px;
  background: var(--surface-alt);
  border: 1px solid var(--border);
  cursor: pointer;
  flex-shrink: 0;
  transition: background .2s;
}
.toggle-btn.on { background: var(--brand-teal); }
.toggle-btn::after {
  content: "";
  position: absolute;
  top: 3px;
  left: 3px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  transition: left .2s;
}
.toggle-btn.on::after { left: 23px; }
.action-btn {
  background: color-mix(in srgb, var(--surface), var(--app-bg) 18%);
  border: 1px solid var(--border);
  border-radius: 8px;
  height: 34px;
  width: 34px;
  padding: 0;
  cursor: pointer;
  font: inherit;
  font-weight: 800;
  color: var(--muted);
  display: inline-grid;
  place-items: center;
  transition: background .15s, border-color .15s, color .15s, transform .15s;
}
.action-btn svg {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2;
}
.action-btn:hover,
.action-btn:focus-visible {
  background: rgba(0, 182, 200, .12);
  border-color: var(--brand-teal);
  color: var(--brand-teal);
  outline: none;
  transform: translateY(-1px);
}
.action-btn.danger:hover,
.action-btn.danger:focus-visible {
  border-color: var(--brand-coral);
  color: var(--brand-coral);
  background: rgba(240, 86, 116, .12);
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (max-width: 860px) {
  .topbar {
    align-items: flex-start;
    flex-wrap: wrap;
    padding: 18px;
  }
  .spacer {
    display: none;
  }
  .toolbar,
  .route-list {
    padding-left: 18px;
    padding-right: 18px;
  }
  .toolbar {
    align-items: stretch;
    flex-direction: column;
  }
  .search-box,
  .sort-control {
    width: 100%;
    min-width: 0;
  }
  .route-card {
    grid-template-columns: 1fr;
  }
  .route-actions {
    align-items: center;
    display: grid;
    grid-template-columns: 44px 34px 34px;
    justify-content: end;
  }
  .flow-map {
    grid-template-columns: 1fr;
  }
  .flow-arrow {
    display: none;
  }
  .route-header {
    flex-direction: column;
  }
  .method-list {
    justify-content: flex-start;
  }
}
</style>
