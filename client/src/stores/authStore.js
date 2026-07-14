import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { getUser, hasRole } from '../auth/keycloak.js';

export const useAuthStore = defineStore('auth', () => {
  const user = ref(getUser());

  const canEdit = computed(() => hasRole('gateway-editor') || hasRole('gateway-publisher'));
  const canPublish = computed(() => hasRole('gateway-publisher'));

  function refresh() {
    user.value = getUser();
  }

  return { user, canEdit, canPublish, refresh };
});
