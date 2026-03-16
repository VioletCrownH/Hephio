import { zipSync } from "/assets/vendor/fflate/fflate.js";

const uploadZone = document.getElementById("uploadZone");
const uploadPrompt = document.getElementById("uploadPrompt");
const uploadText = document.getElementById("uploadText");
const uploadHint = document.getElementById("uploadHint");
const fileInput = document.getElementById("fileInput");

const fileListSection = document.getElementById("fileListSection");
const fileListEl = document.getElementById("fileList");
const fileListSummary = document.getElementById("fileListSummary");
const addMoreBtn = document.getElementById("addMoreBtn");

const actionArea = document.getElementById("actionArea");
const createZipBtn = document.getElementById("createZipBtn");
const clearBtn = document.getElementById("clearBtn");
const statusEl = document.getElementById("status");

let items = [];
let nextId = 1;
let isBusy = false;

/*
  item shape:
  {
    id,
    file,
    name,
    size
  }
*/

/* ---------------- Upload wiring ---------------- */

uploadZone.addEventListener("click", () => {
  if (!isBusy) fileInput.click();
});

uploadZone.addEventListener("keydown", (e) => {
  if (isBusy) return;
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    fileInput.click();
  }
});

uploadZone.addEventListener("dragenter", (e) => {
  e.preventDefault();
  if (!isBusy) uploadZone.classList.add("drag-over");
});

uploadZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  if (!isBusy) uploadZone.classList.add("drag-over");
});

uploadZone.addEventListener("dragleave", () => {
  uploadZone.classList.remove("drag-over");
});

uploadZone.addEventListener("drop", async (e) => {
  e.preventDefault();
  uploadZone.classList.remove("drag-over");
  if (isBusy) return;

  const files = Array.from(e.dataTransfer?.files || []);
  await addFiles(files);
  fileInput.value = "";
});

fileInput.addEventListener("change", async (e) => {
  const files = Array.from(e.target.files || []);
  await addFiles(files);
  fileInput.value = "";
});

addMoreBtn.addEventListener("click", () => {
  if (!isBusy) fileInput.click();
});

/* ---------------- Actions ---------------- */

createZipBtn.addEventListener("click", async () => {
  if (!items.length || isBusy) return;

  try {
    setBusy(true);
    setStatus("Creating ZIP...");

    const zipInput = {};
    const usedNames = new Set();

    for (const item of items) {
      const bytes = new Uint8Array(await item.file.arrayBuffer());
      const safeName = makeUniqueName(sanitizeFileName(item.name), usedNames);
      zipInput[safeName] = bytes;
    }

    const zipped = zipSync(zipInput, { level: 6 });
    const blob = new Blob([zipped], { type: "application/zip" });

    downloadBlob(makeZipName(items), blob);
    setSuccess("Done.");
  } catch (err) {
    console.error(err);
    setError("Something went wrong while creating the ZIP.");
  } finally {
    setBusy(false);
  }
});

clearBtn.addEventListener("click", () => {
  if (!isBusy) resetUI();
});

/* ---------------- File handling ---------------- */

async function addFiles(files) {
  clearStatus();

  if (!files.length) return;

  for (const file of files) {
    items.push({
      id: nextId++,
      file,
      name: file.name || `file-${nextId}`,
      size: file.size || 0
    });
  }

  renderList();
  syncUI();
}

function removeItem(id) {
  const idx = items.findIndex((item) => item.id === id);
  if (idx === -1) return;

  items.splice(idx, 1);
  renderList();
  syncUI();
  clearStatus();
}

/* ---------------- Rendering ---------------- */

function renderList() {
  fileListEl.innerHTML = "";

  items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "tool-zip-item";

    row.innerHTML = `
      <div class="tool-zip-item-main">
        <div class="tool-zip-item-name">${escapeHtml(item.name)}</div>
        <div class="tool-zip-item-meta">${formatBytes(item.size)}</div>
      </div>
      <div class="tool-zip-item-actions">
        <button class="tool-btn-icon" type="button" data-remove="${item.id}" aria-label="Remove file">×</button>
      </div>
    `;

    fileListEl.appendChild(row);
  });

  fileListEl.querySelectorAll("[data-remove]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = Number(btn.dataset.remove);
      removeItem(id);
    });
  });

  const totalSize = items.reduce((sum, item) => sum + item.size, 0);
  const fileLabel = items.length === 1 ? "1 file" : `${items.length.toLocaleString()} files`;
  fileListSummary.textContent = `${fileLabel} • ${formatBytes(totalSize)} total`;
}

/* ---------------- UI state ---------------- */

function syncUI() {
  const hasItems = items.length > 0;

  uploadZone.classList.toggle("has-file", hasItems);
  uploadPrompt.classList.remove("hidden");

  if (hasItems) {
    uploadText.textContent = "Drop more files here";
    uploadHint.textContent = "or click to add more files to the ZIP";
  } else {
    uploadText.textContent = "Drop files here";
    uploadHint.textContent = "or click to choose files to include in a ZIP";
  }

  fileListSection.classList.toggle("hidden", !hasItems);
  actionArea.classList.toggle("hidden", !hasItems);
  createZipBtn.disabled = !hasItems;
}

function setBusy(busy) {
  isBusy = busy;

  createZipBtn.disabled = busy || !items.length;
  clearBtn.disabled = busy;
  addMoreBtn.disabled = busy;
  fileInput.disabled = busy;

  uploadZone.classList.toggle("is-busy", busy);
}

/* ---------------- Helpers ---------------- */

function sanitizeFileName(name) {
  const cleaned = String(name || "file")
    .replace(/[\\/]/g, "-")
    .replace(/\u0000/g, "")
    .trim();

  return cleaned || "file";
}

function makeUniqueName(name, usedNames) {
  if (!usedNames.has(name)) {
    usedNames.add(name);
    return name;
  }

  const dotIndex = name.lastIndexOf(".");
  const hasExt = dotIndex > 0;
  const base = hasExt ? name.slice(0, dotIndex) : name;
  const ext = hasExt ? name.slice(dotIndex) : "";

  let counter = 2;
  let nextName = `${base} (${counter})${ext}`;

  while (usedNames.has(nextName)) {
    counter += 1;
    nextName = `${base} (${counter})${ext}`;
  }

  usedNames.add(nextName);
  return nextName;
}

function makeZipName(files) {
  if (!files.length) return "archive.zip";

  const firstName = files[0].name || "files";
  const base = firstName.replace(/\.[^.]+$/, "");
  return `${base}-files.zip`;
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
  if (mb < 1024) return `${mb.toFixed(2)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
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

/* ---------------- Reset ---------------- */

function resetUI() {
  items = [];
  nextId = 1;

  fileListEl.innerHTML = "";
  fileListSummary.textContent = "0 files";

  clearStatus();
  setBusy(false);
  syncUI();
}

/* ---------------- Init ---------------- */

resetUI();
