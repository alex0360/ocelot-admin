<template>
  <main class="history-view">
    <header class="history-hero">
      <div>
        <span class="eyebrow">Historial</span>
        <h2>Snapshots de publicacion</h2>
        <p>{{ activeFileLabel }}</p>
      </div>
      <button class="btn btn-outline" :disabled="loading || !envStore.activeFileId" @click="loadHistory">
        Actualizar
      </button>
    </header>

    <section v-if="!envStore.activeFileId" class="empty-panel">
      <div class="empty-icon" aria-hidden="true">GM</div>
      <h3>Selecciona un archivo</h3>
      <p>El historial se muestra para el archivo Ocelot activo en la barra lateral.</p>
    </section>

    <section v-else class="history-content">
      <div class="history-summary">
        <div>
          <span>Total snapshots</span>
          <strong>{{ snapshots.length }}</strong>
        </div>
        <div>
          <span>Ultima publicacion</span>
          <strong>{{ snapshots[0] ? formatDate(snapshots[0].publishedAt) : 'Sin datos' }}</strong>
        </div>
      </div>

      <div v-if="loading" class="empty-panel compact">
        <p>Cargando historial...</p>
      </div>

      <div v-else-if="error" class="message error-message">
        {{ error }}
      </div>

      <div v-else-if="!snapshots.length" class="empty-panel compact">
        <h3>No hay snapshots</h3>
        <p>Cuando publiques cambios, apareceran aqui para auditoria y rollback.</p>
      </div>

      <ol v-else class="timeline">
        <li
          v-for="(snapshot, index) in snapshots"
          :key="snapshot.id"
          class="timeline-item"
          :class="{
            current: index === 0,
            rollback: isRollbackSnapshot(snapshot),
            'has-backup': Boolean(snapshot.backupPath),
          }"
        >
          <span class="timeline-dot" aria-hidden="true"></span>
          <article class="snapshot-card" :class="{ 'has-backup': Boolean(snapshot.backupPath) }">
            <header class="snapshot-header">
              <div>
                <h3>
                  {{ snapshot.userDisplayName || 'Usuario' }} publico
                  {{ snapshot.changes?.length || 0 }} cambio(s)
                </h3>
                <p>{{ formatDate(snapshot.publishedAt) }} - {{ envStore.activeEnvironment?.name || 'Ambiente' }}</p>
              </div>
              <span class="snapshot-size">{{ snapshotSource(snapshot) }}</span>
            </header>

            <p class="comment">{{ snapshot.comment || 'Sin comentario' }}</p>

            <ul v-if="snapshot.changes?.length" class="changes-list">
              <li v-for="(change, index) in snapshot.changes" :key="`${snapshot.id}-${index}`">
                <span class="change-kind" :class="change.kind">{{ changeLabel(change.kind) }}</span>
                <span>{{ change.text }}</span>
              </li>
            </ul>

            <div v-if="snapshot.backupPath" class="backup-chip" :title="snapshot.backupPath">
              <span>Backup</span>
              <strong>{{ fileName(snapshot.backupPath) }}</strong>
            </div>

            <footer class="snapshot-actions">
              <button class="link-btn" :disabled="restoringId === snapshot.id" @click="openRestoreModal(snapshot)">
                {{ restoringId === snapshot.id ? 'Restaurando...' : 'Restaurar esta version' }}
              </button>
            </footer>
          </article>
        </li>
      </ol>
    </section>

    <div v-if="restoreTarget" class="restore-backdrop" @click.self="closeRestoreModal">
      <form class="restore-modal" @submit.prevent="confirmRestore">
        <header class="restore-header">
          <div>
            <span class="eyebrow">Rollback</span>
            <h3>Restaurar snapshot</h3>
            <p>{{ formatDate(restoreTarget.publishedAt) }}</p>
          </div>
          <button type="button" class="modal-close" aria-label="Cerrar" @click="closeRestoreModal">x</button>
        </header>

        <section class="restore-body">
          <div class="restore-target">
            <span>Archivo</span>
            <strong>{{ envStore.activeFile?.displayName || 'Archivo activo' }}</strong>
            <p>{{ envStore.activeFile?.filePath }}</p>
          </div>

          <div class="restore-preview">
            <div>
              <span>Publicado por</span>
              <strong>{{ restoreTarget.userDisplayName || 'Usuario' }}</strong>
            </div>
            <div>
              <span>Cambios</span>
              <strong>{{ restoreTarget.changes?.length || 0 }}</strong>
            </div>
            <div>
              <span>Origen</span>
              <strong>{{ snapshotSource(restoreTarget) }}</strong>
            </div>
          </div>

          <label class="field">
            <span>Comentario</span>
            <textarea
              v-model="rollbackComment"
              rows="3"
              placeholder="Describe por que se restaura esta version"
            ></textarea>
          </label>

          <div v-if="restoreTarget.backupPath" class="backup-detail" :title="restoreTarget.backupPath">
            <span>Backup usado para restaurar</span>
            <strong>{{ fileName(restoreTarget.backupPath) }}</strong>
          </div>

          <p v-if="restoreError" class="message error-message compact-message">{{ restoreError }}</p>
        </section>

        <footer class="restore-actions">
          <button type="button" class="btn secondary-btn" :disabled="isRestoring" @click="closeRestoreModal">
            Cancelar
          </button>
          <button type="submit" class="btn primary-btn" :disabled="isRestoring">
            {{ isRestoring ? 'Restaurando...' : 'Restaurar version' }}
          </button>
        </footer>
      </form>
    </div>
  </main>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { publishingApi } from '../api/publishing.js';
