// Wrapper simple de fetch con soporte de token y refresh
const API_BASE = '';

async function request(path, options = {}) {
  const token = localStorage.getItem('token');
  options.headers = options.headers || {};
  if (token) options.headers['Authorization'] = `Bearer ${token}`;
  options.headers['Content-Type'] = options.headers['Content-Type'] || 'application/json';

  // helper to perform fetch and catch network errors
  async function doFetch() {
    try {
      const res = await fetch(API_BASE + path, options);
      return { ok: true, res };
    } catch (err) {
      return { ok: false, error: err };
    }
  }

  // First attempt
  let attempt = await doFetch();
  if (!attempt.ok) {
    // network error: try once more
    const retry = await doFetch();
    if (!retry.ok) {
      // return a consistent object for callers
      return { error: 'network', details: retry.error };
    }
    attempt = retry;
  }

  const res = attempt.res;
  if (res.status === 401) {
    // intentar refresh
    const refresh = localStorage.getItem('refreshToken');
    if (refresh) {
      try {
        const r = await fetch(API_BASE + '/auth/refresh', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: refresh }) });
        if (r.ok) {
          const data = await r.json();
          localStorage.setItem('token', data.token);
          localStorage.setItem('refreshToken', data.refreshToken);
          // reintentar la petición original con nuevo token
          options.headers['Authorization'] = `Bearer ${data.token}`;
          const retried = await fetch(API_BASE + path, options);
          return { res: retried };
        }
      } catch (e) {
        // refresh network error or server error
      }
    }
    // si no hay refresh o falla, eliminar tokens y forzar login
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    window.location = '/';
    return { res };
  }
  return { res };
}

async function httpMethod(method, path, body = null, customOptions = {}) {
  const options = {
    ...customOptions,
    method
  };
  if (body) {
    options.body = typeof body === 'string' ? body : JSON.stringify(body);
  }

  const result = await request(path, options);

  if (result.error) {
    const err = new Error(result.error);
    err.response = { data: { error: result.details || 'Error de conexión de red' } };
    throw err;
  }

  const res = result.res;
  let data;
  try {
    data = await res.json();
  } catch (e) {
    data = null;
  }

  if (!res.ok) {
    const err = new Error((data && data.error) ? data.error : `Error ${res.status}`);
    err.response = { status: res.status, data: data || { error: `Error ${res.status}` } };
    throw err;
  }

  return { status: res.status, data, res };
}

const api = {
  request,
  get: (path, options) => httpMethod('GET', path, null, options),
  post: (path, body, options) => httpMethod('POST', path, body, options),
  put: (path, body, options) => httpMethod('PUT', path, body, options),
  patch: (path, body, options) => httpMethod('PATCH', path, body, options),
  delete: (path, options) => httpMethod('DELETE', path, null, options)
};

export default api;
