# Gateway Manager — CWS

Panel de administración visual para archivos de configuración de Ocelot API Gateway.

## Stack

- **Frontend**: Vue 3 + Vite + Pinia + Vue Router
- **Backend**: Node.js + Express
- **Auth**: Keycloak (JWT, desactivable en dev)

Todo vive en un solo repo. En producción, `npm run build` genera el frontend estático y Express lo sirve desde el mismo puerto.

## Quick Start

```bash
# 1. Instalar dependencias (raíz + cliente)
npm install
cd client && npm install && cd ..

# 2. Copiar config
cp .env.example .env

# 3. Levantar en dev (backend en :3500, frontend en :5173 con proxy)
npm run dev
```

Abrir http://localhost:5173

En dev, Keycloak está deshabilitado (mock user con rol Publisher). Para habilitarlo, editar `client/.env.development`.

## Producción

```bash
npm run build     # Genera client/dist
npm start         # Express sirve API + frontend en :3500
```

### Datos persistentes

El panel guarda ambientes, archivos registrados, snapshots y backups en `DATA_DIR`.
Para que una actualización del servicio no borre esos datos, configurá `DATA_DIR` en una ruta fuera del directorio de despliegue:

```env
DATA_DIR=C:\ProgramData\gateway-manager-cws\data
```

Si ya tenés datos en `server/data`, copiá esos JSON y la carpeta `backups` al nuevo `DATA_DIR` antes de reiniciar el servicio.

## Estructura del proyecto

```
gateway-manager/
├── server/                    # Backend (Express)
│   ├── index.js               # Entry point
│   ├── routes/
│   │   ├── environments.js    # CRUD ambientes
│   │   ├── files.js           # Registrar/desregistrar archivos
│   │   ├── routes.js          # Leer/validar rutas del JSON
│   │   ├── publishing.js      # Publicar, historial, rollback
│   │   └── services.js        # Catálogo de servicios downstream
│   ├── services/
│   │   ├── dataStore.js       # Persistencia de metadata (JSON local)
│   │   └── ocelotMapper.js    # Lee/escribe archivos ocelot.json
│   ├── middleware/
│   │   └── keycloak.js        # JWT validation
│   └── data/                  # Metadata auto-generada (no commitear)
│
├── client/                    # Frontend (Vue 3)
│   ├── src/
│   │   ├── auth/keycloak.js   # Init Keycloak / mock en dev
│   │   ├── api/               # Módulos axios por recurso
│   │   ├── stores/            # Pinia stores
│   │   ├── components/        # Componentes Vue
│   │   ├── views/             # Vistas (Dashboard, History, Settings)
│   │   ├── router/            # Vue Router
│   │   ├── App.vue
│   │   └── main.js
│   ├── .env.development
│   └── vite.config.js         # Proxy /api → :3500
│
├── .env.example
├── package.json               # Scripts: dev, build, start
└── README.md
```

## Flujo de datos

```
Browser → Vue 3 SPA → axios → /api/* → Express → ocelotMapper → ocelot.json (disco)
                                              ↘ dataStore → metadata.json (disco)
```

## Auth (Keycloak)

Roles:
- `gateway-viewer`: solo lectura
- `gateway-editor`: crear/editar rutas (cambios quedan pendientes)
- `gateway-publisher`: publicar cambios, gestionar ambientes/archivos, rollback

En dev: mock automático con todos los roles. En prod: `VITE_KEYCLOAK_DISABLED=false` + config real.
