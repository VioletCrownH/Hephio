// Rotate PDF (with optional page range)
// Uses: /assets/vendor/pdf/pdf-lib.umd.min.js

const uploadZone = document.getElementById("uploadZone");
const uploadPrompt = document.getElementById("uploadPrompt");
const fileSummary = document.getElementById("fileSummary");

const fileInput = document.getElementById("fileInput");
const chooseDifferent = document.getElementById("chooseDifferent");

const fileNameEl = document.getElementById("fileName");
const fileSizeEl = document.getElementById("fileSize");
const pageCountEl = document.getElementById("pageCount");

const settingsPanel = document.getElementById("settingsPanel");
const pageRangeInput = document.getElementById("pageRangeInput");
const rotationSelect = document.getElementById("rotationSelect");
const rotateBtn = document.getElementById("rotateBtn");
const statusEl = document.getElementById("status");

// pdf-lib (UMD) globals
const { PDFDocument, degrees } = window.PDFLib || {};

let currentFile = null;
let currentPdfBytes = null;
let currentPageCount = 0;

/* ---------------- Upload Zone wiring ---------------- */

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

  const file = e.dataTransfer?.files?.[0] ?? null;
  await loadFile(file);
  fileInput.value = "";
});

fileInput.addEventListener("change", async (e) => {
  const file = e.target.files?.[0] ?? null;
  await loadFile(file);
});

chooseDifferent?.addEventListener("click", (e) => {
  e.preventDefault();
  fileInput.click();
});

/* ---------------- Controls ---------------- */

rotationSelect.addEventListener("change", () => {
  clearStatus();
  syncButtonState();
});

pageRangeInput.addEventListener("input", () => {
  clearStatus();
  syncButtonState();
});

rotateBtn.addEventListener("click", async () => {
  if (!currentPdfBytes || !currentPageCount) return;

  const rot = Number(rotationSelect.value);
  if (![90, 180, 270].includes(rot)) return;

  // Parse page range (blank => all pages)
  let pageIndexes = null; // null means all pages
  try {
    pageIndexes = parsePageRange(pageRangeInput.value, currentPageCount);
  } catch (e) {
    setError(e.message || "Invalid page range.");
    return;
  }

  setStatus("Rotating…");
  setBusy(true);

  try {
    const outBytes = await rotateSelectedPages(currentPdfBytes, rot, pageIndexes);
    const outName = makeRotatedName(currentFile?.name ?? "document.pdf", rot);
    downloadBytes(outName, outBytes, "application/pdf");
    setSuccess("Done.");
  } catch (err) {
    console.error(err);
    setError("Something went wrong while rotating this PDF.");
  } finally {
    setBusy(false);
  }
});

/* ---------------- Core PDF logic ---------------- */

async function rotateSelectedPages(pdfBytes, rotationDeg, pageIndexesOrNull) {
  if (!PDFDocument || !degrees) {
    throw new Error("pdf-lib not available on window.PDFLib");
  }

  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: false });
  const pages = pdfDoc.getPages();

  const shouldRotate = (idx0) => {
    if (pageIndexesOrNull === null) return true; // all pages
    return pageIndexesOrNull.has(idx0);
  };

  for (let i = 0; i < pages.length; i++) {
    if (!shouldRotate(i)) continue;

    const page = pages[i];
    const existing = page.getRotation()?.angle ?? 0; // 0/90/180/270
    const next = (existing + rotationDeg) % 360;
    page.setRotation(degrees(next));
  }

  return await pdfDoc.save();
}

/* ---------------- File load + UI state ---------------- */

function resetUI() {
  currentFile = null;
  currentPdfBytes = null;
  currentPageCount = 0;

  // Reset settings
  settingsPanel.classList.add("hidden");
  pageRangeInput.value = "";
  pageRangeInput.disabled = true;

  rotationSelect.disabled = true;
  rotateBtn.disabled = true;

  // Reset upload zone
  uploadZone.classList.remove("has-file");
  uploadPrompt.classList.remove("hidden");
  fileSummary.classList.add("hidden");

  // Reset preview values
  fileNameEl.textContent = "—";
  fileSizeEl.textContent = "—";
  pageCountEl.textContent = "—";

  clearStatus();
}

