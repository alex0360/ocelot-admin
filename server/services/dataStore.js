import fs from 'fs-extra';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

/**
 * Almacenamiento de metadatos del panel en archivos JSON locales.
 * No almacena las rutas de Ocelot en sí (esas viven en los archivos .json reales),
 * sino la metadata: ambientes registrados, archivos registrados, snapshots/historial.
 *
 * En un futuro esto se puede migrar a SQLite o SQL Server sin cambiar la interfaz.
 */
export class DataStore {
  #dataDir;
  #environmentsPath;
  #filesPath;
  #snapshotsPath;
  #servicesPath;

  constructor(dataDir) {
    this.#dataDir = dataDir;
    this.#environmentsPath = path.join(dataDir, 'environments.json');
    this.#filesPath = path.join(dataDir, 'files.json');
    this.#snapshotsPath = path.join(dataDir, 'snapshots.json');
    this.#servicesPath = path.join(dataDir, 'services.json');
  }

  async initialize() {
    await fs.ensureDir(this.#dataDir);
    await fs.ensureDir(path.join(this.#dataDir, 'backups'));

    if (!await fs.pathExists(this.#environmentsPath)) {
      await this.#write(this.#environmentsPath, [
        { id: uuidv4(), name: 'Dev', description: 'Ambiente de desarrollo', sortOrder: 1, createdAt: new Date().toISOString() },
        { id: uuidv4(), name: 'QA', description: 'Ambiente de pruebas', sortOrder: 2, createdAt: new Date().toISOString() },
        { id: uuidv4(), name: 'Prod', description: 'Producción', sortOrder: 3, createdAt: new Date().toISOString() },
      ]);
    }

    if (!await fs.pathExists(this.#filesPath)) {
      await this.#write(this.#filesPath, []);
    }

    if (!await fs.pathExists(this.#snapshotsPath)) {
      await this.#write(this.#snapshotsPath, []);
    }

    if (!await fs.pathExists(this.#servicesPath)) {
      await this.#write(this.#servicesPath, [
        this.#normalizeService({ id: uuidv4(), name: 'Clientes', host: 'svc-clientes', port: 5001 }),
        this.#normalizeService({ id: uuidv4(), name: 'Pagos', host: 'svc-pagos', port: 5002 }),
        this.#normalizeService({ id: uuidv4(), name: 'Afiliados', host: 'svc-afiliados', port: 5003 }),
        this.#normalizeService({ id: uuidv4(), name: 'Notificaciones', host: 'svc-notifs', port: 5004 }),
      ]);
    }
  }

  // ── Environments ──

  async getEnvironments() {
    return this.#read(this.#environmentsPath);
  }

  async getEnvironment(environmentId) {
    const environments = await this.getEnvironments();
    return environments.find(environment => environment.id === environmentId) || null;
  }

  async createEnvironment(data) {
    const environments = await this.getEnvironments();
    const environment = {
      id: uuidv4(),
      name: data.name,
      description: data.description || '',
      sortOrder: environments.length + 1,
      createdAt: new Date().toISOString(),
    };
    environments.push(environment);
    await this.#write(this.#environmentsPath, environments);
    return environment;
  }

  async updateEnvironment(environmentId, data) {
    const environments = await this.getEnvironments();
    const index = environments.findIndex(environment => environment.id === environmentId);
    if (index < 0) return null;
    environments[index] = { ...environments[index], ...data, id: environmentId };
    await this.#write(this.#environmentsPath, environments);
    return environments[index];
  }

  async deleteEnvironment(environmentId) {
    const environments = await this.getEnvironments();
    const filtered = environments.filter(environment => environment.id !== environmentId);
    if (filtered.length === environments.length) return false;
    await this.#write(this.#environmentsPath, filtered);
    // También eliminar archivos asociados
    const files = await this.getFiles();
    const remaining = files.filter(file => file.environmentId !== environmentId);
    await this.#write(this.#filesPath, remaining);
    return true;
  }

  // ── Files ──

  async getFiles(environmentId = null) {
    const files = await this.#read(this.#filesPath);
    if (environmentId) return files.filter(file => file.environmentId === environmentId);
    return files;
  }

  async getFile(fileId) {
    const files = await this.getFiles();
    return files.find(file => file.id === fileId) || null;
  }

  async createFile(data) {
    const files = await this.getFiles();
    const file = {
      id: uuidv4(),
      environmentId: data.environmentId,
      displayName: data.displayName,
      filePath: data.filePath,
      createdAt: new Date().toISOString(),
    };
    files.push(file);
    await this.#write(this.#filesPath, files);
    return file;
  }

  async deleteFile(fileId) {
    const files = await this.getFiles();
    const filtered = files.filter(file => file.id !== fileId);
    if (filtered.length === files.length) return false;
    await this.#write(this.#filesPath, filtered);
    return true;
  }

  // ── Snapshots (historial) ──

  async getSnapshots(fileId) {
    const snapshots = await this.#read(this.#snapshotsPath);
    return snapshots
      .filter(snapshot => snapshot.fileId === fileId)
      .sort((snapshotA, snapshotB) => new Date(snapshotB.publishedAt) - new Date(snapshotA.publishedAt));
  }

  async createSnapshot(data) {
    const snapshots = await this.#read(this.#snapshotsPath);
    const snapshot = {
      id: uuidv4(),
      fileId: data.fileId,
      jsonContent: data.jsonContent || '',
      backupPath: data.backupPath || '',
      userId: data.userId || 'anonymous',
      userDisplayName: data.userDisplayName || 'Usuario',
      comment: data.comment,
      changes: data.changes || [],
      publishedAt: new Date().toISOString(),
    };
    snapshots.push(snapshot);
    await this.#write(this.#snapshotsPath, snapshots);
    return snapshot;
  }

  // ── Services (catálogo de downstream) ──

  async getServices() {
    const services = await this.#read(this.#servicesPath);
    const normalized = services.map(service => this.#normalizeService(service));
    if (JSON.stringify(services) !== JSON.stringify(normalized)) {
      await this.#write(this.#servicesPath, normalized);
    }
    return normalized;
  }

  async createService(data) {
    const services = await this.getServices();
    const service = this.#normalizeService({
      id: uuidv4(),
      name: data.name,
      host: data.host,
      port: data.port,
      health: data.health,
    });
    services.push(service);
    await this.#write(this.#servicesPath, services);
    return service;
  }

  async updateService(serviceId, data) {
    const services = await this.getServices();
    const index = services.findIndex(service => service.id === serviceId);
    if (index < 0) return null;
    services[index] = this.#normalizeService({ ...services[index], ...data, id: serviceId });
    await this.#write(this.#servicesPath, services);
    return services[index];
  }

  async deleteService(serviceId) {
    const services = await this.getServices();
    const filtered = services.filter(service => service.id !== serviceId);
    await this.#write(this.#servicesPath, filtered);
    return filtered.length < services.length;
  }

  // ── Backup ──

  async createBackup(filePath) {
    if (!await fs.pathExists(filePath)) return null;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `${path.basename(filePath, '.json')}_${timestamp}.json`;
    const backupPath = path.join(this.#dataDir, 'backups', backupName);
    await fs.copy(filePath, backupPath);
    return backupPath;
  }

  // ── Helpers privados ──

  async #read(filePath) {
    return fs.readJson(filePath);
  }

  async #write(filePath, data) {
    await fs.writeJson(filePath, data, { spaces: 2 });
  }

  #normalizeService(service) {
    const healthPath = service.health?.path || '/health';
    const expectedStatus = service.health?.expectedStatus || [200];
    return {
      id: service.id || uuidv4(),
      name: service.name || '',
      host: service.host || '',
      port: Number(service.port) || 80,
      health: {
        enabled: service.health?.enabled ?? true,
        scheme: service.health?.scheme || 'http',
        path: healthPath.startsWith('/') ? healthPath : `/${healthPath}`,
        method: service.health?.method || 'GET',
        timeoutMs: Number(service.health?.timeoutMs) || 3000,
        expectedStatus: Array.isArray(expectedStatus) ? expectedStatus.map(Number) : [Number(expectedStatus) || 200],
      },
    };
  }
}
