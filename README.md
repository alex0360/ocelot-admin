# Gateway Manager

Gateway Manager es un panel web para administrar archivos JSON de configuracion de Ocelot API Gateway. Permite registrar varios archivos por ambiente, editar rutas, configurar `GlobalConfiguration`, cache y autenticacion, publicar cambios con backup automatico, restaurar snapshots y administrar health checks de servicios downstream.

El proyecto esta compuesto por una API Express y una interfaz Vue. No requiere base de datos: su metadata se guarda como JSON en el directorio configurado por `DATA_DIR`.

## Requisitos

- Node.js 20 o superior.
- npm 10 o superior.
- Permisos de lectura y escritura sobre los archivos Ocelot que se registraran.
- Permisos de lectura y escritura sobre `DATA_DIR`.

Comprueba la version instalada:

```bash
node --version
npm --version
```

## Instalacion local

Desde la raiz del repositorio instala las dependencias del servidor y del cliente.

### Windows PowerShell

```powershell
Copy-Item .env.example .env
Copy-Item client\.env.example client\.env.local
npm ci
npm ci --prefix client
npm run dev
```

### macOS y Linux

```bash
cp .env.example .env
cp client/.env.example client/.env.local
npm ci
npm ci --prefix client
npm run dev
```

Abre `http://localhost:5173`. El servidor API queda disponible en `http://localhost:3500` y el cliente de desarrollo redirige automaticamente las solicitudes `/api` hacia ese puerto.

La configuracion inicial usa un usuario de desarrollo sin Keycloak. Esto permite ejecutar el proyecto inmediatamente en una maquina local.

## Configuracion

Hay dos configuraciones distintas porque Express y Vite se ejecutan en procesos diferentes.

### Servidor: `.env`

Parte de [`.env.example`](.env.example):

| Variable | Uso | Valor local sugerido |
| --- | --- | --- |
| `PORT` | Puerto de Express. | `3500` |
| `NODE_ENV` | Modo de ejecucion. `npm start` lo establece en `production`. | `development` |
| `DATA_DIR` | Directorio de metadata, snapshots y backups. | `./server/data` |
| `CLIENT_ORIGIN` | Origen permitido por CORS durante desarrollo. | `http://localhost:5173` |
| `KEYCLOAK_URL` | URL base del proveedor de identidad. | `https://auth.example.internal` |
| `KEYCLOAK_REALM` | Realm de Keycloak. | `gateway` |
| `KEYCLOAK_CLIENT_ID` | Cliente de Keycloak para el backend. | `gateway-admin-spa` |

`DATA_DIR` puede ser relativo a la raiz del proyecto o absoluto. Para despliegues persistentes usa una ruta fuera de la carpeta que se actualiza:

```env
# Windows
DATA_DIR=C:\ProgramData\gateway-manager\data

# Linux
# DATA_DIR=/var/lib/gateway-manager
```

### Cliente: `client/.env.local`

Parte de [`client/.env.example`](client/.env.example). Las variables que empiezan por `VITE_` se incorporan al navegador durante la compilacion, por lo que deben estar dentro de `client/`.

| Variable | Uso |
| --- | --- |
| `VITE_KEYCLOAK_DISABLED` | `true` usa el usuario de desarrollo; `false` inicia el login de Keycloak. |
| `VITE_KEYCLOAK_URL` | URL base de Keycloak cuando esta habilitado. |
| `VITE_KEYCLOAK_REALM` | Realm que usa el cliente. |
| `VITE_KEYCLOAK_CLIENT_ID` | Cliente publico de Keycloak. |

Para usar Keycloak, cambia `VITE_KEYCLOAK_DISABLED=false`, completa las tres variables restantes y vuelve a iniciar Vite o a ejecutar la compilacion.

> Seguridad: actualmente el middleware JWT del backend esta deshabilitado en [`server/index.js`](server/index.js). El login de la interfaz por si solo no protege los endpoints de Express. Antes de exponer la aplicacion fuera de una red de confianza, habilita `keycloakMiddleware` y valida los roles que debe tener cada operacion.

## Primer uso

1. Inicia la aplicacion y selecciona un ambiente. La primera ejecucion crea `Dev`, `QA` y `Prod` como valores iniciales; puedes crear o borrar ambientes desde la barra lateral.
2. En **Archivos**, usa **Agregar** para registrar un JSON de Ocelot. Indica un nombre y una ruta absoluta o relativa accesible por el proceso de Node.js.
3. Si la ruta no existe, el sistema crea un archivo valido con `Routes` vacio y `GlobalConfiguration.BaseUrl` vacio.
4. Selecciona el archivo, crea o edita rutas y configura sus opciones: destino, metodos, `SwaggerKey`, cache, `AuthenticationOptions` y scopes.
5. Los cambios permanecen pendientes hasta pulsar **Publicar**. La publicacion solicita un comentario, valida las rutas y escribe el JSON de Ocelot.
6. Usa **Historial** para consultar publicaciones previas y restaurar una version.
7. En **Health**, registra servicios downstream agrupados por host y puerto, configura su endpoint de health y ejecuta comprobaciones desde el servidor.

