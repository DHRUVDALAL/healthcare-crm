(function () {
  'use strict';

  window.CRM_AUTH.redirectIfAuthed();

  const form = document.getElementById('loginForm');
  const alertBox = document.getElementById('alert');
  const btn = document.getElementById('loginBtn');

  function showError(message) {
    alertBox.textContent = message;
    alertBox.classList.add('show');
  }

  function clearError() {
    alertBox.textContent = '';
    alertBox.classList.remove('show');
  }

  async function loadPublicBranding() {
    try {
      const res = await window.CRM_API.request('/api/settings/public');
      const data = res.data || {};
      const systemName = data.system_name || 'Healthcare Recruitment CRM';
      const systemLogo = data.system_logo;

      const titleEl = document.querySelector('.auth-brand-title');
      if (titleEl) titleEl.textContent = systemName;

      const markEl = document.querySelector('.auth-brand-mark');
      if (markEl && systemLogo) {
        const logoUrl = systemLogo.startsWith('/') || systemLogo.startsWith('http') ? systemLogo : `/${systemLogo}`;
        markEl.classList.add('has-logo');
        markEl.innerHTML = `<img src="${logoUrl}" alt="Logo" style="width:100%;height:100%;object-fit:contain;border-radius:8px;display:block;" onerror="this.parentElement.classList.remove('has-logo');this.remove();" />`;
      }

      if (systemName) {
        document.title = `Login - ${systemName}`;
      }
    } catch (err) {
      console.warn('[Login] Branding fetch failed:', err);
    }
  }

  loadPublicBranding();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearError();

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    if (!email || !password) {
      showError('Email and password are required.');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Signing in...';

    try {
      const res = await window.CRM_API.request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });

      window.CRM_API.setToken(res.data.token);
      window.location.href = './dashboard.html';
    } catch (err) {
      showError(err.message || 'Login failed');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Login';
    }
  });
})();
