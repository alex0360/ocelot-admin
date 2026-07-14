<template>
  <aside class="sidebar">
    <div class="brand">
      <div class="brand-top">
        <div class="brand-id">
          <div class="brand-mark" aria-hidden="true">GM</div>
          <span class="tag">Ocelot</span>
        </div>
        <button class="theme-btn" :title="themeTitle" @click="$emit('toggle-theme')">
          <svg v-if="currentTheme === 'dark'" class="theme-icon" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2" />
            <path d="M12 20v2" />
            <path d="m4.93 4.93 1.41 1.41" />
            <path d="m17.66 17.66 1.41 1.41" />
            <path d="M2 12h2" />
            <path d="M20 12h2" />
            <path d="m6.34 17.66-1.41 1.41" />
            <path d="m19.07 4.93-1.41 1.41" />
          </svg>
          <svg v-else class="theme-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5 7.2 7.2 0 1 0 20.5 14.5Z" />
          </svg>
          <span>{{ currentTheme === 'dark' ? 'Claro' : 'Oscuro' }}</span>
        </button>
      </div>
      <div class="brand-copy">
        <h1>Gateway Manager</h1>
        <p>Gestor de Puertas de Enlaces</p>
      </div>
    </div>

    <nav class="nav-card app-nav" aria-label="Navegacion principal">
      <RouterLink class="view-link" to="/">Rutas</RouterLink>
      <RouterLink class="view-link" to="/settings">Health</RouterLink>
    </nav>

    <!-- Ambientes -->
    <section class="nav-card">
      <div class="section-header">
        <div>
          <span class="label">Ambientes</span>
          <strong>{{ envStore.environments.length }} registrados</strong>
        </div>
        <div class="header-actions">
          <button class="icon-action primary" title="Agregar ambiente" @click="showAddEnv = !showAddEnv">
            Nuevo
          </button>
        </div>
      </div>
      <div class="env-list">
        <button
          v-for="environment in envStore.environments"
          :key="environment.id"
          class="env-card"
          :class="{ active: envStore.activeEnvironmentId === environment.id }"
          @click="envStore.selectEnvironment(environment.id)"
        >
          <span class="env-icon" aria-hidden="true">{{ environmentInitials(environment.name) }}</span>
          <span class="env-copy">
            <span class="env-name">{{ environment.name }}</span>
            <span class="env-meta">archivos {{ environmentFileCount(environment.id) }}</span>
          </span>
          <span class="env-actions">
            <span class="env-state">{{ envStore.activeEnvironmentId === environment.id ? 'Activo' : 'Abrir' }}</span>
            <span
              v-if="authStore.canPublish"
              class="compact-delete"
              title="Eliminar ambiente"
              role="button"
              tabindex="0"
              @click.stop="openDeleteEnvironment(environment)"
              @keydown.enter.stop.prevent="openDeleteEnvironment(environment)"
              @keydown.space.stop.prevent="openDeleteEnvironment(environment)"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3 6h18" />
                <path d="M8 6V4h8v2" />
                <path d="M6 6l1 15h10l1-15" />
                <path d="M10 11v6" />
                <path d="M14 11v6" />
              </svg>
            </span>
          </span>
        </button>
      </div>
      <div v-if="showAddEnv" class="inline-form">
        <input
          v-model.trim="newEnvName"
          placeholder="Nombre del ambiente..."
          @keyup.enter="createEnvironment"
        >
        <button @click="createEnvironment">Crear</button>
      </div>
    </section>

    <!-- Archivos -->
    <section v-if="envStore.activeEnvironment" class="nav-card">
      <div class="section-header">
        <div>
          <span class="label">Archivos</span>
          <strong>{{ envStore.activeEnvironment.name }}</strong>
        </div>
        <div class="header-actions">
          <button class="icon-action primary" title="Registrar archivo" @click="$emit('open-file-form')">Agregar</button>
        </div>
      </div>
      <nav v-if="envStore.activeFile" class="view-switch" aria-label="Cambiar vista">
        <RouterLink class="view-link" to="/">Rutas</RouterLink>
        <RouterLink class="view-link" to="/history">Historial</RouterLink>
      </nav>
      <div class="file-list">
        <div
          v-for="file in envStore.activeFiles"
          :key="file.id"
          class="file-item"
          :class="{ active: envStore.activeFileId === file.id }"
          @click="selectFile(file)"
        >
          <span class="file-icon" aria-hidden="true">JSON</span>
          <div class="file-info">
            <span class="file-name" :title="file.displayName">{{ file.displayName }}</span>
            <span v-if="envStore.activeFileId === file.id" class="file-meta-row">
              <span class="file-count">{{ fileEndpointLabel(file) }}</span>
              <span class="file-state">Activo</span>
            </span>
            <span v-if="envStore.activeFileId === file.id" class="file-path-chip" :title="file.filePath">
              {{ file.filePath }}
            </span>
          </div>
          <span class="file-actions">
            <button
              v-if="authStore.canPublish"
              class="file-delete-btn"
              title="Desregistrar archivo"
              @click.stop="openDeleteFile(file)"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3 6h18" />
                <path d="M8 6V4h8v2" />
                <path d="M6 6l1 15h10l1-15" />
                <path d="M10 11v6" />
                <path d="M14 11v6" />
              </svg>
            </button>
          </span>
        </div>
      </div>
      <p v-if="!envStore.activeFiles.length" class="empty-hint">
        No hay archivos registrados para este ambiente.
      </p>
    </section>

    <!-- User -->
    <div class="sidebar-footer">
      <div class="user-info">
        <span class="avatar">{{ initials }}</span>
        <span>{{ authStore.user?.displayName }}</span>
      </div>
      <span class="role-badge">{{ primaryRole }}</span>
    </div>

    <DeleteConfirmModal
      v-if="deleteTarget"
      :eyebrow="deleteTarget.eyebrow"
      :title="deleteTarget.title"
      :message="deleteTarget.message"
      :detail="deleteTarget.detail"
      :confirm-label="deleteTarget.confirmLabel"
      @close="deleteTarget = null"
      @confirm="confirmDelete"
    />
  </aside>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import DeleteConfirmModal from '../DeleteConfirmModal.vue';
