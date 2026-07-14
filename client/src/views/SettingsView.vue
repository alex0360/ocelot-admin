<template>
  <main class="settings-view">
    <header class="settings-hero">
      <div>
        <span class="eyebrow">Configuracion</span>
        <h2>Health de servicios</h2>
        <p>Configuracion agrupada por host y puerto.</p>
      </div>
      <div class="hero-actions">
        <button class="btn btn-outline hero-btn" @click="openCreateService">
          Nuevo health
        </button>
        <button class="btn btn-primary hero-btn" :disabled="loadingHealth" @click="checkHealth">
          {{ loadingHealth ? 'Consultando...' : 'Probar health' }}
        </button>
      </div>
    </header>

    <section class="content">
      <div v-if="loading" class="empty-panel">Cargando servicios...</div>
      <div v-else-if="error" class="message error-message">{{ error }}</div>
      <div v-else-if="!groups.length" class="empty-panel">No hay servicios registrados.</div>

      <template v-else>
        <div class="toolbar">
          <div class="search-box">
            <span class="search-icon" aria-hidden="true">/</span>
            <input v-model="searchQuery" type="text" placeholder="Buscar por nombre, host o health...">
          </div>
          <label class="sort-control">
            <span>Ordenar por</span>
            <select v-model="sortMode">
              <option value="name">Nombre</option>
              <option value="host">Host</option>
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

        <div v-if="!filteredGroups.length" class="empty-panel compact">
          <h3>Sin resultados</h3>
          <p>Prueba otro termino de busqueda.</p>
        </div>

        <div v-else class="group-grid">
        <article v-for="group in filteredGroups" :key="group.key" class="service-group">
          <div class="service-body">
            <header class="group-header">
              <div class="group-title">
                <h3>{{ group.services.map(service => service.name).join(', ') }}</h3>
                <span class="service-state" :class="{ off: !group.health.enabled }">
                  {{ group.health.enabled ? 'Activo' : 'Apagado' }}
                </span>
              </div>
              <div class="health-toolbar">
                <div class="health-tags" aria-label="Configuracion health">
                  <span class="health-tag method-tag" :class="group.health.method">{{ group.health.method }}</span>
                  <span class="health-tag">{{ routeCountLabel(group) }}</span>
                </div>
              </div>
            </header>

            <div class="health-flow with-actions">
              <div class="flow-group">
                <span class="flow-label">Host</span>
                <span class="flow-node upstream">{{ group.host }}:{{ group.port }}</span>
              </div>
              <span class="flow-arrow">-></span>
              <div class="flow-group">
                <span class="flow-label">Health</span>
                <span class="flow-node downstream">{{ healthUrl(group) }}</span>
              </div>
              <div class="service-actions">
                <span class="status-pill" :class="statusFor(group.key).status">
                  {{ statusLabel(statusFor(group.key).status) }}
                </span>
                <button
                  class="toggle-btn"
                  :class="{ on: group.health.enabled }"
                  :disabled="updatingGroupKey === group.key"
                  :title="group.health.enabled ? 'Desactivar health' : 'Activar health'"
                  :aria-label="group.health.enabled ? 'Desactivar health' : 'Activar health'"
                  @click="toggleGroupEnabled(group)"
                ></button>
                <button class="action-btn" title="Editar health" aria-label="Editar health" @click="editGroup(group)">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5Z" />
                  </svg>
                </button>
                <button class="action-btn danger" title="Eliminar health" aria-label="Eliminar health" @click="openDeleteGroup(group)">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M3 6h18" />
                    <path d="M8 6V4h8v2" />
                    <path d="M6 6l1 15h10l1-15" />
                    <path d="M10 11v6" />
                    <path d="M14 11v6" />
                  </svg>
                </button>
              </div>
            </div>

            <div class="group-meta">
              <span class="meta-pill">
                <span>Timeout</span>
                <strong>{{ group.health.timeoutMs }} ms</strong>
              </span>
              <span class="meta-pill">
                <span>Status</span>
                <strong>{{ group.health.expectedStatus?.join(', ') || '200' }}</strong>
              </span>
              <span class="meta-pill">
                <span>Esquema</span>
                <strong>{{ group.health.scheme }}</strong>
              </span>
            </div>

            <div v-if="statusFor(group.key).error" class="message error-message compact">
              {{ statusFor(group.key).error }}
            </div>
          </div>
        </article>
        </div>
      </template>
    </section>

    <div v-if="editorOpen" class="modal-backdrop" @click.self="closeEditor">
      <form class="modal" @submit.prevent="saveHealth">
        <header class="modal-header">
          <div>
            <span class="eyebrow">Health</span>
            <h3>{{ editorMode === 'create' ? 'Nuevo health' : `${serviceForm.host}:${serviceForm.port}` }}</h3>
            <p>{{ editorSubtitle }}</p>
          </div>
          <button type="button" class="close-btn" @click="closeEditor">x</button>
        </header>

        <section class="form-grid">
          <label class="field field-wide">
            <span>{{ editingGroup?.services?.length > 1 ? 'Servicios' : 'Nombre del servicio' }}</span>
            <input
              v-model.trim="serviceForm.name"
              type="text"
              :disabled="editorMode === 'edit' && editingGroup?.services?.length > 1"
              placeholder="Notificaciones"
              required
            >
          </label>

          <label class="field">
            <span>Host</span>
            <input v-model.trim="serviceForm.host" type="text" placeholder="svc-notifs" required>
          </label>

          <label class="field">
            <span>Puerto</span>
            <input v-model.number="serviceForm.port" type="number" min="1" max="65535" required>
          </label>

          <label class="field">
            <span>Esquema</span>
            <select v-model="healthForm.scheme">
              <option value="http">http</option>
              <option value="https">https</option>
            </select>
          </label>

          <label class="field">
            <span>Metodo</span>
            <select v-model="healthForm.method">
              <option value="GET">GET</option>
              <option value="HEAD">HEAD</option>
            </select>
          </label>

          <label class="field field-wide">
            <span>Path</span>
            <input v-model.trim="healthForm.path" type="text" placeholder="/health" required>
          </label>

          <label class="field">
            <span>Timeout ms</span>
            <input v-model.number="healthForm.timeoutMs" type="number" min="500" max="30000" step="100" required>
          </label>

          <label class="field">
            <span>Status esperado</span>
            <input v-model.trim="expectedStatusText" type="text" placeholder="200,204" required>
          </label>
        </section>

        <div v-if="formWarnings.length" class="warning-list">
          <div v-for="warning in formWarnings" :key="warning" class="message warning-message compact">
            {{ warning }}
          </div>
        </div>

        <p v-if="formError" class="message error-message compact">{{ formError }}</p>

        <footer class="modal-actions">
          <button type="button" class="btn btn-outline" @click="closeEditor">Cancelar</button>
          <button type="submit" class="btn btn-primary" :disabled="saving">
            {{ saving ? 'Guardando...' : 'Guardar' }}
          </button>
        </footer>
      </form>
    </div>

    <DeleteConfirmModal
      v-if="deleteTarget"
      eyebrow="Eliminar health"
      :title="`Eliminar ${deleteTarget.host}:${deleteTarget.port}`"
      :message="deleteMessage"
      :detail="deleteTarget.services.map(service => service.name).join(', ')"
      confirm-label="Eliminar health"
      @close="deleteTarget = null"
      @confirm="confirmDeleteGroup"
    />
  </main>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import DeleteConfirmModal from '../components/DeleteConfirmModal.vue';
