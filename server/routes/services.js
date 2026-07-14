import { Router } from 'express';

export const serviceRoutes = Router();

serviceRoutes.get('/', async (request, response) => {
  try {
    const services = await request.store.getServices();
    response.json(services);
  } catch (error) {
    response.status(500).json({ error: error.message });
  }
});

serviceRoutes.get('/groups', async (request, response) => {
  try {
    const services = await request.store.getServices();
    response.json(groupServicesByHostPort(services));
  } catch (error) {
    response.status(500).json({ error: error.message });
  }
});

serviceRoutes.get('/health', async (request, response) => {
  try {
    const services = await request.store.getServices();
    const groups = groupServicesByHostPort(services);
    const checks = await Promise.all(groups.map(group => checkServiceGroup(group)));
    response.json(checks);
  } catch (error) {
    response.status(500).json({ error: error.message });
  }
});

serviceRoutes.post('/', async (request, response) => {
  try {
    const { name, host, port, health } = request.body;
    if (!name?.trim() || !host?.trim() || !port) {
      return response.status(400).json({ error: 'name, host y port son obligatorios.' });
    }
    const service = await request.store.createService({ name, host, port, health });
    response.status(201).json(service);
  } catch (error) {
    response.status(500).json({ error: error.message });
  }
});

serviceRoutes.put('/:serviceId', async (request, response) => {
  try {
    const service = await request.store.updateService(request.params.serviceId, request.body);
    if (!service) return response.status(404).json({ error: 'Servicio no encontrado.' });
    response.json(service);
  } catch (error) {
    response.status(500).json({ error: error.message });
  }
});

serviceRoutes.delete('/:serviceId', async (request, response) => {
  try {
    const deleted = await request.store.deleteService(request.params.serviceId);
    if (!deleted) return response.status(404).json({ error: 'Servicio no encontrado.' });
    response.json({ deleted: true });
  } catch (error) {
    response.status(500).json({ error: error.message });
  }
});

function groupServicesByHostPort(services) {
  const groups = new Map();

  for (const service of services) {
    const key = `${service.host}:${service.port}`;
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        host: service.host,
        port: service.port,
        health: service.health,
        services: [],
      });
    }
    groups.get(key).services.push({
      id: service.id,
      name: service.name,
    });
  }

  return [...groups.values()].sort((left, right) =>
    left.host.localeCompare(right.host) || Number(left.port) - Number(right.port)
  );
}

async function checkServiceGroup(group) {
  const health = group.health || {};
  if (health.enabled === false) {
    return { ...group, status: 'disabled', checkedAt: new Date().toISOString() };
  }

  const scheme = health.scheme || 'http';
  const path = health.path || '/health';
  const url = `${scheme}://${group.host}:${group.port}${path.startsWith('/') ? path : `/${path}`}`;
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(health.timeoutMs) || 3000);

  try {
    const result = await fetch(url, {
      method: health.method || 'GET',
      signal: controller.signal,
    });
    const durationMs = Date.now() - startedAt;
    const expected = health.expectedStatus || [200];
    return {
      ...group,
      url,
      status: expected.includes(result.status) ? 'healthy' : 'unhealthy',
      httpStatus: result.status,
      durationMs,
      checkedAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      ...group,
      url,
      status: 'unreachable',
      error: error.name === 'AbortError' ? 'Timeout' : error.message,
      durationMs: Date.now() - startedAt,
      checkedAt: new Date().toISOString(),
    };
  } finally {
    clearTimeout(timeout);
  }
}
