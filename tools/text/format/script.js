// Hephio - JSON Formatter & Validator
// Output updates on button click. Output textarea is read-only.

const uploadZone = document.getElementById("uploadZone");
const fileInput = document.getElementById("fileInput");
const uploadPrompt = document.getElementById("uploadPrompt");
const filePreview = document.getElementById("filePreview");
const fileNameEl = document.getElementById("fileName");
const fileSizeEl = document.getElementById("fileSize");
const charCountEl = document.getElementById("charCount");
const chooseDifferent = document.getElementById("chooseDifferent");

const inputJson = document.getElementById("inputJson");
const outputJson = document.getElementById("outputJson");
const metaInput = document.getElementById("metaInput");
const metaOutput = document.getElementById("metaOutput");
const statusEl = document.getElementById("status");

const btnFormat = document.getElementById("btnFormat");
const btnMinify = document.getElementById("btnMinify");
const btnValidate = document.getElementById("btnValidate");
const btnClear = document.getElementById("btnClear");

const btnCopyOutput = document.getElementById("btnCopyOutput");
const btnDownload = document.getElementById("btnDownload");
const btnReset = document.getElementById("btnReset");

let currentFileBase = "hephio-json";

function setStatus(msg, kind = "") {
  statusEl.textContent = msg || "";
  statusEl.classList.remove("error");
  if (kind === "error") statusEl.classList.add("error");
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let idx = 0;
  let n = bytes;
  while (n >= 1024 && idx < units.length - 1) {
    n /= 1024;
    idx++;
  }
  const value = idx === 0 ? String(Math.round(n)) : n.toFixed(1).replace(/\.0$/, "");
  return `${value} ${units[idx]}`;
}

function sanitizeBaseName(name) {
  const base = (name || "hephio-json").replace(/\.[^.]+$/, "").trim().slice(0, 60);
  return base || "hephio-json";
}

function updateCounts() {
  metaInput.textContent = `${inputJson.value.length.toLocaleString()} chars`;
  metaOutput.textContent = `${outputJson.value.length.toLocaleString()} chars`;

  if (uploadZone.classList.contains("has-file")) {
    charCountEl.textContent = inputJson.value.length.toLocaleString();
  }
}

function resetFileUI() {
  uploadZone.classList.remove("has-file");
  filePreview.classList.add("hidden");
  uploadPrompt.classList.remove("hidden");
  fileNameEl.textContent = "filename.json";
  fileSizeEl.textContent = "—";
  charCountEl.textContent = "—";
  currentFileBase = "hephio-json";
  fileInput.value = "";
}

function resetAll() {
  inputJson.value = "";
  outputJson.value = "";
  resetFileUI();
  updateCounts();
  setStatus("");
}

function computeLineColFromPosition(text, pos) {
  // pos is 0-based character index
  const before = text.slice(0, Math.max(0, pos));
  const lines = before.split(/\r?\n/);
  const line = lines.length;
  const col = lines[lines.length - 1].length + 1;
  return { line, col };
}

function parseJsonOrThrow(text) {
  // Trim for parsing; keep original for error context
  const trimmed = text.trim();
  if (!trimmed) {
    const err = new Error("Empty input");
    err.isEmpty = true;
    throw err;
  }
  return JSON.parse(trimmed);
}

function formatJson() {
  const src = inputJson.value || "";
  try {
    const obj = parseJsonOrThrow(src);
    outputJson.value = JSON.stringify(obj, null, 2);
    updateCounts();
    setStatus("Formatted JSON successfully.", "");
  } catch (err) {
    handleJsonError(err, src);
  }
}

function minifyJson() {
  const src = inputJson.value || "";
  try {
    const obj = parseJsonOrThrow(src);
    outputJson.value = JSON.stringify(obj);
    updateCounts();
    setStatus("Minified JSON successfully.", "");
  } catch (err) {
    handleJsonError(err, src);
  }
}

function validateJson() {
  const src = inputJson.value || "";
  try {
    parseJsonOrThrow(src);
    setStatus("✓ Valid JSON", "");
  } catch (err) {
    handleJsonError(err, src);
  }
}

