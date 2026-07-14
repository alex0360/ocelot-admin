<template>
  <div class="app-shell" :data-theme="theme">
    <AppSidebar
      :current-theme="theme"
      @toggle-theme="toggleTheme"
      @open-file-form="openFileForm"
    />
    <router-view />
    <FileRegistrationModal
      v-if="showFileForm && envStore.activeEnvironment"
      :environment-id="envStore.activeEnvironment.id"
      :environment-name="envStore.activeEnvironment.name"
      @close="showFileForm = false"
    />
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import AppSidebar from './components/layout/AppSidebar.vue';
import FileRegistrationModal from './components/FileRegistrationModal.vue';
import { useEnvironmentStore } from './stores/environmentStore.js';

const envStore = useEnvironmentStore();
const showFileForm = ref(false);
const theme = ref(localStorage.getItem('gateway-manager-theme') || 'dark');

function openFileForm() {
  showFileForm.value = true;
}

function toggleTheme() {
  theme.value = theme.value === 'dark' ? 'light' : 'dark';
  localStorage.setItem('gateway-manager-theme', theme.value);
}

onMounted(async () => {
  await envStore.loadEnvironments();
  if (envStore.activeEnvironmentId) {
    await envStore.loadFiles(envStore.activeEnvironmentId);
  }
});
</script>

<style>
@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@300;500;600;700;800&display=swap');

* { box-sizing: border-box; margin: 0; }
html, body, #app { height: 100%; }
body {
  font-family: 'Montserrat', system-ui, -apple-system, sans-serif;
  font-weight: 300;
  font-size: 14px;
}
.app-shell {
  --cardnet-teal: #00B6C8;
  --cardnet-coral: #F05674;
  --cardnet-yellow: #FFDF00;
  --cardnet-warm: #E2E0DB;
  --cardnet-purple: #8342D7;
  --cardnet-navy: #2A285F;
  --cardnet-teal-dark: #008B99;
  --danger: #F05674;
  --app-bg: #F4F7FA;
  --surface: #FFFFFF;
  --surface-alt: #F8FAFC;
  --text: #2A285F;
  --muted: #60657A;
  --border: #E2E0DB;
  --sidebar-bg: #FFFFFF;
  --sidebar-surface: #F8F8F6;
  --sidebar-active: #00B6C8;
  --sidebar-text: #2A285F;
  --sidebar-muted: #60657A;
  --sidebar-border: #E2E0DB;
  --shadow-soft: 0 18px 44px rgba(42, 40, 95, .16);
  display: flex;
  height: 100vh;
  overflow: hidden;
  background: var(--app-bg);
  color: var(--text);
}
.app-shell[data-theme="dark"] {
  --app-bg: #171633;
  --surface: #211F4B;
  --surface-alt: #1B1A3F;
  --text: #FFFFFF;
  --muted: #C8C7D5;
  --border: rgba(226, 224, 219, .22);
  --sidebar-bg: #2A285F;
  --sidebar-surface: rgba(255, 255, 255, .07);
  --sidebar-active: #00B6C8;
  --sidebar-text: #FFFFFF;
  --sidebar-muted: #C8C7D5;
  --sidebar-border: rgba(226, 224, 219, .18);
  --shadow-soft: 0 18px 44px rgba(0, 0, 0, .28);
}
</style>
