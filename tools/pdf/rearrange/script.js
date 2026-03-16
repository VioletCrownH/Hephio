// ============================================
// PDF REARRANGE TOOL
// Reorder pages and download an updated PDF
// ============================================

(function() {
  'use strict';

  // ==========================================
  // DOM ELEMENTS
  // ==========================================

  const uploadSection = document.getElementById('uploadSection');
  const uploadZone = document.getElementById('uploadZone');
  const uploadPrompt = document.getElementById('uploadPrompt');
  const fileInput = document.getElementById('fileInput');
  
  const workspaceSection = document.getElementById('workspaceSection');
  const changeFileBtn = document.getElementById('changeFileBtn');
  const fileNameDisplay = document.getElementById('fileName');
  const fileMetaDisplay = document.getElementById('fileMeta');
  const pagesSummaryEl = document.getElementById('pagesSummary');

  const pageList = document.getElementById('pageList');
  const quickActions = document.getElementById('quickActions');
  
  const reverseBtn = document.getElementById('reverseBtn');
  const resetBtn = document.getElementById('resetBtn');
  const downloadBtn = document.getElementById('downloadBtn');
  const clearBtn = document.getElementById('clearBtn');
  const statusEl = document.getElementById('status');

  const toolMain = document.getElementById('toolMain');
  const pageSubtitle = document.getElementById('pageSubtitle');

  // ==========================================
  // STATE
  // ==========================================

  let currentFile = null;
  let currentPdf = null; // PDFDocument
  let pageCount = 0;
  let locked = false;

  // order is an array of 0-based indices, e.g. [0,1,2,...]
  let order = [];
  let originalOrder = [];

  // pdf-lib exposes a global PDFLib (UMD build)
  const PDFLib = window.PDFLib;

  // ==========================================
  // UPLOAD ZONE BEHAVIOR
  // ==========================================

  uploadZone.addEventListener('click', () => fileInput.click());

  uploadZone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInput.click();
    }
  });

  uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('tool-upload-zone-dragover');
  });

  uploadZone.addEventListener('dragleave', () => {
    uploadZone.classList.remove('tool-upload-zone-dragover');
  });

  uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('tool-upload-zone-dragover');
    
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      loadFile(files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) {
      loadFile(file);
    }
  });

  // ==========================================
  // BUTTON ACTIONS
  // ==========================================

  reverseBtn.addEventListener('click', () => {
    if (!order.length) return;
    order.reverse();
    renderPageList();
    syncButtons();
  });

  resetBtn.addEventListener('click', () => {
    if (!originalOrder.length) return;
    order = [...originalOrder];
    renderPageList();
    syncButtons();
  });

  downloadBtn.addEventListener('click', async () => {
    if (!currentFile || !currentPdf || locked || order.length !== pageCount) return;

    setStatus('Building PDF...');
    downloadBtn.disabled = true;

    try {
      const { PDFDocument } = PDFLib;
      const outPdf = await PDFDocument.create();

      // Copy pages in the chosen order
      const copied = await outPdf.copyPages(currentPdf, order);
      copied.forEach((p) => outPdf.addPage(p));

      setStatus('Finalizing...');
      const outBytes = await outPdf.save();

      const blob = new Blob([outBytes], { type: 'application/pdf' });
      const base = sanitizeBase(baseName(currentFile.name));
      downloadBlob(`${base}-rearranged.pdf`, blob);

      setStatus('✓ PDF rearranged and downloaded successfully.');
    } catch (err) {
      console.error(err);
      setError('Something went wrong while rearranging this PDF.');
    } finally {
      syncButtons();
    }
  });

  clearBtn.addEventListener('click', () => {
    resetTool();
  });

  changeFileBtn.addEventListener('click', () => {
    resetTool();
  });

  // ==========================================
  // FILE LOADING
  // ==========================================

  async function loadFile(file) {
    if (!file) return;

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      alert('Please upload a PDF file.');
      return;
    }

    currentFile = file;

    if (!PDFLib?.PDFDocument) {
      alert('PDF library not loaded. Please refresh the page.');
      return;
    }

    setStatus('Analyzing PDF...');

    try {
      const bytes = await file.arrayBuffer();
      currentPdf = await PDFLib.PDFDocument.load(bytes);
      pageCount = currentPdf.getPageCount();
      locked = false;

      // Show workspace, hide upload
      uploadSection.style.display = 'none';
      workspaceSection.style.display = 'block';
      
      // Disable footer peek
      toolMain.setAttribute('data-disable-footer-peek', 'true');
      toolMain.classList.remove('has-extra-space');
      toolMain.style.height = 'auto';
      toolMain.style.minHeight = 'auto';
      if (window.adjustFooterPeek) window.adjustFooterPeek();

      // Hide subtitle when file is loaded
      if (pageSubtitle) {
        pageSubtitle.classList.add('hidden');
      }

      // Update file bar
      fileNameDisplay.textContent = file.name;
      fileMetaDisplay.textContent = `${formatBytes(file.size)} • ${pageCount} page${pageCount === 1 ? '' : 's'}`;

      // Update summary
      pagesSummaryEl.textContent = `${pageCount} page${pageCount === 1 ? '' : 's'}`;

      // Initialize orders
      order = Array.from({ length: pageCount }, (_, i) => i);
      originalOrder = [...order];

      // Show quick actions only if there are multiple pages
      quickActions.style.display = pageCount > 1 ? 'block' : 'none';

      renderPageList();
      setStatus('');

    } catch (err) {
      console.warn('Load failed:', err);
      locked = true;
      currentPdf = null;
      pageCount = 0;

      // Still show workspace but with error state
      uploadSection.style.display = 'none';
      workspaceSection.style.display = 'block';
      
      toolMain.setAttribute('data-disable-footer-peek', 'true');
      toolMain.classList.remove('has-extra-space');
      toolMain.style.height = 'auto';
      toolMain.style.minHeight = 'auto';
      if (window.adjustFooterPeek) window.adjustFooterPeek();

      if (pageSubtitle) {
        pageSubtitle.classList.add('hidden');
      }

      fileNameDisplay.textContent = file.name;
      fileMetaDisplay.textContent = formatBytes(file.size);
      pagesSummaryEl.textContent = 'Locked';

      pageList.innerHTML = '<p style="color: #64748b; text-align: center; padding: 2rem;">This PDF appears to be password-protected or unreadable.</p>';
      
      setError('This PDF appears password-protected or unreadable. Unlock support will be added later.');
    } finally {
      syncButtons();
    }
  }

  // ==========================================
  // PAGE LIST RENDERING
  // ==========================================

  function renderPageList() {
    pageList.innerHTML = '';

    if (!currentFile || locked) {
      return;
    }

    if (pageCount <= 0) {
      pageList.innerHTML = '<p style="color: #64748b; text-align: center; padding: 2rem;">No pages to display.</p>';
      return;
    }

    if (pageCount === 1) {
      pageList.innerHTML = '<p style="color: #64748b; text-align: center; padding: 2rem;">This PDF has a single page.</p>';
      return;
    }

    // Create page rows
    order.forEach((pageIndex, pos) => {
      const row = document.createElement('div');
      row.className = 'tool-meta-row';
      row.style.alignItems = 'center';

      const labelEl = document.createElement('span');
      labelEl.className = 'tool-meta-label';
      labelEl.textContent = `#${pos + 1}`;

      const valueEl = document.createElement('span');
      valueEl.className = 'tool-meta-value';
      valueEl.style.display = 'flex';
      valueEl.style.justifyContent = 'space-between';
      valueEl.style.alignItems = 'center';
      valueEl.style.gap = '0.5rem';

      // Page number text
      const text = document.createElement('span');
      text.textContent = `Page ${pageIndex + 1}`;

      // Control buttons
      const controls = document.createElement('span');
      controls.style.display = 'flex';
      controls.style.gap = '0.25rem';

      const upBtn = document.createElement('button');
      upBtn.type = 'button';
      upBtn.className = 'tool-btn-icon';
      upBtn.textContent = '↑';
      upBtn.disabled = pos === 0;
      upBtn.addEventListener('click', () => move(pos, pos - 1));

      const downBtn = document.createElement('button');
      downBtn.type = 'button';
      downBtn.className = 'tool-btn-icon';
      downBtn.textContent = '↓';
      downBtn.disabled = pos === order.length - 1;
      downBtn.addEventListener('click', () => move(pos, pos + 1));

      controls.appendChild(upBtn);
      controls.appendChild(downBtn);

      valueEl.appendChild(text);
      valueEl.appendChild(controls);

      row.appendChild(labelEl);
      row.appendChild(valueEl);
      pageList.appendChild(row);
    });
  }

  function move(fromPos, toPos) {
    if (toPos < 0 || toPos >= order.length) return;
    const [moved] = order.splice(fromPos, 1);
    order.splice(toPos, 0, moved);
    renderPageList();
    syncButtons();
  }

  // ==========================================
  // STATE MANAGEMENT
  // ==========================================

  function syncButtons() {
    clearBtn.disabled = !currentFile;

    if (!currentFile || locked) {
      downloadBtn.disabled = true;
      reverseBtn.disabled = true;
      resetBtn.disabled = true;
      return;
    }

    downloadBtn.disabled = pageCount < 1 || order.length !== pageCount;

    // Reverse/reset only make sense when there are 2+ pages
    const hasMany = pageCount > 1;
    reverseBtn.disabled = !hasMany;
    resetBtn.disabled = !hasMany;
  }

  function resetTool() {
    // Reset state
    currentFile = null;
    currentPdf = null;
    pageCount = 0;
    locked = false;
    order = [];
    originalOrder = [];

    // Reset inputs
    fileInput.value = '';

    // Reset buttons
    downloadBtn.disabled = true;
    clearBtn.disabled = true;
    reverseBtn.disabled = true;
    resetBtn.disabled = true;

    // Reset display
    pageList.innerHTML = '';
    pagesSummaryEl.textContent = '—';
    setStatus('');

    // Show upload, hide workspace
    uploadSection.style.display = 'block';
    workspaceSection.style.display = 'none';

    // Re-enable footer peek
    toolMain.removeAttribute('data-disable-footer-peek');
    toolMain.classList.add('has-extra-space');
    if (window.adjustFooterPeek) window.adjustFooterPeek();

    // Show subtitle when no file is loaded
    if (pageSubtitle) {
      pageSubtitle.classList.remove('hidden');
    }
  }

  // ==========================================
  // HELPERS
  // ==========================================

  function baseName(filename) {
    return String(filename ?? 'document.pdf').replace(/\.[^.]+$/, '');
  }

  function sanitizeBase(name) {
    return name.replace(/[^\w\-]+/g, '_').slice(0, 60) || 'document';
  }

  function downloadBlob(filename, blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(2)} MB`;
  }

  function setError(msg) {
    statusEl.innerHTML = `<div class="tool-status-error">${msg}</div>`;
  }

  function setStatus(msg) {
    if (!msg) {
      statusEl.innerHTML = '';
    } else {
      statusEl.innerHTML = `<div class="tool-status-info">${msg}</div>`;
    }
  }

})();