## Archivos Ocelot compatibles

El lector reconoce `Routes` y el formato legado `ReRoutes`. Al publicar, el archivo se escribe usando `Routes` y conserva `GlobalConfiguration`.

La interfaz administra directamente estas propiedades de cada ruta:

- `UpstreamPathTemplate` y `UpstreamHttpMethod`.
- `DownstreamScheme`, `DownstreamPathTemplate` y `DownstreamHostAndPorts`.
- `SwaggerKey`.
- `FileCacheOptions`, incluyendo `TtlSeconds` y `EnableContentHashing`.
- `AuthenticationOptions`, `AuthenticationProviderKeys` y `AllowedScopes`.
- `Metadata.RouteId`, `Metadata.DisplayName` y el estado habilitado.

Las propiedades de ruta que la interfaz no administra se preservan al volver a escribir el JSON. Las rutas deshabilitadas se omiten de `Routes` y se conservan en la seccion personalizada `_DisabledRoutes` para mostrarlas de nuevo en el panel.

Antes de publicar se bloquean, entre otros casos, rutas de entrada duplicadas para el mismo metodo, puertos invalidos, hosts con protocolo o paths, metodos no admitidos, cache invalida y configuraciones de autenticacion incompletas. Las rutas potencialmente ambiguas se muestran como advertencias.

## Persistencia, backup y rollback

El directorio definido por `DATA_DIR` contiene:

```text
DATA_DIR/
  environments.json  # Ambientes del panel
  files.json         # Archivos Ocelot registrados y sus rutas
  services.json      # Catalogo de health checks
  snapshots.json     # Historial de publicaciones
  backups/           # Copias del JSON antes de cada publicacion o rollback
```

Cada publicacion crea primero una copia del archivo Ocelot en `backups/` y guarda el snapshot correspondiente. Al restaurar, el sistema realiza otra copia del estado actual y despues recupera el backup seleccionado. Para conservar el historial al actualizar el servicio, conserva y reutiliza el mismo `DATA_DIR`.

Eliminar un ambiente o quitar un archivo desde la interfaz elimina solo su registro del panel. El archivo JSON de Ocelot en disco no se borra automaticamente.

## Produccion

Prepara `.env` y `client/.env.local` con los valores del entorno antes de compilar. No copies archivos `.env` con secretos al repositorio.

```bash
npm ci
npm ci --prefix client
npm run build
npm start
```

`npm start` funciona en Windows, macOS y Linux y sirve tanto la API como los archivos compilados desde `http://localhost:3500` por defecto. Coloca un proxy inverso o TLS delante del proceso cuando sea necesario.

Para actualizar una instalacion:

1. Deten el proceso.
2. Actualiza el codigo y las dependencias.
3. Conserva `DATA_DIR` sin modificar.
4. Compila con `npm run build`.
5. Inicia de nuevo con `npm start`.

## Comandos disponibles

| Comando | Descripcion |
| --- | --- |
| `npm run dev` | Inicia Express y Vite en modo desarrollo. |
| `npm run dev:server` | Inicia solo Express con recarga por cambios. |
| `npm run dev:client` | Inicia solo Vite en el puerto 5173. |
| `npm run build` | Genera `client/dist`. |
| `npm start` | Sirve la aplicacion compilada en modo produccion. |
| `npm run lint` | Ejecuta ESLint sobre el cliente cuando este configurado. |
| `npm run stop` | Finaliza procesos Node en Windows. En otros sistemas usa `Ctrl+C` o el gestor de servicios. |

## Diagnostico rapido

| Problema | Revision recomendada |
| --- | --- |
| El cliente no carga datos | Confirma que Express esta activo en el puerto configurado y que `CLIENT_ORIGIN` coincide con la URL de Vite. |
| No se puede registrar o publicar un archivo | Revisa que la cuenta que ejecuta Node tenga permisos de lectura y escritura en la carpeta del JSON. |
| No se conservan ambientes o snapshots tras actualizar | Configura `DATA_DIR` fuera de la carpeta de despliegue y conserva ese directorio. |
| Falla el login de Keycloak | Verifica las variables en `client/.env.local`, la URL, el realm y la URL de redireccion autorizada en Keycloak. |
| Un health check dice `Sin conexion` | El proceso de Node debe poder resolver el host y acceder al host, puerto y path configurados. |
| Una ruta no publica | Abre el resumen de validacion y corrige los errores bloqueantes antes de publicar. |

## Estructura

```text
gateway-manager/
  server/                 # API Express, rutas y persistencia JSON
  client/                 # Interfaz Vue y configuracion Vite
  .env.example            # Plantilla de configuracion del servidor
  client/.env.example     # Plantilla de configuracion del navegador
  package.json            # Scripts del proyecto
```
