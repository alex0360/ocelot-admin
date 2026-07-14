import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router/index.js';
import { initAuth } from './auth/keycloak.js';

async function bootstrap() {
  // Autenticar primero — la app no se monta hasta que hay sesión
  const authenticated = await initAuth();

  if (!authenticated) {
    document.body.innerHTML = '<p style="padding:40px;font-family:sans-serif">Redirigiendo al login…</p>';
    return;
  }

  const app = createApp(App);
  app.use(createPinia());
  app.use(router);
  app.mount('#app');
}

bootstrap().catch((error) => {
  console.error('Error al iniciar la aplicación:', error);
  document.body.innerHTML = `
    <div style="padding:40px;font-family:sans-serif;max-width:500px;margin:auto">
      <h2>Error al conectar con Keycloak</h2>
      <p>Verificá que el servidor de autenticación está disponible.</p>
      <pre style="background:#f4f4f4;padding:12px;border-radius:8px;font-size:12px;overflow:auto">${error.message}</pre>
      <button onclick="location.reload()" style="margin-top:12px;padding:8px 16px;cursor:pointer">Reintentar</button>
    </div>
  `;
});
