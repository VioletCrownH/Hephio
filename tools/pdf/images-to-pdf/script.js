const uploadZone = document.getElementById("uploadZone");
const uploadPrompt = document.getElementById("uploadPrompt");
const uploadText = document.getElementById("uploadText");
const uploadHint = document.getElementById("uploadHint");
const fileInput = document.getElementById("fileInput");

const fileListSection = document.getElementById("fileListSection");
const fileListEl = document.getElementById("fileList");
const fileListSummary = document.getElementById("fileListSummary");
const addMoreBtn = document.getElementById("addMoreBtn");

const settingsPanel = document.getElementById("settingsPanel");
const pageSizeSelect = document.getElementById("pageSizeSelect");
const imageFitSelect = document.getElementById("imageFitSelect");
const marginCheckbox = document.getElementById("marginCheckbox");
const convertBtn = document.getElementById("convertBtn");
const statusEl = document.getElementById("status");

const { PDFDocument } = window.PDFLib || {};

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

let items = [];
let nextId = 1;

/* Upload wiring */

uploadZone.addEventListener("click", () => fileInput.click());

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

  const files = Array.from(e.dataTransfer?.files || []);
  await addFiles(files);
  fileInput.value = "";
});

fileInput.addEventListener("change", async (e) => {
  const files = Array.from(e.target.files || []);
  await addFiles(files);
  fileInput.value = "";
});

addMoreBtn.addEventListener("click", () => fileInput.click());

/* Settings controls */

pageSizeSelect.addEventListener("change", clearStatus);
imageFitSelect.addEventListener("change", clearStatus);
marginCheckbox.addEventListener("change", clearStatus);

/* Convert */

convertBtn.addEventListener("click", async () => {
  if (!items.length) return;

  setStatus("Creating PDF...");
  setBusy(true);

  try {
    const pdfBytes = await buildPdfFromImages(items, {
      pageSize: pageSizeSelect.value,
      fitMode: imageFitSelect.value,
      addMargin: marginCheckbox.checked
    });

    const outName = makeOutputName(items);
    downloadBytes(outName, pdfBytes, "application/pdf");

    setSuccess("Done.");
  } catch (err) {
    console.error(err);
    setError("Something went wrong while creating this PDF.");
  } finally {
    setBusy(false);
  }
});

/* File handling */

async function addFiles(files) {
  clearStatus();

  if (!files.length) return;

  const validFiles = files.filter((file) => ACCEPTED_TYPES.includes(file.type));

  if (!validFiles.length) {
    setError("Please upload JPG, PNG, or WebP images.");
    return;
  }

  if (validFiles.length !== files.length) {
    setStatus("Some files were skipped because they were not JPG, PNG, or WebP images.");
  }

  try {
    for (const file of validFiles) {
      const item = await createImageItem(file);
      items.push(item);
    }

    renderList();
    syncUI();
  } catch (err) {
    console.error(err);
    setError("Something went wrong while reading one of the images.");
  }
}

async function createImageItem(file) {
  const dims = await getImageDimensions(file);
  const thumbUrl = URL.createObjectURL(file);

  return {
    id: nextId++,
    file,
    width: dims.width,
    height: dims.height,
    thumbUrl
  };
}

function removeItem(id) {
  const idx = items.findIndex((item) => item.id === id);
  if (idx === -1) return;

  URL.revokeObjectURL(items[idx].thumbUrl);
  items.splice(idx, 1);

  renderList();
  syncUI();
  clearStatus();
}

function moveItemUp(id) {
  const idx = items.findIndex((item) => item.id === id);
  if (idx <= 0) return;

  [items[idx - 1], items[idx]] = [items[idx], items[idx - 1]];
  renderList();
  clearStatus();
}

function moveItemDown(id) {
  const idx = items.findIndex((item) => item.id === id);
  if (idx === -1 || idx >= items.length - 1) return;

  [items[idx], items[idx + 1]] = [items[idx + 1], items[idx]];
  renderList();
  clearStatus();
}

/* Rendering */

function renderList() {
  fileListEl.innerHTML = "";

  items.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "image-pdf-item";

    row.innerHTML = `
      <div class="image-pdf-item-left">
        <div class="image-pdf-thumb-wrap">
          <img class="image-pdf-thumb" src="${item.thumbUrl}" alt="" />
        </div>

        <div class="image-pdf-item-info">
          <div class="image-pdf-item-name">${escapeHtml(item.file.name)}</div>
          <div class="image-pdf-item-meta">
            ${formatBytes(item.file.size)} · ${item.width} × ${item.height}
          </div>
        </div>
      </div>

      <div class="image-pdf-item-controls">
        <button class="tool-btn-icon" type="button" data-action="up" data-id="${item.id}" aria-label="Move up" ${index === 0 ? "disabled" : ""}>↑</button>
        <button class="tool-btn-icon" type="button" data-action="down" data-id="${item.id}" aria-label="Move down" ${index === items.length - 1 ? "disabled" : ""}>↓</button>
        <button class="tool-btn-icon" type="button" data-action="remove" data-id="${item.id}" aria-label="Remove image">×</button>
      </div>
    `;

    fileListEl.appendChild(row);
  });

  fileListEl.querySelectorAll("[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = Number(btn.dataset.id);
      const action = btn.dataset.action;

      if (action === "up") moveItemUp(id);
      if (action === "down") moveItemDown(id);
      if (action === "remove") removeItem(id);
    });
  });

  fileListSummary.textContent =
    items.length === 1 ? "1 image" : `${items.length} images`;
}

