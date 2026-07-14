import fs from 'fs-extra';

/**
 * OcelotMapper: la ÚNICA pieza que toca el formato JSON de Ocelot.
 *
 * Si Ocelot cambia su schema (como pasó con ReRoutes → Routes),
 * solo se modifica este archivo.
 */

const EMPTY_CONFIG = {
  Routes: [],
  GlobalConfiguration: {
    BaseUrl: '',
  },
};

/**
 * Lee un archivo ocelot.json y devuelve un array de RouteDefinition.
 */
export async function readOcelotFile(filePath) {
  if (!await fs.pathExists(filePath)) {
    return { routes: [], globalConfig: EMPTY_CONFIG.GlobalConfiguration };
  }

  const raw = await fs.readJson(filePath);

  // Soportar ambas convenciones: "Routes" (v16+) y "ReRoutes" (legacy)
  const ocelotRoutes = raw.Routes || raw.ReRoutes || [];
  const globalConfig = raw.GlobalConfiguration || {};

  const routes = ocelotRoutes.map((ocelotRoute, routeIndex) => {
    const downstreamEntry = ocelotRoute.DownstreamHostAndPorts?.[0] || {};

    return {
      routeId: ocelotRoute.Metadata?.RouteId || `route-${routeIndex}`,
      displayName: ocelotRoute.Metadata?.DisplayName || ocelotRoute.UpstreamPathTemplate || '',
      upstreamPathTemplate: ocelotRoute.UpstreamPathTemplate || '',
      upstreamHttpMethods: ocelotRoute.UpstreamHttpMethod || ['GET'],
      downstreamScheme: ocelotRoute.DownstreamScheme || 'http',
      downstreamHost: downstreamEntry.Host || '',
      downstreamPort: downstreamEntry.Port || 80,
      downstreamPathTemplate: ocelotRoute.DownstreamPathTemplate || '',
      swaggerKey: ocelotRoute.SwaggerKey || '',
      authenticationOptions: ocelotRoute.AuthenticationOptions || null,
      fileCacheOptions: ocelotRoute.FileCacheOptions || null,
      isEnabled: ocelotRoute.Metadata?.IsEnabled !== 'false',
      metadata: ocelotRoute.Metadata || {},
      // Preservar propiedades extra (RateLimiting, Auth, Caching, etc.)
      _extraConfig: extractExtraConfig(ocelotRoute),
    };
  });

  return { routes, globalConfig };
}

/**
 * Escribe un array de RouteDefinition de vuelta a un archivo ocelot.json.
 */
export async function writeOcelotFile(filePath, routes, globalConfig = {}) {
  const ocelotRoutes = routes.map(routeDefinition => {
    const baseRoute = {
      UpstreamPathTemplate: routeDefinition.upstreamPathTemplate,
      UpstreamHttpMethod: routeDefinition.upstreamHttpMethods,
      DownstreamScheme: routeDefinition.downstreamScheme || 'http',
      DownstreamPathTemplate: routeDefinition.downstreamPathTemplate,
      DownstreamHostAndPorts: [
        {
          Host: routeDefinition.downstreamHost,
          Port: routeDefinition.downstreamPort,
        },
      ],
      Metadata: {
        ...routeDefinition.metadata,
        RouteId: routeDefinition.routeId,
        DisplayName: routeDefinition.displayName,
        IsEnabled: String(routeDefinition.isEnabled),
      },
    };

    if (routeDefinition.fileCacheOptions) {
      baseRoute.FileCacheOptions = routeDefinition.fileCacheOptions;
    }

    if (routeDefinition.swaggerKey) {
      baseRoute.SwaggerKey = routeDefinition.swaggerKey;
    }

    if (routeDefinition.authenticationOptions) {
      baseRoute.AuthenticationOptions = routeDefinition.authenticationOptions;
    }

    // Re-inyectar propiedades extra que el mapper no gestiona (Auth, RateLimiting, etc.)
    if (routeDefinition._extraConfig) {
      return { ...baseRoute, ...routeDefinition._extraConfig };
    }

    return baseRoute;
  });

  // Solo incluir rutas habilitadas en el JSON real.
  // Las deshabilitadas se guardan en metadata para que la UI las muestre,
  // pero no se escriben como Route activa en Ocelot.
  const activeRoutes = ocelotRoutes.filter(
    ocelotRoute => ocelotRoute.Metadata?.IsEnabled !== 'false'
  );

  const disabledRoutes = ocelotRoutes.filter(
    ocelotRoute => ocelotRoute.Metadata?.IsEnabled === 'false'
  );

  const config = {
    Routes: activeRoutes,
    GlobalConfiguration: globalConfig,
  };

  // Las rutas deshabilitadas se guardan en una sección custom para no perderlas
  if (disabledRoutes.length > 0) {
    config._DisabledRoutes = disabledRoutes;
  }

  await fs.writeJson(filePath, config, { spaces: 2 });
  return config;
}

