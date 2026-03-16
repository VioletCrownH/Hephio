import { zipSync } from "/assets/vendor/fflate/fflate.js";

const uploadZone = document.getElementById("uploadZone");
const uploadPrompt = document.getElementById("uploadPrompt");
const fileSummary = document.getElementById("fileSummary");
const fileInput = document.getElementById("fileInput");

const addFilesBtn = document.getElementById("addFilesBtn");
const replaceFilesBtn = document.getElementById("replaceFilesBtn");

const summaryTitle = document.getElementById("summaryTitle");
const summarySize = document.getElementById("summarySize");

const workspace = document.getElementById("workspace");

const prefixInput = document.getElementById("prefixInput");
const suffixInput = document.getElementById("suffixInput");
const replaceFromInput = document.getElementById("replaceFromInput");
const replaceToInput = document.getElementById("replaceToInput");

const numberingEnabled = document.getElementById("numberingEnabled");
const numberFormatSelect = document.getElementById("numberFormatSelect");
const startNumberInput = document.getElementById("startNumberInput");

const previewMeta = document.getElementById("previewMeta");
const previewList = document.getElementById("previewList");
const conflictNote = document.getElementById("conflictNote");

const downloadBtn = document.getElementById("downloadBtn");
const clearBtn = document.getElementById("clearBtn");
const statusEl = document.getElementById("status");

let files = [];
let previewItems = [];
let pickerMode = "replace";

/* ---------------- Upload zone ---------------- */

uploadZone.addEventListener("click", () => {
  pickerMode = files.length ? "add" : "replace";
  fileInput.value = "";
  fileInput.click();
});

uploadZone.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    pickerMode = files.length ? "add" : "replace";
    fileInput.value = "";
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

uploadZone.addEventListener("drop", (e) => {
  e.preventDefault();
  uploadZone.classList.remove("drag-over");

  const dropped = Array.from(e.dataTransfer?.files ?? []);
  loadFiles(dropped, { append: files.length > 0 });
  fileInput.value = "";
});

fileInput.addEventListener("change", (e) => {
  const selected = Array.from(e.target.files ?? []);
  loadFiles(selected, { append: pickerMode === "add" });
  fileInput.value = "";
});

addFilesBtn?.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();
  pickerMode = "add";
  fileInput.value = "";
  fileInput.click();
});

replaceFilesBtn?.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();
  pickerMode = "replace";
  fileInput.value = "";
  fileInput.click();
});

/* ---------------- Rule inputs ---------------- */

[
  prefixInput,
  suffixInput,
  replaceFromInput,
  replaceToInput,
  numberFormatSelect,
  startNumberInput,
  numberingEnabled
].forEach((el) => {
  el.addEventListener("input", handleRulesChanged);
  el.addEventListener("change", handleRulesChanged);
});

/* ---------------- Actions ---------------- */

downloadBtn.addEventListener("click", async () => {
  clearStatus();

  if (!files.length || !previewItems.length) {
    setError("Add files before downloading.");
    return;
  }

  const mode = getDownloadMode();

  try {
    downloadBtn.disabled = true;

    if (mode === "zip") {
      setStatus("Preparing ZIP...");
      await downloadAsZip();
      setSuccess("ZIP download ready.");
    } else {
      setStatus("Starting individual downloads...");
      await downloadIndividually();
      setSuccess("Downloads started.");
    }
  } catch (err) {
    console.error(err);
    setError("Something went wrong while preparing the renamed files.");
  } finally {
    downloadBtn.disabled = false;
  }
});

clearBtn.addEventListener("click", () => {
  resetUI();
});

/* ---------------- Core ---------------- */

function loadFiles(incomingFiles, { append = false } = {}) {
  clearStatus();

  if (!incomingFiles.length) return;

  if (append) {
    files = mergeFiles(files, incomingFiles);
  } else {
    files = [...incomingFiles];
  }

  uploadPrompt.classList.add("hidden");
  fileSummary.classList.remove("hidden");
  uploadZone.classList.add("has-file");
  workspace.classList.remove("hidden");

  updateSummary();
  updatePreview();
}

function mergeFiles(existingFiles, incomingFiles) {
  const merged = [...existingFiles];
  const seen = new Set(existingFiles.map(fileKey));

  incomingFiles.forEach((file) => {
    const key = fileKey(file);
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(file);
    }
  });

  return merged;
}

function fileKey(file) {
  return `${file.name}__${file.size}__${file.lastModified}`;
}

function handleRulesChanged() {
  clearStatus();
  updatePreview();
}

function updateSummary() {
  summaryTitle.textContent = `${files.length} file${files.length === 1 ? "" : "s"} selected`;
  summarySize.textContent = formatBytes(
    files.reduce((sum, file) => sum + file.size, 0)
  );
}

function updatePreview() {
  previewItems = [];

  if (!files.length) {
    renderPreview();
    return;
  }

  const rules = getRules();
  const usedNames = new Map();
  let hadConflicts = false;

  files.forEach((file, index) => {
    const nextName = buildRenamedFilename(file.name, index, rules);
    const uniqueName = ensureUniqueName(nextName, usedNames);

    if (uniqueName !== nextName) {
      hadConflicts = true;
    }

    previewItems.push({
      file,
      originalName: file.name,
      newName: uniqueName
    });
  });

  renderPreview(hadConflicts);
}

function getRules() {
  const startAt = Math.max(1, parseInt(startNumberInput.value || "1", 10) || 1);

  return {
    prefix: prefixInput.value,
    suffix: suffixInput.value,
    replaceFrom: replaceFromInput.value,
    replaceTo: replaceToInput.value,
    numberingEnabled: numberingEnabled.checked,
    numberDigits: Number(numberFormatSelect.value),
    startAt
  };
}

