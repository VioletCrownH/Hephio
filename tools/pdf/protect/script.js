// ============================================
// PDF PROTECT TOOL
// Add password protection to PDF files
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
  const fileInfo = document.getElementById('fileInfo');

  const pw1 = document.getElementById('pw1');
  const pw2 = document.getElementById('pw2');
  const showPw = document.getElementById('showPw');
  
  const protectBtn = document.getElementById('protectBtn');
  const clearBtn = document.getElementById('clearBtn');
  const statusEl = document.getElementById('status');

  const toolMain = document.getElementById('toolMain');
  const pageSubtitle = document.getElementById('pageSubtitle');
  
  // ==========================================
  // STATE
  // ==========================================

  let currentFile = null;
  let currentBytes = null;

  // pdf-lib-plus-encrypt exposes a global PDFLib (UMD build)
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
  // PASSWORD INPUT BEHAVIOR
  // ==========================================

  pw1.addEventListener('input', syncButtonState);
  pw2.addEventListener('input', syncButtonState);

  showPw.addEventListener('change', () => {
    const type = showPw.checked ? 'text' : 'password';
    pw1.type = type;
    pw2.type = type;
  });

  // ==========================================
  // BUTTON ACTIONS
  // ==========================================

  protectBtn.addEventListener('click', async () => {
    if (!currentFile || !currentBytes) return;

    const p1 = pw1.value || '';
    const p2 = pw2.value || '';
    
    if (!p1) {
      setError('Please enter a password.');
      return;
    }
    
    if (p1 !== p2) {
      setError('Passwords do not match.');
      return;
    }

    // Guard: check if PDF library is loaded
    if (!PDFLib?.PDFDocument) {
      setError('PDF library not loaded. Please refresh the page.');
      return;
    }

    setStatus('Protecting PDF...');
    protectBtn.disabled = true;

    try {
      const pdfDoc = await PDFLib.PDFDocument.load(currentBytes, {
        ignoreEncryption: false,
      });

      if (typeof pdfDoc.encrypt !== 'function') {
        throw new Error('Encryption not available in this build.');
      }

      // Apply password encryption
      pdfDoc.encrypt({
        userPassword: p1,
      });

      const outBytes = await pdfDoc.save();

      const filename = makeProtectedName(currentFile.name);
      downloadBytes(filename, outBytes);

      setStatus('✓ PDF protected and downloaded successfully.');
    } catch (err) {
      console.error(err);

      const msg = (err?.message || '').includes('encrypted')
        ? 'This PDF appears to already be encrypted. Please unlock it first.'
        : (err?.message || 'Something went wrong while protecting this PDF.');

      setError(msg);
    } finally {
      protectBtn.disabled = false;
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

    try {
      setStatus('Loading PDF...');
      
      currentBytes = new Uint8Array(await file.arrayBuffer());
      
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
      fileMetaDisplay.textContent = formatBytes(file.size);

      // Render file info
      renderFileInfo(file, currentBytes);

      // Enable password inputs
      pw1.disabled = false;
      pw2.disabled = false;
      showPw.disabled = false;
      clearBtn.disabled = false;

      setStatus('');
      syncButtonState();

    } catch (e) {
      console.error(e);
      setError('Something went wrong while reading this PDF.');
    }
  }

  function renderFileInfo(file, bytes) {
    fileInfo.innerHTML = '';
    addMetaRow(fileInfo, 'File name', file.name);
    addMetaRow(fileInfo, 'File size', formatBytes(file.size));
    addMetaRow(fileInfo, 'Type', 'application/pdf');
    addMetaRow(fileInfo, 'Loaded', `${formatBytes(bytes.byteLength)} in memory`);
  }

  // ==========================================
  // STATE MANAGEMENT
  // ==========================================

  function syncButtonState() {
    const hasFile = !!currentFile && !!currentBytes;
    const p1Val = pw1.value || '';
    const p2Val = pw2.value || '';
    const hasPw = p1Val && p1Val === p2Val;
    
    protectBtn.disabled = !(hasFile && hasPw);

    // Live mismatch hint
    if (p1Val && p2Val && p1Val !== p2Val) {
      setStatus('⚠ Passwords do not match.');
    } else if (statusEl.textContent.includes('do not match')) {
      setStatus('');
    }
  }

  function resetTool() {
    // Reset state
    currentFile = null;
    currentBytes = null;

    // Reset inputs
    fileInput.value = '';
    pw1.value = '';
    pw2.value = '';
    pw1.disabled = true;
    pw2.disabled = true;
    showPw.checked = false;
    showPw.disabled = true;

    // Reset buttons
    protectBtn.disabled = true;
    clearBtn.disabled = true;

    // Reset display
    fileInfo.innerHTML = '';
    setStatus('');

    // Show upload, hide workspace
    uploadSection.style.display = 'block';
    workspaceSection.style.display = 'none';

    // Re-enable footer peek
    toolMain.removeAttribute('data-disable-footer-peek');
    if (window.adjustFooterPeek) window.adjustFooterPeek();

    // Show subtitle when no file is loaded
    if (pageSubtitle) {
      pageSubtitle.classList.remove('hidden');
    }
  }

  // ==========================================
  // HELPERS
  // ==========================================

  function addMetaRow(container, label, value) {
    const row = document.createElement('div');
    row.className = 'tool-meta-row';

    const labelEl = document.createElement('span');
    labelEl.className = 'tool-meta-label';
    labelEl.textContent = label;

    const valueEl = document.createElement('span');
    valueEl.className = 'tool-meta-value';
    valueEl.textContent = value;

    row.appendChild(labelEl);
    row.appendChild(valueEl);
    container.appendChild(row);
  }

  function makeProtectedName(originalName) {
    const base = originalName.replace(/\.pdf$/i, '');
    return `${base}-protected.pdf`;
  }

  function downloadBytes(filename, bytes) {
    const blob = new Blob([bytes], { type: 'application/pdf' });
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