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

const IOS_COMPRESS_LABEL = "Compress & Save Image";
const DEFAULT_COMPRESS_LABEL = "Compress Image";

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
    setStatus(isIOSDevice() ? "Preparing image..." : "Compressing image...");

    const mimeType = getOutputMimeType();
    const quality = Number(qualitySlider.value) / 100;

    const canvas = document.createElement("canvas");
    canvas.width = currentImage.width;
    canvas.height = currentImage.height;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas context unavailable");
    }

    ctx.drawImage(currentImage, 0, 0);

    const blob = await canvasToBlob(
      canvas,
      mimeType,
      mimeType === "image/png" ? undefined : quality
    );

    const filename = makeOutputName(currentFile.name, mimeType);
    saveImageOutput(filename, blob);

    if (isIOSDevice()) {
      setSuccess("Opened image. Press and hold it to save to Photos.");
    } else {
      setSuccess(
        `Done. ${formatBytes(currentFile.size)} → ${formatBytes(blob.size)}`
      );
    }

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
    updatePrimaryActionLabel();
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
  updatePrimaryActionLabel();
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
    if (!ctx) {
      throw new Error("Canvas context unavailable");
    }

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

function saveImageOutput(filename, blob) {
  if (isIOSDevice()) {
    openImagePreviewForIOS(blob, filename);
    return;
  }

  downloadBlob(filename, blob);
}

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = filename;

  document.body.appendChild(a);
  a.click();
  a.remove();

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

function openImagePreviewForIOS(blob, filename) {
  const url = URL.createObjectURL(blob);
  const previewWindow = window.open("", "_blank");

  if (!previewWindow) {
    URL.revokeObjectURL(url);
    throw new Error("Preview window blocked");
  }

  const safeTitle = escapeHtml(filename);

  previewWindow.document.open();
  previewWindow.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <title>${safeTitle}</title>
  <style>
    :root {
      color-scheme: light dark;
    }

    * {
      box-sizing: border-box;
    }

    html, body {
      margin: 0;
      padding: 0;
      background: #000;
      color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    .save-banner {
      position: sticky;
      top: 0;
      z-index: 20;
      padding: calc(12px + env(safe-area-inset-top, 0px)) 16px 12px;
      background: rgba(17, 17, 17, 0.96);
      border-bottom: 1px solid rgba(255, 255, 255, 0.12);
      text-align: center;
      font-size: 14px;
      line-height: 1.4;
    }

    .image-wrap {
      min-height: 100vh;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      background: #000;
    }

    img {
      display: block;
      width: 100%;
      height: auto;
      max-width: 100%;
      -webkit-user-select: none;
      user-select: none;
    }
  </style>
</head>
<body>
  <div class="save-banner">Press and hold the image below to save it to Photos.</div>
  <div class="image-wrap">
    <img src="${url}" alt="${safeTitle}" />
  </div>
</body>
</html>`);
  previewWindow.document.close();

  previewWindow.addEventListener("beforeunload", () => {
    URL.revokeObjectURL(url);
  });
}

function isIOSDevice() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function updatePrimaryActionLabel() {
  compressBtn.textContent = isIOSDevice()
    ? IOS_COMPRESS_LABEL
    : DEFAULT_COMPRESS_LABEL;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return char;
    }
  });
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

updatePrimaryActionLabel();
resetUI();