import { useEnvironmentStore } from '../stores/environmentStore.js';
import { useRouteStore } from '../stores/routeStore.js';

const envStore = useEnvironmentStore();
const routeStore = useRouteStore();

const snapshots = ref([]);
const loading = ref(false);
const error = ref('');
const restoringId = ref('');
const restoreTarget = ref(null);
const rollbackComment = ref('');
const restoreError = ref('');

const isRestoring = computed(() => Boolean(restoringId.value));

const activeFileLabel = computed(() =>
  envStore.activeFile
    ? `${envStore.activeFile.displayName} - ${envStore.activeFile.filePath}`
    : 'Selecciona un archivo para ver su historial'
);

onMounted(loadHistory);

watch(
  () => envStore.activeFileId,
  () => loadHistory()
);

async function loadHistory() {
  if (!envStore.activeFileId) {
    snapshots.value = [];
    return;
  }

  loading.value = true;
  error.value = '';
  try {
    snapshots.value = await publishingApi.history(envStore.activeFileId);
  } catch (requestError) {
    error.value = requestError.response?.data?.error || requestError.message || 'No se pudo cargar el historial.';
  } finally {
    loading.value = false;
  }
}

function openRestoreModal(snapshot) {
  restoreTarget.value = snapshot;
  rollbackComment.value = `Rollback a ${formatDate(snapshot.publishedAt)}`;
  restoreError.value = '';
}

function closeRestoreModal() {
  if (isRestoring.value) return;
  restoreTarget.value = null;
  rollbackComment.value = '';
  restoreError.value = '';
}

async function confirmRestore() {
  if (!restoreTarget.value) return;

  const snapshot = restoreTarget.value;
  restoringId.value = snapshot.id;
  error.value = '';
  restoreError.value = '';
  try {
    await publishingApi.rollback({
      fileId: envStore.activeFileId,
      snapshotId: snapshot.id,
      comment: rollbackComment.value.trim() || `Rollback a ${formatDate(snapshot.publishedAt)}`,
    });
    restoreTarget.value = null;
    rollbackComment.value = '';
    await loadHistory();
    await routeStore.loadRoutes(envStore.activeFileId);
  } catch (requestError) {
    restoreError.value = requestError.response?.data?.error || requestError.message || 'No se pudo restaurar el snapshot.';
  } finally {
    restoringId.value = '';
  }
}