import { servicesApi } from '../api/services.js';
import { useEnvironmentStore } from '../stores/environmentStore.js';
import { useRouteStore } from '../stores/routeStore.js';

const envStore = useEnvironmentStore();
const routeStore = useRouteStore();
const services = ref([]);
const healthResults = ref([]);
const loading = ref(false);
const loadingHealth = ref(false);
const saving = ref(false);
const error = ref('');
const formError = ref('');
const editingGroup = ref(null);
const editorMode = ref('');
const deleteTarget = ref(null);
const updatingGroupKey = ref('');
const expectedStatusText = ref('200');
const searchQuery = ref('');
const sortMode = ref('name');
const sortDirection = ref('asc');

const serviceForm = reactive({
  name: '',
  host: '',
  port: 80,
});

const healthForm = reactive({
  enabled: true,
  scheme: 'http',
  path: '/health',
  method: 'GET',
  timeoutMs: 3000,
  expectedStatus: [200],
});

const editorOpen = computed(() => Boolean(editorMode.value));

const editorSubtitle = computed(() => {
  if (editorMode.value === 'create') return 'Registrar servicio y configuracion health.';
  if (!editingGroup.value) return '';
  const count = editingGroup.value.services.length;
  return count > 1
    ? `Editando health para ${count} servicios agrupados.`
    : editingGroup.value.services[0]?.name || 'Servicio';
});