async function loadFile(file) {
  resetUI();
  if (!file) return;

  if (file.type !== "application/pdf") {
    setError("Please upload a PDF file.");
    return;
  }

  currentFile = file;

  try {
    setStatus("Reading PDF…");

    const bytes = await file.arrayBuffer();
    currentPdfBytes = bytes;

    // Validate + count pages
    const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: false });
    currentPageCount = pdfDoc.getPageCount();

    // Morph upload zone to preview
    uploadPrompt.classList.add("hidden");
    fileSummary.classList.remove("hidden");
    uploadZone.classList.add("has-file");

    // Populate preview
    fileNameEl.textContent = file.name;
    fileSizeEl.textContent = formatBytes(file.size);
    pageCountEl.textContent = String(currentPageCount);

    // Reveal settings
    settingsPanel.classList.remove("hidden");
    rotationSelect.disabled = false;
    rotationSelect.value = "90";

    pageRangeInput.disabled = false;
    pageRangeInput.value = ""; // blank => all pages

    clearStatus();
    syncButtonState();
  } catch (err) {
    console.error(err);
    setError("Unable to read this PDF. If it’s password-protected, try unlocking it first.");
  }
}

function syncButtonState() {
  if (!currentPdfBytes || !currentPageCount || rotationSelect.disabled) {
    rotateBtn.disabled = true;
    return;
  }

  const val = (pageRangeInput.value ?? "").trim();
  if (val) {
    try {
      parsePageRange(val, currentPageCount);
    } catch {
      rotateBtn.disabled = true;
      return;
    }
  }

  rotateBtn.disabled = false;
}

function setBusy(isBusy) {
  rotateBtn.disabled = isBusy || !currentPdfBytes;
  rotationSelect.disabled = isBusy || !currentPdfBytes;
  pageRangeInput.disabled = isBusy || !currentPdfBytes;
  uploadZone.classList.toggle("is-busy", isBusy);
}

/* ---------------- Page range parsing ---------------- */

function parsePageRange(input, pageCount) {
  const raw = (input ?? "").trim();

  // Blank => all pages
  if (!raw) return null;

  // Remove all whitespace
  const cleaned = raw.replace(/\s+/g, "");

  // Allowed chars: digits, commas, hyphens
  if (!/^[0-9,\-]+$/.test(cleaned)) {
    throw new Error("Page range can only include numbers, commas, and hyphens (e.g., 1-3,5,8-10).");
  }

  const parts = cleaned.split(",").filter(Boolean);
  if (parts.length === 0) return null;

  const set = new Set();

  for (const part of parts) {
    if (part.includes("-")) {
      const [aStr, bStr, ...rest] = part.split("-");
      if (rest.length > 0 || !aStr || !bStr) {
        throw new Error("Invalid range format. Use like 2-5.");
      }
      const a = toInt(aStr);
      const b = toInt(bStr);

      if (a < 1 || b < 1) throw new Error("Page numbers must be 1 or higher.");

      const start = Math.min(a, b);
      const end = Math.max(a, b);

      if (start > pageCount) continue; // out of bounds => ignore

      for (let p = start; p <= Math.min(end, pageCount); p++) {
        set.add(p - 1); // 0-based
      }
    } else {
      const n = toInt(part);
      if (n < 1) throw new Error("Page numbers must be 1 or higher.");
      if (n > pageCount) continue; // out of bounds => ignore
      set.add(n - 1);
    }
  }

  if (set.size === 0) {
    throw new Error(`No valid pages found. This PDF has ${pageCount} pages.`);
  }

  return set;
}

function toInt(s) {
  if (!/^\d+$/.test(s)) throw new Error("Invalid number in page range.");
  const n = Number(s);
  if (!Number.isFinite(n)) throw new Error("Invalid number in page range.");
  return n;
}

/* ---------------- Naming + download ---------------- */

function makeRotatedName(originalName, rotationDeg) {
  const base = originalName.replace(/\.[^.]+$/, "");
  return `${base}-rotated-${rotationDeg}.pdf`;
}

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

/* ---------------- Helpers ---------------- */

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
}

/* ---------------- Status UI ---------------- */

function clearStatus() {
  statusEl.textContent = "";
  statusEl.classList.remove("error");
}

function setStatus(msg) {
  statusEl.textContent = msg;
  statusEl.classList.remove("error");
}

function setSuccess(msg) {
  statusEl.textContent = msg;
  statusEl.classList.remove("error");
}

function setError(msg) {
  statusEl.textContent = msg;
  statusEl.classList.add("error");
}

/* ---------------- Init ---------------- */

resetUI();