function formatDate(value) {
  if (!value) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-DO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function snapshotSource(snapshot) {
  if (snapshot.backupPath) return 'Backup';
  if (!snapshot.jsonContent) return 'Sin respaldo';
  return contentSize(snapshot.jsonContent);
}

function contentSize(jsonContent) {
  const kilobytes = new Blob([jsonContent]).size / 1024;
  return `${kilobytes.toFixed(kilobytes >= 10 ? 0 : 1)} KB`;
}

function fileName(path) {
  if (!path) return 'backup.json';
  return path.split(/[\\/]/).filter(Boolean).pop() || path;
}

function changeLabel(kind) {
  return {
    add: 'Nuevo',
    mod: 'Cambio',
    del: 'Elimina',
    rollback: 'Rollback',
  }[kind] || 'Cambio';
}

function isRollbackSnapshot(snapshot) {
  return snapshot.changes?.some(change => change.kind === 'rollback')
    || /rollback/i.test(snapshot.comment || '');
}
</script>

<style scoped>
.history-view {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  background:
    radial-gradient(circle at 88% 0%, rgba(0, 182, 200, .16), transparent 30%),
    var(--app-bg);
  color: var(--text);
}
.history-hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 22px 28px;
  background:
    radial-gradient(circle at 92% 10%, rgba(0, 182, 200, .22), transparent 28%),
    linear-gradient(135deg, var(--brand-navy), #211F4B);
  color: #fff;
  border-bottom: 1px solid rgba(226, 224, 219, .18);
}
.eyebrow {
  color: var(--brand-teal);
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 1.2px;
  text-transform: uppercase;
}
.history-hero h2 {
  color: #fff;
  font-size: 22px;
  font-weight: 900;
  margin-top: 4px;
}
.history-hero p {
  color: rgba(255, 255, 255, .72);
  font-size: 12px;
  margin-top: 5px;
  overflow-wrap: anywhere;
}
.btn {
  appearance: none;
  min-height: 38px;
  border-radius: 8px;
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  font-weight: 900;
  padding: 8px 16px;
}
.btn-outline {
  background: rgba(255, 255, 255, .07);
  border: 1px solid rgba(226, 224, 219, .42);
  color: #fff;
}
.primary-btn {
  background: var(--brand-teal);
  border: 1px solid var(--brand-teal);
  color: #fff;
}
.secondary-btn {
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--text);
}
.btn:disabled {
  cursor: not-allowed;
  opacity: .55;
}
.history-content {
  padding: 20px 28px 44px;
}
.history-summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 18px;
}
.history-summary div,
.empty-panel,
.snapshot-card,
.restore-modal {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: 0 12px 30px rgba(42, 40, 95, .08);
}
.history-summary div {
  display: grid;
  gap: 5px;
  padding: 14px 16px;
}
.history-summary span {
  color: var(--muted);
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 1px;
  text-transform: uppercase;
}
.history-summary strong {
  color: var(--text);
  font-size: 16px;
  font-weight: 900;
}
.empty-panel {
  margin: 28px;
  padding: 42px 24px;
  text-align: center;
  color: var(--muted);
}
.empty-panel.compact {
  margin: 0;
  padding: 24px;
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
  font-weight: 900;
}
.empty-panel h3 {
  color: var(--text);
  font-size: 18px;
  font-weight: 900;
  margin-bottom: 6px;
}
.message {
  border-radius: 10px;
  font-size: 12px;
  font-weight: 800;
  padding: 12px 14px;
}
.error-message {
  border: 1px solid rgba(240, 86, 116, .38);
  background: rgba(240, 86, 116, .10);
  color: var(--brand-coral);
}
.timeline {
  list-style: none;
  margin: 0;
  padding: 0 0 0 18px;
  position: relative;
}
.timeline-item {
  --timeline-dot-bg: rgba(226, 224, 219, .18);
  --timeline-dot-border: rgba(226, 224, 219, .50);
  --timeline-dot-halo: transparent;
  --timeline-line: linear-gradient(
    180deg,
    rgba(226, 224, 219, .48),
    rgba(131, 66, 215, .30) 54%,
    rgba(0, 182, 200, .28)
  );
  --timeline-card-line: linear-gradient(
    180deg,
    rgba(226, 224, 219, .46),
    rgba(131, 66, 215, .34) 52%,
    rgba(0, 182, 200, .30)
  );
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr);
  gap: 12px;
  margin-bottom: 14px;
  position: relative;
}
.timeline-item.current {
  --timeline-dot-bg: var(--brand-teal);
  --timeline-dot-border: var(--brand-teal);
  --timeline-dot-halo: rgba(0, 182, 200, .18);
  --timeline-line: linear-gradient(180deg, var(--brand-teal), rgba(0, 182, 200, .62) 48%, rgba(131, 66, 215, .62));
  --timeline-card-line: linear-gradient(180deg, var(--brand-teal), rgba(0, 182, 200, .64) 45%, var(--brand-purple));
}
.timeline-item.rollback {
  --timeline-dot-bg: rgba(131, 66, 215, .24);
  --timeline-dot-border: rgba(131, 66, 215, .68);
  --timeline-line: linear-gradient(180deg, rgba(131, 66, 215, .62), rgba(131, 66, 215, .36) 58%, rgba(226, 224, 219, .26));
  --timeline-card-line: linear-gradient(180deg, rgba(131, 66, 215, .72), rgba(131, 66, 215, .46) 52%, rgba(226, 224, 219, .28));
}
.timeline-item.current.rollback {
  --timeline-dot-bg: linear-gradient(135deg, var(--brand-teal), var(--brand-purple));
  --timeline-dot-border: var(--brand-purple);
  --timeline-dot-halo: rgba(131, 66, 215, .18);
  --timeline-line: linear-gradient(180deg, var(--brand-teal), rgba(131, 66, 215, .74));
  --timeline-card-line: linear-gradient(180deg, var(--brand-teal), var(--brand-purple));
}
.timeline-item::before {
  content: "";
  position: absolute;
  left: 8px;
  top: 34px;
  bottom: -18px;
  width: 3px;
  border-radius: 999px;
  background: var(--timeline-line);
}
.timeline-item:last-child::before {
  display: none;
}
.timeline-dot {
  width: 16px;
  height: 16px;
  border: 3px solid var(--timeline-dot-border);
  border-radius: 50%;
  background: var(--timeline-dot-bg);
  margin-top: 18px;
  position: relative;
  z-index: 1;
  box-shadow:
    0 0 0 4px var(--app-bg),
    0 0 0 7px var(--timeline-dot-halo);
}
.snapshot-card {
  overflow: hidden;
  padding: 0;
  position: relative;
}
.snapshot-card::before {
  content: "";
  position: absolute;
  inset: 0 auto 0 0;
  width: 3px;
  background: var(--timeline-card-line);
  opacity: .95;
}
.snapshot-header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 16px 0;
}
.snapshot-header h3 {
  color: var(--text);
  font-size: 15px;
  font-weight: 900;
}
.snapshot-header p {
  color: var(--muted);
  font-size: 12px;
  margin-top: 5px;
}
.snapshot-size {
  align-self: flex-start;
  align-items: center;
  background: var(--brand-navy);
  border: 1px solid rgba(0, 182, 200, .55);
  border-radius: 7px;
  box-shadow: 0 1px 0 rgba(255, 255, 255, .12) inset;
  color: #fff;
  display: inline-flex;
  font-size: 9.5px;
  font-weight: 900;
  letter-spacing: .4px;
  line-height: 1;
  min-height: 22px;
  padding: 0 8px;
  text-transform: uppercase;
  white-space: nowrap;
}
.comment {
  color: var(--text);
  font-size: 13px;
  font-weight: 700;
  margin: 12px 16px 0;
}
.changes-list {
  list-style: none;
  margin: 12px 16px 0;
  padding: 0;
  display: grid;
  gap: 6px;
}
.changes-list li {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  color: var(--muted);
  font-size: 12px;
}
.change-kind {
  align-items: center;
  border: 1px solid transparent;
  border-radius: 7px;
  box-shadow: 0 1px 0 rgba(255, 255, 255, .12) inset;
  display: inline-flex;
  flex-shrink: 0;
  font-family: ui-monospace, monospace;
  font-size: 9.5px;
  font-weight: 900;
  letter-spacing: .4px;
  line-height: 1;
  min-height: 22px;
  padding: 0 8px;
  text-transform: uppercase;
}
.change-kind.add {
  background: var(--brand-teal);
  border-color: rgba(0, 182, 200, .75);
  color: #051A2F;
}
.change-kind.mod {
  background: var(--brand-yellow);
  border-color: rgba(255, 223, 0, .78);
  color: var(--brand-navy);
}
.change-kind.del {
  background: var(--brand-coral);
  border-color: rgba(240, 86, 116, .78);
  color: #fff;
}
.change-kind.rollback {
  background: var(--brand-purple);
  border-color: rgba(131, 66, 215, .78);
  color: #fff;
}
.backup-chip {
  align-items: center;
  background: var(--brand-navy);
  border: 1px solid rgba(0, 182, 200, .55);
  border-radius: 7px;
  box-shadow: 0 1px 0 rgba(255, 255, 255, .12) inset;
  color: #fff;
  display: inline-flex;
  gap: 8px;
  margin: 12px 16px 0;
  max-width: calc(100% - 32px);
  min-height: 26px;
  padding: 0 9px;
}
.backup-chip span,
.backup-detail span {
  color: inherit;
  font-size: 9.5px;
  font-weight: 900;
  letter-spacing: .6px;
  text-transform: uppercase;
}
.backup-chip strong {
  color: inherit;
  font-family: ui-monospace, monospace;
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.snapshot-actions {
  background: color-mix(in srgb, var(--surface), var(--app-bg) 32%);
  border-top: 1px solid var(--border);
  margin-top: 14px;
  padding: 12px 16px;
}
.link-btn {
  appearance: none;
  border: 0;
  background: transparent;
  color: var(--brand-teal);
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  font-weight: 900;
  padding: 0;
}
.link-btn:disabled {
  cursor: not-allowed;
  opacity: .55;
}
.restore-backdrop {
  align-items: center;
  background: rgba(5, 10, 28, .62);
  display: flex;
  inset: 0;
  justify-content: center;
  padding: 24px;
  position: fixed;
  z-index: 60;
}
.restore-modal {
  color: var(--text);
  max-width: 560px;
  overflow: hidden;
  width: min(560px, 100%);
}
.restore-header {
  align-items: flex-start;
  background:
    radial-gradient(circle at 85% 0%, rgba(0, 182, 200, .2), transparent 32%),
    linear-gradient(135deg, var(--brand-navy), #211F4B);
  color: #fff;
  display: flex;
  gap: 16px;
  justify-content: space-between;
  padding: 22px 24px;
}
.restore-header h3 {
  color: #fff;
  font-size: 22px;
  font-weight: 900;
  margin-top: 5px;
}
.restore-header p {
  color: rgba(255, 255, 255, .72);
  font-size: 12px;
  margin-top: 4px;
}
.modal-close {
  appearance: none;
  background: rgba(255, 255, 255, .08);
  border: 1px solid rgba(226, 224, 219, .34);
  border-radius: 8px;
  color: #fff;
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  font-weight: 900;
  height: 34px;
  width: 34px;
}
.restore-body {
  display: grid;
  gap: 14px;
  padding: 20px 24px;
}
.restore-target {
  background: color-mix(in srgb, var(--surface), var(--app-bg) 36%);
  border: 1px solid var(--border);
  border-radius: 10px;
  display: grid;
  gap: 4px;
  padding: 12px;
}
.restore-target span,
.restore-preview span,
.field span {
  color: var(--muted);
  font-size: 11px;
  font-weight: 900;
}
.restore-target strong {
  color: var(--text);
  font-size: 14px;
}
.restore-target p {
  color: var(--muted);
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.restore-preview {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
.restore-preview div {
  border: 1px solid var(--border);
  border-radius: 10px;
  display: grid;
  gap: 4px;
  padding: 11px;
}
.restore-preview strong {
  color: var(--text);
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.field {
  display: grid;
  gap: 7px;
}
.field textarea {
  background: var(--input-bg);
  border: 1px solid var(--input-border);
  border-radius: 10px;
  color: var(--text);
  font: inherit;
  min-height: 92px;
  padding: 11px 12px;
  resize: vertical;
}
.field textarea:focus {
  border-color: var(--brand-teal);
  box-shadow: 0 0 0 3px rgba(0, 182, 200, .16);
  outline: none;
}
.backup-detail {
  background: rgba(0, 182, 200, .08);
  border: 1px dashed rgba(0, 182, 200, .32);
  border-radius: 10px;
  display: grid;
  gap: 4px;
  padding: 10px 12px;
}
.backup-detail strong {
  color: var(--text);
  font-family: ui-monospace, monospace;
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.compact-message {
  margin: 0;
}
.restore-actions {
  align-items: center;
  background: color-mix(in srgb, var(--surface), var(--app-bg) 38%);
  border-top: 1px solid var(--border);
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  padding: 16px 24px;
}
@media (max-width: 760px) {
  .history-hero,
  .snapshot-header {
    flex-direction: column;
  }
  .history-content {
    padding: 16px;
  }
  .history-summary {
    grid-template-columns: 1fr;
  }
  .restore-preview {
    grid-template-columns: 1fr;
  }
  .restore-actions {
    flex-direction: column-reverse;
  }
  .restore-actions .btn {
    width: 100%;
  }
  .empty-panel {
    margin: 16px;
  }
}
</style>