const deleteMessage = computed(() => {
  if (!deleteTarget.value) return '';
  const count = deleteTarget.value.services.length;
  return count > 1
    ? `Se eliminaran ${count} servicios registrados para este host y puerto.`
    : 'Se eliminara este servicio health del catalogo.';
});

const formWarnings = computed(() => {
  if (!editorOpen.value) return [];

  const warnings = [];
  const port = Number(serviceForm.port);
  const path = normalizeHealthPath(healthForm.path || '');
  const timeout = Number(healthForm.timeoutMs);

  if (Number.isFinite(timeout) && timeout > 10000) {
    warnings.push('Timeout alto: puede hacer lenta la consulta de health.');
  }
  if (Number.isFinite(timeout) && timeout > 0 && timeout < 1000) {
    warnings.push('Timeout bajo: puede marcar fallos por latencia normal.');
  }
  if (healthForm.scheme === 'https' && [80, 5000, 5001].includes(port)) {
    warnings.push('Revisa esquema y puerto: https con puerto usualmente usado por http.');
  }
  if (healthForm.scheme === 'http' && port === 443) {
    warnings.push('Revisa esquema y puerto: http con puerto 443 suele ser inconsistente.');
  }
  if (path && !['/health', '/healthz', '/ready', '/status'].includes(path.toLowerCase())) {
    warnings.push('Path poco comun para health. Confirma que el servicio expone esa ruta.');
  }

  const previewGroup = {
    host: serviceForm.host.trim(),
    port,
  };
  if (serviceForm.host.trim() && port && routeCountFor(previewGroup) === 0) {
    warnings.push('No hay endpoints del Ocelot activo apuntando a este host y puerto.');
  }
  if (editorMode.value === 'edit' && (editingGroup.value?.services?.length || 0) > 1) {
    warnings.push('Este host y puerto agrupa varios servicios; los cambios aplican a todos.');
  }

  return warnings;
});

const groups = computed(() => {
  const map = new Map();
  for (const service of services.value) {
    const key = `${service.host}:${service.port}`;
    if (!map.has(key)) {
      map.set(key, {
        key,
        host: service.host,
        port: service.port,
        health: service.health || defaultHealth(),
        services: [],
      });
    }
    map.get(key).services.push(service);
  }
  return [...map.values()].sort((left, right) =>
    left.host.localeCompare(right.host) || Number(left.port) - Number(right.port)
  );
});

const filteredGroups = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  const direction = sortDirection.value === 'desc' ? -1 : 1;

  return groups.value
    .map((group, index) => ({ group, index }))
    .filter(({ group }) => {
      if (!query) return true;
      const serviceNames = group.services.map(service => service.name).join(' ').toLowerCase();
      return serviceNames.includes(query)
        || group.host.toLowerCase().includes(query)
        || String(group.port).includes(query)
        || healthUrl(group).toLowerCase().includes(query)
        || group.health.method.toLowerCase().includes(query)
        || routeCountLabel(group).toLowerCase().includes(query);
    })
    .sort((left, right) => {
      if (sortMode.value === 'port') {
        return (((Number(left.group.port) || 0) - (Number(right.group.port) || 0)) || left.index - right.index) * direction;
      }

      if (sortMode.value === 'host') {
        const hostCompare = left.group.host.localeCompare(right.group.host)
          || ((Number(left.group.port) || 0) - (Number(right.group.port) || 0))
          || left.index - right.index;
        return hostCompare * direction;
      }

      const leftName = left.group.services.map(service => service.name).join(', ').toLowerCase();
      const rightName = right.group.services.map(service => service.name).join(', ').toLowerCase();
      return (leftName.localeCompare(rightName) || left.index - right.index) * direction;
    })
    .map(({ group }) => group);
});