function clearAll() {
  inputJson.value = "";
  outputJson.value = "";
  updateCounts();
  setStatus("");
}

function handleJsonError(err, srcText) {
  if (err?.isEmpty) {
    outputJson.value = "";
    updateCounts();
    setStatus("Paste or upload JSON to format/validate.", "error");
    return;
  }

  // Try to extract position from error message: "Unexpected token ... in JSON at position 123"
  const msg = String(err?.message || "Invalid JSON");
  const m = msg.match(/position\s+(\d+)/i);
  if (m) {
    const pos = Number(m[1]);
    const { line, col } = computeLineColFromPosition(srcText, pos);
    setStatus(`Invalid JSON — ${msg} (line ${line}, col ${col})`, "error");
  } else {
    setStatus(`Invalid JSON — ${msg}`, "error");
  }

  // Don't overwrite output; keep last good output for reference
  updateCounts();
}

async function loadJsonFile(file) {
  if (!file) return;

  const isAccepted =
    file.type === "application/json" ||
    file.type === "text/plain" ||
    file.name.toLowerCase().endsWith(".json") ||
    file.name.toLowerCase().endsWith(".txt");

  if (!isAccepted) {
    setStatus("Please upload a .json or .txt file.", "error");
    return;
  }

  const text = await file.text();
  inputJson.value = text;
  outputJson.value = text;

  uploadZone.classList.add("has-file");
  uploadPrompt.classList.add("hidden");
  filePreview.classList.remove("hidden");

  fileNameEl.textContent = file.name;
  fileSizeEl.textContent = formatBytes(file.size);
  charCountEl.textContent = text.length.toLocaleString();

  currentFileBase = sanitizeBaseName(file.name);

  updateCounts();
  setStatus("File loaded. Choose Format / Minify / Validate.", "");
}

function preventDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}

/* ---------------------------
   Copy / download
---------------------------- */
async function copyOutput() {
  const text = outputJson.value || "";
  if (!text) {
    setStatus("Nothing to copy yet. Click Format or Minify first.", "error");
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    setStatus("Copied output to clipboard.", "");
  } catch {
    outputJson.focus();
    outputJson.select();
    const ok = document.execCommand("copy");
    setStatus(ok ? "Copied output to clipboard." : "Copy failed. Manually select and copy.", ok ? "" : "error");
  }
}

function downloadOutput() {
  const text = outputJson.value || "";
  if (!text) {
    setStatus("Nothing to download yet. Click Format or Minify first.", "error");
    return;
  }

  const filename = `${currentFileBase}.json`;
  const blob = new Blob([text], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
  setStatus(`Downloaded ${filename}`, "");
}

/* ---------------------------
   Events
---------------------------- */
uploadZone.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", async (e) => {
  const file = e.target.files?.[0] || null;
  if (file) await loadJsonFile(file);
});

chooseDifferent?.addEventListener("click", (e) => {
  e.preventDefault();
  resetFileUI();
  setStatus("Choose a different file or paste JSON.", "");
  updateCounts();
});

// Drag/drop
["dragenter", "dragover", "dragleave", "drop"].forEach((evt) =>
  uploadZone.addEventListener(evt, preventDefaults)
);

uploadZone.addEventListener("dragover", () => uploadZone.classList.add("drag-over"));
uploadZone.addEventListener("dragleave", () => uploadZone.classList.remove("drag-over"));
uploadZone.addEventListener("drop", async (e) => {
  uploadZone.classList.remove("drag-over");
  const file = e.dataTransfer?.files?.[0] || null;
  if (file) await loadJsonFile(file);
});

// Update counts live for input changes (output updates on button click)
inputJson.addEventListener("input", () => {
  updateCounts();
});

// Buttons
btnFormat.addEventListener("click", formatJson);
btnMinify.addEventListener("click", minifyJson);
btnValidate.addEventListener("click", validateJson);
btnClear.addEventListener("click", clearAll);

btnCopyOutput.addEventListener("click", copyOutput);
btnDownload.addEventListener("click", downloadOutput);
btnReset.addEventListener("click", resetAll);

// Init
resetAll();
