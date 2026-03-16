// Hephio - Word & Character Counter (Text Counter)
// Live updates as the user types or loads a .txt file.

const READING_WPM = 225;
const SPEAKING_WPM = 150;

const uploadZone = document.getElementById("uploadZone");
const fileInput = document.getElementById("fileInput");
const uploadPrompt = document.getElementById("uploadPrompt");
const filePreview = document.getElementById("filePreview");
const fileNameEl = document.getElementById("fileName");
const fileSizeEl = document.getElementById("fileSize");
const charCountEl = document.getElementById("charCount");
const chooseDifferent = document.getElementById("chooseDifferent");

const textInput = document.getElementById("textInput");
const miniCounter = document.getElementById("miniCounter");
const statusEl = document.getElementById("status");

const statWords = document.getElementById("statWords");
const statChars = document.getElementById("statChars");
const statCharsNoSpaces = document.getElementById("statCharsNoSpaces");
const statSentences = document.getElementById("statSentences");
const statParagraphs = document.getElementById("statParagraphs");
const statLines = document.getElementById("statLines");
const statNonEmptyLines = document.getElementById("statNonEmptyLines");
const statAvgWordLen = document.getElementById("statAvgWordLen");
const statReadTime = document.getElementById("statReadTime");
const statSpeakTime = document.getElementById("statSpeakTime");

const btnCopySummary = document.getElementById("btnCopySummary");
const btnDownloadSummary = document.getElementById("btnDownloadSummary");
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

function countWords(text) {
  // Word = sequences of letters/numbers with optional internal apostrophes (or smart apostrophes)
  const matches = text.match(/[\p{L}\p{N}]+(?:[''][\p{L}\p{N}]+)*/gu);
  return matches ? matches.length : 0;
}

function getWordLengths(text) {
  const matches = text.match(/[\p{L}\p{N}]+(?:[''][\p{L}\p{N}]+)*/gu) || [];
  return matches.map((w) => w.length);
}

function countSentences(text) {
  const trimmed = text.trim();
  if (!trimmed) return 0;

  const matches = trimmed.match(/[.!?]+(?=\s|$)/g);
  return matches ? matches.length : 1;
}

function countLines(text) {
  if (text.length === 0) return 0;
  return text.split(/\r?\n/).length;
}

function countNonEmptyLines(text) {
  if (!text.trim()) return 0;
  return text.split(/\r?\n/).filter((line) => line.trim().length > 0).length;
}

function countParagraphs(text) {
  // Paragraphs = blocks separated by blank lines
  const trimmed = text.trim();
  if (!trimmed) return 0;

  const normalized = trimmed.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const parts = normalized.split(/\n\s*\n+/).filter((p) => p.trim().length > 0);
  return parts.length;
}

function formatDurationMinutes(minutes) {
  if (!Number.isFinite(minutes) || minutes <= 0) return "0 min";
  if (minutes < 1) return "< 1 min";
  const rounded = Math.ceil(minutes);
  if (rounded < 60) return `${rounded} min`;
  const hrs = Math.floor(rounded / 60);
  const mins = rounded % 60;
  return mins === 0 ? `${hrs} hr` : `${hrs} hr ${mins} min`;
}

function computeStats(text) {
  const chars = text.length;
  const charsNoSpaces = text.replace(/\s/g, "").length;

  const words = countWords(text);
  const wordLens = getWordLengths(text);
  const avgWordLen = words === 0 ? 0 : (wordLens.reduce((a, b) => a + b, 0) / words);

  const sentences = countSentences(text);
  const paragraphs = countParagraphs(text);
  const lines = countLines(text);
  const nonEmptyLines = countNonEmptyLines(text);

  const readMinutes = words / READING_WPM;
  const speakMinutes = words / SPEAKING_WPM;

  return {
    words,
    chars,
    charsNoSpaces,
    sentences,
    paragraphs,
    lines,
    nonEmptyLines,
    avgWordLen,
    readMinutes,
    speakMinutes,
  };
}

function renderStats(s) {
  statWords.textContent = s.words.toLocaleString();
  statChars.textContent = s.chars.toLocaleString();
  statCharsNoSpaces.textContent = s.charsNoSpaces.toLocaleString();
  statSentences.textContent = s.sentences.toLocaleString();
  statParagraphs.textContent = s.paragraphs.toLocaleString();
  statLines.textContent = s.lines.toLocaleString();
  statNonEmptyLines.textContent = s.nonEmptyLines.toLocaleString();
  statAvgWordLen.textContent = s.avgWordLen ? s.avgWordLen.toFixed(1) : "0.0";
  statReadTime.textContent = formatDurationMinutes(s.readMinutes);
  statSpeakTime.textContent = formatDurationMinutes(s.speakMinutes);
}

function updateAll() {
  const text = textInput.value || "";
  const s = computeStats(text);

  renderStats(s);

  // Tiny live counter under textarea
  miniCounter.textContent =
    `${s.words.toLocaleString()} words | ${s.chars.toLocaleString()} characters`;

  // Keep file preview character count in sync if a file is loaded
  if (uploadZone.classList.contains("has-file")) {
    charCountEl.textContent = text.length.toLocaleString();
  }

  setStatus("");
}

function buildSummaryText() {
  const text = textInput.value || "";
  const s = computeStats(text);

  return [
    "Hephio Text Counter Summary",
    "--------------------------",
    `Words: ${s.words}`,
    `Characters (with spaces): ${s.chars}`,
    `Characters (no spaces): ${s.charsNoSpaces}`,
    `Sentences: ${s.sentences}`,
    `Paragraphs: ${s.paragraphs}`,
    `Lines: ${s.lines}`,
    `Non-empty lines: ${s.nonEmptyLines}`,
    `Average word length: ${s.avgWordLen ? s.avgWordLen.toFixed(1) : "0.0"}`,
    `Reading time (225 wpm): ${formatDurationMinutes(s.readMinutes)}`,
    `Speaking time (150 wpm): ${formatDurationMinutes(s.speakMinutes)}`,
  ].join("\n");
}

async function copySummary() {
  const summary = buildSummaryText();
  try {
    await navigator.clipboard.writeText(summary);
    setStatus("Copied summary to clipboard.", "");
  } catch {
    setStatus("Copy failed. Your browser may block clipboard access.", "error");
  }
}

function downloadSummary() {
  const summary = buildSummaryText();
  const filename = `${currentFileBase}-text-count-summary.txt`;

  const blob = new Blob([summary], { type: "text/plain;charset=utf-8" });
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

async function loadTextFile(file) {
  const isTxt = file.type === "text/plain" || file.name.toLowerCase().endsWith(".txt");
  if (!isTxt) {
    setStatus("Please upload a .txt file.", "error");
    return;
  }

  const text = await file.text();
  textInput.value = text;

  uploadZone.classList.add("has-file");
  uploadPrompt.classList.add("hidden");
  filePreview.classList.remove("hidden");

  fileNameEl.textContent = file.name;
  fileSizeEl.textContent = formatBytes(file.size);
  charCountEl.textContent = text.length.toLocaleString();

  currentFileBase = sanitizeBaseName(file.name);

  updateAll();
  setStatus("File loaded.", "");
}

function preventDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}

/* ---------------------------
   Events
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

// Live updates
textInput.addEventListener("input", updateAll);

// Actions
btnCopySummary.addEventListener("click", copySummary);
btnDownloadSummary.addEventListener("click", downloadSummary);
btnClear.addEventListener("click", () => {
  textInput.value = "";
  resetFileUI();
  updateAll();
  setStatus("Cleared.", "");
});

// Init
resetFileUI();
updateAll();