onMounted(async () => {
  await loadServices();
  await ensureRoutesLoaded();
});

watch(
  () => envStore.activeFileId,
  () => ensureRoutesLoaded()
);

async function loadServices() {
  loading.value = true;
  error.value = '';
  try {
    services.value = await servicesApi.list();
  } catch (requestError) {
    error.value = requestError.response?.data?.error || requestError.message || 'No se pudieron cargar los servicios.';
  } finally {
    loading.value = false;
  }
}

async function checkHealth() {
  loadingHealth.value = true;
  error.value = '';
  try {
    healthResults.value = await servicesApi.health();
  } catch (requestError) {
    error.value = requestError.response?.data?.error || requestError.message || 'No se pudo consultar health.';
  } finally {
    loadingHealth.value = false;
  }
}

function editGroup(group) {
  editingGroup.value = group;
  editorMode.value = 'edit';
  formError.value = '';
  Object.assign(serviceForm, {
    name: group.services.length > 1
      ? group.services.map(service => service.name).join(', ')
      : group.services[0]?.name || '',
    host: group.host,
    port: Number(group.port) || 80,
  });
  Object.assign(healthForm, {
    ...defaultHealth(),
    ...(group.health || {}),
  });
  expectedStatusText.value = (healthForm.expectedStatus || [200]).join(',');
}

function openCreateService() {
  editingGroup.value = null;
  editorMode.value = 'create';
  formError.value = '';
  Object.assign(serviceForm, {
    name: '',
    host: '',
    port: 80,
  });
  Object.assign(healthForm, defaultHealth());
  expectedStatusText.value = '200';
}

function closeEditor(force = false) {
  if (saving.value && !force) return;
  editingGroup.value = null;
  editorMode.value = '';
  formError.value = '';
}

async function saveHealth() {
  const validation = validateHealthForm();
  if (!validation.valid) {
    formError.value = validation.error;
    return;
  }

  saving.value = true;
  formError.value = '';
  const health = {
    enabled: editorMode.value === 'edit'
      ? editingGroup.value?.health?.enabled ?? true
      : true,
    scheme: healthForm.scheme,
    path: validation.path,
    method: healthForm.method,
    timeoutMs: Number(healthForm.timeoutMs),
    expectedStatus: validation.expectedStatus,
  };

  try {
    if (editorMode.value === 'create') {
      await servicesApi.create({
        name: serviceForm.name.trim(),
        host: serviceForm.host.trim(),
        port: validation.port,
        health,
      });
    } else {
      await Promise.all(editingGroup.value.services.map(service => {
        const data = {
          host: serviceForm.host.trim(),
          port: validation.port,
          health,
        };
        if (editingGroup.value.services.length === 1) {
          data.name = serviceForm.name.trim();
        }
        return servicesApi.update(service.id, data);
      }));
    }
    closeEditor(true);
    await loadServices();
  } catch (requestError) {
    formError.value = requestError.response?.data?.error || requestError.message || 'No se pudo guardar.';
  } finally {
    saving.value = false;
  }
}

function openDeleteGroup(group) {
  deleteTarget.value = group;
}

async function toggleGroupEnabled(group) {
  updatingGroupKey.value = group.key;
  error.value = '';
  const health = {
    ...defaultHealth(),
    ...(group.health || {}),
    enabled: !group.health.enabled,
  };

  try {
    await Promise.all(group.services.map(service =>
      servicesApi.update(service.id, { health })
    ));
    await loadServices();
  } catch (requestError) {
    error.value = requestError.response?.data?.error || requestError.message || 'No se pudo actualizar el estado health.';
  } finally {
    updatingGroupKey.value = '';
  }
}

