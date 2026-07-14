<template>
  <div class="route-editor-backdrop" @click.self="$emit('close')">
    <form class="route-editor-modal" @submit.prevent="submit">
      <header class="route-editor-header">
        <div class="title-block">
          <span class="eyebrow">{{ route ? 'Editar ruta' : 'Nueva ruta' }}</span>
          <h2>{{ form.displayName || 'Ruta de Ocelot' }}</h2>
          <p>{{ form.upstreamPathTemplate || 'Configura entrada, destino y cache' }}</p>
        </div>
        <button type="button" class="close-btn" title="Cerrar" @click="$emit('close')">x</button>
      </header>

      <section class="editor-section">
        <div class="section-heading">
          <h3>Entrada</h3>
        </div>
        <div class="form-grid">
          <label class="field field-wide">
            <span>Nombre</span>
            <input v-model.trim="form.displayName" type="text" required>
          </label>

          <label class="field field-wide">
            <span>Ruta entrada</span>
            <input v-model.trim="form.upstreamPathTemplate" type="text" placeholder="/api/v1/recurso" required>
          </label>

          <div class="field field-wide">
            <span>Metodos</span>
            <div class="method-grid">
              <button
                v-for="method in httpMethods"
                :key="method"
                type="button"
                class="method-option"
                :class="[method, { active: selectedMethods.includes(method) }]"
                @click="toggleMethod(method)"
              >
                {{ method }}
              </button>
            </div>
          </div>

          <label class="field field-wide">
            <span>SwaggerKey</span>
            <input v-model.trim="form.swaggerKey" type="text" placeholder="email">
          </label>
        </div>
      </section>

      <section class="editor-section">
        <div class="section-heading">
          <h3>Destino</h3>
        </div>
        <div class="form-grid">
          <label class="field">
            <span>Esquema</span>
            <select v-model="form.downstreamScheme">
              <option value="https">https</option>
              <option value="http">http</option>
            </select>
          </label>

          <label class="field">
            <span>Puerto</span>
            <input v-model.number="form.downstreamPort" type="number" min="1" max="65535" required>
          </label>

          <label class="field field-wide">
            <span>Host destino</span>
            <input v-model.trim="form.downstreamHost" type="text" placeholder="serapp01.cardnet.com.do" required>
          </label>

          <label class="field field-wide">
            <span>Ruta destino</span>
            <input v-model.trim="form.downstreamPathTemplate" type="text" placeholder="/api/v1/recurso" required>
          </label>
        </div>
      </section>

      <section class="editor-section auth-section">
        <div class="section-heading inline">
          <div>
            <h3>Acceso</h3>
            <p>Configura AuthenticationOptions para provider keys y scopes.</p>
          </div>
          <button
            type="button"
            class="switch"
            :class="{ on: authEnabled }"
            @click="authEnabled = !authEnabled"
          >
            {{ authEnabled ? 'On' : 'Off' }}
          </button>
        </div>

        <div class="form-grid" :class="{ muted: !authEnabled }">
          <label class="field field-wide">
            <span>AuthenticationProviderKeys</span>
            <input
              v-model.trim="authProviderKeysText"
              type="text"
              placeholder="keycloak"
              :disabled="!authEnabled"
            >
          </label>

          <label class="field field-wide">
            <span>AllowedScopes</span>
            <textarea
              v-model.trim="allowedScopesText"
              rows="3"
              placeholder="api-electronic-billing:xml-sign:post"
              :disabled="!authEnabled"
            ></textarea>
          </label>
        </div>
      </section>

      <section class="editor-section cache-section">
        <div class="section-heading inline">
          <div>
            <h3>Cache</h3>
            <p>Escribe FileCacheOptions.TtlSeconds en esta ruta.</p>
          </div>
          <button
            type="button"
            class="switch"
            :class="{ on: cacheEnabled }"
            @click="cacheEnabled = !cacheEnabled"
          >
            {{ cacheEnabled ? 'On' : 'Off' }}
          </button>
        </div>

        <div class="cache-controls" :class="{ muted: !cacheEnabled }">
          <label class="field ttl-field">
            <span>TTL segundos</span>
            <input v-model.number="ttlSeconds" type="number" min="1" step="1" :disabled="!cacheEnabled">
          </label>
          <div class="ttl-presets">
            <button type="button" :disabled="!cacheEnabled" @click="ttlSeconds = 300">5 min</button>
            <button type="button" :disabled="!cacheEnabled" @click="ttlSeconds = 3600">1 hora</button>
            <button type="button" :disabled="!cacheEnabled" @click="ttlSeconds = 28800">8 horas</button>
            <button type="button" :disabled="!cacheEnabled" @click="ttlSeconds = 86400">24 horas</button>
          </div>
          <label class="hash-option" :class="{ disabled: !cacheEnabled }">
            <input v-model="enableContentHashing" type="checkbox" :disabled="!cacheEnabled">
            <span>EnableContentHashing</span>
          </label>
        </div>
      </section>

      <section v-if="showValidation && (validationErrors.length || validationWarnings.length || error)" class="validation-panel">
        <div v-if="error" class="validation-box error-box">
          <strong>No se puede guardar</strong>
          <p>{{ error }}</p>
        </div>
        <div v-if="validationErrors.length" class="validation-box error-box">
          <strong>Errores de validacion</strong>
          <ul>
            <li v-for="message in validationErrors" :key="message">{{ message }}</li>
          </ul>
        </div>
        <div v-if="validationWarnings.length" class="validation-box warning-box">
          <strong>Advertencias</strong>
          <ul>
            <li v-for="message in validationWarnings" :key="message">{{ message }}</li>
          </ul>
        </div>
      </section>

      <footer class="modal-actions">
        <button type="button" class="btn btn-outline" @click="$emit('close')">Cancelar</button>
        <button type="submit" class="btn btn-primary">Guardar</button>
      </footer>
    </form>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue';

