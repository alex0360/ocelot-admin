import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { readOcelotFile, validateRoutes } from '../services/ocelotMapper.js';

export const routeRoutes = Router();

/**
 * GET /api/routes?fileId=xxx
 * Lee el archivo ocelot.json real y devuelve las rutas mapeadas.
 */
routeRoutes.get('/', async (request, response) => {
  try {
    const { fileId } = request.query;
    if (!fileId) return response.status(400).json({ error: 'fileId es obligatorio.' });

    const file = await request.store.getFile(fileId);
    if (!file) return response.status(404).json({ error: 'Archivo no encontrado.' });

    const { routes, globalConfig } = await readOcelotFile(file.filePath);
    response.json({ routes, globalConfig, file });
  } catch (error) {
    response.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/routes/validate
 * Valida un array de rutas sin guardar.
 */
routeRoutes.post('/validate', async (request, response) => {
  try {
    const { routes } = request.body;
    const result = validateRoutes(routes || []);
    response.json(result);
  } catch (error) {
    response.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/routes/preview
 * Dado un fileId + array de cambios, devuelve un diff legible.
 */
routeRoutes.post('/preview', async (request, response) => {
  try {
    const { fileId, routes: proposedRoutes } = request.body;

    const file = await request.store.getFile(fileId);
    if (!file) return response.status(404).json({ error: 'Archivo no encontrado.' });

    const { routes: currentRoutes } = await readOcelotFile(file.filePath);
    const currentMap = new Map(currentRoutes.map(route => [route.routeId, route]));
    const proposedMap = new Map(proposedRoutes.map(route => [route.routeId, route]));

    const changes = [];

    // Nuevas
    for (const [routeId, route] of proposedMap) {
      if (!currentMap.has(routeId)) {
        changes.push({
          kind: 'add',
          text: `Nueva ruta "${route.displayName}": ${route.upstreamHttpMethods.join(', ')} ${route.upstreamPathTemplate} → ${route.downstreamHost}:${route.downstreamPort}${route.downstreamPathTemplate}`,
        });
      }
    }

    // Modificadas
    for (const [routeId, proposed] of proposedMap) {
      const current = currentMap.get(routeId);
      if (!current) continue;

      const diffs = [];
      if (current.upstreamPathTemplate !== proposed.upstreamPathTemplate) {
        diffs.push(`URL de entrada: ${current.upstreamPathTemplate} → ${proposed.upstreamPathTemplate}`);
      }
      if (current.downstreamHost !== proposed.downstreamHost || current.downstreamPort !== proposed.downstreamPort) {
        diffs.push(`Servicio destino: ${current.downstreamHost}:${current.downstreamPort} → ${proposed.downstreamHost}:${proposed.downstreamPort}`);
      }
      if (current.isEnabled !== proposed.isEnabled) {
        diffs.push(proposed.isEnabled ? 'Habilitada' : 'Deshabilitada');
      }
      if (JSON.stringify(current.upstreamHttpMethods) !== JSON.stringify(proposed.upstreamHttpMethods)) {
        diffs.push(`Métodos: ${proposed.upstreamHttpMethods.join(', ')}`);
      }

      if (diffs.length) {
        changes.push({
          kind: 'mod',
          text: `Cambio en "${proposed.displayName}": ${diffs.join(' · ')}`,
        });
      }
    }

    // Eliminadas
    for (const [routeId, current] of currentMap) {
      if (!proposedMap.has(routeId)) {
        changes.push({
          kind: 'del',
          text: `Eliminada "${current.displayName}" (${current.upstreamPathTemplate})`,
        });
      }
    }

    response.json({ changes });
  } catch (error) {
    response.status(500).json({ error: error.message });
  }
});