/**
 * Valida un array de RouteDefinition.
 * Retorna { valid: true } o { valid: false, errors: [...] }
 */
export function validateRoutes(routes) {
  const errors = [];
  const warnings = [];
  const allowedMethods = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']);

  for (const [routeIndex, routeDefinition] of routes.entries()) {
    const label = routeDefinition.displayName || `Ruta ${routeIndex + 1}`;
    const upstreamPath = String(routeDefinition.upstreamPathTemplate || '').trim();
    const downstreamPath = String(routeDefinition.downstreamPathTemplate || '').trim();
    const methods = normalizeMethods(routeDefinition.upstreamHttpMethods);

    validatePath(upstreamPath, `${label}: URL de entrada`, errors);
    validatePath(downstreamPath, `${label}: ruta del servicio destino`, errors);

    if (!routeDefinition.downstreamHost) {
      errors.push(`${label}: falta el host del servicio destino.`);
    } else {
      validateHost(String(routeDefinition.downstreamHost), label, errors);
    }

    const normalizedPort = Number(routeDefinition.downstreamPort);
    if (!Number.isInteger(normalizedPort) || normalizedPort < 1 || normalizedPort > 65535) {
      errors.push(`${label}: el puerto debe ser un entero entre 1 y 65535.`);
    }

    if (!['http', 'https'].includes(routeDefinition.downstreamScheme)) {
      errors.push(`${label}: el esquema debe ser http o https.`);
    }

    if (!routeDefinition.upstreamHttpMethods?.length) {
      errors.push(`${label}: debe tener al menos un método HTTP.`);
    }

    const invalidMethods = methods.filter(method => !allowedMethods.has(method));
    if (invalidMethods.length) {
      errors.push(`${label}: metodos no permitidos: ${invalidMethods.join(', ')}.`);
    }

    if (routeDefinition.swaggerKey && !/^[A-Za-z0-9_-]+$/.test(routeDefinition.swaggerKey)) {
      errors.push(`${label}: SwaggerKey solo permite letras, numeros, guion y guion bajo.`);
    }

    if (routeDefinition.fileCacheOptions) {
      const ttl = Number(routeDefinition.fileCacheOptions.TtlSeconds);
      if (!Number.isInteger(ttl) || ttl < 1) {
        errors.push(`${label}: FileCacheOptions.TtlSeconds debe ser un entero mayor que cero.`);
      } else if (ttl > 604800) {
        errors.push(`${label}: FileCacheOptions.TtlSeconds no debe superar 604800 segundos.`);
      }
    }

    if (routeDefinition.authenticationOptions) {
      const providerKeys = routeDefinition.authenticationOptions.AuthenticationProviderKeys || [];
      const scopes = routeDefinition.authenticationOptions.AllowedScopes || [];
      if (!Array.isArray(providerKeys) || !providerKeys.length) {
        errors.push(`${label}: AuthenticationOptions.AuthenticationProviderKeys requiere al menos un provider.`);
      }
      if (!Array.isArray(scopes)) {
        errors.push(`${label}: AuthenticationOptions.AllowedScopes debe ser un arreglo.`);
      }
    }

    const parameterValidation = validateRouteParameters(upstreamPath, downstreamPath, label);
    errors.push(...parameterValidation.errors);
    warnings.push(...parameterValidation.warnings);
  }

  // Duplicados: mismo UpstreamPathTemplate + método
  const seen = new Set();
  for (const routeDefinition of routes) {
    if (routeDefinition.isEnabled === false) continue;

    for (const method of normalizeMethods(routeDefinition.upstreamHttpMethods)) {
      const key = `${method}:${normalizePath(routeDefinition.upstreamPathTemplate)}`;
      if (seen.has(key)) {
        errors.push(`Ruta duplicada: ${method} ${routeDefinition.upstreamPathTemplate}`);
      }
      seen.add(key);
    }
  }

  for (let leftIndex = 0; leftIndex < routes.length; leftIndex += 1) {
    const left = routes[leftIndex];
    const leftMethods = normalizeMethods(left.upstreamHttpMethods);

    for (let rightIndex = leftIndex + 1; rightIndex < routes.length; rightIndex += 1) {
      const right = routes[rightIndex];
      const rightMethods = normalizeMethods(right.upstreamHttpMethods);
      const overlapsMethod = leftMethods.some(method => rightMethods.includes(method));

      if (
        left.displayName
        && right.displayName
        && left.displayName.trim().toLowerCase() === right.displayName.trim().toLowerCase()
      ) {
        warnings.push(`Nombre duplicado: "${left.displayName}".`);
      }

      if (overlapsMethod && hasAmbiguousPattern(left.upstreamPathTemplate, right.upstreamPathTemplate)) {
        warnings.push(`Rutas potencialmente ambiguas: ${left.upstreamPathTemplate} y ${right.upstreamPathTemplate}.`);
      }
    }
  }

  return errors.length
    ? { valid: false, errors: uniqueMessages(errors), warnings: uniqueMessages(warnings) }
    : { valid: true, warnings: uniqueMessages(warnings) };
}

