import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

const KEYCLOAK_URL = process.env.KEYCLOAK_URL || 'https://auth.cws.local';
const KEYCLOAK_REALM = process.env.KEYCLOAK_REALM || 'cws-gateway';

const client = jwksClient({
  jwksUri: `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/certs`,
  cache: true,
  rateLimit: true,
});

function getKey(header, callback) {
  client.getSigningKey(header.kid, (error, key) => {
    if (error) return callback(error);
    callback(null, key.getPublicKey());
  });
}

/**
 * Middleware que valida el JWT de Keycloak.
 * Extrae roles de realm_access.roles y los pone en req.user.roles.
 */
export function keycloakMiddleware(request, response, next) {
  const authHeader = request.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return response.status(401).json({ error: 'Token de autenticación requerido' });
  }

  const token = authHeader.slice(7);

  jwt.verify(token, getKey, {
    algorithms: ['RS256'],
    issuer: `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}`,
  }, (error, decoded) => {
    if (error) {
      return response.status(401).json({ error: 'Token inválido o expirado' });
    }

    request.user = {
      id: decoded.sub,
      username: decoded.preferred_username,
      displayName: decoded.name || decoded.preferred_username,
      email: decoded.email,
      roles: decoded.realm_access?.roles || [],
    };

    next();
  });
}

/**
 * Middleware que requiere un rol específico.
 * Usar después de keycloakMiddleware.
 *
 * Ejemplo: router.post('/publish', requireRole('gateway-publisher'), handler)
 */
export function requireRole(...roles) {
  return (request, response, next) => {
    if (!request.user) {
      return response.status(401).json({ error: 'No autenticado' });
    }

    const hasRole = roles.some(role => request.user.roles.includes(role));
    if (!hasRole) {
      return response.status(403).json({
        error: `Acceso denegado. Se requiere uno de estos roles: ${roles.join(', ')}`,
      });
    }

    next();
  };
}
