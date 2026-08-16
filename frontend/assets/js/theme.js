(function () {
  'use strict';

  // System forces clean default Light Theme across all pages
  function applyLightTheme() {
    document.body.classList.remove('theme-dark');
    localStorage.setItem('crm_theme', 'light');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyLightTheme);
  } else {
    applyLightTheme();
  }

  window.CRM_THEME = {
    getSavedTheme: () => 'light',
    applyTheme: () => applyLightTheme(),
    toggleTheme: () => applyLightTheme()
  };
})();