/* PDF building */

async function buildPdfFromImages(imageItems, options) {
  if (!PDFDocument) {
    throw new Error("pdf-lib not available on window.PDFLib");
  }

  const pdfDoc = await PDFDocument.create();

  for (const item of imageItems) {
    const bytes = await item.file.arrayBuffer();

    let embeddedImage;
    let imgWidth;
    let imgHeight;

    if (item.file.type === "image/jpeg") {
      embeddedImage = await pdfDoc.embedJpg(bytes);
    } else {
      const pngBytes = await ensurePngBytes(item.file);
      embeddedImage = await pdfDoc.embedPng(pngBytes);
    }

    imgWidth = embeddedImage.width;
    imgHeight = embeddedImage.height;

    const pageSpec = getPageSpec(options.pageSize, imgWidth, imgHeight);
    const page = pdfDoc.addPage([pageSpec.width, pageSpec.height]);

    const margin = options.addMargin ? 20 : 0;
    const area = {
      x: margin,
      y: margin,
      width: Math.max(1, pageSpec.width - margin * 2),
      height: Math.max(1, pageSpec.height - margin * 2)
    };

    const placement =
      options.fitMode === "cover"
        ? getCoverPlacement(imgWidth, imgHeight, area)
        : getContainPlacement(imgWidth, imgHeight, area);

    page.drawImage(embeddedImage, placement);
  }

  return await pdfDoc.save();
}

/* Placement helpers */

function getPageSpec(pageSizeValue, imgWidth, imgHeight) {
  switch (pageSizeValue) {
    case "letter-portrait":
      return { width: 612, height: 792 };
    case "letter-landscape":
      return { width: 792, height: 612 };
    case "a4-portrait":
      return { width: 595.28, height: 841.89 };
    case "a4-landscape":
      return { width: 841.89, height: 595.28 };
    case "fit":
    default:
      return { width: imgWidth, height: imgHeight };
  }
}

function getContainPlacement(imgWidth, imgHeight, area) {
  const scale = Math.min(area.width / imgWidth, area.height / imgHeight);
  const width = imgWidth * scale;
  const height = imgHeight * scale;

  return {
    x: area.x + (area.width - width) / 2,
    y: area.y + (area.height - height) / 2,
    width,
    height
  };
}

function getCoverPlacement(imgWidth, imgHeight, area) {
  const scale = Math.max(area.width / imgWidth, area.height / imgHeight);
  const width = imgWidth * scale;
  const height = imgHeight * scale;

  return {
    x: area.x + (area.width - width) / 2,
    y: area.y + (area.height - height) / 2,
    width,
    height
  };
}

/* Image helpers */

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

async function ensurePngBytes(file) {
  if (file.type === "image/png") {
    return await file.arrayBuffer();
  }

  const img = await fileToImage(file);
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;

  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);

  const blob = await canvasToBlob(canvas, "image/png");
  return await blob.arrayBuffer();
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) reject(new Error("toBlob returned null"));
      else resolve(blob);
    }, type, quality);
  });
}

/* UI state */

function syncUI() {
  const hasItems = items.length > 0;

  uploadZone.classList.toggle("has-file", hasItems);
  uploadPrompt.classList.remove("hidden");

  if (hasItems) {
    uploadText.textContent = "Drop more images here";
    uploadHint.textContent = "or click to add more JPG, PNG, or WebP files";
  } else {
    uploadText.textContent = "Drop images here";
    uploadHint.textContent = "or click to choose JPG, PNG, or WebP files";
  }

  fileListSection.classList.toggle("hidden", !hasItems);
  settingsPanel.classList.toggle("hidden", !hasItems);
  convertBtn.disabled = !hasItems;
}

function setBusy(isBusy) {
  convertBtn.disabled = isBusy || !items.length;
  pageSizeSelect.disabled = isBusy;
  imageFitSelect.disabled = isBusy;
  marginCheckbox.disabled = isBusy;
  addMoreBtn.disabled = isBusy;
  uploadZone.classList.toggle("is-busy", isBusy);
}

/* Naming */

function makeOutputName(imageItems) {
  const firstName = imageItems[0]?.file?.name || "images";
  const base = firstName.replace(/\.[^.]+$/, "");
  return `${base}-images-to-pdf.pdf`;
}

/* Download */

function downloadBytes(filename, bytes, mimeType) {
  const blob = new Blob([bytes], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;

  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

/* Helpers */

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/* Status UI */

function clearStatus() {
  statusEl.innerHTML = "";
  statusEl.className = "tool-status-message";
}

function setStatus(msg) {
  statusEl.textContent = msg;
  statusEl.className = "tool-status-message";
}

function setSuccess(msg) {
  statusEl.textContent = msg;
  statusEl.className = "tool-status-message";
}

function setError(msg) {
  statusEl.textContent = msg;
  statusEl.className = "tool-status-message error";
}

/* Cleanup */

window.addEventListener("beforeunload", () => {
  items.forEach((item) => {
    try {
      URL.revokeObjectURL(item.thumbUrl);
    } catch {
      // ignore
    }
  });
});

/* Init */

syncUI();
