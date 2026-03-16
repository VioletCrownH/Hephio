// Hephio - Sort Lines
// Sort types: alphabetical, numeric (lines starting with numbers), length
// Options: case-insensitive (default ON), remove duplicates (default OFF),
// ignore empty lines (default ON), trim whitespace (default ON)
// Order: asc/desc

const uploadZone = document.getElementById("uploadZone");
const fileInput = document.getElementById("fileInput");
const uploadPrompt = document.getElementById("uploadPrompt");
const filePreview = document.getElementById("filePreview");
const fileNameEl = document.getElementById("fileName");
const fileSizeEl = document.getElementById("fileSize");
const charCountEl = document.getElementById("charCount");
const chooseDifferent = document.getElementById("chooseDifferent");

const inputText = document.getElementById("inputText");
const outputText = document.getElementById("outputText");
const metaInput = document.getElementById("metaInput");
const metaOutput = document.getElementById("metaOutput");
const statusEl = document.getElementById("status");

const optCaseInsensitive = document.getElementById("optCaseInsensitive");
const optRemoveDupes = document.getElementById("optRemoveDupes");
const optIgnoreEmpty = document.getElementById("optIgnoreEmpty");
const optTrim = document.getElementById("optTrim");

const btnSort = document.getElementById("btnSort");
const btnCopy = document.getElementById("btnCopy");
const btnDownload = document.getElementById("btnDownload");
const btnClear = document.getElementById("btnClear");

let currentFileBase = "hephio-text";

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
  const base = (name || "hephio-text").replace(/\.[^.]+$/, "").trim().slice(0, 60);
  return base || "hephio-text";
}

function resetFileUI() {
  uploadZone.classList.remove("has-file");
  filePreview.classList.add("hidden");
  uploadPrompt.classList.remove("hidden");
  fileNameEl.textContent = "filename.txt";
  fileSizeEl.textContent = "—";
  charCountEl.textContent = "—";
  currentFileBase = "hephio-text";
  fileInput.value = "";
}