import { useEnvironmentStore } from '../../stores/environmentStore.js';
import { useRouteStore } from '../../stores/routeStore.js';
import { useAuthStore } from '../../stores/authStore.js';

const envStore = useEnvironmentStore();
const routeStore = useRouteStore();
const authStore = useAuthStore();
const router = useRouter();

const props = defineProps({
  currentTheme: {
    type: String,
    default: 'dark',
  },
});

const showAddEnv = ref(false);
const newEnvName = ref('');
const deleteTarget = ref(null);

const initials = computed(() => {
  const name = authStore.user?.displayName || '';
  return name.split(' ').map(word => word[0]).join('').slice(0, 2).toUpperCase();
});

const primaryRole = computed(() => {
  if (authStore.canPublish) return 'Publisher';
  if (authStore.canEdit) return 'Editor';
  return 'Viewer';
});

const themeTitle = computed(() =>
  props.currentTheme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'
);

function environmentInitials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function environmentFileCount(environmentId) {
  return envStore.files.filter(file => file.environmentId === environmentId).length;
}

function fileEndpointLabel(file) {
  return `endpoints ${routeStore.currentFileId === file.id ? routeStore.routes.length : 0}`;
}

async function createEnvironment() {
  if (!newEnvName.value) return;
  await envStore.createEnvironment({ name: newEnvName.value });
  newEnvName.value = '';
  showAddEnv.value = false;
}

function selectFile(file) {
  envStore.selectFile(file.id);
  routeStore.loadRoutes(file.id);
  router.push('/');
}

function openDeleteEnvironment(environment = envStore.activeEnvironment) {
  if (!environment) return;
  deleteTarget.value = {
    type: 'environment',
    id: environment.id,
    eyebrow: 'Eliminar ambiente',
    title: `Eliminar ${environment.name}`,
    message: 'Se eliminara el ambiente y se desregistraran sus archivos del panel.',
    detail: 'No se borran los archivos ocelot.json del disco.',
    confirmLabel: 'Eliminar ambiente',
  };
}

function openDeleteFile(file) {
  deleteTarget.value = {
    type: 'file',
    id: file.id,
    eyebrow: 'Desregistrar archivo',
    title: `Desregistrar ${file.displayName}`,
    message: 'El archivo dejara de aparecer en el panel para este ambiente.',
    detail: file.filePath,
    confirmLabel: 'Desregistrar',
  };
}

async function confirmDelete() {
  if (!deleteTarget.value) return;
  const target = deleteTarget.value;
  deleteTarget.value = null;

  if (target.type === 'environment') {
    await envStore.removeEnvironment(target.id);
    routeStore.clearRoutes();
    return;
  }

  if (target.type === 'file') {
    await envStore.unregisterFile(target.id);
    routeStore.clearRoutes();
  }
}

