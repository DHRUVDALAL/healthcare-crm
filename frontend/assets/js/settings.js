(function () {
  'use strict';

  let currentUser = null;
  let systemSettings = {};

  document.addEventListener('DOMContentLoaded', async () => {
    // 1. Auth protection
    if (window.CRM_AUTH && typeof window.CRM_AUTH.requireAuth === 'function') {
      window.CRM_AUTH.requireAuth();
    }

    await loadUserProfile();
    await loadCompanySettings();
    initEventListeners();
  });

  // --- 1. Load User Profile ---
  async function loadUserProfile() {
    try {
      const res = await window.CRM_API.request('/api/auth/profile');
      currentUser = res.data ? res.data.user : null;
      if (!currentUser) return;

      // Populate Sidebar Account Details
      const userNameEl = document.getElementById('userName');
      const userRoleEl = document.getElementById('userRole');
      if (userNameEl) userNameEl.textContent = currentUser.full_name || 'User';
      if (userRoleEl) userRoleEl.textContent = currentUser.role === 'admin' ? 'Administrator' : (currentUser.role || 'Employee');

      // Populate Personal Details Inputs
      const fullNameInput = document.getElementById('profile_full_name');
      const phoneInput = document.getElementById('profile_phone');
      if (fullNameInput) fullNameInput.value = currentUser.full_name || '';
      if (phoneInput) phoneInput.value = currentUser.phone || '';

      // Parse Notification Preferences
      let notifPrefs = {};
      if (typeof currentUser.notification_preferences === 'string') {
        try { notifPrefs = JSON.parse(currentUser.notification_preferences); } catch (e) { notifPrefs = {}; }
      } else if (currentUser.notification_preferences && typeof currentUser.notification_preferences === 'object') {
        notifPrefs = currentUser.notification_preferences;
      }

      const cbInterview = document.getElementById('pref_interview_reminders');
      const cbFollowup = document.getElementById('pref_followup_alerts');
      const cbTask = document.getElementById('pref_task_alerts');
      if (cbInterview) cbInterview.checked = !!notifPrefs.interview_reminders;
      if (cbFollowup) cbFollowup.checked = !!notifPrefs.followup_alerts;
      if (cbTask) cbTask.checked = !!notifPrefs.task_alerts;

      // Avatar preview
      const photoUrl = currentUser.photo_path || currentUser.photo_url;
      const avatarEl = document.getElementById('profileAvatarPreview');
      if (avatarEl && photoUrl) {
        avatarEl.src = photoUrl.startsWith('/') || photoUrl.startsWith('http') ? photoUrl : `/${photoUrl}`;
        avatarEl.style.display = 'block';
      }

      // Hide Admin section if employee
      if (currentUser.role !== 'admin') {
        const adminSection = document.getElementById('adminSettingsSection');
        if (adminSection) adminSection.style.display = 'none';
      }
    } catch (err) {
      console.error('Failed to load user profile:', err);
    }
  }

  // --- 2. Load Company Settings & Branding (Admin Only) ---
  async function loadCompanySettings() {
    if (!currentUser || currentUser.role !== 'admin') return;

    try {
      const res = await window.CRM_API.request('/api/settings');
      systemSettings = (res.data && res.data.settings) ? res.data.settings : {};

      // System Name
      const systemNameInput = document.getElementById('system_name');
      if (systemNameInput) {
        systemNameInput.value = systemSettings.system_name || systemSettings.company_name || 'HealthCRM';
      }

      // System Logo Preview
      const logoPreview = document.getElementById('systemLogoPreview');
      const logoPlaceholder = document.getElementById('systemLogoPlaceholder');
      if (systemSettings.system_logo && logoPreview) {
        const logoUrl = systemSettings.system_logo.startsWith('/') || systemSettings.system_logo.startsWith('http') ? systemSettings.system_logo : `/${systemSettings.system_logo}`;
        logoPreview.src = logoUrl;
        logoPreview.style.display = 'block';
        if (logoPlaceholder) logoPlaceholder.style.display = 'none';
      }

      // Inputs to map: id -> default fallback
      const fieldDefaults = {
        company_name: 'HealthCRM Staffing',
        timezone: 'Asia/Kolkata',
        support_email: 'support@healthcrm.com',
        billing_currency: 'INR',
        invoice_prefix: 'HCRM',
        commission_percentage: '12',
        session_timeout: '30 minutes',
        require_otp: 'Enabled'
      };

      for (const [key, fallback] of Object.entries(fieldDefaults)) {
        const el = document.getElementById(key);
        if (el) {
          el.value = (systemSettings[key] !== undefined && systemSettings[key] !== null && systemSettings[key] !== '')
            ? systemSettings[key]
            : fallback;
        }
      }

      const checkKeys = {
        interview_reminders: true,
        invoice_alerts: true,
        new_applicant_notifications: true
      };

      for (const [key, fallbackBool] of Object.entries(checkKeys)) {
        const el = document.getElementById(key);
        if (el) {
          if (systemSettings[key] !== undefined) {
            el.checked = systemSettings[key] === 'true' || systemSettings[key] === true;
          } else {
            el.checked = fallbackBool;
          }
        }
      }
    } catch (err) {
      console.error('Failed to load company settings:', err);
    }
  }

  // --- 3. Event Listeners ---
  function initEventListeners() {
    // --- Profile Photo Upload ---
    const chooseBtn = document.getElementById('choosePhotoBtn');
    const photoInput = document.getElementById('photoUploadInput');
    const uploadBtn = document.getElementById('uploadPhotoBtn');
    const photoStatus = document.getElementById('photoUploadStatus');
    const avatarPreview = document.getElementById('profileAvatarPreview');

    if (chooseBtn && photoInput) {
      chooseBtn.addEventListener('click', () => photoInput.click());
    }

    if (photoInput) {
      photoInput.addEventListener('change', () => {
        const file = photoInput.files[0];
        if (file) {
          if (photoStatus) photoStatus.textContent = `Selected: ${file.name}`;
          const reader = new FileReader();
          reader.onload = (ev) => {
            if (avatarPreview) {
              avatarPreview.src = ev.target.result;
              avatarPreview.style.display = 'block';
            }
          };
          reader.readAsDataURL(file);
        }
      });
    }

    if (uploadBtn && photoInput) {
      uploadBtn.addEventListener('click', async () => {
        const file = photoInput.files[0];
        if (!file) {
          if (photoStatus) photoStatus.textContent = 'Please choose a photo first.';
          return;
        }

        const fd = new FormData();
        fd.append('photo', file);

        try {
          if (photoStatus) photoStatus.textContent = 'Uploading...';
          const res = await window.CRM_API.request('/api/auth/photo', { method: 'POST', body: fd });
          if (photoStatus) photoStatus.textContent = 'Photo uploaded successfully!';
          const newPath = res.data ? (res.data.photo_path || res.data.photo_url) : null;
          if (newPath && avatarPreview) {
            avatarPreview.src = newPath.startsWith('/') || newPath.startsWith('http') ? newPath : `/${newPath}`;
            avatarPreview.style.display = 'block';
          }
        } catch (err) {
          if (photoStatus) photoStatus.textContent = err.message || 'Upload failed.';
        }
      });
    }

    // --- System Logo Upload ---
    const chooseLogoBtn = document.getElementById('chooseSystemLogoBtn');
    const logoInput = document.getElementById('systemLogoInput');
    const uploadLogoBtn = document.getElementById('uploadSystemLogoBtn');
    const logoStatus = document.getElementById('systemLogoStatus');
    const logoPreview = document.getElementById('systemLogoPreview');
    const logoPlaceholder = document.getElementById('systemLogoPlaceholder');

    if (chooseLogoBtn && logoInput) {
      chooseLogoBtn.addEventListener('click', () => logoInput.click());
    }

    if (logoInput) {
      logoInput.addEventListener('change', () => {
        const file = logoInput.files[0];
        if (file) {
          if (logoStatus) logoStatus.textContent = `Selected: ${file.name}`;
          const reader = new FileReader();
          reader.onload = (ev) => {
            if (logoPreview) {
              logoPreview.src = ev.target.result;
              logoPreview.style.display = 'block';
              if (logoPlaceholder) logoPlaceholder.style.display = 'none';
            }
          };
          reader.readAsDataURL(file);
        }
      });
    }

    if (uploadLogoBtn && logoInput) {
      uploadLogoBtn.addEventListener('click', async () => {
        const file = logoInput.files[0];
        if (!file) {
          showToast('Please select a logo file first.', 'error');
          return;
        }

        const fd = new FormData();
        fd.append('logo', file);

        try {
          if (logoStatus) logoStatus.textContent = 'Uploading logo...';
          const res = await window.CRM_API.request('/api/settings/logo', {
            method: 'POST',
            body: fd
          });

          const logoUrl = res.data ? res.data.system_logo : null;
          if (logoUrl && logoPreview) {
            logoPreview.src = logoUrl;
            logoPreview.style.display = 'block';
            if (logoPlaceholder) logoPlaceholder.style.display = 'none';
          }

          if (logoStatus) logoStatus.textContent = 'System logo updated successfully!';
          showToast('System logo updated successfully!', 'success');

          // Trigger dynamic branding update across sidebar & page header
          if (window.SidebarNav && typeof window.SidebarNav.applySystemBranding === 'function') {
            window.SidebarNav.applySystemBranding();
          }
        } catch (err) {
          if (logoStatus) logoStatus.textContent = err.message || 'Logo upload failed.';
          showToast(err.message || 'Logo upload failed.', 'error');
        }
      });
    }

    // --- Profile Details Form Submit ---
    const profileDetailsForm = document.getElementById('profileDetailsForm');
    if (profileDetailsForm) {
      profileDetailsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const alertEl = document.getElementById('profileSaveAlert');
        const nameInput = document.getElementById('profile_full_name');
        const phoneInput = document.getElementById('profile_phone');
        const name = nameInput ? nameInput.value.trim() : '';

        if (!name) {
          if (alertEl) { alertEl.textContent = 'Full name is required.'; alertEl.style.display = 'block'; }
          return;
        }

        try {
          if (alertEl) alertEl.style.display = 'none';
          await window.CRM_API.request('/api/auth/profile', {
            method: 'PUT',
            body: JSON.stringify({
              full_name: name,
              phone: phoneInput ? phoneInput.value.trim() : ''
            })
          });

          const userNameEl = document.getElementById('userName');
          if (userNameEl) userNameEl.textContent = name;
          showToast('Profile updated successfully!', 'success');
        } catch (err) {
          if (alertEl) {
            alertEl.textContent = err.message || 'Failed to update profile.';
            alertEl.style.display = 'block';
          }
        }
      });
    }

    // --- Preferences Form Submit ---
    const preferencesForm = document.getElementById('preferencesForm');
    if (preferencesForm) {
      preferencesForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const alertEl = document.getElementById('preferencesSaveAlert');

        const notifPrefs = {
          interview_reminders: document.getElementById('pref_interview_reminders') ? document.getElementById('pref_interview_reminders').checked : false,
          followup_alerts: document.getElementById('pref_followup_alerts') ? document.getElementById('pref_followup_alerts').checked : false,
          task_alerts: document.getElementById('pref_task_alerts') ? document.getElementById('pref_task_alerts').checked : false
        };

        try {
          if (alertEl) alertEl.style.display = 'none';
          await window.CRM_API.request('/api/auth/profile', {
            method: 'PUT',
            body: JSON.stringify({
              theme: 'light',
              notification_preferences: notifPrefs
            })
          });

          showToast('Preferences saved successfully!', 'success');
        } catch (err) {
          if (alertEl) {
            alertEl.textContent = err.message || 'Failed to save preferences.';
            alertEl.style.display = 'block';
          }
        }
      });
    }

    // --- Change Password Form Submit ---
    const changePasswordForm = document.getElementById('changePasswordForm');
    if (changePasswordForm) {
      changePasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const alertEl = document.getElementById('passwordAlert');
        const currentPw = document.getElementById('current_password') ? document.getElementById('current_password').value : '';
        const newPw = document.getElementById('new_password') ? document.getElementById('new_password').value : '';
        const confirmPw = document.getElementById('confirm_password') ? document.getElementById('confirm_password').value : '';

        if (newPw.length < 8) {
          if (alertEl) { alertEl.textContent = 'New password must be at least 8 characters.'; alertEl.style.display = 'block'; }
          return;
        }

        if (newPw !== confirmPw) {
          if (alertEl) { alertEl.textContent = 'Passwords do not match.'; alertEl.style.display = 'block'; }
          return;
        }

        try {
          if (alertEl) alertEl.style.display = 'none';
          await window.CRM_API.request('/api/auth/password', {
            method: 'PATCH',
            body: JSON.stringify({ current_password: currentPw, new_password: newPw })
          });

          changePasswordForm.reset();
          showToast('Password changed successfully!', 'success');
        } catch (err) {
          if (alertEl) {
            alertEl.textContent = err.message || 'Failed to change password.';
            alertEl.style.display = 'block';
          }
        }
      });
    }

    // --- Admin Settings Form Submit ---
    const settingsForm = document.getElementById('settingsForm');
    if (settingsForm) {
      settingsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveCompanySettings();
      });
    }

    // --- Topbar "Save Changes" Button ---
    const topbarSaveBtn = document.querySelector('.topbar-right button[type="submit"]');
    if (topbarSaveBtn) {
      topbarSaveBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        if (currentUser && currentUser.role === 'admin') {
          await saveCompanySettings();
        }
        const profileForm = document.getElementById('profileDetailsForm');
        if (profileForm) {
          profileForm.requestSubmit();
        }
      });
    }

    // --- Reset Button ---
    const topbarResetBtn = document.querySelector('.topbar-right button[type="reset"]');
    if (topbarResetBtn) {
      topbarResetBtn.addEventListener('click', (e) => {
        e.preventDefault();
        loadUserProfile();
        loadCompanySettings();
        showToast('Settings reset to saved values.', 'info');
      });
    }
  }

  // --- Helper: Save Company Settings ---
  async function saveCompanySettings() {
    const keys = [
      'system_name', 'company_name', 'timezone', 'support_email', 'billing_currency',
      'invoice_prefix', 'commission_percentage', 'session_timeout', 'require_otp'
    ];
    const checkKeys = ['interview_reminders', 'invoice_alerts', 'new_applicant_notifications'];

    const payload = {};
    keys.forEach(k => {
      const el = document.getElementById(k);
      if (el) payload[k] = el.value.trim();
    });

    checkKeys.forEach(k => {
      const el = document.getElementById(k);
      if (el) payload[k] = el.checked ? 'true' : 'false';
    });

    try {
      await window.CRM_API.request('/api/settings', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      showToast('System & company settings saved successfully!', 'success');

      // Trigger dynamic branding update across sidebar & page headers immediately
      if (window.SidebarNav && typeof window.SidebarNav.applySystemBranding === 'function') {
        window.SidebarNav.applySystemBranding();
      }
      return true;
    } catch (err) {
      showToast(err.message || 'Failed to save company settings', 'error');
      return false;
    }
  }

  // --- Toast Notification Helper ---
  function showToast(message, type) {
    let toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'toastContainer';
      toastContainer.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9999;display:flex;flex-direction:column;gap:10px;';
      document.body.appendChild(toastContainer);
    }

    const toast = document.createElement('div');
    const bgColor = type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6';
    toast.style.cssText = `background:${bgColor};color:#ffffff;padding:12px 20px;border-radius:8px;font-size:14px;font-weight:600;box-shadow:0 10px 25px rgba(0,0,0,0.2);animation:fadeIn 0.3s ease;min-width:250px;`;
    toast.textContent = message;

    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

})();
