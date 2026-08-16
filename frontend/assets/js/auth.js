(function () {
  'use strict';

  function parseJwt(token) {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      return JSON.parse(jsonPayload);
    } catch (e) {
      return null;
    }
  }

  function requireAuth() {
    const token = window.CRM_API.getToken();
    if (!token) {
      window.location.href = './login.html';
      return;
    }

    const payload = parseJwt(token);
    if (payload && payload.role === 'employee') {
      const path = window.location.pathname.toLowerCase();
      const forbidden = [
        'employees.html',
        'invoices.html',
        'salary.html',
        'reports.html',
        'projections.html',
        'assignment.html'
      ];
      const isForbidden = forbidden.some(p => path.includes(p));
      if (isForbidden) {
        window.location.href = './dashboard.html';
      }
    }
  }

  function redirectIfAuthed() {
    const token = window.CRM_API.getToken();
    if (token) {
      window.location.href = './dashboard.html';
    }
  }

  async function performLogout() {
    try {
      await window.CRM_API.request('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      // ignore
    }

    try {
      await window.CRM_API.request('/api/attendance/logout', { method: 'PATCH' });
    } catch (e) {
      // ignore
    } finally {
      window.CRM_API.clearToken();
      window.location.href = './login.html';
    }
  }

  function bindLogout() {
    document.addEventListener('click', (event) => {
      const target = event.target.closest('[data-logout]');
      if (!target) return;
      event.preventDefault();
      performLogout();
    });
  }

  bindLogout();

  window.CRM_AUTH = {
    requireAuth,
    redirectIfAuthed,
    bindLogout
  };
})();