function buildRenamedFilename(originalName, index, rules) {
  const { base, ext } = splitFilename(originalName);

  let nextBase = base;

  if (rules.replaceFrom) {
    nextBase = nextBase.split(rules.replaceFrom).join(rules.replaceTo);
  }

  nextBase = `${rules.prefix}${nextBase}${rules.suffix}`;

  if (rules.numberingEnabled) {
    const number = String(rules.startAt + index).padStart(rules.numberDigits, "0");
    nextBase = `${nextBase}-${number}`;
  }

  nextBase = sanitizeFilenamePart(nextBase.trim());

  if (!nextBase) {
    nextBase = rules.numberingEnabled
      ? `file-${String(rules.startAt + index).padStart(rules.numberDigits, "0")}`
      : "file";
  }

  return `${nextBase}${ext}`;
}

function ensureUniqueName(filename, usedNames) {
  const lower = filename.toLowerCase();

  if (!usedNames.has(lower)) {
    usedNames.set(lower, 1);
    return filename;
  }

  const { base, ext } = splitFilename(filename);
  let counter = 2;
  let candidate = `${base}-${counter}${ext}`;

  while (usedNames.has(candidate.toLowerCase())) {
    counter += 1;
    candidate = `${base}-${counter}${ext}`;
  }

  usedNames.set(candidate.toLowerCase(), 1);
  return candidate;
}

function splitFilename(filename) {
  const lastDot = filename.lastIndexOf(".");

  if (lastDot <= 0) {
    return { base: filename, ext: "" };
  }

  return {
    base: filename.slice(0, lastDot),
    ext: filename.slice(lastDot)
  };
}

function sanitizeFilenamePart(value) {
  return value
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function renderPreview(hadConflicts = false) {
  previewList.innerHTML = "";
  previewMeta.textContent = `${previewItems.length} file${previewItems.length === 1 ? "" : "s"}`;
  conflictNote.classList.toggle("hidden", !hadConflicts);

  if (!previewItems.length) return;

  previewItems.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "tool-batch-preview-row";

    const original = document.createElement("div");
    original.className = "tool-batch-preview-original";
    original.textContent = item.originalName;

    const arrow = document.createElement("div");
    arrow.className = "tool-batch-preview-arrow";
    arrow.textContent = "→";

    const renamed = document.createElement("div");
    renamed.className = "tool-batch-preview-renamed";
    renamed.textContent = item.newName;

    const actions = document.createElement("div");
    actions.className = "tool-batch-preview-actions";

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "tool-btn-icon tool-batch-remove-btn";
    removeBtn.setAttribute("aria-label", `Remove ${item.originalName}`);
    removeBtn.title = "Remove file";
    removeBtn.textContent = "×";
    removeBtn.addEventListener("click", () => {
      removeFileAt(index);
    });

    actions.appendChild(removeBtn);

    row.appendChild(original);
    row.appendChild(arrow);
    row.appendChild(renamed);
    row.appendChild(actions);

    previewList.appendChild(row);
  });
}

function removeFileAt(index) {
  files.splice(index, 1);

  if (!files.length) {
    resetUI();
    return;
  }

  updateSummary();
  updatePreview();
  clearStatus();
}

function getDownloadMode() {
  const checked = document.querySelector('input[name="downloadMode"]:checked');
  return checked ? checked.value : "zip";
}

/* ---------------- Downloads ---------------- */

async function downloadAsZip() {
  const zipEntries = {};

  for (const item of previewItems) {
    const bytes = new Uint8Array(await item.file.arrayBuffer());
    zipEntries[item.newName] = bytes;
  }

  const zipped = zipSync(zipEntries, { level: 6 });
  const blob = new Blob([zipped], { type: "application/zip" });

  downloadBlob(makeZipName(), blob);
}

async function downloadIndividually() {
  for (const item of previewItems) {
    const blob = item.file.slice(
      0,
      item.file.size,
      item.file.type || "application/octet-stream"
    );

    downloadBlob(item.newName, blob);
    await delay(100);
  }
}

function makeZipName() {
  return `batch-renamed-${previewItems.length}.zip`;
}

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = filename;
  a.style.display = "none";

  document.body.appendChild(a);
  a.click();
  a.remove();

  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* ---------------- UI ---------------- */

function resetUI(clearFiles = true) {
  if (clearFiles) {
    files = [];
    previewItems = [];
    fileInput.value = "";

    prefixInput.value = "";
    suffixInput.value = "";
    replaceFromInput.value = "";
    replaceToInput.value = "";
    numberingEnabled.checked = true;
    numberFormatSelect.value = "3";
    startNumberInput.value = "1";

    const zipRadio = document.querySelector('input[name="downloadMode"][value="zip"]');
    if (zipRadio) {
      zipRadio.checked = true;
    }
  }

  if (!files.length) {
    uploadPrompt.classList.remove("hidden");
    fileSummary.classList.add("hidden");
    uploadZone.classList.remove("has-file");
    workspace.classList.add("hidden");
    previewList.innerHTML = "";
    previewMeta.textContent = "0 files";
    conflictNote.classList.add("hidden");
    summaryTitle.textContent = "0 files selected";
    summarySize.textContent = "—";
  }

  clearStatus();
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;

  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;

  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(2)} MB`;

  const gb = mb / 1024;
  return `${gb.toFixed(2)} GB`;
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