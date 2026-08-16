(function () {
  'use strict';

  let drawerEl = null;

  function createDrawer() {
    if (drawerEl) return;

    const drawerHtml = `
      <div id="quickPreviewDrawer" style="position:fixed;top:0;right:-480px;width:460px;height:100vh;background:var(--bg-primary);box-shadow:-10px 0 25px rgba(0,0,0,0.15);z-index:9999;transition:right 240ms cubic-bezier(0.16,1,0.3,1);border-left:1px solid var(--border-default);display:flex;flex-direction:column">
        <div style="padding:16px 20px;border-bottom:1px solid var(--border-default);display:flex;align-items:center;justify-content:space-between">
          <div>
            <div id="previewCategory" class="badge" style="font-size:11px">Entity Preview</div>
            <div id="previewTitle" style="font-weight:800;font-size:16px;margin-top:4px">Item Details</div>
          </div>
          <button id="closePreviewBtn" class="icon-btn" title="Close Preview" style="border:none;background:transparent;cursor:pointer"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>
        <div id="previewBody" style="padding:20px;flex:1;overflow-y:auto">
          <div class="small-muted">Loading preview data...</div>
        </div>
        <div style="padding:16px 20px;border-top:1px solid var(--border-default);display:flex;gap:10px;justify-content:flex-end">
          <button id="previewFullLink" class="btn btn-primary btn-sm">Open Full Record</button>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', drawerHtml);
    drawerEl = document.getElementById('quickPreviewDrawer');

    document.getElementById('closePreviewBtn').addEventListener('click', closePreview);
  }

  function openPreview(category, title, contentHtml, fullUrl) {
    createDrawer();
    document.getElementById('previewCategory').textContent = category;
    document.getElementById('previewTitle').textContent = title;
    document.getElementById('previewBody').innerHTML = contentHtml;
    const linkBtn = document.getElementById('previewFullLink');
    if (fullUrl) {
      linkBtn.style.display = 'inline-flex';
      linkBtn.onclick = () => { window.location.href = fullUrl; };
    } else {
      linkBtn.style.display = 'none';
    }

    drawerEl.style.right = '0px';
  }

  function closePreview() {
    if (drawerEl) {
      drawerEl.style.right = '-480px';
    }
  }

  window.CRM_PREVIEW = {
    openPreview,
    closePreview
  };
})();
