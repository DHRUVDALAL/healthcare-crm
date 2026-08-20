(function () {
  'use strict';

  const API = {
    baseUrl: ''
  };

  function getToken() {
    return localStorage.getItem('crm_token');
  }

  function setToken(token) {
    localStorage.setItem('crm_token', token);
  }

  function clearToken() {
    localStorage.removeItem('crm_token');
  }

  async function request(path, options) {
    const token = getToken();

    const opts = options || {};
    opts.headers = Object.assign({}, opts.headers || {});

    const isFormData = (typeof FormData !== 'undefined') && (opts.body instanceof FormData);
    const hasContentType = Object.keys(opts.headers).some((k) => k.toLowerCase() === 'content-type');

    if (!isFormData && !hasContentType) {
      opts.headers['Content-Type'] = 'application/json';
    }

    if (token) {
      opts.headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch(API.baseUrl + path, opts);
    const contentType = res.headers.get('content-type') || '';

    let body = null;
    if (contentType.includes('application/json')) {
      body = await res.json();
    } else {
      body = { success: false, message: await res.text() };
    }

    if (!res.ok) {
      const msg = (body && body.message) ? body.message : 'Request failed';
      const err = new Error(msg);
      err.status = res.status;
      err.body = body;

      if (res.status === 401 && !path.includes('/api/auth/login')) {
        clearToken();
        const currentLoc = window.location.pathname.toLowerCase();
        if (!currentLoc.includes('login.html')) {
          window.location.href = './login.html';
        }
      }

      throw err;
    }

    return body;
  }

  window.CRM_API = {
    getToken,
    setToken,
    clearToken,
    request
  };
})();