defineEmits(['open-file-form', 'toggle-theme']);
</script>

<style scoped>
.sidebar {
  width: 296px;
  flex-shrink: 0;
  background: var(--sidebar-bg);
  color: var(--sidebar-text);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  border-right: 1px solid var(--sidebar-border);
}
.brand {
  padding: 18px 16px;
  border-bottom: 1px solid var(--sidebar-border);
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 10px;
}
.brand-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.brand-id {
  display: inline-flex;
  align-items: center;
  min-width: 0;
  gap: 10px;
}
.brand-mark {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  background: linear-gradient(135deg, var(--brand-teal), var(--brand-purple));
  color: #fff;
  display: grid;
  place-items: center;
  font-size: 12px;
  font-weight: 800;
  flex-shrink: 0;
}
.brand-copy {
  min-width: 0;
}
.brand h1 {
  font-size: 18px;
  color: var(--sidebar-text);
  font-weight: 800;
  line-height: 1.05;
}
.tag {
  background: var(--brand-yellow);
  color: var(--brand-navy);
  font-size: 10px;
  padding: 2px 7px;
  border-radius: 4px;
  font-weight: 800;
  letter-spacing: .2px;
}
.brand p {
  font-size: 11px;
  color: var(--sidebar-muted);
  margin-top: 4px;
  line-height: 1.35;
}
.theme-btn {
  appearance: none;
  border: 1px solid var(--sidebar-border);
  border-radius: 7px;
  background: var(--sidebar-surface);
  color: var(--sidebar-muted);
  cursor: pointer;
  font: inherit;
  font-size: 10px;
  font-weight: 800;
  padding: 6px 8px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.theme-btn:hover {
  border-color: var(--brand-teal);
  color: var(--sidebar-text);
}
.theme-icon {
  width: 13px;
  height: 13px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2;
  flex-shrink: 0;
}
.nav-card {
  margin: 14px 12px 0;
  padding: 12px;
  border: 1px solid var(--sidebar-border);
  border-radius: 12px;
  background: var(--sidebar-surface);
  box-shadow: var(--shadow-soft);
}
.section-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  padding-bottom: 10px;
}
.label {
  display: block;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 1.4px;
  color: var(--sidebar-muted);
  font-weight: 800;
  margin-bottom: 3px;
}
.section-header strong {
  color: var(--sidebar-text);
  font-size: 12px;
  font-weight: 700;
}
.header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.icon-action {
  appearance: none;
  display: inline-grid;
  place-items: center;
  min-height: 28px;
  border: 1px solid var(--sidebar-border);
  border-radius: 8px;
  background: transparent;
  color: var(--sidebar-muted);
  cursor: pointer;
  font: inherit;
  font-size: 11px;
  font-weight: 800;
  padding: 0 9px;
  text-decoration: none;
}
.icon-action:hover {
  border-color: var(--brand-teal);
  color: var(--sidebar-text);
}
.icon-action.primary {
  background: var(--brand-teal);
  border-color: var(--brand-teal);
  color: #fff;
}
.icon-action.danger:hover {
  border-color: var(--brand-coral);
  color: var(--brand-coral);
}
.view-switch {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  margin-bottom: 10px;
  padding: 4px;
  border: 1px solid var(--sidebar-border);
  border-radius: 10px;
  background: rgba(0, 0, 0, .08);
}
.app-nav {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  padding: 4px;
}
.view-link {
  min-height: 30px;
  display: grid;
  place-items: center;
  border-radius: 8px;
  color: var(--sidebar-muted);
  font-size: 11px;
  font-weight: 900;
  text-decoration: none;
}
.view-link:hover {
  color: var(--sidebar-text);
}
.view-link.router-link-exact-active {
  background: var(--brand-teal);
  color: #fff;
}
.env-list,
.file-list {
  display: grid;
  gap: 8px;
}
.env-card,
.file-item {
  position: relative;
  width: 100%;
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 9px;
  border-radius: 10px;
  border: 1px solid var(--sidebar-border);
  background: transparent;
  color: var(--sidebar-text);
  cursor: pointer;
  font-family: inherit;
  text-align: left;
  overflow: hidden;
  transition: border-color .15s, background .15s, transform .15s;
}
.file-item {
  align-items: flex-start;
  padding: 10px;
}
.env-card.active::before,
.file-item.active::before {
  content: "";
  position: absolute;
  inset: 0 auto 0 0;
  width: 3px;
  background: var(--brand-teal);
}
.env-card:hover,
.file-item:hover {
  border-color: var(--brand-teal);
  transform: translateY(-1px);
}
.env-card.active,
.file-item.active {
  background: rgba(0, 182, 200, .14);
  border-color: var(--brand-teal);
}
.env-icon,
.file-icon {
  width: 34px;
  height: 34px;
  border-radius: 9px;
  display: grid;
  place-items: center;
  background: var(--brand-navy);
  color: #fff;
  font-size: 11px;
  font-weight: 800;
}
.file-icon {
  font-size: 9px;
}
.env-card.active .env-icon,
.file-item.active .file-icon {
  background: var(--brand-teal);
}
.env-copy,
.file-info {
  display: grid;
  gap: 2px;
  min-width: 0;
}
.file-info {
  gap: 6px;
}
.file-meta-row {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  min-width: 0;
}
.env-name,
.file-name {
  color: var(--sidebar-text);
  font-size: 13px;
  font-weight: 800;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.file-name {
  display: block;
  line-height: 1.25;
  overflow: visible;
  text-overflow: initial;
  white-space: normal;
  word-break: break-word;
}
.file-count {
  border: 1px solid rgba(0, 182, 200, .34);
  border-radius: 999px;
  color: var(--brand-teal);
  flex-shrink: 0;
  font-size: 9px;
  font-weight: 900;
  padding: 2px 6px;
  text-transform: uppercase;
}
.env-meta {
  color: var(--sidebar-muted);
  font-size: 10.5px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.file-path-chip {
  background: rgba(42, 40, 95, .22);
  border: 1px solid var(--sidebar-border);
  border-radius: 7px;
  color: var(--sidebar-muted);
  display: block;
  font-family: ui-monospace, monospace;
  font-size: 9.5px;
  font-weight: 700;
  max-width: 100%;
  overflow: hidden;
  padding: 4px 6px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.env-state,
.file-state {
  border-radius: 999px;
  border: 1px solid var(--sidebar-border);
  color: var(--sidebar-muted);
  font-size: 10px;
  font-weight: 800;
  padding: 3px 7px;
}
.env-card.active .env-state,
.file-state {
  border-color: var(--brand-teal);
  color: var(--brand-teal);
}
.env-actions,
.file-actions {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 1px;
}
.compact-delete,
.file-delete-btn {
  width: 24px;
  height: 24px;
  min-width: 24px;
  display: grid;
  place-items: center;
  border: 1px solid var(--sidebar-border);
  border-radius: 8px;
  background: transparent;
  color: var(--sidebar-muted);
  cursor: pointer;
  font-family: inherit;
  font-size: 13px;
  font-weight: 900;
  line-height: 1;
}
.compact-delete svg,
.file-delete-btn svg {
  width: 13px;
  height: 13px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2;
}
.compact-delete:hover,
.compact-delete:focus-visible,
.file-delete-btn:hover,
.file-delete-btn:focus-visible {
  border-color: var(--brand-coral);
  background: rgba(240, 86, 116, .12);
  color: var(--brand-coral);
  outline: none;
}
.file-delete-btn {
  appearance: none;
  flex-shrink: 0;
}
.empty-hint {
  padding: 10px;
  font-size: 12px;
  color: var(--sidebar-muted);
}
.inline-form {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  padding-top: 10px;
}
.inline-form input {
  flex: 1;
  padding: 6px 10px;
  border-radius: 6px;
  border: 1px solid var(--sidebar-border);
  background: var(--sidebar-surface);
  color: var(--sidebar-text);
  font-family: inherit;
  font-size: 12px;
  outline: none;
}
.inline-form input:focus { border-color: var(--brand-teal); }
.inline-form button {
  background: var(--brand-teal);
  border: none;
  color: #fff;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  font-family: inherit;
}
.sidebar-footer {
  margin-top: auto;
  padding: 14px 16px;
  border-top: 1px solid var(--sidebar-border);
  font-size: 12px;
  background: linear-gradient(90deg, rgba(0, 182, 200, .08), transparent);
}
.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--sidebar-text);
  font-weight: 500;
  margin-bottom: 4px;
}
.avatar {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: var(--brand-teal);
  color: #fff;
  display: grid;
  place-items: center;
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
}
.role-badge {
  color: var(--brand-teal);
  font-weight: 600;
  font-size: 11px;
}
</style>
