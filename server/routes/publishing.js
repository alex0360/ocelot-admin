import { Router } from 'express';
import fs from 'fs-extra';
import { readOcelotFile, writeOcelotFile, validateRoutes } from '../services/ocelotMapper.js';

export const publishRoutes = Router();

/**
 * POST /api/publishing/publish
 * Aplica los cambios al archivo ocelot.json.
 * Body: { fileId, routes, comment, user? }
 */
publishRoutes.post('/publish', async (request, response) => {
  try {
    const { fileId, routes, comment, user, globalConfig } = request.body;

    if (!fileId || !routes || !comment?.trim()) {
      return response.status(400).json({
        error: 'fileId, routes y comment son obligatorios.',
      });
    }

    const file = await request.store.getFile(fileId);
    if (!file) return response.status(404).json({ error: 'Archivo no encontrado.' });

    // Validar las rutas antes de escribir
    const validation = validateRoutes(routes);
    if (!validation.valid) {
      return response.status(422).json({
        error: 'Las rutas tienen errores de validación.',
        details: validation.errors,
      });
    }

    // Leer configuración actual para preservar GlobalConfiguration
    const { globalConfig: currentGlobalConfig } = await readOcelotFile(file.filePath);

    // Backup automático
    const backupPath = await request.store.createBackup(file.filePath);

    // Escribir el nuevo archivo
    const writtenConfig = await writeOcelotFile(file.filePath, routes, globalConfig || currentGlobalConfig);

    // Registrar snapshot del estado anterior. El contenido vive en backupPath;
    // jsonContent queda solo como compatibilidad con snapshots antiguos.
    const snapshot = await request.store.createSnapshot({
      fileId,
      jsonContent: '',
      userId: user?.id || request.user?.id || 'anonymous',
      userDisplayName: user?.displayName || request.user?.displayName || 'Usuario',
      comment: comment.trim(),
      changes: request.body.changes || [],
      backupPath,
    });

    response.json({
      published: true,
      snapshotId: snapshot.id,
      backupPath,
      routesWritten: routes.length,
    });
  } catch (error) {
    response.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/publishing/history?fileId=xxx
 * Devuelve el historial de snapshots de un archivo.
 */
publishRoutes.get('/history', async (request, response) => {
  try {
    const { fileId } = request.query;
    if (!fileId) return response.status(400).json({ error: 'fileId es obligatorio.' });

    const snapshots = await request.store.getSnapshots(fileId);
    response.json(snapshots);
  } catch (error) {
    response.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/publishing/rollback
 * Restaura un snapshot anterior.
 * Body: { fileId, snapshotId, comment }
 */
publishRoutes.post('/rollback', async (request, response) => {
  try {
    const { fileId, snapshotId, comment } = request.body;

    const file = await request.store.getFile(fileId);
    if (!file) return response.status(404).json({ error: 'Archivo no encontrado.' });

    const snapshots = await request.store.getSnapshots(fileId);
    const targetSnapshot = snapshots.find(snapshot => snapshot.id === snapshotId);
    if (!targetSnapshot) return response.status(404).json({ error: 'Snapshot no encontrado.' });

    // Backup del estado actual antes del rollback para poder deshacerlo.
    const rollbackBackupPath = await request.store.createBackup(file.filePath);

    // Restaurar el JSON del snapshot. backupPath es la fuente principal;
    // jsonContent queda como respaldo para snapshots antiguos.
    let restoreContent = '';
    if (targetSnapshot.backupPath && await fs.pathExists(targetSnapshot.backupPath)) {
      restoreContent = await fs.readFile(targetSnapshot.backupPath, 'utf-8');
    }
    if (!restoreContent) {
      restoreContent = targetSnapshot.jsonContent || '';
    }
    if (!restoreContent) {
      return response.status(422).json({ error: 'El snapshot no tiene contenido JSON restaurable.' });
    }

    await fs.writeFile(file.filePath, restoreContent, 'utf-8');

    // Registrar el rollback como un nuevo snapshot
    await request.store.createSnapshot({
      fileId,
      jsonContent: '',
      backupPath: rollbackBackupPath,
      userId: request.user?.id || 'anonymous',
      userDisplayName: request.user?.displayName || 'Usuario',
      comment: comment || `Rollback a versión del ${targetSnapshot.publishedAt}`,
      changes: [{ kind: 'rollback', text: `Restaurado a versión del ${targetSnapshot.publishedAt}` }],
    });

    response.json({ rolledBack: true, restoredFrom: targetSnapshot.publishedAt });
  } catch (error) {
    response.status(500).json({ error: error.message });
  }
});
