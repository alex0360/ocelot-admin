<template>
  <div class="discard-backdrop" @click.self="$emit('close')">
    <form class="discard-modal" @submit.prevent="$emit('confirm')">
      <header class="discard-header">
        <div>
          <span class="eyebrow">Cambios pendientes</span>
          <h2>Descartar cambios</h2>
          <p>Se recargará el archivo desde disco y se perderán los cambios sin publicar.</p>
        </div>
        <button type="button" class="close-btn" title="Cerrar" @click="$emit('close')">x</button>
      </header>

      <section class="discard-body">
        <div class="warning-box">
          <strong>{{ pendingCount }} pendiente(s)</strong>
          <span>Esta acción no modifica el archivo Ocelot; solo limpia los cambios locales en pantalla.</span>
        </div>
      </section>

      <footer class="discard-actions">
        <button type="button" class="btn btn-outline" @click="$emit('close')">Cancelar</button>
        <button type="submit" class="btn btn-danger">Descartar</button>
      </footer>
    </form>
  </div>
</template>

<script setup>
defineProps({
  pendingCount: {
    type: Number,
    required: true,
  },
});

defineEmits(['close', 'confirm']);
</script>

<style>
.discard-backdrop {
  position: fixed;
  inset: 0;
  z-index: 30;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(20, 30, 43, .58);
}
.discard-modal {
  width: min(460px, 100%);
  background: #fff;
  border: 1px solid #DDE5EC;
  border-radius: 10px;
  box-shadow: 0 24px 70px rgba(20, 30, 43, .28);
}
.discard-header {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 22px 24px 18px;
  border-bottom: 1px solid #EDF1F5;
}
.discard-header div {
  flex: 1;
  min-width: 0;
}
.discard-header .eyebrow {
  color: #C47E1A;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: .8px;
  text-transform: uppercase;
}
.discard-header h2 {
  color: #18222D;
  font-size: 20px;
  font-weight: 800;
  margin-top: 4px;
}
.discard-header p {
  color: #5B6B7A;
  font-size: 12px;
  margin-top: 5px;
}
.discard-modal .close-btn {
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
.discard-body {
  padding: 18px 24px;
}
.warning-box {
  display: grid;
  gap: 5px;
  border: 1px solid #F1D7A8;
  border-radius: 8px;
  background: #FFF8EA;
  padding: 12px 14px;
}
.warning-box strong {
  color: #A86410;
  font-size: 13px;
}
.warning-box span {
  color: #5B6B7A;
  font-size: 12px;
  line-height: 1.45;
}
.discard-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 18px 24px 22px;
  border-top: 1px solid #EDF1F5;
}
.discard-modal .btn {
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
.discard-modal .btn-outline {
  background: #fff;
  color: #4F5E6B;
  border-color: #D8E1E8;
}
.discard-modal .btn-danger {
  background: #B34240;
  color: #fff;
}
.discard-modal .btn-danger:hover {
  background: #963330;
}
</style>