function normalizeLineEndings(s) {
  return (s || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function getSortType() {
  return document.querySelector('input[name="sortType"]:checked')?.value || "alpha";
}

function getSortOrder() {
  return document.querySelector('input[name="sortOrder"]:checked')?.value || "asc";
}

function getLinesFromInput() {
  const raw = normalizeLineEndings(inputText.value || "");
  let lines = raw.split("\n");

  if (optTrim.checked) lines = lines.map(l => l.trim());

  if (optIgnoreEmpty.checked) lines = lines.filter(l => l.length > 0);

  return lines;
}

function dedupe(lines) {
  if (!optRemoveDupes.checked) return lines;

  const seen = new Set();
  const out = [];
  for (const l of lines) {
    const key = optCaseInsensitive.checked ? l.toLowerCase() : l;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(l);
  }
  return out;
}

function alphaCompare(a, b) {
  if (optCaseInsensitive.checked) {
    return a.localeCompare(b, undefined, { sensitivity: "base" });
  }
  return a.localeCompare(b);
}

function lengthCompare(a, b) {
  // stable-ish: if equal length, fall back to alpha
  const d = a.length - b.length;
  return d !== 0 ? d : alphaCompare(a, b);
}

function parseLeadingNumber(line) {
  // Accept leading +/- and digits with optional commas/decimals
  // Examples: "10 apples", "-3.5lbs", "1,234 items"
  const m = line.match(/^\s*([-+]?\d{1,3}(?:,\d{3})*(?:\.\d+)?)/);
  if (!m) return null;
  const num = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(num) ? num : null;
}

function numericCompare(a, b) {
  // Only lines that BEGIN with numbers should be compared numerically.
  // Non-numeric-leading lines are pushed to the end and sorted alphabetically among themselves.
  const an = parseLeadingNumber(a);
  const bn = parseLeadingNumber(b);

  const aHas = an !== null;
  const bHas = bn !== null;

  if (aHas && bHas) {
    const d = an - bn;
    return d !== 0 ? d : alphaCompare(a, b);
  }
  if (aHas && !bHas) return -1;
  if (!aHas && bHas) return 1;

  // neither starts with a number
  return alphaCompare(a, b);
}

function sortLines(lines) {
  const type = getSortType();
  const order = getSortOrder();

  let sorted = [...lines];

  if (type === "alpha") sorted.sort(alphaCompare);
  else if (type === "length") sorted.sort(lengthCompare);
  else if (type === "numeric") sorted.sort(numericCompare);
  else sorted.sort(alphaCompare);

  if (order === "desc") sorted.reverse();

  return sorted;
}

function updateMeta() {
  const lines = normalizeLineEndings(inputText.value || "").split("\n");
  const nonEmpty = lines.filter(l => l.trim().length > 0).length;

  metaInput.textContent = `${nonEmpty.toLocaleString()} lines`;
  const outLines = (outputText.value || "").trim().length
    ? normalizeLineEndings(outputText.value || "").split("\n").filter(l => l.trim().length > 0).length
    : 0;
  metaOutput.textContent = `${outLines.toLocaleString()} lines`;

  if (uploadZone.classList.contains("has-file")) {
    charCountEl.textContent = (inputText.value || "").length.toLocaleString();
  }
}

function doSort() {
  setStatus("");

  const lines = getLinesFromInput();
  if (!lines.length) {
    outputText.value = "";
    updateMeta();
    setStatus("Paste lines or upload a .txt file first.", "error");
    return;
  }

  const before = lines.length;
  const deduped = dedupe(lines);
  const sorted = sortLines(deduped);

  outputText.value = sorted.join("\n");
  updateMeta();

  const removed = before - deduped.length;
  const msg = removed > 0
    ? `Sorted ${sorted.length} lines (removed ${removed} duplicates).`
    : `Sorted ${sorted.length} lines.`;

  setStatus(msg, "");
}

async function loadTextFile(file) {
  const isTxt = file.type === "text/plain" || file.name.toLowerCase().endsWith(".txt");
  if (!isTxt) {
    setStatus("Please upload a .txt file.", "error");
    return;
  }

  const text = await file.text();
  inputText.value = text;

  uploadZone.classList.add("has-file");
  uploadPrompt.classList.add("hidden");
  filePreview.classList.remove("hidden");

  fileNameEl.textContent = file.name;
  fileSizeEl.textContent = formatBytes(file.size);
  charCountEl.textContent = text.length.toLocaleString();

  currentFileBase = sanitizeBaseName(file.name);

  updateMeta();
  setStatus("File loaded. Choose options and click Sort Lines.", "");
}

function preventDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}

async function copyOutput() {
  const text = outputText.value || "";
  if (!text) {
    setStatus("Nothing to copy yet. Click Sort Lines first.", "error");
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    setStatus("Copied output to clipboard.", "");
  } catch {
    outputText.focus();
    outputText.select();
    const ok = document.execCommand("copy");
    setStatus(ok ? "Copied output to clipboard." : "Copy failed. Manually select and copy.", ok ? "" : "error");
  }
}

function downloadOutput() {
  const text = outputText.value || "";
  if (!text) {
    setStatus("Nothing to download yet. Click Sort Lines first.", "error");
    return;
  }

  const filename = `${currentFileBase}-sorted.txt`;
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
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

function clearAll() {
  inputText.value = "";
  outputText.value = "";
  resetFileUI();
  updateMeta();
  setStatus("Cleared.", "");
}

/* Events */
uploadZone.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", async (e) => {
  const file = e.target.files?.[0] || null;
  if (file) await loadTextFile(file);
});

chooseDifferent?.addEventListener("click", (e) => {
  e.preventDefault();
  resetFileUI();
  setStatus("Choose a different file or paste text.", "");
  updateMeta();
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
  if (file) await loadTextFile(file);
});

// Live meta updates
inputText.addEventListener("input", updateMeta);

// Primary actions
btnSort.addEventListener("click", doSort);
btnCopy.addEventListener("click", copyOutput);
btnDownload.addEventListener("click", downloadOutput);
btnClear.addEventListener("click", clearAll);

// Init
resetFileUI();
updateMeta();
