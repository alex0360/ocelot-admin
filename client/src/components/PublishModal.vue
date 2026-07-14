<template>
  <div class="publish-backdrop" @click.self="!submitting && $emit('close')">
    <form class="publish-modal" @submit.prevent="submit">
      <header class="publish-header">
        <div>
          <span class="eyebrow">Publicación</span>
          <h2>Publicar cambios</h2>
          <p>{{ pendingChanges.length }} cambio(s) pendiente(s)</p>
        </div>
        <button type="button" class="close-btn" title="Cerrar" :disabled="submitting" @click="$emit('close')">x</button>
      </header>

      <section class="publish-body">
        <label class="field">
          <span>Comentario</span>
          <textarea
            v-model.trim="comment"
            rows="3"
            placeholder="Describe brevemente qué se está publicando"
            :disabled="submitting"
            autofocus
          ></textarea>
        </label>

        <div class="changes-box">
          <div class="changes-header">
            <h3>Resumen</h3>
          </div>
          <ul>
            <li v-for="(change, index) in pendingChanges" :key="`${change.kind}-${index}`">
              <span class="change-kind" :class="change.kind">{{ changeLabel(change.kind) }}</span>
              <span>{{ change.text }}</span>
            </li>
          </ul>
        </div>

        <div v-if="error" class="publish-error">
          <strong>{{ error }}</strong>
          <ul v-if="errorDetails.length">
            <li v-for="detail in errorDetails" :key="detail">{{ detail }}</li>
          </ul>
        </div>
      </section>

      <footer class="publish-actions">
        <button type="button" class="btn btn-outline" :disabled="submitting" @click="$emit('close')">Cancelar</button>
        <button type="submit" class="btn btn-primary" :disabled="submitting">
          {{ submitting ? 'Publicando...' : 'Publicar' }}
        </button>
      </footer>
    </form>
  </div>
</template>

<script setup>
import { ref } from 'vue';

defineProps({
  pendingChanges: {
    type: Array,
    required: true,
  },
  submitting: {
    type: Boolean,
    default: false,
  },
  error: {
    type: String,
    default: '',
  },
  errorDetails: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits(['close', 'publish']);
const comment = ref('');

function changeLabel(kind) {
  return {
    add: 'Nuevo',
    mod: 'Cambio',
    del: 'Elimina',
    rollback: 'Rollback',
  }[kind] || 'Cambio';
}

function submit() {
  if (!comment.value) return;
  emit('publish', comment.value);
}
</script>

<style>
.publish-backdrop {
  position: fixed;
  inset: 0;
  z-index: 30;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(20, 30, 43, .58);
}
.publish-modal {
  width: min(560px, 100%);
  max-height: calc(100vh - 32px);
  overflow: auto;
  background: #fff;
  border: 1px solid #DDE5EC;
  border-radius: 10px;
  box-shadow: 0 24px 70px rgba(20, 30, 43, .28);
}
.publish-header {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 22px 24px 18px;
  border-bottom: 1px solid #EDF1F5;
}
.publish-header div {
  flex: 1;
  min-width: 0;
}
.publish-header .eyebrow {
  color: #0B8585;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: .8px;
  text-transform: uppercase;
}
.publish-header h2 {
  color: #18222D;
  font-size: 20px;
  font-weight: 800;
  margin-top: 4px;
}
.publish-header p {
  color: #5B6B7A;
  font-size: 12px;
  margin-top: 5px;
}
.publish-modal .close-btn {
  appearance: none;
  width: 34px;
  height: 34px;
  border: 1px solid #DDE5EC;
  border-radius: 8px;
  background: #fff;
  color: #5B6B7A;
  cursor: pointer;
  font: inherit;
  font-weight: 800;
}
.publish-body {
  padding: 18px 24px;
}
.publish-modal .field {
  display: grid;
  gap: 7px;
}
.publish-modal .field span {
  color: #4F5E6B;
  font-size: 12px;
  font-weight: 800;
}
.publish-modal textarea {
  width: 100%;
  resize: vertical;
  min-height: 86px;
  border: 1px solid #D8E1E8;
  border-radius: 8px;
  padding: 10px 12px;
  color: #18222D;
  background: #fff;
  font: inherit;
  outline: none;
}
.publish-modal textarea:focus {
  border-color: #0B8585;
  box-shadow: 0 0 0 3px #E0F1F1;
}
.changes-box {
  margin-top: 16px;
  border: 1px solid #E3E9EF;
  border-radius: 8px;
  overflow: hidden;
}
.changes-header {
  background: #F8FAFC;
  border-bottom: 1px solid #E3E9EF;
  padding: 10px 12px;
}
.changes-header h3 {
  color: #18222D;
  font-size: 12px;
  font-weight: 800;
}
.changes-box ul {
  list-style: none;
  margin: 0;
  padding: 4px 0;
  max-height: 220px;
  overflow: auto;
}
.changes-box li {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 8px 12px;
  color: #4F5E6B;
  font-size: 12px;
  border-bottom: 1px solid #F0F3F6;
}
.changes-box li:last-child {
  border-bottom: 0;
}
.change-kind {
  flex-shrink: 0;
  border-radius: 999px;
  padding: 2px 8px;
  font-size: 10px;
  font-weight: 900;
}
.change-kind.add { background: #E2F2E9; color: #1E7A4A; }
.change-kind.mod { background: #FBF1DD; color: #C47E1A; }
.change-kind.del { background: #F8E9E8; color: #B34240; }
.change-kind.rollback { background: #EDF0F4; color: #4F5E6B; }
.publish-error {
  margin-top: 14px;
  border: 1px solid rgba(240, 86, 116, .38);
  border-radius: 8px;
  background: rgba(240, 86, 116, .10);
  color: #18222D;
  font-size: 12px;
  line-height: 1.45;
  padding: 12px 14px;
}
.publish-error strong {
  color: #B34240;
  display: block;
  font-weight: 900;
}
.publish-error ul {
  margin: 8px 0 0;
  padding-left: 18px;
}
.publish-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 18px 24px 22px;
  border-top: 1px solid #EDF1F5;
}
.publish-modal .btn {
  appearance: none;
  min-height: 38px;
  border-radius: 8px;
  padding: 8px 18px;
  font: inherit;
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
  border: 1px solid transparent;
}
.publish-modal .btn:disabled {
  opacity: .6;
  cursor: not-allowed;
}
.publish-modal .btn-primary {
  background: #0B8585;
  color: #fff;
}
.publish-modal .btn-outline {
  background: #fff;
  color: #4F5E6B;
  border-color: #D8E1E8;
}
@media (max-width: 640px) {
  .publish-backdrop { padding: 10px; }
  .publish-header,
  .publish-body,
  .publish-actions { padding-left: 16px; padding-right: 16px; }
}
</style>
