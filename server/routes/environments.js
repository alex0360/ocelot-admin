import { Router } from 'express';

export const environmentRoutes = Router();

// Listar ambientes
environmentRoutes.get('/', async (request, response) => {
  try {
    const environments = await request.store.getEnvironments();
    response.json(environments);
  } catch (error) {
    response.status(500).json({ error: error.message });
  }
});

// Crear ambiente
environmentRoutes.post('/', async (request, response) => {
  try {
    const { name, description } = request.body;

    if (!name?.trim()) {
      return response.status(400).json({ error: 'El nombre del ambiente es obligatorio.' });
    }

    const existing = await request.store.getEnvironments();
    const isDuplicate = existing.some(
      environment => environment.name.toLowerCase() === name.trim().toLowerCase()
    );
    if (isDuplicate) {
      return response.status(409).json({ error: `Ya existe un ambiente llamado "${name}".` });
    }

    const environment = await request.store.createEnvironment({ name: name.trim(), description });
    response.status(201).json(environment);
  } catch (error) {
    response.status(500).json({ error: error.message });
  }
});

// Editar ambiente
environmentRoutes.put('/:environmentId', async (request, response) => {
  try {
    const updated = await request.store.updateEnvironment(request.params.environmentId, request.body);
    if (!updated) return response.status(404).json({ error: 'Ambiente no encontrado.' });
    response.json(updated);
  } catch (error) {
    response.status(500).json({ error: error.message });
  }
});

// Eliminar ambiente
environmentRoutes.delete('/:environmentId', async (request, response) => {
  try {
    const deleted = await request.store.deleteEnvironment(request.params.environmentId);
    if (!deleted) return response.status(404).json({ error: 'Ambiente no encontrado.' });
    response.json({ deleted: true });
  } catch (error) {
    response.status(500).json({ error: error.message });
  }
});
