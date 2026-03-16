/* ============================================
   HEPHIO - Text Cleanup Tool
   Upload .txt → Clean → Download
   ============================================ */

// DOM Elements
const uploadZone = document.getElementById("uploadZone");
const fileInput = document.getElementById("fileInput");
const uploadPrompt = document.getElementById("uploadPrompt");
const filePreview = document.getElementById("filePreview");
const chooseDifferent = document.getElementById("chooseDifferent");

const fileName = document.getElementById("fileName");
const fileSize = document.getElementById("fileSize");
const charCount = document.getElementById("charCount");

const orDivider = document.getElementById("orDivider");
const pasteSection = document.getElementById("pasteSection");
const pasteInput = document.getElementById("pasteInput");
const btnPasteSubmit = document.getElementById("btnPasteSubmit");

const settingsSection = document.getElementById("settingsSection");
const resultSection = document.getElementById("resultSection");

const btnClean = document.getElementById("btnClean");
const btnDownload = document.getElementById("btnDownload");
const btnStartOver = document.getElementById("btnStartOver");

const optRemoveExtraSpaces = document.getElementById("optRemoveExtraSpaces");
const optTrimWhitespace = document.getElementById("optTrimWhitespace");
const optNormalizeLineBreaks = document.getElementById("optNormalizeLineBreaks");
const optTabsToSpaces = document.getElementById("optTabsToSpaces");
const optTabSize = document.getElementById("optTabSize");

const optNormalizeQuotes = document.getElementById("optNormalizeQuotes");
const optNormalizeDashes = document.getElementById("optNormalizeDashes");
const optFixEncoding = document.getElementById("optFixEncoding");
const optPlainPunctuation = document.getElementById("optPlainPunctuation");

const optRemoveInvisible = document.getElementById("optRemoveInvisible");
const optRemoveControls = document.getElementById("optRemoveControls");

const optRemoveEmptyLines = document.getElementById("optRemoveEmptyLines");
const optCollapseBlankLines = document.getElementById("optCollapseBlankLines");

const optCase = document.getElementById("optCase");

// State
let originalFile = null;
let originalText = "";
let cleanedText = "";

/* ============================================
   FILE HANDLING
   ============================================ */

function formatBytes(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
}

function handleFile(file) {
  if (!file) return;

  if (!file.type.includes("text") && !file.name.endsWith(".txt")) {
    alert("Please upload a .txt file");
    return;
  }

  originalFile = file;

  const reader = new FileReader();
  reader.onload = (e) => {
    originalText = e.target.result;
    
    // Update UI
    fileName.textContent = file.name;
    fileSize.textContent = formatBytes(file.size);
    charCount.textContent = originalText.length.toLocaleString();

    // Show file preview, hide upload prompt and paste section
    uploadZone.classList.add("has-file");
    uploadPrompt.classList.add("hidden");
    filePreview.classList.remove("hidden");
    orDivider.classList.add("hidden");
    pasteSection.classList.add("hidden");
    settingsSection.classList.remove("hidden");
    resultSection.classList.add("hidden");
    
    // Remove footer peek behavior after file load
    document.querySelector(".tool-main")?.classList.remove("has-extra-space");
  };

  reader.readAsText(file);
}

/* ============================================
   TEXT CLEANING FUNCTIONS
   ============================================ */

function normalizeLineBreaks(text) {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function tabsToSpaces(text, tabSize) {
  const spaces = " ".repeat(Math.max(1, tabSize | 0));
  return text.replace(/\t/g, spaces);
}

function trimWhitespacePerLine(text) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .join("\n");
}

function removeExtraSpaces(text) {
  return text.replace(/[ ]{2,}/g, " ");
}

function normalizeQuotes(text) {
  return text
    .replace(/[\u201C\u201D\u2033]/g, '"')
    .replace(/[\u2018\u2019\u2032]/g, "'")
    .replace(/\u00AB/g, '"')
    .replace(/\u00BB/g, '"');
}

function normalizeDashes(text) {
  return text.replace(/[\u2014\u2013\u2212\u2011]/g, "-");
}

function convertSmartPunctuationToPlain(text) {
  return text
    .replace(/\u2026/g, "...")
    .replace(/[\u2022\u00B7\u2219]/g, "*")
    .replace(/\u00A0/g, " ");
}

function removeInvisibleCharacters(text) {
  return text
    .replace(/\u00A0/g, " ")
    .replace(/[\u200B\u200C\u200D\u2060\uFEFF]/g, "");
}

function removeControlCharacters(text) {
  return text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
}

function removeEmptyLines(text) {
  return text
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .join("\n");
}

function collapseBlankLines(text) {
  return text.replace(/\n{3,}/g, "\n\n");
}

function sentenceCase(text) {
  const lower = text.toLowerCase();
  let result = "";
  let capNext = true;

  for (let i = 0; i < lower.length; i++) {
    const ch = lower[i];
    if (capNext && /[a-z]/i.test(ch)) {
      result += ch.toUpperCase();
      capNext = false;
      continue;
    }
    result += ch;
    if (/[.!?]\s|\n/.test(lower.slice(i, i + 2)) || ch === "\n") {
      capNext = true;
    }
  }
  return result;
}

function titleCase(text) {
  return text.replace(/\S+/g, (word) => {
    const w = word.toLowerCase();
    return w.charAt(0).toUpperCase() + w.slice(1);
  });
}