async function confirmDeleteGroup() {
  if (!deleteTarget.value) return;
  const target = deleteTarget.value;
  deleteTarget.value = null;
  error.value = '';
  try {
    await Promise.all(target.services.map(service => servicesApi.remove(service.id)));
    await loadServices();
  } catch (requestError) {
    error.value = requestError.response?.data?.error || requestError.message || 'No se pudo eliminar el health.';
  }
}

function healthUrl(group) {
  const health = group.health || defaultHealth();
  return `${health.scheme || 'http'}://${group.host}:${group.port}${health.path || '/health'}`;
}

function statusFor(groupKey) {
  return healthResults.value.find(result => result.key === groupKey) || { status: 'unknown' };
}

function statusLabel(status) {
  return {
    healthy: 'OK',
    unhealthy: 'Fallo',
    unreachable: 'Sin conexion',
    disabled: 'Apagado',
    unknown: 'Sin probar',
  }[status] || status;
}

async function ensureRoutesLoaded() {
  if (!envStore.activeFileId) return;
  if (routeStore.currentFileId === envStore.activeFileId && routeStore.routes.length) return;
  await routeStore.loadRoutes(envStore.activeFileId);
}

function routeCountFor(group) {
  return routeStore.routes.filter(route =>
    route.downstreamHost === group.host && Number(route.downstreamPort) === Number(group.port)
  ).length;
}

function routeCountLabel(group) {
  const count = routeCountFor(group);
  return `endpoints ${count}`;
}

