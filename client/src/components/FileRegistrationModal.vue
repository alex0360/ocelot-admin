<template>
  <div class="modal-backdrop" @click.self="$emit('close')">
    <form class="modal" @submit.prevent="submit">
      <header class="modal-header">
        <div>
          <h2>Registrar archivo</h2>
          <p>{{ environmentName }}</p>
        </div>
        <button type="button" class="icon-btn" title="Cerrar" @click="$emit('close')">x</button>
      </header>

      <label class="field">
        <span>Nombre</span>
        <input
          v-model.trim="form.displayName"
          type="text"
          placeholder="CWS.Api.Gateway.Private"
          autocomplete="off"
          required
        >
      </label>

      <label class="field">
        <span>Ruta del archivo</span>
        <input
          v-model.trim="form.filePath"
          type="text"
          placeholder="C:\gateway\ocelot.json"
          autocomplete="off"
          required
        >
      </label>

      <p v-if="error" class="error">{{ error }}</p>

      <footer class="modal-actions">
        <button type="button" class="btn btn-outline" :disabled="submitting" @click="$emit('close')">
          Cancelar
        </button>
        <button type="submit" class="btn btn-primary" :disabled="submitting">
          {{ submitting ? 'Guardando...' : 'Guardar' }}
        </button>
      </footer>
    </form>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue';
import { useEnvironmentStore } from '../stores/environmentStore.js';
import { useRouteStore } from '../stores/routeStore.js';

const props = defineProps({
  environmentId: {
    type: String,
    required: true,
  },
  environmentName: {
    type: String,
    required: true,
  },
});

const emit = defineEmits(['close']);
const envStore = useEnvironmentStore();
const routeStore = useRouteStore();

const form = reactive({
  displayName: '',
  filePath: '',
});

const error = ref('');
const submitting = ref(false);

async function submit() {
  error.value = '';
  if (!form.displayName || !form.filePath) {
    error.value = 'Completa el nombre y la ruta del archivo.';
    return;
  }

  submitting.value = true;
  try {
    const file = await envStore.registerFile({
      environmentId: props.environmentId,
      ...form,
    });
    envStore.selectFile(file.id);
    await routeStore.loadRoutes(file.id);
    emit('close');
  } catch (requestError) {
    error.value = requestError.response?.data?.error || requestError.message || 'No se pudo registrar el archivo.';
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 20;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(42, 40, 95, .58);
}
.modal {
  width: min(480px, 100%);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: var(--shadow-soft);
  overflow: hidden;
}
.modal-header {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 22px 24px 18px;
  background: linear-gradient(135deg, var(--brand-navy), #211F4B);
}
.modal-header div { flex: 1; min-width: 0; }
.modal-header h2 {
  font-size: 17px;
  font-weight: 800;
  color: #fff;
}
.modal-header p {
  font-size: 12px;
  color: rgba(255, 255, 255, .72);
  margin-top: 4px;
}
.icon-btn {
  width: 30px;
  height: 30px;
  border: 1px solid rgba(226, 224, 219, .38);
  border-radius: 6px;
  background: rgba(255, 255, 255, .08);
  color: #fff;
  cursor: pointer;
  font: inherit;
  font-weight: 800;
}
.icon-btn:hover {
  border-color: var(--brand-teal);
  color: #fff;
}
.field {
  display: grid;
  gap: 7px;
  margin: 0 24px 14px;
}
.modal-header + .field {
  margin-top: 20px;
}
.field span {
  font-size: 12px;
  font-weight: 800;
  color: var(--muted);
}
.field input,
.field select {
  width: 100%;
  min-height: 38px;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px 11px;
  color: var(--text);
  background: var(--surface);
  font: inherit;
  outline: none;
}
.field input:focus,
.field select:focus {
  border-color: var(--brand-teal);
  box-shadow: 0 0 0 3px rgba(0, 182, 200, .18);
}
.error {
  margin: 4px 24px 14px;
  color: var(--brand-coral);
  font-size: 12px;
  font-weight: 800;
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 18px 24px 22px;
  border-top: 1px solid var(--border);
  background: var(--surface-alt);
}
.btn {
  min-height: 36px;
  border-radius: 7px;
  padding: 8px 16px;
  font: inherit;
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
  border: 1px solid transparent;
}
.btn:disabled {
  opacity: .55;
  cursor: not-allowed;
}
.btn-primary {
  background: var(--brand-teal);
  color: #fff;
}
.btn-primary:hover { background: var(--brand-teal-dark); }
.btn-outline {
  background: transparent;
  color: var(--muted);
  border-color: var(--border);
}
.btn-outline:hover {
  border-color: var(--brand-teal);
  color: var(--text);
}
</style>
