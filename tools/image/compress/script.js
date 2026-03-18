const uploadZone = document.getElementById("uploadZone");
const uploadPrompt = document.getElementById("uploadPrompt");
const fileSummary = document.getElementById("fileSummary");
const fileInput = document.getElementById("fileInput");
const chooseDifferent = document.getElementById("chooseDifferent");

const thumb = document.getElementById("thumb");
const fileNameEl = document.getElementById("fileName");
const fileSizeEl = document.getElementById("fileSize");
const fileDimsEl = document.getElementById("fileDims");

const settingsPanel = document.getElementById("settingsPanel");
const formatSelect = document.getElementById("formatSelect");
const qualitySlider = document.getElementById("qualitySlider");
const qualityValue = document.getElementById("qualityValue");
const compressBtn = document.getElementById("compressBtn");
const statusEl = document.getElementById("status");

const estimateBox = document.getElementById("estimateBox");
const estimateValue = document.getElementById("estimateValue");

let currentFile = null;
let currentImage = null;
let currentThumbUrl = null;

/* ---------------- Upload wiring ---------------- */

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

/* ---------------- Controls ---------------- */

qualitySlider.addEventListener("input", () => {
  qualityValue.textContent = `${qualitySlider.value}%`;
  updateEstimate();
  clearStatus();
});

formatSelect.addEventListener("change", () => {
  updateEstimate();
  clearStatus();
});

/* ---------------- Action ---------------- */

compressBtn.addEventListener("click", async () => {
  if (!currentFile || !currentImage) return;

  try {
    setBusy(true);
    setStatus("Compressing image...");

    const mimeType = getOutputMimeType();
    const quality = Number(qualitySlider.value) / 100;

    const canvas = document.createElement("canvas");
    canvas.width = currentImage.width;
    canvas.height = currentImage.height;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(currentImage, 0, 0);

    const blob = await canvasToBlob(
      canvas,
      mimeType,
      mimeType === "image/png" ? undefined : quality
    );

    const filename = makeOutputName(currentFile.name, mimeType);
    downloadBlob(filename, blob);

    setSuccess(
      `Done. ${formatBytes(currentFile.size)} → ${formatBytes(blob.size)}`
    );
    updateEstimate(blob.size);
  } catch (err) {
    console.error(err);
    setError("Something went wrong while compressing this image.");
  } finally {
    setBusy(false);
  }
});

/* ---------------- Core ---------------- */

async function loadFile(file) {
  resetUI();

  if (!file) return;

  if (!["image/jpeg", "image/png"].includes(file.type)) {
    setError("Please upload a JPG or PNG image.");
    return;
  }

  currentFile = file;

  try {
    const img = await fileToImage(file);
    currentImage = img;

    uploadPrompt.classList.add("hidden");
    fileSummary.classList.remove("hidden");
    uploadZone.classList.add("has-file");
    settingsPanel.classList.remove("hidden");

    fileNameEl.textContent = file.name;
    fileSizeEl.textContent = formatBytes(file.size);
    fileDimsEl.textContent = `${img.width} × ${img.height}`;

    currentThumbUrl = URL.createObjectURL(file);
    thumb.src = currentThumbUrl;

    compressBtn.disabled = false;
    updateEstimate();
  } catch (err) {
    console.error(err);
    setError("Something went wrong while reading this image.");
  }
}

function resetUI() {
  currentFile = null;
  currentImage = null;

  uploadPrompt.classList.remove("hidden");
  fileSummary.classList.add("hidden");
  uploadZone.classList.remove("has-file");
  settingsPanel.classList.add("hidden");

  formatSelect.value = "keep";
  qualitySlider.value = "85";
  qualityValue.textContent = "85%";
  compressBtn.disabled = true;

  estimateBox.classList.add("hidden");
  estimateValue.textContent = "—";

  if (currentThumbUrl) {
    URL.revokeObjectURL(currentThumbUrl);
    currentThumbUrl = null;
  }

  thumb.removeAttribute("src");
  clearStatus();
}

function setBusy(busy) {
  compressBtn.disabled = busy || !currentFile;
  formatSelect.disabled = busy;
  qualitySlider.disabled = busy;
}

function getOutputMimeType() {
  if (!currentFile) return "image/jpeg";

  const selected = formatSelect.value;
  if (selected === "jpeg") return "image/jpeg";
  if (selected === "png") return "image/png";
  return currentFile.type === "image/png" ? "image/png" : "image/jpeg";
}

function makeOutputName(originalName, mimeType) {
  const base = originalName.replace(/\.[^.]+$/, "");
  const ext = mimeType === "image/png" ? "png" : "jpg";
  return `${base}-compressed.${ext}`;
}

/* ---------------- Estimate ---------------- */

async function updateEstimate(forcedSize = null) {
  if (!currentFile || !currentImage) return;

  if (forcedSize !== null) {
    estimateBox.classList.remove("hidden");
    estimateValue.textContent = formatBytes(forcedSize);
    return;
  }

  try {
    const mimeType = getOutputMimeType();
    const quality = Number(qualitySlider.value) / 100;

    const canvas = document.createElement("canvas");
    canvas.width = currentImage.width;
    canvas.height = currentImage.height;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(currentImage, 0, 0);

    const blob = await canvasToBlob(
      canvas,
      mimeType,
      mimeType === "image/png" ? undefined : quality
    );

    estimateBox.classList.remove("hidden");
    estimateValue.textContent = formatBytes(blob.size);
  } catch {
    estimateBox.classList.add("hidden");
    estimateValue.textContent = "—";
  }
}

/* ---------------- Helpers ---------------- */

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

/* ---------------- Status ---------------- */

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