const props = defineProps({
  route: {
    type: Object,
    default: null,
  },
  routes: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits(['close', 'save']);

const httpMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];
const selectedMethods = ref(['GET']);
const cacheEnabled = ref(false);
const ttlSeconds = ref(86400);
const enableContentHashing = ref(false);
const authEnabled = ref(false);
const authProviderKeysText = ref('keycloak');
const allowedScopesText = ref('');
const error = ref('');
const submitAttempted = ref(false);

const form = reactive({
  routeId: '',
  displayName: '',
  upstreamPathTemplate: '',
  upstreamHttpMethods: ['GET'],
  downstreamScheme: 'https',
  downstreamHost: '',
  downstreamPort: 443,
  downstreamPathTemplate: '',
  swaggerKey: '',
  authenticationOptions: null,
  isEnabled: true,
  fileCacheOptions: null,
  metadata: {},
  _extraConfig: undefined,
});

const validation = computed(() => validateRouteForm());
const validationErrors = computed(() => validation.value.errors);
const validationWarnings = computed(() => validation.value.warnings);
const showValidation = computed(() =>
  submitAttempted.value
  || Boolean(props.route)
  || Boolean(
    form.displayName
    || form.upstreamPathTemplate
    || form.downstreamHost
    || form.downstreamPathTemplate
    || form.swaggerKey
  )
);

watch(
  () => props.route,
  (route) => {
    Object.assign(form, {
      routeId: route?.routeId || '',
      displayName: route?.displayName || '',
      upstreamPathTemplate: route?.upstreamPathTemplate || '',
      upstreamHttpMethods: route?.upstreamHttpMethods || ['GET'],
      downstreamScheme: route?.downstreamScheme || 'https',
      downstreamHost: route?.downstreamHost || '',
      downstreamPort: route?.downstreamPort || 443,
      downstreamPathTemplate: route?.downstreamPathTemplate || '',
      swaggerKey: route?.swaggerKey || '',
      authenticationOptions: route?.authenticationOptions || null,
      isEnabled: route?.isEnabled ?? true,
      fileCacheOptions: route?.fileCacheOptions || null,
      metadata: route?.metadata || {},
      _extraConfig: route?._extraConfig,
    });

    selectedMethods.value = [...form.upstreamHttpMethods];
    cacheEnabled.value = Boolean(route?.fileCacheOptions?.TtlSeconds);
    ttlSeconds.value = route?.fileCacheOptions?.TtlSeconds || 86400;
    enableContentHashing.value = Boolean(route?.fileCacheOptions?.EnableContentHashing);
    authEnabled.value = Boolean(route?.authenticationOptions);
    authProviderKeysText.value = route?.authenticationOptions?.AuthenticationProviderKeys?.join(', ') || 'keycloak';
    allowedScopesText.value = route?.authenticationOptions?.AllowedScopes?.join('\n') || '';
    error.value = '';
    submitAttempted.value = false;
  },
  { immediate: true }
);

function toggleMethod(method) {
  if (selectedMethods.value.includes(method)) {
    selectedMethods.value = selectedMethods.value.filter(current => current !== method);
    return;
  }
  selectedMethods.value = [...selectedMethods.value, method];
}

function submit() {
  submitAttempted.value = true;
  const result = validateRouteForm();
  if (result.errors.length) {
    error.value = 'Corrige los errores marcados antes de guardar.';
    return;
  }
  error.value = '';

  emit('save', {
    ...form,
    upstreamHttpMethods: selectedMethods.value,
    downstreamPort: Number(form.downstreamPort),
    fileCacheOptions: cacheEnabled.value
      ? {
          ...(form.fileCacheOptions || {}),
          TtlSeconds: Math.trunc(Number(ttlSeconds.value)),
          EnableContentHashing: enableContentHashing.value,
        }
      : null,
    authenticationOptions: authEnabled.value
      ? {
          AuthenticationProviderKeys: parseList(authProviderKeysText.value),
          AllowedScopes: parseList(allowedScopesText.value),
        }
      : null,
  });
}

function validateRouteForm() {
  const errors = [];
  const warnings = [];
  const methods = normalizeMethods(selectedMethods.value);
  const upstreamPath = form.upstreamPathTemplate.trim();
  const downstreamPath = form.downstreamPathTemplate.trim();
  const host = form.downstreamHost.trim();
  const port = Number(form.downstreamPort);
  const currentRouteId = form.routeId || props.route?.routeId || '';

  if (!form.displayName.trim()) {
    errors.push('El nombre de la ruta es obligatorio.');
  }

  validatePath(upstreamPath, 'Ruta entrada', errors);
  validatePath(downstreamPath, 'Ruta destino', errors);

  if (!methods.length) {
    errors.push('Selecciona al menos un metodo HTTP.');
  }

  const invalidMethods = methods.filter(method => !httpMethods.includes(method));
  if (invalidMethods.length) {
    errors.push(`Metodos no permitidos: ${invalidMethods.join(', ')}.`);
  }

  if (!['http', 'https'].includes(form.downstreamScheme)) {
    errors.push('El esquema debe ser http o https.');
  }

  validateHost(host, errors);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    errors.push('El puerto debe ser un entero entre 1 y 65535.');
  }

  if (form.swaggerKey.trim() && !/^[A-Za-z0-9_-]+$/.test(form.swaggerKey.trim())) {
    errors.push('SwaggerKey solo permite letras, numeros, guion y guion bajo.');
  }

  if (cacheEnabled.value) {
    const ttl = Number(ttlSeconds.value);
    if (!Number.isInteger(ttl) || ttl < 1) {
      errors.push('El TTL de cache debe ser un entero mayor que cero.');
    } else if (ttl > 604800) {
      errors.push('El TTL de cache no debe superar 604800 segundos (7 dias).');
    }
  }

  if (authEnabled.value) {
    if (!parseList(authProviderKeysText.value).length) {
      errors.push('AuthenticationProviderKeys requiere al menos un provider.');
    }
    const invalidScopes = parseList(allowedScopesText.value).filter(scope => /\s/.test(scope));
    if (invalidScopes.length) {
      errors.push('AllowedScopes no debe contener espacios dentro de cada scope.');
    }
  }

  const parameterErrors = validateRouteParameters(upstreamPath, downstreamPath, warnings);
  errors.push(...parameterErrors);

  for (const route of props.routes) {
    if (route.routeId === currentRouteId) continue;

    const routeMethods = normalizeMethods(route.upstreamHttpMethods);
    const overlapsMethod = methods.some(method => routeMethods.includes(method));
    const sameUpstream = normalizePath(route.upstreamPathTemplate) === normalizePath(upstreamPath);

    if (sameUpstream && overlapsMethod && route.isEnabled !== false && form.isEnabled !== false) {
      errors.push(`Ya existe una ruta activa con la misma entrada y metodo: ${route.upstreamHttpMethods.join(', ')} ${route.upstreamPathTemplate}.`);
    }

    if (
      route.displayName?.trim()
      && form.displayName.trim()
      && route.displayName.trim().toLowerCase() === form.displayName.trim().toLowerCase()
    ) {
      warnings.push(`Ya existe otra ruta con el nombre "${route.displayName}".`);
    }

    if (overlapsMethod && hasAmbiguousPattern(upstreamPath, route.upstreamPathTemplate)) {
      warnings.push(`La ruta puede competir con "${route.upstreamPathTemplate}" para alguno de los mismos metodos.`);
    }
  }

  return {
    errors: uniqueMessages(errors),
    warnings: uniqueMessages(warnings),
  };
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

function validateHost(host, errors) {
  if (!host) {
    errors.push('Host destino es obligatorio.');
    return;
  }
  if (/^https?:\/\//i.test(host)) {
    errors.push('Host destino no debe incluir http:// ni https://.');
  }
  if (host.includes('/') || /\s/.test(host)) {
    errors.push('Host destino no debe contener slash ni espacios.');
  }
  if (!/^[A-Za-z0-9.-]+$/.test(host)) {
    errors.push('Host destino solo permite letras, numeros, puntos y guiones.');
  }
}

function validateRouteParameters(upstreamPath, downstreamPath, warnings) {
  const errors = [];
  const upstreamParams = extractRouteParams(upstreamPath);
  const downstreamParams = extractRouteParams(downstreamPath);
  const missingInDownstream = upstreamParams.filter(param => !downstreamParams.includes(param));
  const missingInUpstream = downstreamParams.filter(param => !upstreamParams.includes(param));

  if (missingInUpstream.length) {
    errors.push(`Ruta destino usa parametros que no existen en entrada: ${missingInUpstream.join(', ')}.`);
  }

  if (missingInDownstream.length) {
    warnings.push(`Ruta entrada define parametros que no se usan en destino: ${missingInDownstream.join(', ')}.`);
  }

  return errors;
}

function extractRouteParams(path) {
  return [...path.matchAll(/\{([A-Za-z0-9_-]+)\}/g)].map(match => match[1]);
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

function parseList(value) {
  return String(value || '')
    .split(/[\n,]+/)
    .map(item => item.trim())
    .filter(Boolean);
}

function uniqueMessages(messages) {
  return [...new Set(messages)];
}
</script>

<style scoped>
.route-editor-backdrop {
  position: fixed;
  inset: 0;
  z-index: 20;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(42, 40, 95, .66);
}
.route-editor-modal {
  width: min(820px, 100%);
  max-height: calc(100vh - 32px);
  overflow: auto;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  box-shadow: var(--shadow-soft);
  padding: 0;
}
.route-editor-header {
  display: flex;
  align-items: flex-start;
  gap: 18px;
  padding: 24px 26px 20px;
  border-bottom: 1px solid rgba(226, 224, 219, .18);
  background:
    radial-gradient(circle at 86% 0%, rgba(0, 182, 200, .22), transparent 28%),
    linear-gradient(135deg, var(--cardnet-navy), #211F4B);
  color: #fff;
}
.title-block {
  flex: 1;
  min-width: 0;
}
.eyebrow {
  color: var(--cardnet-teal);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 1px;
  text-transform: uppercase;
}
.route-editor-header h2 {
  color: #fff;
  font-size: 22px;
  font-weight: 800;
  margin-top: 4px;
  overflow-wrap: anywhere;
  line-height: 1.15;
}
.route-editor-header p {
  color: rgba(255, 255, 255, .72);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  margin-top: 5px;
  overflow-wrap: anywhere;
}
.route-editor-modal .close-btn {
  appearance: none;
  width: 34px;
  height: 34px;
  border: 1px solid rgba(226, 224, 219, .38);
  border-radius: 8px;
  background: rgba(255, 255, 255, .08);
  color: #fff;
  cursor: pointer;
  font: inherit;
  font-weight: 800;
}
.route-editor-modal .close-btn:hover {
  border-color: var(--cardnet-teal);
  color: #fff;
  background: rgba(0, 182, 200, .14);
}
.editor-section {
  padding: 20px 26px;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
}
.section-heading {
  margin-bottom: 14px;
}
.section-heading.inline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.section-heading h3 {
  color: var(--text);
  font-size: 14px;
  font-weight: 800;
  letter-spacing: .2px;
}
.section-heading p {
  color: var(--muted);
  font-size: 12px;
  margin-top: 4px;
}
.form-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 14px;
}
.field {
  display: grid;
  gap: 7px;
}
.field-wide {
  grid-column: 1 / -1;
}
.field span {
  color: var(--muted);
  font-size: 12px;
  font-weight: 800;
}
.route-editor-modal .field input,
.route-editor-modal .field select,
.route-editor-modal .field textarea {
  width: 100%;
  min-height: 40px;
  border: 1px solid var(--border);
  border-radius: 9px;
  padding: 9px 12px;
  color: var(--text);
  background: var(--surface);
  font: inherit;
  outline: none;
  transition: border-color .15s, box-shadow .15s, background .15s;
}
.route-editor-modal .field textarea {
  min-height: 82px;
  resize: vertical;
}
.route-editor-modal .field input {
  appearance: none;
}
.route-editor-modal .field input:focus,
.route-editor-modal .field select:focus,
.route-editor-modal .field textarea:focus {
  border-color: var(--cardnet-teal);
  box-shadow: 0 0 0 3px rgba(0, 182, 200, .18);
}
.route-editor-modal .method-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.route-editor-modal .method-option {
  appearance: none;
  min-width: 74px;
  height: 34px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface-alt);
  color: var(--muted);
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  font-weight: 900;
  line-height: 1;
  transition: background .15s, border-color .15s, color .15s, transform .15s;
}
.route-editor-modal .method-option:hover {
  border-color: var(--cardnet-teal);
  color: var(--text);
}
.route-editor-modal .method-option.active {
  border-color: transparent;
  color: #fff;
  box-shadow: 0 8px 18px rgba(42, 40, 95, .18);
}
.route-editor-modal .method-option.GET.active { background: var(--cardnet-teal); }
.route-editor-modal .method-option.POST.active { background: var(--cardnet-purple); }
.route-editor-modal .method-option.PUT.active { background: #8A7100; }
.route-editor-modal .method-option.PATCH.active { background: #5A3FAE; }
.route-editor-modal .method-option.DELETE.active { background: var(--cardnet-coral); }
.route-editor-modal .method-option.OPTIONS.active { background: var(--cardnet-navy); }
.cache-section {
  background: var(--surface-alt);
}
.auth-section {
  background: var(--surface);
}
.route-editor-modal .switch {
  appearance: none;
  min-width: 52px;
  height: 32px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface);
  color: var(--muted);
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  font-weight: 900;
}
.route-editor-modal .switch.on {
  border-color: var(--cardnet-teal);
  background: var(--cardnet-teal);
  color: #fff;
}
.cache-controls {
  display: flex;
  align-items: end;
  gap: 12px;
  flex-wrap: wrap;
}
.cache-controls.muted {
  opacity: .56;
}
.form-grid.muted {
  opacity: .56;
}
.ttl-field {
  width: 160px;
}
.ttl-presets {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding-bottom: 1px;
}
.route-editor-modal .ttl-presets button {
  appearance: none;
  height: 36px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--muted);
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  font-weight: 800;
  padding: 0 12px;
}
.route-editor-modal .ttl-presets button:disabled {
  cursor: not-allowed;
}
.route-editor-modal .ttl-presets button:not(:disabled):hover {
  border-color: var(--cardnet-teal);
  color: var(--text);
}
.hash-option {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--muted);
  cursor: pointer;
  font-size: 12px;
  font-weight: 800;
  padding: 0 12px;
}
.hash-option input {
  width: 15px;
  height: 15px;
  accent-color: var(--cardnet-teal);
}
.hash-option.disabled {
  cursor: not-allowed;
  opacity: .65;
}
.validation-panel {
  display: grid;
  gap: 10px;
  padding: 16px 26px 0;
}
.validation-box {
  border-radius: 10px;
  font-size: 12px;
  line-height: 1.45;
  padding: 12px 14px;
}
.validation-box strong {
  display: block;
  font-size: 12px;
  font-weight: 900;
  margin-bottom: 5px;
}
.validation-box p {
  margin: 0;
}
.validation-box ul {
  margin: 0;
  padding-left: 18px;
}
.error-box {
  border: 1px solid rgba(240, 86, 116, .38);
  background: rgba(240, 86, 116, .10);
  color: var(--text);
}
.error-box strong {
  color: var(--cardnet-coral);
}
.warning-box {
  border: 1px solid rgba(255, 223, 0, .46);
  background: rgba(255, 223, 0, .12);
  color: var(--text);
}
.warning-box strong {
  color: #8A7100;
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 18px 26px 22px;
  background: var(--surface-alt);
}
.route-editor-modal .btn {
  appearance: none;
  min-height: 38px;
  border-radius: 8px;
  padding: 8px 18px;
  font: inherit;
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
  border: 1px solid transparent;
}
.route-editor-modal .btn-primary {
  background: var(--cardnet-teal);
  color: #fff;
}
.route-editor-modal .btn-primary:hover {
  background: var(--cardnet-teal-dark);
}
.route-editor-modal .btn-outline {
  background: var(--surface);
  color: var(--muted);
  border-color: var(--border);
}
.route-editor-modal .btn-outline:hover {
  border-color: var(--cardnet-teal);
  color: var(--text);
}
@media (max-width: 640px) {
  .route-editor-backdrop { padding: 10px; }
  .route-editor-header,
  .editor-section,
  .modal-actions { padding-left: 16px; padding-right: 16px; }
  .form-grid { grid-template-columns: 1fr; }
  .ttl-field { width: 100%; }
}
</style>