function validatePath(path, label, errors) {
  if (!path) {
    errors.push(`${label} es obligatoria.`);
    return;
  }
  if (!path.startsWith('/')) {
    errors.push(`${label} debe empezar con "/".`);
  }
  if (/\s/.test(path)) {
    errors.push(`${label} no debe contener espacios.`);
  }
  if (path.includes('//')) {
    errors.push(`${label} no debe contener doble slash "//".`);
  }
  if (/[{}]/.test(path.replace(/\{[A-Za-z0-9_-]+\}/g, ''))) {
    errors.push(`${label} tiene parametros con formato invalido. Usa {nombre}.`);
  }
}

function validateHost(host, label, errors) {
  if (/^https?:\/\//i.test(host)) {
    errors.push(`${label}: el host destino no debe incluir http:// ni https://.`);
  }
  if (host.includes('/') || /\s/.test(host)) {
    errors.push(`${label}: el host destino no debe contener slash ni espacios.`);
  }
  if (!/^[A-Za-z0-9.-]+$/.test(host)) {
    errors.push(`${label}: el host destino solo permite letras, numeros, puntos y guiones.`);
  }
}

function validateRouteParameters(upstreamPath, downstreamPath, label) {
  const upstreamParams = extractRouteParams(upstreamPath);
  const downstreamParams = extractRouteParams(downstreamPath);
  const missingInDownstream = upstreamParams.filter(param => !downstreamParams.includes(param));
  const missingInUpstream = downstreamParams.filter(param => !upstreamParams.includes(param));
  const errors = [];
  const warnings = [];

  if (missingInUpstream.length) {
    warnings.push(`${label}: ruta destino usa parametros que no existen en entrada: ${missingInUpstream.join(', ')}.`);
  }

  if (missingInDownstream.length) {
    warnings.push(`${label}: ruta entrada define parametros que no se usan en destino: ${missingInDownstream.join(', ')}.`);
  }

  return { errors, warnings };
}

function extractRouteParams(path) {
  return [...String(path || '').matchAll(/\{([A-Za-z0-9_-]+)\}/g)].map(match => match[1]);
}

function hasAmbiguousPattern(leftPath, rightPath) {
  const leftSegments = normalizePath(leftPath).split('/').filter(Boolean);
  const rightSegments = normalizePath(rightPath).split('/').filter(Boolean);
  if (leftSegments.length !== rightSegments.length) return false;
  if (normalizePath(leftPath) === normalizePath(rightPath)) return false;

  return leftSegments.every((leftSegment, index) => {
    const rightSegment = rightSegments[index];
    return leftSegment === rightSegment || isRouteParam(leftSegment) || isRouteParam(rightSegment);
  });
}

function isRouteParam(segment) {
  return /^\{[A-Za-z0-9_-]+\}$/.test(segment);
}

function normalizeMethods(methods) {
  return [...new Set((methods || []).map(method => String(method).toUpperCase().trim()).filter(Boolean))];
}

function normalizePath(path) {
  return String(path || '').trim().replace(/\/+$/, '') || '/';
}

function uniqueMessages(messages) {
  return [...new Set(messages)];
}

/**
 * Extrae propiedades de un Route de Ocelot que el mapper no gestiona directamente
 * (AuthenticationOptions, RateLimitOptions, FileCacheOptions, etc.)
 * para preservarlas al re-escribir el archivo.
 */
function extractExtraConfig(ocelotRoute) {
  const managed = new Set([
    'UpstreamPathTemplate', 'UpstreamHttpMethod',
    'DownstreamScheme', 'DownstreamPathTemplate', 'DownstreamHostAndPorts',
    'Metadata', 'FileCacheOptions', 'SwaggerKey', 'AuthenticationOptions',
  ]);

  const extra = {};
  for (const [key, value] of Object.entries(ocelotRoute)) {
    if (!managed.has(key)) {
      extra[key] = value;
    }
  }

  return Object.keys(extra).length ? extra : undefined;
}
