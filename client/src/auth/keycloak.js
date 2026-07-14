/**
 * Módulo de autenticación con Keycloak.
 *
 * En desarrollo (VITE_KEYCLOAK_DISABLED=true) se mockea el login
 * para poder iterar sin un Keycloak real corriendo.
 */

const IS_KEYCLOAK_DISABLED = import.meta.env.VITE_KEYCLOAK_DISABLED === 'true';

let keycloakInstance = null;

// ── Mock para desarrollo sin Keycloak ──
const mockUser = {
  token: 'dev-mock-token',
  tokenParsed: {
    sub: 'dev-user-001',
    preferred_username: 'edelossantos',
    name: 'Emmanuel De los Santos',
    email: 'edelossantos@cws.local',
    realm_access: {
      roles: ['gateway-viewer', 'gateway-editor', 'gateway-publisher'],
    },
  },
  authenticated: true,
};

/**
 * Inicializa Keycloak. Si está deshabilitado, usa el mock.
 */
export async function initAuth() {
  if (IS_KEYCLOAK_DISABLED) {
    keycloakInstance = mockUser;
    return true;
  }

  const Keycloak = (await import('keycloak-js')).default;

  keycloakInstance = new Keycloak({
    url: import.meta.env.VITE_KEYCLOAK_URL,
    realm: import.meta.env.VITE_KEYCLOAK_REALM,
    clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID || 'gateway-admin-spa',
  });

  const authenticated = await keycloakInstance.init({
    onLoad: 'login-required',
    pkceMethod: 'S256',
    checkLoginIframe: false,
  });

  // Auto-refresh del token
  setInterval(async () => {
    try {
      await keycloakInstance.updateToken(30);
    } catch {
      keycloakInstance.login();
    }
  }, 30_000);

  return authenticated;
}

export function getToken() {
  return keycloakInstance?.token || null;
}

export function getUser() {
  const parsed = keycloakInstance?.tokenParsed;
  if (!parsed) return null;

  return {
    id: parsed.sub,
    username: parsed.preferred_username,
    displayName: parsed.name || parsed.preferred_username,
    email: parsed.email,
    roles: parsed.realm_access?.roles || [],
  };
}

export function hasRole(role) {
  const user = getUser();
  return user?.roles.includes(role) || false;
}

export function logout() {
  if (IS_KEYCLOAK_DISABLED) {
    window.location.reload();
    return;
  }
  keycloakInstance?.logout();
}
