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
const formatSelect = document.getElementById("formatSelect");
const qualityWrap = document.getElementById("qualityWrap");
const qualityInput = document.getElementById("qualityInput");
const qualityVal = document.getElementById("qualityVal");
const convertBtn = document.getElementById("convertBtn");
const statusEl = document.getElementById("status");

let currentFile = null;
let originalDims = null;
let currentThumbUrl = null;

/* ---------------- Upload Zone wiring ---------------- */

uploadZone.addEventListener("click", (e) => {
  if (e.target !== chooseDifferent) {
    fileInput.click();
  }
});

uploadZone.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    fileInput.click();
  }
});

uploadZone.addEventListener("dragenter", (e) => {
  e.preventDefault();
  uploadZone.classList.add("drag-over");
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
  fileInput.value = "";
});

fileInput.addEventListener("change", async (e) => {
  const file = e.target.files?.[0] ?? null;
  await loadFile(file);
});

chooseDifferent.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();
  fileInput.click();
});

/* ---------------- Settings controls ---------------- */

formatSelect.addEventListener("change", () => {
  updateQualityVisibility();
  syncButtonState();
  clearStatus();
});

qualityInput.addEventListener("input", () => {
  qualityVal.textContent = `${qualityInput.value}%`;
});

/* ---------------- Convert action ---------------- */

convertBtn.addEventListener("click", async () => {
  if (!currentFile || !originalDims) return;

  const outType = formatSelect.value;
  if (!outType) return;

  setBusy(true);
  setStatus("Converting...");

  try {
    const img = await fileToImage(currentFile);

    const canvas = document.createElement("canvas");
    canvas.width = originalDims.width;
    canvas.height = originalDims.height;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);

    const quality =
      (outType === "image/jpeg" || outType === "image/webp")
        ? Number(qualityInput.value) / 100
        : undefined;

    const blob = await canvasToBlob(canvas, outType, quality);

    const filename = makeConvertedName(currentFile.name, outType);
    downloadBlob(filename, blob);

    setSuccess("Done.");
  } catch (err) {
    console.error(err);
    setError("Something went wrong while converting this image.");
  } finally {
    setBusy(false);
  }
});

/* ---------------- File load + UI state ---------------- */

function resetUI() {
  currentFile = null;
  originalDims = null;

  settingsPanel.classList.add("hidden");
  formatSelect.disabled = true;
  convertBtn.disabled = true;

  qualityWrap.classList.add("hidden");
  qualityInput.value = 85;
  qualityVal.textContent = "85%";

  uploadZone.classList.remove("has-file");
  uploadPrompt.classList.remove("hidden");
  fileSummary.classList.add("hidden");

  if (currentThumbUrl) {
    URL.revokeObjectURL(currentThumbUrl);
    currentThumbUrl = null;
  }

  thumb.removeAttribute("src");
  clearStatus();
}

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

    uploadPrompt.classList.add("hidden");
    fileSummary.classList.remove("hidden");
    uploadZone.classList.add("has-file");

    fileNameEl.textContent = file.name;
    fileSizeEl.textContent = formatBytes(file.size);
    fileDimsEl.textContent = `${originalDims.width} × ${originalDims.height}`;

    currentThumbUrl = URL.createObjectURL(file);
    thumb.src = currentThumbUrl;

    settingsPanel.classList.remove("hidden");
    formatSelect.disabled = false;
    setDefaultOutputFormat(file.type);

    updateQualityVisibility();
    syncButtonState();
  } catch (err) {
    console.error(err);
    setError("Something went wrong while reading this image.");
  }
}

function setDefaultOutputFormat(inputType) {
  if (inputType === "image/jpeg") {
    formatSelect.value = "image/png";
  } else {
    formatSelect.value = "image/jpeg";
  }
}

function updateQualityVisibility() {
  const outType = formatSelect.value;
  const show = outType === "image/jpeg" || outType === "image/webp";
  qualityWrap.classList.toggle("hidden", !show);
}

function syncButtonState() {
  convertBtn.disabled = !currentFile || !formatSelect.value;
}

function setBusy(busy) {
  convertBtn.disabled = busy || !currentFile || !formatSelect.value;
  formatSelect.disabled = busy;
  qualityInput.disabled = busy;
}

/* ---------------- Naming ---------------- */

function makeConvertedName(originalName, mimeType) {
  const base = originalName.replace(/\.[^.]+$/, "");
  const ext =
    mimeType === "image/png" ? "png" :
    mimeType === "image/webp" ? "webp" :
    "jpg";

  return `${base}-to-${ext}.${ext}`;
}

/* ---------------- Helpers ---------------- */

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
  statusEl.className = "tool-status-message";
}

function setStatus(msg) {
  statusEl.textContent = msg;
  statusEl.className = "tool-status-message";
}

function setSuccess(msg) {
  statusEl.textContent = msg;
  statusEl.className = "tool-status-success";
}

function setError(msg) {
  statusEl.textContent = msg;
  statusEl.className = "tool-status-error";
}

/* ---------------- Init ---------------- */

resetUI();