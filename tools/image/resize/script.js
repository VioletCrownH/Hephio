const uploadZone = document.getElementById("uploadZone");
const uploadPrompt = document.getElementById("uploadPrompt");
const fileSummary = document.getElementById("fileSummary");
const chooseDifferent = document.getElementById("chooseDifferent");

const thumb = document.getElementById("thumb");
const fileNameEl = document.getElementById("fileName");
const fileSizeEl = document.getElementById("fileSize");
const fileDimsEl = document.getElementById("fileDims");

const settingsPanel = document.getElementById("settingsPanel");

const fileInput = document.getElementById("fileInput");
const widthInput = document.getElementById("widthInput");
const heightInput = document.getElementById("heightInput");
const lockAspect = document.getElementById("lockAspect");

const formatSelect = document.getElementById("formatSelect");

const qualityWrap = document.getElementById("qualityWrap");
const qualityInput = document.getElementById("qualityInput");
const qualityVal = document.getElementById("qualityVal");

const resizeBtn = document.getElementById("resizeBtn");
const statusEl = document.getElementById("status");
const pageSubtitle = document.getElementById("pageSubtitle");

let currentFile = null;
let originalDims = null;
let aspect = null;
let currentThumbUrl = null;

let lastEdited = "width"; // track which field user changed last

/* ---------------- Upload Zone wiring ---------------- */

uploadZone.addEventListener("click", () => fileInput.click());

uploadZone.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    fileInput.click();
  }
});

uploadZone.addEventListener("dragenter", (e) => {
  e.preventDefault();
  uploadZone.classList.add("is-dragging");
});
uploadZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  uploadZone.classList.add("is-dragging");
});
uploadZone.addEventListener("dragleave", () => {
  uploadZone.classList.remove("is-dragging");
});
uploadZone.addEventListener("drop", async (e) => {
  e.preventDefault();
  uploadZone.classList.remove("is-dragging");

  const file = e.dataTransfer?.files?.[0] ?? null;
  await loadFile(file);
  fileInput.value = "";
});

fileInput.addEventListener("change", async (e) => {
  const file = e.target.files?.[0] ?? null;
  await loadFile(file);
});

chooseDifferent?.addEventListener("click", (e) => {
  e.preventDefault();
  fileInput.click();
});

/* ---------------- Settings wiring ---------------- */

widthInput.addEventListener("input", () => {
  lastEdited = "width";
  if (lockAspect.checked) syncOtherDimension();
  syncButtonState();
  clearStatus();
});

heightInput.addEventListener("input", () => {
  lastEdited = "height";
  if (lockAspect.checked) syncOtherDimension();
  syncButtonState();
  clearStatus();
});

lockAspect.addEventListener("change", () => {
  if (lockAspect.checked) syncOtherDimension();
  clearStatus();
});

formatSelect.addEventListener("change", () => {
  updateQualityVisibility();
  syncButtonState();
  clearStatus();
});

qualityInput.addEventListener("input", () => {
  qualityVal.textContent = `${qualityInput.value}%`;
});

/* ---------------- Action ---------------- */

resizeBtn.addEventListener("click", async () => {
  if (!currentFile || !originalDims) return;

  const w = clampInt(widthInput.value);
  const h = clampInt(heightInput.value);
  if (!w || !h) {
    setError("Please enter a valid width and height.");
    return;
  }

  setStatus("Resizing…");
  resizeBtn.disabled = true;

  try {
    const img = await fileToImage(currentFile);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, w, h);

    const outType = getSelectedOutputType();
    const q =
      (outType === "image/jpeg" || outType === "image/webp")
        ? Number(qualityInput.value) / 100
        : undefined;

    const blob = await canvasToBlob(canvas, outType, q);

    const filename = makeResizedName(currentFile.name, outType, w, h);
    downloadBlob(filename, blob);

    setSuccess("Done.");
  } catch (err) {
    console.error(err);
    setError("Something went wrong while resizing this image.");
  } finally {
    resizeBtn.disabled = false;
  }
});

/* ---------------- Core logic ---------------- */

