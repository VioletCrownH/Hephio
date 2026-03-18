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
  if (e.target !== chooseDifferent) fileInput.click();
});

uploadZone.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    fileInput.click();
  }
});

uploadZone.addEventListener("drop", async (e) => {
  e.preventDefault();
  const file = e.dataTransfer?.files?.[0] ?? null;
  await loadFile(file);
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

/* ---------------- Action ---------------- */

compressBtn.addEventListener("click", async () => {
  if (!currentFile || !currentImage) return;

  const isIOS = isIOSDevice();
  let previewWindow = null;

  try {
    // OPEN WINDOW IMMEDIATELY (critical for iPhone)
    if (isIOS) {
      previewWindow = window.open("", "_blank");
      if (!previewWindow) throw new Error("Popup blocked");

      previewWindow.document.write(`
        <html>
          <body style="background:#000;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;">
            Preparing image...
          </body>
        </html>
      `);
    }

    setBusy(true);

    const canvas = document.createElement("canvas");
    canvas.width = currentImage.width;
    canvas.height = currentImage.height;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(currentImage, 0, 0);

    const blob = await canvasToBlob(
      canvas,
      getOutputMimeType(),
      Number(qualitySlider.value) / 100
    );

    const filename = makeOutputName(currentFile.name, getOutputMimeType());

    if (isIOS) {
      showImagePreview(previewWindow, blob, filename);
    } else {
      downloadBlob(filename, blob);
    }

    setSuccess("Done.");
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

  currentFile = file;
  currentImage = await fileToImage(file);

  uploadPrompt.classList.add("hidden");
  fileSummary.classList.remove("hidden");
  settingsPanel.classList.remove("hidden");

  fileNameEl.textContent = file.name;
  fileSizeEl.textContent = formatBytes(file.size);
  fileDimsEl.textContent = `${currentImage.width} × ${currentImage.height}`;

  currentThumbUrl = URL.createObjectURL(file);
  thumb.src = currentThumbUrl;

  compressBtn.disabled = false;
}

/* ---------------- Helpers ---------------- */

function isIOSDevice() {
  return /iPhone|iPad|iPod/.test(navigator.userAgent);
}

function showImagePreview(win, blob, filename) {
  const url = URL.createObjectURL(blob);

  win.document.open();
  win.document.write(`
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
        <style>
          body { margin:0; background:#000; color:#fff; font-family:sans-serif; }
          .banner { padding:12px; text-align:center; background:#111; }
          img { width:100%; }
        </style>
      </head>
      <body>
        <div class="banner">Press and hold the image to save</div>
        <img src="${url}" />
      </body>
    </html>
  `);
}

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
}

function fileToImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };

    img.onerror = reject;
    img.src = url;
  });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, type, quality);
  });
}

function getOutputMimeType() {
  return currentFile.type === "image/png" ? "image/png" : "image/jpeg";
}

function makeOutputName(name) {
  return name.replace(/\.[^.]+$/, "") + "-compressed.jpg";
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1024 / 1024).toFixed(2) + " MB";
}

/* ---------------- UI ---------------- */

function setBusy(b) {
  compressBtn.disabled = b;
}

function setSuccess(msg) {
  statusEl.textContent = msg;
}

function setError(msg) {
  statusEl.textContent = msg;
}

function clearStatus() {
  statusEl.textContent = "";
}

function resetUI() {
  compressBtn.disabled = true;
  clearStatus();
}