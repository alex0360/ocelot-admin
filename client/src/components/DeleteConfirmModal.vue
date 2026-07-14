<template>
  <div class="delete-backdrop" @click.self="$emit('close')">
    <form class="delete-modal" @submit.prevent="$emit('confirm')">
      <header class="delete-header">
        <div>
          <span class="eyebrow">{{ eyebrow }}</span>
          <h2>{{ title }}</h2>
          <p>{{ message }}</p>
        </div>
        <button type="button" class="close-btn" title="Cerrar" @click="$emit('close')">x</button>
      </header>

      <section v-if="detail" class="delete-body">
        <div class="detail-box">{{ detail }}</div>
      </section>

      <footer class="delete-actions">
        <button type="button" class="btn btn-outline" @click="$emit('close')">Cancelar</button>
        <button type="submit" class="btn btn-danger">{{ confirmLabel }}</button>
      </footer>
    </form>
  </div>
</template>

<script setup>
defineProps({
  eyebrow: {
    type: String,
    default: 'Eliminar',
  },
  title: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  detail: {
    type: String,
    default: '',
  },
  confirmLabel: {
    type: String,
    default: 'Eliminar',
  },
});

defineEmits(['close', 'confirm']);
</script>

<style>
.delete-backdrop {
  position: fixed;
  inset: 0;
  z-index: 30;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(42, 40, 95, .62);
}
.delete-modal {
  width: min(460px, 100%);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: var(--shadow-soft);
  overflow: hidden;
}
.delete-header {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 22px 24px 18px;
  border-bottom: 1px solid var(--border);
  background: linear-gradient(135deg, rgba(240, 86, 116, .14), transparent);
}
.delete-header div {
  flex: 1;
  min-width: 0;
}
.delete-header .eyebrow {
  color: var(--brand-coral);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: .8px;
  text-transform: uppercase;
}
.delete-header h2 {
  color: var(--text);
  font-size: 20px;
  font-weight: 800;
  margin-top: 4px;
}
.delete-header p {
  color: var(--muted);
  font-size: 12px;
  line-height: 1.45;
  margin-top: 5px;
}
.delete-modal .close-btn {
  appearance: none;
  width: 34px;
  height: 34px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--muted);
  cursor: pointer;
  font: inherit;
  font-weight: 800;
}
.delete-body {
  padding: 18px 24px;
}
.detail-box {
  border: 1px solid rgba(255, 223, 0, .46);
  border-radius: 8px;
  background: rgba(255, 223, 0, .10);
  color: var(--muted);
  font-size: 12px;
  line-height: 1.45;
  padding: 12px 14px;
  overflow-wrap: anywhere;
}
.delete-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 18px 24px 22px;
  border-top: 1px solid var(--border);
  background: var(--surface-alt);
}
.delete-modal .btn {
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
.delete-modal .btn-outline {
  background: transparent;
  color: var(--muted);
  border-color: var(--border);
}
.delete-modal .btn-danger {
  background: var(--brand-coral);
  color: #fff;
}
.delete-modal .btn-danger:hover {
  filter: brightness(.94);
}
</style>