async function loadFile(file) {
  resetUI();
  if (!file) return;

  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    setError("Please upload a JPG, PNG, or WebP image.");
    return;
  }

  currentFile = file;

  try {
    originalDims = await getImageDimensions(file);
    aspect = originalDims.width / originalDims.height;

    // Upload zone → summary card
    uploadPrompt.classList.add("hidden");
    fileSummary.classList.remove("hidden");
    settingsPanel.classList.remove("hidden");

    fileNameEl.textContent = file.name;
    fileSizeEl.textContent = formatBytes(file.size);
    fileDimsEl.textContent = `${originalDims.width} × ${originalDims.height}`;

    currentThumbUrl = URL.createObjectURL(file);
    thumb.src = currentThumbUrl;

    // Defaults: set inputs to original dims
    widthInput.value = String(originalDims.width);
    heightInput.value = String(originalDims.height);
    lockAspect.checked = true;
    lastEdited = "width";

    // Output format defaults
    formatSelect.disabled = false;
    formatSelect.value = "keep";

    // Quality defaults
    qualityInput.value = "85";
    qualityVal.textContent = "85%";
    updateQualityVisibility();

    syncButtonState();
    
    // Hide subtitle after file load to save space
    if (pageSubtitle) pageSubtitle.classList.add("hidden");
    
    // Remove footer peek for post-file-load state
    const toolMain = document.getElementById("toolMain");
    if (toolMain) {
      toolMain.classList.remove("has-extra-space");
      // Disable automatic footer peek adjustments
      toolMain.dataset.disableFooterPeek = 'true';
      // Force the layout to allow scrolling instead of fixed height
      toolMain.style.height = 'auto';
      toolMain.style.minHeight = 'calc(100vh - 100px)';
    }
  } catch (err) {
    console.error(err);
    setError("Something went wrong while reading this image.");
  }
}

function resetUI() {
  currentFile = null;
  originalDims = null;
  aspect = null;

  settingsPanel.classList.add("hidden");

  uploadPrompt.classList.remove("hidden");
  fileSummary.classList.add("hidden");

  widthInput.value = "";
  heightInput.value = "";
  lockAspect.checked = true;
  lastEdited = "width";

  formatSelect.disabled = true;
  formatSelect.value = "keep";

  qualityWrap.classList.add("hidden");
  qualityInput.value = "85";
  qualityVal.textContent = "85%";

  resizeBtn.disabled = true;

  if (currentThumbUrl) {
    URL.revokeObjectURL(currentThumbUrl);
    currentThumbUrl = null;
  }
  thumb.removeAttribute("src");

  clearStatus();
  
  // Show subtitle again when reset
  if (pageSubtitle) pageSubtitle.classList.remove("hidden");
  
  // Restore footer peek for reset/initial state
  const toolMain = document.getElementById("toolMain");
  if (toolMain) {
    toolMain.classList.add("has-extra-space");
    // Re-enable automatic footer peek adjustments
    delete toolMain.dataset.disableFooterPeek;
    // Reset the layout styles so adjustFooterPeek can work properly
    toolMain.style.height = '';
    toolMain.style.minHeight = '';
  }
  
  // Recalculate footer peek behavior
  if (typeof adjustFooterPeek === 'function') {
    adjustFooterPeek();
  }
}

function syncOtherDimension() {
  if (!aspect) return;

  const w = clampInt(widthInput.value);
  const h = clampInt(heightInput.value);

  if (lastEdited === "width" && w) {
    const newH = Math.max(1, Math.round(w / aspect));
    heightInput.value = String(newH);
  } else if (lastEdited === "height" && h) {
    const newW = Math.max(1, Math.round(h * aspect));
    widthInput.value = String(newW);
  }
}

function syncButtonState() {
  const w = clampInt(widthInput.value);
  const h = clampInt(heightInput.value);
  resizeBtn.disabled = !currentFile || !w || !h;
}

function getSelectedOutputType() {
  if (!currentFile) return null;

  const choice = formatSelect.value;
  if (choice === "keep") return currentFile.type;
  if (choice === "jpeg") return "image/jpeg";
  if (choice === "png") return "image/png";
  if (choice === "webp") return "image/webp";
  return currentFile.type;
}

function updateQualityVisibility() {
  const outType = getSelectedOutputType();
  const show = outType === "image/jpeg" || outType === "image/webp";
  qualityWrap.classList.toggle("hidden", !show);
}

/* ---------------- Naming ---------------- */

function makeResizedName(originalName, mimeType, w, h) {
  const base = originalName.replace(/\.[^.]+$/, "");
  const ext =
    mimeType === "image/png" ? "png" :
    mimeType === "image/webp" ? "webp" :
    "jpg";

  return `${base}-${w}x${h}.${ext}`;
}

/* ---------------- Helpers ---------------- */

function clampInt(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  const i = Math.floor(n);
  if (i < 1) return null;
  return i;
}

async function getImageDimensions(file) {
  const bmp = await createImageBitmap(file);
  const out = { width: bmp.width, height: bmp.height };
  bmp.close?.();
  return out;
}

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

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) reject(new Error("toBlob returned null"));
      else resolve(blob);
    }, type, quality);
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

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
}

/* ---------------- Status UI ---------------- */

function clearStatus() {
  statusEl.textContent = "";
  statusEl.className = "";
}

function setStatus(msg) {
  statusEl.textContent = msg;
  statusEl.className = "tool-status-info";
}

function setError(msg) {
  statusEl.textContent = msg;
  statusEl.className = "tool-status-error";
}

function setSuccess(msg) {
  statusEl.textContent = msg;
  statusEl.className = "tool-status-success";
}

/* ---------------- Init ---------------- */

resetUI();