function fixEncodingArtifacts(text) {
  const likely = /[Ãâ]/.test(text);
  if (!likely) return text;

  try {
    const bytes = new Uint8Array([...text].map((c) => c.charCodeAt(0) & 0xff));
    const decoded = new TextDecoder("utf-8", { fatal: false }).decode(bytes);

    const score = (s) => {
      const repl = (s.match(/\uFFFD/g) || []).length;
      const moj = (s.match(/[Ãâ]/g) || []).length;
      return repl * 5 + moj;
    };

    const before = score(text);
    const after = score(decoded);

    if (after + 2 < before) return decoded;
    return text;
  } catch {
    return text;
  }
}

function applyCaseTransform(text, mode) {
  switch (mode) {
    case "lower":
      return text.toLowerCase();
    case "upper":
      return text.toUpperCase();
    case "title":
      return titleCase(text);
    case "sentence":
      return sentenceCase(text);
    default:
      return text;
  }
}

function readOptions() {
  return {
    removeExtraSpaces: optRemoveExtraSpaces.checked,
    trimWhitespace: optTrimWhitespace.checked,
    normalizeLineBreaks: optNormalizeLineBreaks.checked,
    tabsToSpaces: optTabsToSpaces.checked,
    tabSize: parseInt(optTabSize.value, 10) || 4,

    normalizeQuotes: optNormalizeQuotes.checked,
    normalizeDashes: optNormalizeDashes.checked,
    fixEncoding: optFixEncoding.checked,
    plainPunctuation: optPlainPunctuation.checked,

    removeInvisible: optRemoveInvisible.checked,
    removeControls: optRemoveControls.checked,

    removeEmptyLines: optRemoveEmptyLines.checked,
    collapseBlankLines: optCollapseBlankLines.checked,

    caseMode: optCase.value || "none",
  };
}

function cleanText(input, opts) {
  let text = input ?? "";

  if (opts.normalizeLineBreaks) {
    text = normalizeLineBreaks(text);
  }

  if (opts.fixEncoding) {
    text = fixEncodingArtifacts(text);
  }

  if (opts.removeInvisible) {
    text = removeInvisibleCharacters(text);
  }
  if (opts.removeControls) {
    text = removeControlCharacters(text);
  }

  if (opts.normalizeQuotes) {
    text = normalizeQuotes(text);
  }
  if (opts.normalizeDashes) {
    text = normalizeDashes(text);
  }
  if (opts.plainPunctuation) {
    text = convertSmartPunctuationToPlain(text);
  }

  if (opts.tabsToSpaces) {
    text = tabsToSpaces(text, opts.tabSize);
  }
  if (opts.trimWhitespace) {
    text = trimWhitespacePerLine(text);
  }
  if (opts.removeExtraSpaces) {
    text = removeExtraSpaces(text);
  }

  if (opts.removeEmptyLines) {
    text = removeEmptyLines(text);
  } else if (opts.collapseBlankLines) {
    text = collapseBlankLines(text);
  }

  text = applyCaseTransform(text, opts.caseMode);

  return text;
}

/* ============================================
   DOWNLOAD
   ============================================ */

function downloadTxt(text, filename) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  URL.revokeObjectURL(url);
}

/* ============================================
   EVENT HANDLERS
   ============================================ */

// Upload zone click
uploadZone.addEventListener("click", (e) => {
  if (e.target === chooseDifferent || uploadZone.classList.contains("has-file")) {
    return;
  }
  fileInput.click();
});

// File input change
fileInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) handleFile(file);
});

// Drag and drop
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
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
});

// Choose different file
chooseDifferent.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();
  fileInput.click();
});

// Paste submit
btnPasteSubmit.addEventListener("click", () => {
  const text = pasteInput.value.trim();
  
  if (!text) {
    alert("Please paste some text first");
    return;
  }
  
  originalText = text;
  
  // Update UI
  fileName.textContent = "Pasted Text";
  fileSize.textContent = formatBytes(originalText.length);
  charCount.textContent = originalText.length.toLocaleString();

  // Show file preview, hide upload prompt and paste section
  uploadZone.classList.add("has-file");
  uploadPrompt.classList.add("hidden");
  filePreview.classList.remove("hidden");
  orDivider.classList.add("hidden");
  pasteSection.classList.add("hidden");
  settingsSection.classList.remove("hidden");
  resultSection.classList.add("hidden");
  
  // Remove footer peek behavior after file load
  document.querySelector(".tool-main")?.classList.remove("has-extra-space");
});

// Clean button
btnClean.addEventListener("click", () => {
  if (!originalText) return;

  const opts = readOptions();
  cleanedText = cleanText(originalText, opts);

  resultSection.classList.remove("hidden");
});

// Download button
btnDownload.addEventListener("click", () => {
  if (!cleanedText) return;

  const originalName = originalFile ? originalFile.name : "pasted-text.txt";
  const baseName = originalName.replace(/\.txt$/i, "");
  const newName = `${baseName}-cleaned.txt`;

  downloadTxt(cleanedText, newName);
});

// Start over button
btnStartOver.addEventListener("click", () => {
  originalFile = null;
  originalText = "";
  cleanedText = "";
  
  fileInput.value = "";
  pasteInput.value = "";
  uploadZone.classList.remove("has-file");
  uploadPrompt.classList.remove("hidden");
  filePreview.classList.add("hidden");
  orDivider.classList.remove("hidden");
  pasteSection.classList.remove("hidden");
  settingsSection.classList.add("hidden");
  resultSection.classList.add("hidden");
  
  // Re-enable footer peek when resetting to initial state
  document.querySelector(".tool-main")?.classList.add("has-extra-space");
  if (typeof adjustFooterPeek === "function") {
    adjustFooterPeek();
  }
});