function validateHealthForm() {
  const name = serviceForm.name.trim();
  const host = serviceForm.host.trim();
  const port = Number(serviceForm.port);
  const path = normalizeHealthPath(healthForm.path || '');
  const timeout = Number(healthForm.timeoutMs);
  const expectedStatus = expectedStatusText.value
    .split(',')
    .map(value => Number(value.trim()))
    .filter(Number.isInteger);

  if (!name) return invalid('Nombre del servicio es obligatorio.');
  if (!host) return invalid('Host es obligatorio.');
  if (/^https?:\/\//i.test(host)) return invalid('Host no debe incluir http:// ni https://.');
  if (host.includes('/')) return invalid('Host no debe incluir ruta. Usa Path para /health.');
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return invalid('Puerto debe estar entre 1 y 65535.');
  }
  if (!['http', 'https'].includes(healthForm.scheme)) {
    return invalid('Esquema debe ser http o https.');
  }
  if (!['GET', 'HEAD'].includes(healthForm.method)) {
    return invalid('Metodo debe ser GET o HEAD.');
  }
  if (!path) return invalid('Path es obligatorio.');
  if (!path.startsWith('/')) return invalid('Path debe empezar con /.');
  if (/^https?:\/\//i.test(path)) return invalid('Path no debe incluir dominio ni protocolo.');
  if (!Number.isInteger(timeout) || timeout < 500 || timeout > 30000) {
    return invalid('Timeout debe estar entre 500 y 30000 ms.');
  }
  if (!expectedStatus.length) return invalid('Indica al menos un status esperado.');
  if (expectedStatus.some(status => status < 100 || status > 599)) {
    return invalid('Status esperado debe contener codigos HTTP entre 100 y 599.');
  }
  if (hasDuplicateHealthTarget(host, port, path)) {
    return invalid('Ya existe un health registrado con el mismo host, puerto y path.');
  }

  return { valid: true, port, path, expectedStatus };
}

function hasDuplicateHealthTarget(host, port, path) {
  const normalizedHost = host.toLowerCase();
  const normalizedPath = normalizeHealthPath(path).toLowerCase();
  const currentServiceIds = new Set(editingGroup.value?.services?.map(service => service.id) || []);

  return services.value.some(service => {
    if (editorMode.value === 'edit' && currentServiceIds.has(service.id)) return false;
    return service.host.toLowerCase() === normalizedHost
      && Number(service.port) === Number(port)
      && normalizeHealthPath(service.health?.path || '/health').toLowerCase() === normalizedPath;
  });
}

function normalizeHealthPath(path) {
  const trimmed = String(path || '').trim();
  if (!trimmed) return '';
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

function invalid(error) {
  return { valid: false, error };
}

function defaultHealth(path = '/health') {
  return {
    enabled: true,
    scheme: 'http',
    path,
    method: 'GET',
    timeoutMs: 3000,
    expectedStatus: [200],
  };
}
</script>

<style scoped>
.settings-view {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  background:
    radial-gradient(circle at 88% 0%, rgba(0, 182, 200, .16), transparent 30%),
    var(--app-bg);
  color: var(--text);
}
.settings-hero {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 24px 28px;
  background: linear-gradient(135deg, var(--brand-navy), #211F4B);
  color: #fff;
}
.eyebrow {
  color: var(--brand-teal);
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 1.2px;
  text-transform: uppercase;
}
.settings-hero h2 {
  color: #fff;
  font-size: 22px;
  font-weight: 900;
  margin-top: 4px;
}
.settings-hero p {
  color: rgba(255, 255, 255, .72);
  font-size: 12px;
  margin-top: 5px;
}
.hero-actions {
  align-items: center;
  display: flex;
  flex-shrink: 0;
  gap: 10px;
}
.content {
  padding: 0 28px 44px;
}
.toolbar {
  align-items: center;
  background: linear-gradient(180deg, rgba(42, 40, 95, .10), transparent);
  display: flex;
  gap: 14px;
  justify-content: space-between;
  padding: 18px 0;
}
.search-box {
  position: relative;
  width: min(460px, 100%);
}
.search-icon {
  align-items: center;
  background: rgba(0, 182, 200, .12);
  border-radius: 6px;
  color: var(--brand-teal);
  display: grid;
  font-size: 16px;
  font-weight: 900;
  height: 20px;
  left: 13px;
  place-items: center;
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 20px;
}
.search-box input {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: var(--shadow-soft);
  color: var(--text);
  font-family: inherit;
  font-size: 13px;
  outline: none;
  padding: 12px 14px 12px 42px;
  width: 100%;
}
.search-box input:focus {
  border-color: var(--brand-teal);
  box-shadow: 0 0 0 3px rgba(0, 182, 200, .18);
}
.sort-control {
  display: grid;
  gap: 6px;
  min-width: 230px;
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
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  color: var(--text);
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  font-weight: 800;
  min-height: 42px;
  outline: none;
  padding: 0 12px;
  box-shadow: var(--shadow-soft);
}
.sort-control select:focus {
  border-color: var(--brand-teal);
  box-shadow: 0 0 0 3px rgba(0, 182, 200, .18);
}
.group-grid {
  display: grid;
  gap: 12px;
}
.service-group,
.empty-panel,
.modal {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: 0 12px 30px rgba(42, 40, 95, .08);
}
.service-group {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;
  overflow: hidden;
  padding: 14px 16px 14px 18px;
  transition: border-color .15s, box-shadow .15s, transform .15s;
}
.service-group::before {
  content: "";
  position: absolute;
  inset: 0 auto 0 0;
  width: 4px;
  background: var(--brand-teal);
  opacity: .9;
}
.service-group:hover {
  border-color: var(--brand-teal);
  box-shadow: 0 18px 40px rgba(42, 40, 95, .12);
  transform: translateY(-1px);
}
.service-body {
  display: grid;
  gap: 10px;
  min-width: 0;
}
.group-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
}
.group-title {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  min-width: 0;
}
.group-header h3 {
  color: var(--text);
  font-size: 15px;
  font-weight: 900;
  line-height: 1.25;
  min-width: 0;
  overflow-wrap: anywhere;
}
.service-state,
.status-pill,
.health-tag,
.meta-pill {
  align-items: center;
  display: inline-flex;
  border: 1px solid var(--border);
  border-radius: 999px;
  white-space: nowrap;
}
.service-state {
  background: rgba(0, 182, 200, .12);
  border-color: rgba(0, 182, 200, .34);
  color: var(--text);
  font-size: 10px;
  font-weight: 900;
  padding: 3px 8px;
}
.service-state.off {
  background: var(--surface-alt);
  border-color: var(--border);
  color: var(--muted);
}
.health-toolbar {
  align-items: center;
  display: flex;
  flex-shrink: 0;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.health-tags {
  align-items: center;
  display: flex;
  flex-shrink: 0;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: flex-end;
  min-height: 34px;
}
.health-tag {
  background: var(--surface-alt);
  border-color: var(--border);
  color: var(--muted);
  font-size: 9.5px;
  font-weight: 900;
  letter-spacing: .4px;
  min-height: 22px;
  padding: 0 8px;
  text-transform: uppercase;
}
.health-tag.host-tag {
  background: var(--brand-teal);
  border-color: rgba(0, 182, 200, .75);
  color: #051A2F;
  font-family: ui-monospace, monospace;
  text-transform: none;
}
.health-tag.method-tag.GET {
  background: var(--brand-teal);
  border-color: rgba(0, 182, 200, .75);
  color: #051A2F;
}
.health-tag.method-tag.HEAD {
  background: var(--brand-navy);
  border-color: rgba(0, 182, 200, .55);
  color: #fff;
}
.status-pill {
  background: var(--surface-alt);
  color: var(--muted);
  font-size: 11px;
  font-weight: 900;
  justify-content: center;
  min-height: 28px;
  padding: 0 10px;
}
.status-pill.healthy { border-color: rgba(0, 182, 200, .38); color: var(--brand-teal); }
.status-pill.unhealthy,
.status-pill.unreachable { border-color: rgba(240, 86, 116, .38); color: var(--brand-coral); }
.status-pill.disabled { color: var(--muted); }
.health-flow {
  display: grid;
  grid-template-columns: minmax(220px, .85fr) auto minmax(280px, 1.4fr);
  align-items: end;
  gap: 10px;
}
.health-flow.with-actions {
  grid-template-columns: minmax(220px, .85fr) auto minmax(280px, 1.4fr) auto;
}
.flow-group {
  display: grid;
  gap: 5px;
  min-width: 0;
}
.flow-label {
  color: var(--muted);
  font-size: 9.5px;
  font-weight: 900;
  letter-spacing: .8px;
  text-transform: uppercase;
}
.flow-node {
  align-items: center;
  border-radius: 6px;
  display: flex;
  font-family: ui-monospace, monospace;
  font-size: 12px;
  min-height: 34px;
  overflow: hidden;
  padding: 7px 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.upstream {
  background: var(--brand-navy);
  color: #fff;
}
.downstream {
  background: rgba(0, 182, 200, .14);
  border: 1px solid rgba(0, 182, 200, .34);
  color: var(--text);
}
.flow-arrow {
  align-self: center;
  color: var(--muted);
  font-size: 13px;
  font-weight: 900;
  padding-top: 17px;
}
.group-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
.meta-pill {
  background: var(--surface-alt);
  color: var(--muted);
  gap: 7px;
  padding: 4px 9px;
}
.meta-pill span {
  color: var(--muted);
  font-size: 9.5px;
  font-weight: 900;
  letter-spacing: .7px;
  text-transform: uppercase;
}
.meta-pill strong {
  color: var(--text);
  font-size: 11px;
  font-weight: 900;
}
.service-actions {
  align-items: center;
  align-self: end;
  display: flex;
  flex-shrink: 0;
  gap: 8px;
  justify-content: flex-end;
  min-height: 34px;
}
.toggle-btn {
  background: var(--surface-alt);
  border: 1px solid var(--border);
  border-radius: 999px;
  cursor: pointer;
  flex-shrink: 0;
  height: 26px;
  position: relative;
  transition: background .2s, opacity .15s;
  width: 46px;
}
.toggle-btn.on {
  background: var(--brand-teal);
}
.toggle-btn::after {
  background: #fff;
  border-radius: 50%;
  content: "";
  height: 16px;
  left: 3px;
  position: absolute;
  top: 4px;
  transition: left .2s;
  width: 16px;
}
.toggle-btn.on::after {
  left: 25px;
}
.toggle-btn:disabled {
  cursor: wait;
  opacity: .6;
}
.action-btn {
  appearance: none;
  background: color-mix(in srgb, var(--surface), var(--app-bg) 18%);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--muted);
  cursor: pointer;
  display: grid;
  height: 34px;
  place-items: center;
  transition: background .15s, border-color .15s, color .15s, transform .15s;
  width: 34px;
}
.action-btn svg {
  fill: none;
  height: 16px;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2;
  width: 16px;
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
  background: rgba(240, 86, 116, .12);
  border-color: var(--brand-coral);
  color: var(--brand-coral);
}
.btn,
.link-btn,
.close-btn {
  font: inherit;
}
.btn {
  appearance: none;
  min-height: 38px;
  border-radius: 8px;
  border: 1px solid transparent;
  cursor: pointer;
  font-size: 12px;
  font-weight: 900;
  padding: 8px 16px;
}
.btn-primary {
  background: var(--brand-teal);
  color: #fff;
}
.btn-outline {
  background: var(--surface);
  border-color: var(--border);
  color: var(--muted);
}
.settings-hero .btn-outline {
  background: rgba(255, 255, 255, .08);
  border-color: rgba(226, 224, 219, .38);
  color: #fff;
}
.settings-hero .btn-outline:hover {
  border-color: var(--brand-teal);
}
.btn:disabled {
  cursor: not-allowed;
  opacity: .6;
}
.empty-panel {
  color: var(--muted);
  padding: 28px;
  text-align: center;
}
.empty-panel.compact {
  margin-bottom: 18px;
}
.message {
  border-radius: 10px;
  font-size: 12px;
  font-weight: 800;
  padding: 12px 14px;
}
.message.compact {
  margin-top: 12px;
}
.error-message {
  border: 1px solid rgba(240, 86, 116, .38);
  background: rgba(240, 86, 116, .10);
  color: var(--brand-coral);
}
.warning-list {
  display: grid;
  gap: 8px;
  padding: 0 22px 6px;
}
.warning-message {
  border: 1px solid rgba(255, 223, 0, .38);
  background: rgba(255, 223, 0, .10);
  color: var(--brand-yellow);
}
.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 30;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(42, 40, 95, .62);
}
.modal {
  width: min(560px, 100%);
  overflow: hidden;
}
.modal-header {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  padding: 20px 22px;
  background: linear-gradient(135deg, var(--brand-navy), #211F4B);
}
.modal-header h3 {
  color: #fff;
  font-size: 18px;
  font-weight: 900;
  margin-top: 4px;
}
.modal-header p {
  color: rgba(255, 255, 255, .72);
  font-size: 12px;
  margin-top: 5px;
}
.close-btn {
  width: 32px;
  height: 32px;
  border: 1px solid rgba(226, 224, 219, .38);
  border-radius: 8px;
  background: rgba(255, 255, 255, .08);
  color: #fff;
  cursor: pointer;
  font-weight: 900;
}
.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  padding: 20px 22px;
}
.field {
  display: grid;
  gap: 7px;
}
.field-wide {
  grid-column: 1 / -1;
}
.field span {
  color: var(--muted);
  font-size: 12px;
  font-weight: 900;
}
.field input,
.field select {
  min-height: 40px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
  font: inherit;
  outline: none;
  padding: 8px 11px;
}
.field input:disabled {
  cursor: not-allowed;
  opacity: .72;
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 18px 22px 22px;
  background: var(--surface-alt);
  border-top: 1px solid var(--border);
}
@media (max-width: 760px) {
  .settings-hero,
  .group-header {
    flex-direction: column;
    align-items: flex-start;
  }
  .content {
    padding: 16px;
  }
  .toolbar {
    align-items: stretch;
    flex-direction: column;
    padding-top: 0;
  }
  .search-box,
  .sort-control {
    min-width: 0;
    width: 100%;
  }
  .hero-actions {
    align-items: stretch;
    flex-direction: column;
    width: 100%;
  }
  .hero-actions .btn {
    width: 100%;
  }
  .service-group {
    grid-template-columns: 1fr;
  }
  .health-tags {
    justify-content: flex-start;
  }
  .health-toolbar {
    justify-content: flex-start;
    width: 100%;
  }
  .health-tags,
  .service-actions {
    width: 100%;
  }
  .health-flow {
    grid-template-columns: 1fr;
  }
  .flow-arrow {
    display: none;
  }
  .service-actions {
    justify-content: flex-start;
  }
  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
