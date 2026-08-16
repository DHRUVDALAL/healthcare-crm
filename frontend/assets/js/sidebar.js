(function () {
  'use strict';

  function initSidebar() {
    const triggers = document.querySelectorAll('.sidebar-nav-trigger');

    triggers.forEach(trigger => {
      trigger.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = trigger.getAttribute('aria-controls');
        const children = document.getElementById(targetId);
        const isExpanded = trigger.getAttribute('aria-expanded') === 'true';

        trigger.setAttribute('aria-expanded', !isExpanded);
        if (children) {
          children.classList.toggle('open', !isExpanded);
        }
      });
    });

    const currentPath = window.location.pathname.split('/').pop() || 'dashboard.html';
    setActiveLink(currentPath);

    // Dynamically fetch profile to append assignment links for admins or restrict views for employees
    if (window.CRM_API.getToken()) {
      window.CRM_API.request('/api/auth/profile')
        .then(res => {
          const user = res.data.user;
          if (!user) return;

          // Set name and role labels
          const nameEl = document.getElementById('userName');
          const roleEl = document.getElementById('userRole');
          if (nameEl) nameEl.textContent = user.full_name;
          if (roleEl) {
            roleEl.textContent = user.role === 'admin' ? 'Administrator' : 'Recruitment Consultant';
          }

    // Dynamically load theme.js, global-search.js, and quick-preview.js if not present
    ['theme.js', 'global-search.js', 'quick-preview.js'].forEach(scriptName => {
      const src = `../assets/js/${scriptName}`;
      if (!document.querySelector(`script[src*="${scriptName}"]`)) {
        const s = document.createElement('script');
        s.src = src;
        document.body.appendChild(s);
      }
    });

          if (user.role === 'admin') {
            const recruitmentChildren = document.getElementById('recruitment-children');
            if (recruitmentChildren) {
              const existingLink = recruitmentChildren.querySelector('a[href="./assignment.html"]');
              if (!existingLink) {
                const applicantsLink = recruitmentChildren.querySelector('a[href="./applicants.html"]');
                const assignmentLink = document.createElement('a');
                assignmentLink.href = './assignment.html';
                assignmentLink.role = 'listitem';
                assignmentLink.textContent = 'Assignment';

                if (applicantsLink && applicantsLink.nextSibling) {
                  recruitmentChildren.insertBefore(assignmentLink, applicantsLink.nextSibling);
                } else {
                  recruitmentChildren.appendChild(assignmentLink);
                }

                // Refresh active link state
                setActiveLink(currentPath);
              }
            }
          } else if (user.role === 'employee') {
            // Hide Finance section completely
            const financeTrigger = document.getElementById('finance-trigger');
            if (financeTrigger) {
              const parent = financeTrigger.closest('.sidebar-nav-item');
              if (parent) parent.style.display = 'none';
            }

            // Hide Employees link under HR
            const hrChildren = document.getElementById('hr-children');
            if (hrChildren) {
              const employeesLink = hrChildren.querySelector('a[href="./employees.html"]');
              if (employeesLink) employeesLink.style.display = 'none';
            }

            // Rename Applicants to My Candidates and update href
            const recruitmentChildren = document.getElementById('recruitment-children');
            if (recruitmentChildren) {
              const applicantsLink = recruitmentChildren.querySelector('a[href="./applicants.html"]');
              if (applicantsLink) {
                applicantsLink.textContent = 'My Candidates';
                applicantsLink.href = './my-candidates.html';
              }
            }
          }
        })
        .catch(err => console.error('[Sidebar] Failed to load profile:', err));
    }
  }

  function setActiveLink(currentPath) {
    const allLinks = document.querySelectorAll('.sidebar-nav-link, .sidebar-nav-children a');

    allLinks.forEach(link => {
      const href = link.getAttribute('href');
      if (href) {
        const linkPath = href.split('/').pop();
        if (linkPath === currentPath) {
          link.classList.add('active');
          const parentChildren = link.closest('.sidebar-nav-children');
          if (parentChildren) {
            parentChildren.classList.add('open');
            const triggerId = parentChildren.id.replace('-children', '');
            const trigger = document.getElementById(triggerId);
            if (trigger) {
              trigger.setAttribute('aria-expanded', 'true');
              trigger.classList.add('active');
            }
          }
        }
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initSidebar();
      applySystemBranding();
      bindGlobalEvents();
    });
  } else {
    initSidebar();
    applySystemBranding();
    bindGlobalEvents();
  }

  function applySystemBranding() {
    if (!window.CRM_API) return;
    window.CRM_API.request('/api/settings/public')
      .then(res => {
        const data = res.data || {};
        const systemName = data.system_name || 'HealthCRM';
        const systemLogo = data.system_logo;

        // 1. Update Sidebar Brand Text
        const brandTextEl = document.querySelector('a.brand span:last-child, .brand-title');
        if (brandTextEl) {
          brandTextEl.textContent = systemName;
        }

        // 2. Update Sidebar Logo Mark
        const brandMark = document.querySelector('a.brand .brand-mark, .brand-logo');
        if (brandMark && systemLogo) {
          const logoUrl = systemLogo.startsWith('/') || systemLogo.startsWith('http') ? systemLogo : `/${systemLogo}`;
          brandMark.classList.add('has-logo');
          brandMark.innerHTML = `<img src="${logoUrl}" alt="Logo" style="width:100%;height:100%;object-fit:contain;border-radius:6px;display:block;" onerror="this.parentElement.classList.remove('has-logo');this.remove();" />`;
        }

        // 3. Update Document Title
        if (document.title.includes('Healthcare Recruitment CRM')) {
          document.title = document.title.replace('Healthcare Recruitment CRM', systemName);
        }
      })
      .catch(err => console.error('[Sidebar] Failed to load branding settings:', err));
  }

  function bindGlobalEvents() {
    document.addEventListener('click', (e) => {
      // Global Quick Add handler
      const btn = e.target.closest('button');
      if (btn && btn.textContent.trim().toLowerCase() === 'quick add') {
        e.preventDefault();
        const primaryAdd = document.querySelector('#addBtn, #btnAddHospital, #btnPostJob, #btnScheduleInterview, #btnCreateInvoice, #btnAddEmployee, #btnCreateTask');
        if (primaryAdd && primaryAdd !== btn) {
          primaryAdd.click();
        } else {
          window.location.href = './applicants.html';
        }
      }

      // Global Logout handler
      const logout = e.target.closest('#logoutBtn, [data-logout], .btn-logout');
      if (logout) {
        e.preventDefault();
        window.CRM_AUTH.logout();
      }
    });
  }

  window.SidebarNav = { initSidebar, setActiveLink, applySystemBranding };
})();