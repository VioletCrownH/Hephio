// Hephio - Text Case Converter (Change Case)
// v1: Output updates only when a case button is clicked.
// "Line-by-line" means: each line is converted independently, preserving line breaks.

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

const btnCopy = document.getElementById("btnCopy");
const btnDownload = document.getElementById("btnDownload");
const btnReset = document.getElementById("btnReset");

const caseBar = document.querySelector(".tool-case-bar");

let lastAppliedCase = null;
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

function updateCounts() {
  metaInput.textContent = `${inputText.value.length.toLocaleString()} chars`;
  metaOutput.textContent = `${outputText.value.length.toLocaleString()} chars`;
}

function sanitizeBaseName(name) {
  const base = (name || "hephio-text")
    .replace(/\.[^.]+$/, "")
    .trim()
    .slice(0, 60);
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

function setActiveButton(mode) {
  // Optional UX: highlight the last clicked case button.
  // If you don't add CSS for `.is-active`, nothing visible happens and that's fine.
  const btns = caseBar?.querySelectorAll("button[data-case]") || [];
  btns.forEach((btn) => btn.classList.toggle("is-active", mode && btn.dataset.case === mode));
}

function resetAll() {
  inputText.value = "";
  outputText.value = "";
  lastAppliedCase = null;
  setActiveButton(null);
  resetFileUI();
  updateCounts();
  setStatus("");
}

/* ---------------------------
   Word splitting (robust-enough for v1)
   - Handles spaces, underscores, hyphens
   - Handles camelCase and PascalCase by inserting spaces before capitals
---------------------------- */
function splitIntoWords(raw) {
  if (!raw) return [];
  let s = raw;

  // camelCase -> camel Case, PDFTools -> PDF Tools
  s = s.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
  s = s.replace(/([A-Z])([A-Z][a-z])/g, "$1 $2");

  // snake/kebab separators -> spaces
  s = s.replace(/[_\-]+/g, " ");

  // punctuation -> spaces (keep letters/numbers/apostrophes)
  s = s.replace(/[^\p{L}\p{N}'\s]/gu, " ");

  // split into tokens
  return s.trim().split(/\s+/).filter(Boolean);
}

function capFirst(w) {
  return w ? w.charAt(0).toUpperCase() + w.slice(1) : "";
}

function toTitleCaseLine(line) {
  const words = splitIntoWords(line);
  return words
    .map((w) => {
      // keep acronyms (2+ chars) as-is
      if (/^[A-Z0-9]{2,}$/.test(w)) return w;
      return capFirst(w.toLowerCase());
    })
    .join(" ");
}

function toSentenceCaseText(text) {
  const lower = text.toLowerCase();
  return lower.replace(/(^|[.!?]\s+)([a-z])/g, (m, p1, p2) => p1 + p2.toUpperCase());
}

function toCamelCaseLine(line) {
  const words = splitIntoWords(line);
  if (!words.length) return "";
  return [
    words[0].toLowerCase(),
    ...words.slice(1).map((w) => capFirst(w.toLowerCase()))
  ].join("");
}

function toPascalCaseLine(line) {
  const words = splitIntoWords(line);
  return words.map((w) => capFirst(w.toLowerCase())).join("");
}

function toSnakeCaseLine(line) {
  const words = splitIntoWords(line);
  return words.map((w) => w.toLowerCase()).join("_");
}

function toKebabCaseLine(line) {
  const words = splitIntoWords(line);
  return words.map((w) => w.toLowerCase()).join("-");
}

function stripDiacritics(s) {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

function toSlugCaseLine(line) {
  if (!line) return "";
  let s = stripDiacritics(line.toLowerCase());

  s = s.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();
  s = s.replace(/[_\-]+/g, " ");
  s = s.replace(/[^\p{L}\p{N}\s]/gu, " ");
  s = s.trim().replace(/\s+/g, "-").replace(/-+/g, "-");

  return s;
}

function transformText(text, mode) {
  const lines = text.split(/\r?\n/);

  switch (mode) {
    case "upper":
      return text.toUpperCase();
    case "lower":
      return text.toLowerCase();
    case "title":
      return lines.map(toTitleCaseLine).join("\n");
    case "sentence":
      // sentence case works best across full text
      return toSentenceCaseText(text);
    case "camel":
      return lines.map(toCamelCaseLine).join("\n");
    case "pascal":
      return lines.map(toPascalCaseLine).join("\n");
    case "snake":
      return lines.map(toSnakeCaseLine).join("\n");
    case "kebab":
      return lines.map(toKebabCaseLine).join("\n");
    case "slug":
      return lines.map(toSlugCaseLine).join("\n");
    default:
      return text;
  }
}

function applyCase(mode) {
  const src = inputText.value || "";
  if (!src.trim()) {
    outputText.value = "";
    updateCounts();
    lastAppliedCase = mode;
    setActiveButton(mode);
    setStatus("Paste or upload text to convert.", "error");
    return;
  }

  const out = transformText(src, mode);
  outputText.value = out;

  lastAppliedCase = mode;
  setActiveButton(mode);
  updateCounts();
  setStatus(`Applied: ${mode}`, "");
}

/* ---------------------------
   File handling
---------------------------- */
async function loadTextFile(file) {
  const isTxt = file.type === "text/plain" || file.name.toLowerCase().endsWith(".txt");
  if (!isTxt) {
    setStatus("Please upload a .txt file.", "error");
    return;
  }

  const text = await file.text();
  inputText.value = text;
  outputText.value = text;

  uploadZone.classList.add("has-file");
  uploadPrompt.classList.add("hidden");
  filePreview.classList.remove("hidden");

  fileNameEl.textContent = file.name;
  fileSizeEl.textContent = formatBytes(file.size);
  charCountEl.textContent = text.length.toLocaleString();
  currentFileBase = sanitizeBaseName(file.name);

  lastAppliedCase = null;
  setActiveButton(null);
  updateCounts();
  setStatus("File loaded. Choose a case option above to convert.", "");
}

function preventDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}

/* ---------------------------
   Copy / download
---------------------------- */
async function copyOutput() {
  const text = outputText.value || "";
  if (!text) {
    setStatus("Nothing to copy yet. Choose a case option first.", "error");
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
    setStatus("Nothing to download yet. Choose a case option first.", "error");
    return;
  }

  const suffix = lastAppliedCase ? `-${lastAppliedCase}` : "";
  const filename = `${currentFileBase}${suffix}.txt`;

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

/* ---------------------------
   Wire up events
---------------------------- */
uploadZone.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", async (e) => {
  const file = e.target.files?.[0] || null;
  if (file) await loadTextFile(file);
});

chooseDifferent?.addEventListener("click", (e) => {
  e.preventDefault();
  resetFileUI();
  setStatus("Choose a different file or paste text.", "");
});

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

// Case buttons bar
caseBar?.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-case]");
  if (!btn) return;
  applyCase(btn.dataset.case);
});

// Input typing: update counts, do NOT auto-update output
inputText.addEventListener("input", () => {
  updateCounts();
  if (uploadZone.classList.contains("has-file")) {
    charCountEl.textContent = inputText.value.length.toLocaleString();
  }
});

// Actions
btnCopy.addEventListener("click", copyOutput);
btnDownload.addEventListener("click", downloadOutput);
btnReset.addEventListener("click", resetAll);

// Init
resetAll();
