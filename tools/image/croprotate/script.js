document.addEventListener("DOMContentLoaded", () => {
  // Sections
  const uploadSection = document.getElementById("uploadSection");
  const workspaceSection = document.getElementById("workspaceSection");

  // Upload UI
  const uploadZone = document.getElementById("uploadZone");
  const fileInput = document.getElementById("fileInput");
  const changeFileBtn = document.getElementById("changeFileBtn");

  // File bar
  const fileNameEl = document.getElementById("fileName");
  const fileMetaEl = document.getElementById("fileMeta");

  // Canvas + overlay
  const canvas = document.getElementById("previewCanvas");
  const cropOverlay = document.getElementById("cropOverlay");
  const cropBadge = document.getElementById("cropBadge");

  // Inputs
  const cropXInput = document.getElementById("cropX");
  const cropYInput = document.getElementById("cropY");
  const cropWInput = document.getElementById("cropW");
  const cropHInput = document.getElementById("cropH");

  // Buttons (crop controls)
  const fullBtn = document.getElementById("fullBtn");
  const resetBtn = document.getElementById("resetBtn");

  // Rotation controls
  const rotLeftBtn = document.getElementById("rotLeftBtn");
  const rotRightBtn = document.getElementById("rotRightBtn");

  // Output controls
  const formatSelect = document.getElementById("formatSelect");
  const qualityWrap = document.getElementById("qualityWrap");
  const qualityInput = document.getElementById("qualityInput");
  const qualityVal = document.getElementById("qualityVal");

  // Primary action
  const downloadBtn = document.getElementById("downloadBtn");

  // Status
  const statusEl = document.getElementById("status");

  const required = [
    uploadSection, workspaceSection,
    uploadZone, fileInput, changeFileBtn,
    fileNameEl, fileMetaEl,
    canvas, cropOverlay, cropBadge,
    cropXInput, cropYInput, cropWInput, cropHInput,
    fullBtn, resetBtn,
    rotLeftBtn, rotRightBtn,
    formatSelect, qualityWrap, qualityInput, qualityVal,
    downloadBtn,
    statusEl,
  ];

  if (required.some((el) => !el)) {
    console.error("Crop & Rotate: Missing expected DOM elements. Check HTML IDs.");
    if (statusEl) {
      statusEl.textContent = "Setup error: missing page elements (check console).";
      statusEl.style.color = "#b91c1c";
    }
    return;
  }

  let currentFile = null;
  let imgEl = null;

  // Rotation: 0, 90, 180, 270 (clockwise)
  let rotation = 0;

  // Crop state in preview canvas pixels
  const MIN_SIZE = 50;
  let crop = { x: 0, y: 0, w: 0, h: 0 };

  // Interaction state
  let dragMode = null; // "move" or "resize"
  let resizeHandle = null; // "nw" | "ne" | "sw" | "se"
  let start = null;

  // ---------- Upload wiring ----------

  uploadZone.addEventListener("click", () => fileInput.click());

  uploadZone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fileInput.click();
    }
  });

  changeFileBtn.addEventListener("click", () => {
    resetToUpload();
    fileInput.click();
  });

  fileInput.addEventListener("change", async (e) => {
    const file = e.target.files?.[0] ?? null;
    await loadFile(file);
  });

  uploadZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    uploadZone.classList.add("drag-over");
  });

  uploadZone.addEventListener("dragleave", () => {
    uploadZone.classList.remove("drag-over");
  });

  uploadZone.addEventListener("drop", async (e) => {
    e.preventDefault();
    uploadZone.classList.remove("drag-over");
    const file = e.dataTransfer?.files?.[0] ?? null;
    await loadFile(file);
  });

  // ---------- Rotation wiring ----------

  rotLeftBtn.addEventListener("click", () => {
    if (!imgEl) return;
    rotation = (rotation + 270) % 360;
    redrawPreviewAndResetCrop(false);
  });

  rotRightBtn.addEventListener("click", () => {
    if (!imgEl) return;
    rotation = (rotation + 90) % 360;
    redrawPreviewAndResetCrop(false);
  });

  // ---------- Output wiring ----------

  formatSelect.addEventListener("change", () => {
    updateQualityVisibility();
  });

  qualityInput.addEventListener("input", () => {
    qualityVal.textContent = `${qualityInput.value}%`;
  });

  function updateQualityVisibility() {
    const fmt = formatSelect.value;
    const show = fmt === "jpeg" || fmt === "webp";
    if (show) {
      qualityWrap.classList.remove("hidden");
    } else {
      qualityWrap.classList.add("hidden");
    }
  }

  // ---------- Load + preview draw ----------

  async function loadFile(file) {
    clearStatus();
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Please upload a JPG, PNG, or WebP image.");
      return;
    }

    try {
      setStatus("Loading image…");

      currentFile = file;
      imgEl = await fileToImage(file);

      rotation = 0;
      formatSelect.value = "original";
      qualityInput.min = "40";
      qualityInput.max = "100";
      qualityInput.value = "85";
      qualityVal.textContent = "85%";
      updateQualityVisibility();

      uploadSection.style.display = "none";
      workspaceSection.style.display = "block";

      const toolMain = document.getElementById("toolMain");
      if (toolMain) {
        toolMain.dataset.disableFooterPeek = "true";
        toolMain.style.height = "auto";
        toolMain.style.minHeight = "auto";
        toolMain.classList.remove("has-extra-space");
      }

      const pageSubtitle = document.getElementById("pageSubtitle");
      if (pageSubtitle) {
        pageSubtitle.classList.add("hidden");
      }

      fileNameEl.textContent = file.name;
      fileMetaEl.textContent = `${formatBytes(file.size)} • ${imgEl.naturalWidth} × ${imgEl.naturalHeight}`;

      redrawPreviewAndResetCrop(true);

      clearStatus();
    } catch (err) {
      console.error(err);
      setError("Something went wrong while loading this image.");
      resetToUpload();
    }
  }

  function resetToUpload() {
    currentFile = null;
    imgEl = null;
    fileInput.value = "";
    rotation = 0;

    cropOverlay.style.display = "none";

    const ctx = canvas.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    canvas.width = 0;
    canvas.height = 0;

    workspaceSection.style.display = "none";
    uploadSection.style.display = "block";

    const toolMain = document.getElementById("toolMain");
    if (toolMain) {
      toolMain.dataset.disableFooterPeek = "false";
      toolMain.classList.add("has-extra-space");
      if (typeof adjustFooterPeek === "function") {
        adjustFooterPeek();
      }
    }

    const pageSubtitle = document.getElementById("pageSubtitle");
    if (pageSubtitle) {
      pageSubtitle.classList.remove("hidden");
    }

    clearStatus();
  }

  function drawPreviewContain(img, canvasEl, rotDeg) {
    const maxWidth = 650;
    const maxHeight = 380;

    const iw = img.naturalWidth;
    const ih = img.naturalHeight;

    const rot = ((rotDeg % 360) + 360) % 360;
    const rw = rot % 180 === 0 ? iw : ih;
    const rh = rot % 180 === 0 ? ih : iw;

    const scale = Math.min(maxWidth / rw, maxHeight / rh, 1);

    const cw = Math.round(rw * scale);
    const ch = Math.round(rh * scale);

    canvasEl.width = cw;
    canvasEl.height = ch;

    const ctx = canvasEl.getContext("2d");
    if (!ctx) throw new Error("No 2D canvas context");

    ctx.clearRect(0, 0, cw, ch);

    ctx.save();
    ctx.translate(cw / 2, ch / 2);
    ctx.rotate((rot * Math.PI) / 180);

    ctx.drawImage(
      img,
      -Math.round(iw * scale) / 2,
      -Math.round(ih * scale) / 2,
      Math.round(iw * scale),
      Math.round(ih * scale)
    );

    ctx.restore();
  }

  function initDefaultCrop() {
    const cw = canvas.width;
    const ch = canvas.height;

    const margin = 0.1;
    crop.x = Math.round(cw * margin);
    crop.y = Math.round(ch * margin);
    crop.w = Math.round(cw * (1 - 2 * margin));
    crop.h = Math.round(ch * (1 - 2 * margin));

    clampCrop();
  }

  function redrawPreviewAndResetCrop(resetCrop = true) {
    if (!imgEl) return;
    drawPreviewContain(imgEl, canvas, rotation);

    if (resetCrop) {
      initDefaultCrop();
    } else {
      clampCrop();
    }

    renderCropUI();
  }

  // ---------- Crop rendering + syncing ----------

  function renderCropUI() {
    cropOverlay.style.display = "block";

    cropOverlay.style.left = `${crop.x}px`;
    cropOverlay.style.top = `${crop.y}px`;
    cropOverlay.style.width = `${crop.w}px`;
    cropOverlay.style.height = `${crop.h}px`;

    cropBadge.textContent = `${Math.round(crop.w)} × ${Math.round(crop.h)}`;

    const off = -6;
    const handles = cropOverlay.querySelectorAll(".crop-handle");
    handles.forEach((h) => {
      const key = h.dataset.handle;
      h.style.left = "";
      h.style.right = "";
      h.style.top = "";
      h.style.bottom = "";

      if (key === "nw") {
        h.style.left = `${off}px`;
        h.style.top = `${off}px`;
        h.style.cursor = "nw-resize";
      } else if (key === "ne") {
        h.style.right = `${off}px`;
        h.style.top = `${off}px`;
        h.style.cursor = "ne-resize";
      } else if (key === "sw") {
        h.style.left = `${off}px`;
        h.style.bottom = `${off}px`;
        h.style.cursor = "sw-resize";
      } else if (key === "se") {
        h.style.right = `${off}px`;
        h.style.bottom = `${off}px`;
        h.style.cursor = "se-resize";
      }
    });

    cropXInput.value = String(Math.round(crop.x));
    cropYInput.value = String(Math.round(crop.y));
    cropWInput.value = String(Math.round(crop.w));
    cropHInput.value = String(Math.round(crop.h));
  }

  function clampCrop() {
    const cw = canvas.width;
    const ch = canvas.height;

    crop.w = Math.max(MIN_SIZE, crop.w);
    crop.h = Math.max(MIN_SIZE, crop.h);

    crop.x = Math.max(0, Math.min(crop.x, cw - crop.w));
    crop.y = Math.max(0, Math.min(crop.y, ch - crop.h));

    crop.w = Math.min(cw - crop.x, crop.w);
    crop.h = Math.min(ch - crop.y, crop.h);

    crop.w = Math.max(MIN_SIZE, crop.w);
    crop.h = Math.max(MIN_SIZE, crop.h);

    crop.x = Math.max(0, Math.min(crop.x, cw - crop.w));
    crop.y = Math.max(0, Math.min(crop.y, ch - crop.h));
  }

  // ---------- Mouse interactions ----------

  cropOverlay.addEventListener("mousedown", (e) => {
    const target = e.target;
    if (target?.classList?.contains("crop-handle")) return;

    e.preventDefault();
    dragMode = "move";
    resizeHandle = null;

    start = snapshotStart(e);
    attachDocListeners();
  });

  cropOverlay.querySelectorAll(".crop-handle").forEach((handleEl) => {
    handleEl.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragMode = "resize";
      resizeHandle = handleEl.dataset.handle || null;
      start = snapshotStart(e);
      attachDocListeners();
    });
  });

  function snapshotStart(e) {
    return {
      mx: e.clientX,
      my: e.clientY,
      x: crop.x,
      y: crop.y,
      w: crop.w,
      h: crop.h,
    };
  }

  function attachDocListeners() {
    document.addEventListener("mousemove", onDocMove);
    document.addEventListener("mouseup", onDocUp);
  }

  function detachDocListeners() {
    document.removeEventListener("mousemove", onDocMove);
    document.removeEventListener("mouseup", onDocUp);
  }

  function onDocMove(e) {
    if (!start || !dragMode) return;

    const dx = e.clientX - start.mx;
    const dy = e.clientY - start.my;

    if (dragMode === "move") {
      crop.x = start.x + dx;
      crop.y = start.y + dy;
      clampCrop();
      renderCropUI();
      return;
    }

    if (dragMode === "resize" && resizeHandle) {
      let x = start.x;
      let y = start.y;
      let w = start.w;
      let h = start.h;

      if (resizeHandle.includes("e")) w = start.w + dx;
      if (resizeHandle.includes("s")) h = start.h + dy;
      if (resizeHandle.includes("w")) {
        x = start.x + dx;
        w = start.w - dx;
      }
      if (resizeHandle.includes("n")) {
        y = start.y + dy;
        h = start.h - dy;
      }

      crop.x = x;
      crop.y = y;
      crop.w = w;
      crop.h = h;
      clampCrop();
      renderCropUI();
    }
  }

  function onDocUp() {
    dragMode = null;
    resizeHandle = null;
    start = null;
    detachDocListeners();
  }

  // ---------- Inputs → overlay ----------

  function parseNum(el, fallback) {
    const v = Number(el.value);
    return Number.isFinite(v) ? v : fallback;
  }

  function applyInputsToCrop() {
    crop.x = Math.round(parseNum(cropXInput, crop.x));
    crop.y = Math.round(parseNum(cropYInput, crop.y));
    crop.w = Math.round(parseNum(cropWInput, crop.w));
    crop.h = Math.round(parseNum(cropHInput, crop.h));
    clampCrop();
    renderCropUI();
  }

  [cropXInput, cropYInput, cropWInput, cropHInput].forEach((el) => {
    el.addEventListener("input", applyInputsToCrop);
  });

  fullBtn.addEventListener("click", () => {
    crop.x = 0;
    crop.y = 0;
    crop.w = canvas.width;
    crop.h = canvas.height;
    clampCrop();
    renderCropUI();
  });

  resetBtn.addEventListener("click", () => {
    initDefaultCrop();
    renderCropUI();
  });

  // ---------- Export ----------

  downloadBtn.addEventListener("click", async () => {
    if (!imgEl || !currentFile) return;

    try {
      setStatus("Exporting…");
      downloadBtn.disabled = true;

      const rotated = renderRotatedFullRes(imgEl, rotation);

      const scaleX = rotated.width / canvas.width;
      const scaleY = rotated.height / canvas.height;

      const sx = Math.round(crop.x * scaleX);
      const sy = Math.round(crop.y * scaleY);
      const sw = Math.round(crop.w * scaleX);
      const sh = Math.round(crop.h * scaleY);

      const src = clampRect(sx, sy, sw, sh, rotated.width, rotated.height);

      const outCanvas = document.createElement("canvas");
      outCanvas.width = src.w;
      outCanvas.height = src.h;

      const octx = outCanvas.getContext("2d");
      if (!octx) throw new Error("No 2D context for output canvas");

      octx.drawImage(
        rotated.canvas,
        src.x,
        src.y,
        src.w,
        src.h,
        0,
        0,
        src.w,
        src.h
      );

      const { mime, quality } = getOutputEncoding(currentFile.type);
      const blob = await canvasToBlob(outCanvas, mime, quality);

      const filename = makeOutputName(currentFile.name, mime, rotation);
      downloadBlob(filename, blob);

      setStatus("Done.");
    } catch (err) {
      console.error(err);
      setError("Something went wrong while exporting this image.");
    } finally {
      downloadBtn.disabled = false;
    }
  });

  function renderRotatedFullRes(img, rotDeg) {
    const rot = ((rotDeg % 360) + 360) % 360;
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;

    const rw = rot % 180 === 0 ? iw : ih;
    const rh = rot % 180 === 0 ? ih : iw;

    const c = document.createElement("canvas");
    c.width = rw;
    c.height = rh;

    const ctx = c.getContext("2d");
    if (!ctx) throw new Error("No 2D context for rotated canvas");

    ctx.save();
    ctx.translate(rw / 2, rh / 2);
    ctx.rotate((rot * Math.PI) / 180);
    ctx.drawImage(img, -iw / 2, -ih / 2);
    ctx.restore();

    return { canvas: c, width: rw, height: rh };
  }

  function clampRect(x, y, w, h, maxW, maxH) {
    let nx = x;
    let ny = y;
    let nw = w;
    let nh = h;

    if (nw < 1) nw = 1;
    if (nh < 1) nh = 1;

    nx = Math.max(0, Math.min(nx, maxW - 1));
    ny = Math.max(0, Math.min(ny, maxH - 1));

    if (nx + nw > maxW) nw = maxW - nx;
    if (ny + nh > maxH) nh = maxH - ny;

    return { x: nx, y: ny, w: nw, h: nh };
  }

  function getOutputEncoding(inputMime) {
    const choice = formatSelect.value;

    const mime =
      choice === "jpeg"
        ? "image/jpeg"
        : choice === "png"
        ? "image/png"
        : choice === "webp"
        ? "image/webp"
        : inputMime;

    let quality = undefined;
    if (mime === "image/jpeg" || mime === "image/webp") {
      quality = Number(qualityInput.value) / 100;
    }

    return { mime, quality };
  }

  function makeOutputName(originalName, mime, rotDeg) {
    const base = originalName.replace(/\.[^.]+$/, "");
    const ext =
      mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";

    const rotTag = ((rotDeg % 360) + 360) % 360;
    const rotSuffix = rotTag === 0 ? "" : `-rot${rotTag}`;

    return `${base}-crop${rotSuffix}.${ext}`;
  }

  function canvasToBlob(canvasEl, type, quality) {
    return new Promise((resolve, reject) => {
      canvasEl.toBlob(
        (blob) => {
          if (!blob) reject(new Error("toBlob returned null"));
          else resolve(blob);
        },
        type,
        quality
      );
    });
  }

  function downloadBlob(filename, blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // ---------- Helpers ----------

  function fileToImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Image decode failed"));
      };
      img.src = url;
    });
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(2)} MB`;
  }

  function setError(msg) {
    statusEl.textContent = msg;
    statusEl.style.color = "#b91c1c";
  }

  function setStatus(msg) {
    statusEl.textContent = msg;
    statusEl.style.color = "#64748b";
  }

  function clearStatus() {
    statusEl.textContent = "";
    statusEl.style.color = "#64748b";
  }
});