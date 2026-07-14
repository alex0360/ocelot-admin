<template>
  <div class="global-backdrop" @click.self="$emit('close')">
    <form class="global-modal" @submit.prevent="submit">
      <header class="global-header">
        <div>
          <span class="eyebrow">Ocelot</span>
          <h2>GlobalConfiguration</h2>
          <p>Edita la configuracion global del archivo activo.</p>
        </div>
        <button type="button" class="close-btn" title="Cerrar" @click="$emit('close')">x</button>
      </header>

      <section class="global-body">
        <label class="field">
          <span>BaseUrl</span>
          <input v-model.trim="baseUrl" type="text" placeholder="https://localhost:8008" @input="syncBaseUrl">
        </label>

        <label class="field">
          <span>JSON completo</span>
          <textarea v-model="jsonText" rows="18" spellcheck="false"></textarea>
        </label>

        <p v-if="error" class="error">{{ error }}</p>
      </section>

      <footer class="global-actions">
        <button type="button" class="btn btn-outline" @click="$emit('close')">Cancelar</button>
        <button type="submit" class="btn btn-primary">Guardar</button>
      </footer>
    </form>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';

const props = defineProps({
  config: {
    type: Object,
    default: () => ({}),
  },
});

const emit = defineEmits(['close', 'save']);

const jsonText = ref('');
const baseUrl = ref('');
const error = ref('');

watch(
  () => props.config,
  (config) => {
    const nextConfig = config && Object.keys(config).length ? config : { BaseUrl: '' };
    jsonText.value = JSON.stringify(nextConfig, null, 2);
    baseUrl.value = nextConfig.BaseUrl || '';
    error.value = '';
  },
  { immediate: true }
);

function syncBaseUrl() {
  try {
    const parsed = parseConfig();
    parsed.BaseUrl = baseUrl.value || '';
    jsonText.value = JSON.stringify(parsed, null, 2);
  } catch {
    // Si el JSON esta temporalmente invalido, no interrumpir la escritura.
  }
}

function submit() {
  try {
    const parsed = parseConfig();
    emit('save', parsed);
  } catch (validationError) {
    error.value = validationError.message;
  }
}

function parseConfig() {
  const parsed = JSON.parse(jsonText.value || '{}');
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    throw new Error('GlobalConfiguration debe ser un objeto JSON.');
  }
  return parsed;
}
</script>

<style scoped>
.global-backdrop {
  position: fixed;
  inset: 0;
  z-index: 30;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(42, 40, 95, .66);
}
.global-modal {
  width: min(780px, 100%);
  max-height: calc(100vh - 32px);
  overflow: auto;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  box-shadow: var(--shadow-soft);
}
.global-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 22px 24px 18px;
  background:
    radial-gradient(circle at 86% 0%, rgba(0, 182, 200, .22), transparent 28%),
    linear-gradient(135deg, var(--brand-navy), #211F4B);
}
.eyebrow {
  color: var(--brand-teal);
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 1px;
  text-transform: uppercase;
}
.global-header h2 {
  color: #fff;
  font-size: 22px;
  font-weight: 900;
  margin-top: 4px;
}
.global-header p {
  color: rgba(255, 255, 255, .72);
  font-size: 12px;
  margin-top: 5px;
}
.close-btn {
  width: 34px;
  height: 34px;
  border: 1px solid rgba(226, 224, 219, .38);
  border-radius: 8px;
  background: rgba(255, 255, 255, .08);
  color: #fff;
  cursor: pointer;
  font: inherit;
  font-weight: 900;
}
.global-body {
  display: grid;
  gap: 16px;
  padding: 20px 24px;
}
.field {
  display: grid;
  gap: 7px;
}
.field span {
  color: var(--muted);
  font-size: 12px;
  font-weight: 900;
}
.field input,
.field textarea {
  width: 100%;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
  font: inherit;
  outline: none;
  padding: 10px 12px;
}
.field input {
  min-height: 40px;
}
.field textarea {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  line-height: 1.45;
  resize: vertical;
}
.field input:focus,
.field textarea:focus {
  border-color: var(--brand-teal);
  box-shadow: 0 0 0 3px rgba(0, 182, 200, .18);
}
.error {
  border: 1px solid rgba(240, 86, 116, .38);
  border-radius: 8px;
  background: rgba(240, 86, 116, .10);
  color: var(--brand-coral);
  font-size: 12px;
  font-weight: 900;
  padding: 12px 14px;
}
.global-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 18px 24px 22px;
  border-top: 1px solid var(--border);
  background: var(--surface-alt);
}
.btn {
  appearance: none;
  min-height: 38px;
  border-radius: 8px;
  border: 1px solid transparent;
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  font-weight: 900;
  padding: 8px 18px;
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
</style>
