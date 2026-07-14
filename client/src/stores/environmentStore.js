import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { environmentsApi } from '../api/environments.js';
import { filesApi } from '../api/files.js';

export const useEnvironmentStore = defineStore('environment', () => {
  const environments = ref([]);
  const files = ref([]);
  const activeEnvironmentId = ref(null);
  const activeFileId = ref(null);
  const loading = ref(false);

  const activeEnvironment = computed(() =>
    environments.value.find(environment => environment.id === activeEnvironmentId.value) || null
  );

  const activeFiles = computed(() =>
    files.value.filter(file => file.environmentId === activeEnvironmentId.value)
  );

  const activeFile = computed(() =>
    files.value.find(file => file.id === activeFileId.value) || null
  );

  async function loadEnvironments() {
    loading.value = true;
    try {
      environments.value = await environmentsApi.list();
      if (!activeEnvironmentId.value && environments.value.length) {
        activeEnvironmentId.value = environments.value[0].id;
      }
    } finally {
      loading.value = false;
    }
  }

  async function loadFiles(environmentId) {
    const result = await filesApi.list(environmentId);
    // Reemplazar solo los de este ambiente
    files.value = [
      ...files.value.filter(file => file.environmentId !== environmentId),
      ...result,
    ];
  }

  function selectEnvironment(environmentId) {
    activeEnvironmentId.value = environmentId;
    activeFileId.value = null;
    loadFiles(environmentId);
  }

  function selectFile(fileId) {
    activeFileId.value = fileId;
  }

  async function createEnvironment(data) {
    const environment = await environmentsApi.create(data);
    environments.value.push(environment);
    return environment;
  }

  async function removeEnvironment(environmentId) {
    await environmentsApi.remove(environmentId);
    environments.value = environments.value.filter(environment => environment.id !== environmentId);
    files.value = files.value.filter(file => file.environmentId !== environmentId);
    activeFileId.value = null;
    if (activeEnvironmentId.value === environmentId) {
      activeEnvironmentId.value = environments.value[0]?.id || null;
      if (activeEnvironmentId.value) {
        await loadFiles(activeEnvironmentId.value);
      }
    }
  }

  async function registerFile(data) {
    const file = await filesApi.create(data);
    files.value.push(file);
    return file;
  }

  async function unregisterFile(fileId) {
    await filesApi.remove(fileId);
    files.value = files.value.filter(file => file.id !== fileId);
    if (activeFileId.value === fileId) {
      activeFileId.value = null;
    }
  }

  return {
    environments, files, loading,
    activeEnvironmentId, activeFileId,
    activeEnvironment, activeFiles, activeFile,
    loadEnvironments, loadFiles,
    selectEnvironment, selectFile,
    createEnvironment, removeEnvironment,
    registerFile, unregisterFile,
  };
});
