import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';

import { environmentRoutes } from './routes/environments.js';
import { fileRoutes } from './routes/files.js';
import { routeRoutes } from './routes/routes.js';
import { publishRoutes } from './routes/publishing.js';
import { serviceRoutes } from './routes/services.js';
import { DataStore } from './services/dataStore.js';
// import { keycloakMiddleware } from './middleware/keycloak.js'; // descomentar cuando Keycloak esté listo

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');
dotenv.config({ path: path.join(PROJECT_ROOT, '.env') });

const PORT = process.env.PORT || 3500;
const IS_PROD = process.env.NODE_ENV === 'production';

function resolveDataDir(dataDir) {
  if (!dataDir?.trim()) return path.join(__dirname, 'data');
  return path.isAbsolute(dataDir) ? dataDir : path.resolve(PROJECT_ROOT, dataDir);
}

const app = express();

// ── Middleware global ──
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '5mb' }));

if (!IS_PROD) {
  app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
}

// ── Inicializar store de metadatos ──
const dataDir = resolveDataDir(process.env.DATA_DIR);
const store = new DataStore(dataDir);
await store.initialize();

// Inyectar store en cada request
app.use((request, _response, next) => {
  request.store = store;
  next();
});

// ── Auth middleware (Keycloak JWT) ──
// En desarrollo se puede desactivar para iterar rápido.
// En producción: descomentar la línea de keycloakMiddleware arriba
// y agregar app.use('/api', keycloakMiddleware);

// ── API Routes ──
app.use('/api/environments', environmentRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/routes', routeRoutes);
app.use('/api/publishing', publishRoutes);
app.use('/api/services', serviceRoutes);

// ── Health check ──
app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Servir frontend en producción ──
if (IS_PROD) {
  const clientDist = path.join(__dirname, '..', 'client', 'dist');
  app.use(express.static(clientDist));
  app.get('*', (_request, response) => {
    response.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`\n  🚀 Gateway Manager API corriendo en http://localhost:${PORT}`);
  console.log(`  📁 Data dir: ${dataDir}`);
  if (!IS_PROD) console.log(`  🖥  Frontend dev: http://localhost:5173\n`);
});
