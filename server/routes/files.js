import { Router } from 'express';
import fs from 'fs-extra';
import path from 'path';

export const fileRoutes = Router();

// Listar archivos (opcionalmente filtrar por ambiente)
fileRoutes.get('/', async (request, response) => {
  try {
    const environmentId = request.query.environmentId || null;
    const files = await request.store.getFiles(environmentId);

    // Agregar flag de si el archivo existe en disco
    const enriched = await Promise.all(
      files.map(async (file) => ({
        ...file,
        existsOnDisk: await fs.pathExists(file.filePath),
      }))
    );

    response.json(enriched);
  } catch (error) {
    response.status(500).json({ error: error.message });
  }
});

// Registrar un archivo de configuración
fileRoutes.post('/', async (request, response) => {
  try {
    const { environmentId, displayName, filePath } = request.body;
    const trimmedFilePath = filePath?.trim();

    if (!environmentId || !displayName?.trim() || !trimmedFilePath) {
      return response.status(400).json({ error: 'environmentId, displayName y filePath son obligatorios.' });
    }

    // Verificar que el ambiente existe
    const environment = await request.store.getEnvironment(environmentId);
    if (!environment) {
      return response.status(404).json({ error: 'Ambiente no encontrado.' });
    }

    // Si el archivo no existe en disco, crear uno vacío con estructura base de Ocelot
    if (!await fs.pathExists(trimmedFilePath)) {
      await fs.ensureDir(path.dirname(trimmedFilePath));
      await fs.writeJson(trimmedFilePath, {
        Routes: [],
        GlobalConfiguration: { BaseUrl: '' },
      }, { spaces: 2 });
    }

    const file = await request.store.createFile({
      environmentId,
      displayName: displayName.trim(),
      filePath: trimmedFilePath,
    });

    response.status(201).json({ ...file, existsOnDisk: true });
  } catch (error) {
    response.status(500).json({ error: error.message });
  }
});

// Desregistrar archivo (no lo elimina del disco)
fileRoutes.delete('/:fileId', async (request, response) => {
  try {
    const deleted = await request.store.deleteFile(request.params.fileId);
    if (!deleted) return response.status(404).json({ error: 'Archivo no encontrado.' });
    response.json({ deleted: true, note: 'El archivo no fue eliminado del disco, solo desregistrado del panel.' });
  } catch (error) {
    response.status(500).json({ error: error.message });
  }
});
