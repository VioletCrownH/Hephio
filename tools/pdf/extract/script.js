// /tools/pdf/extract/script.js
//
// PDF Extract: text (.txt) or pages as images (PNG/JPEG).
// Uses PDF.js (ESM) and optional JSZip.
//
// Vendor files expected:
// - /assets/vendor/pdfjs/pdf.min.mjs
// - /assets/vendor/pdfjs/pdf.worker.min.mjs
// - /assets/vendor/zip/jszip.min.js

import * as pdfjsLib from "/assets/vendor/pdfjs/pdf.min.mjs";
pdfjsLib.GlobalWorkerOptions.workerSrc = "/assets/vendor/pdfjs/pdf.worker.min.mjs";

// -------- DOM --------
const uploadZone = document.getElementById("uploadZone");
const fileInput = document.getElementById("fileInput");

const uploadSection = document.getElementById("uploadSection");
const workspaceSection = document.getElementById("workspaceSection");

const toolMain = document.getElementById("toolMain");
const pageSubtitle = document.getElementById("pageSubtitle");

const fileNameEl = document.getElementById("fileName");
const fileMetaEl = document.getElementById("fileMeta");
const changeFileBtn = document.getElementById("changeFileBtn");

const pagesInput = document.getElementById("pagesInput");
const pagesSummaryEl = document.getElementById("pagesSummary");

const btnOdd = document.getElementById("btnOdd");
const btnEven = document.getElementById("btnEven");
const btnFirst = document.getElementById("btnFirst");
const btnLast = document.getElementById("btnLast");

const imageOptionsEl = document.getElementById("imageOptions");
const imgFormat = document.getElementById("imgFormat");
const jpegQualityWrap = document.getElementById("jpegQualityWrap");
const jpegQuality = document.getElementById("jpegQuality");
const jpegQualityVal = document.getElementById("jpegQualityVal");
const scaleSelect = document.getElementById("scaleSelect");

const zipToggle = document.getElementById("zipToggle");
const zipHint = document.getElementById("zipHint");

const runBtn = document.getElementById("runBtn");
const clearBtn = document.getElementById("clearBtn");
const statusEl = document.getElementById("status");

// -------- State --------
let currentFile = null;
let pdfDoc = null;
let pageCount = 0;

// ZIP: auto-default until user changes it manually
let zipAuto = true;

// -------- Upload wiring --------
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

changeFileBtn.addEventListener("click", () => {
  resetUI();
  fileInput.click();
});

// -------- Mode / options wiring --------
document.querySelectorAll('input[name="mode"]').forEach((el) => {
  el.addEventListener("change", () => {
    updateModeUI();
    updatePagesSummaryAndZip();
    syncButtonState();
  });
});

pagesInput.addEventListener("input", () => {
  updatePagesSummaryAndZip();
  syncButtonState();
});

[btnOdd, btnEven, btnFirst, btnLast].forEach((btn) => {
  btn.addEventListener("click", () => {
    if (!pageCount) return;

    if (btn === btnOdd) pagesInput.value = buildOddEvenList(pageCount, "odd");
    if (btn === btnEven) pagesInput.value = buildOddEvenList(pageCount, "even");
    if (btn === btnFirst) pagesInput.value = "1";
    if (btn === btnLast) pagesInput.value = String(pageCount);

    updatePagesSummaryAndZip();
    syncButtonState();
  });
});

imgFormat.addEventListener("change", () => {
  updateImageOptionVisibility();
  syncButtonState();
});

jpegQuality.addEventListener("input", () => {
  jpegQualityVal.textContent = `${jpegQuality.value}%`;
});

scaleSelect.addEventListener("change", () => syncButtonState());

zipToggle.addEventListener("change", () => {
  zipAuto = false;
  updateZipHint();
});

clearBtn.addEventListener("click", () => {
  resetUI();
  fileInput.value = "";
});

runBtn.addEventListener("click", async () => {
  if (!pdfDoc || !currentFile) return;

  runBtn.disabled = true;
  clearBtn.disabled = true;
  setStatus("Working…");

  try {
    const mode = getMode();
    const pages = getSelectedPagesOrAll();

    if (mode === "text") {
      await extractText(pages);
    } else {
      await exportPagesAsImages(pages);
    }

    setSuccess("Done.");
  } catch (err) {
    console.error(err);
    setError("Something went wrong while extracting from this PDF.");
  } finally {
    syncButtonState();
  }
});

// -------------------- Load --------------------

async function loadFile(file) {
  resetUI();
  if (!file) return;

  if (!(file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"))) {
    setError("Please upload a PDF file.");
    return;
  }

  currentFile = file;
  clearBtn.disabled = false;

  setStatus("Loading PDF…");

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    pdfDoc = await pdfjsLib.getDocument({ data: bytes }).promise;
    pageCount = pdfDoc.numPages || 0;

    // Show workspace
    uploadSection.style.display = "none";
    workspaceSection.style.display = "block";

    // Disable footer peek when file is loaded
    if (toolMain) {
      toolMain.setAttribute("data-disable-footer-peek", "true");
      toolMain.classList.remove("has-extra-space");
      toolMain.style.height = "auto";
      toolMain.style.minHeight = "auto";
    }

    // Hide subtitle when file is loaded
    if (pageSubtitle) {
      pageSubtitle.classList.add("hidden");
    }

    fileNameEl.textContent = file.name;
    fileMetaEl.textContent = `${formatBytes(file.size)} • ${pageCount} page${pageCount === 1 ? "" : "s"}`;

    // Enable inputs
    pagesInput.disabled = false;
    enableQuickFill(true);

    imgFormat.disabled = false;
    scaleSelect.disabled = false;
    jpegQuality.disabled = false;

    // Defaults
    imgFormat.value = "image/png";
    scaleSelect.value = "1.5";
    jpegQuality.value = "85";
    jpegQualityVal.textContent = "85%";

    updateModeUI();
    updateImageOptionVisibility();

    clearStatus();
  } catch (err) {
    console.warn(err);
    setError("This PDF may be password-protected or unreadable.");
  } finally {
    updatePagesSummaryAndZip();
    syncButtonState();
  }
}

// -------------------- UI state --------------------

function updateModeUI() {
  const mode = getMode();
  
  if (mode === "images") {
    imageOptionsEl.classList.remove("hidden");
    runBtn.textContent = "Export & Download";
  } else {
    imageOptionsEl.classList.add("hidden");
    runBtn.textContent = "Extract & Download";
  }
}

function updateImageOptionVisibility() {
  const isJpeg = imgFormat.value === "image/jpeg";
  
  if (isJpeg) {
    jpegQualityWrap.classList.remove("hidden");
  } else {
    jpegQualityWrap.classList.add("hidden");
  }
}

function enableQuickFill(enabled) {
  [btnOdd, btnEven, btnFirst, btnLast].forEach((b) => (b.disabled = !enabled));
}

function syncButtonState() {
  clearBtn.disabled = !currentFile;

  if (!pdfDoc || !currentFile || !pageCount) {
    runBtn.disabled = true;
    return;
  }

  // Pages input optional; blank => all pages.
  const raw = pagesInput.value.trim();
  if (!raw) {
    runBtn.disabled = false;
    return;
  }

  const parsed = parsePageSpec(raw, pageCount);
  runBtn.disabled = !parsed.ok;
}

function updatePagesSummaryAndZip() {
  // summary
  if (!pdfDoc || !pageCount) {
    pagesSummaryEl.textContent = "—";
    return;
  }

  const raw = pagesInput.value.trim();
  let count = pageCount;

  if (raw) {
    const parsed = parsePageSpec(raw, pageCount);
    if (!parsed.ok) {
      pagesSummaryEl.textContent = "—";
      updateZipHint();
      return;
    }
    count = parsed.pages.length;
  }

  pagesSummaryEl.textContent = `${count} page${count === 1 ? "" : "s"} selected`;

  // ZIP auto-default (images mode only)
  if (getMode() === "images") {
    if (zipAuto) zipToggle.checked = count >= 2;
  }

  updateZipHint(count);
}

function updateZipHint(selectedCount = null) {
  if (!zipHint) return;

  if (getMode() !== "images") {
    zipHint.textContent = "ZIP applies to image exports.";
    return;
  }

  const n = selectedCount ?? inferSelectedCountSafe();
  if (n <= 1) {
    zipHint.textContent = zipToggle.checked
      ? "ZIP is ON (single page will be zipped)."
      : "ZIP is OFF (single page will download directly).";
  } else {
    zipHint.textContent = zipToggle.checked
      ? "ZIP is ON (recommended for multi-page exports)."
      : "ZIP is OFF (pages will download individually).";
  }
}

function inferSelectedCountSafe() {
  if (!pdfDoc || !pageCount) return 0;
  const raw = pagesInput.value.trim();
  if (!raw) return pageCount;
  const parsed = parsePageSpec(raw, pageCount);
  return parsed.ok ? parsed.pages.length : 0;
}

function getMode() {
  return document.querySelector('input[name="mode"]:checked')?.value ?? "text";
}

// -------------------- Selection parsing --------------------

function getSelectedPagesOrAll() {
  const raw = pagesInput.value.trim();
  if (!raw) return Array.from({ length: pageCount }, (_, i) => i + 1);

  const parsed = parsePageSpec(raw, pageCount);
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.pages;
}

function parsePageSpec(input, maxPage) {
  const r = parseRanges(input, maxPage);
  if (!r.ok) return r;

  const pages = new Set();
  for (const range of r.ranges) {
    for (let p = range.start; p <= range.end; p++) pages.add(p);
  }

  const list = Array.from(pages).sort((a, b) => a - b);
  if (!list.length) return { ok: false, error: "No pages selected." };
  return { ok: true, pages: list };
}

function parseRanges(input, maxPage) {
  const raw = (input ?? "").trim();
  if (!raw) return { ok: false, error: "Enter pages (example: 1-3,5,7-9)." };

  const cleaned = raw.replace(/\s+/g, "");
  const parts = cleaned.split(",").filter(Boolean);
  if (!parts.length) return { ok: false, error: "Enter pages (example: 1-3,5,7-9)." };

  const ranges = [];

  for (const token of parts) {
    if (/^\d+$/.test(token)) {
      const n = Number(token);
      const err = validatePage(n, maxPage);
      if (err) return { ok: false, error: err };
      ranges.push({ start: n, end: n });
      continue;
    }

    if (/^\d+-\d+$/.test(token)) {
      const [aStr, bStr] = token.split("-");
      const a = Number(aStr);
      const b = Number(bStr);

      const errA = validatePage(a, maxPage);
      if (errA) return { ok: false, error: errA };

      const errB = validatePage(b, maxPage);
      if (errB) return { ok: false, error: errB };

      if (b < a) return { ok: false, error: `Invalid range "${token}". End must be ≥ start.` };

      ranges.push({ start: a, end: b });
      continue;
    }

    return { ok: false, error: `Invalid token "${token}". Use commas and ranges like 1-3,5,7-9.` };
  }

  return { ok: true, ranges };
}

function validatePage(n, maxPage) {
  if (!Number.isFinite(n) || n % 1 !== 0) return "Page numbers must be whole numbers.";
  if (n < 1) return "Page numbers start at 1.";
  if (n > maxPage) return `Page ${n} is out of range (PDF has ${maxPage} pages).`;
  return "";
}

function buildOddEvenList(maxPage, mode) {
  const pages = [];
  for (let p = 1; p <= maxPage; p++) {
    if (mode === "odd" && p % 2 === 1) pages.push(p);
    if (mode === "even" && p % 2 === 0) pages.push(p);
  }
  return pages.join(",");
}

// -------------------- Extract: Text --------------------

async function extractText(pages1Based) {
  const base = sanitizeBase(baseName(currentFile.name));
  const parts = [];

  for (let i = 0; i < pages1Based.length; i++) {
    const p = pages1Based[i];
    setStatus(`Extracting text… (${i + 1}/${pages1Based.length})`);

    const page = await pdfDoc.getPage(p);
    const textContent = await page.getTextContent();

    // Simple readable output: join by spaces (best-effort)
    const strings = textContent.items.map((it) => it.str).filter(Boolean);
    parts.push(`--- Page ${p} ---\n${strings.join(" ")}\n`);
  }

  const text = parts.join("\n");
  downloadBlob(`${base}-text.txt`, new Blob([text], { type: "text/plain" }));
}

// -------------------- Export: Pages as Images --------------------

async function exportPagesAsImages(pages1Based) {
  const base = sanitizeBase(baseName(currentFile.name));

  const format = imgFormat.value;
  const scale = Number(scaleSelect.value) || 1.5;

  const quality = (format === "image/jpeg")
    ? Number(jpegQuality.value) / 100
    : undefined;

  const outputs = [];

  for (let i = 0; i < pages1Based.length; i++) {
    const p = pages1Based[i];
    setStatus(`Rendering page ${p}… (${i + 1}/${pages1Based.length})`);

    const page = await pdfDoc.getPage(p);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);

    const ctx = canvas.getContext("2d", { alpha: false });
    // white background for JPEG (and fine for PNG)
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvasContext: ctx, viewport }).promise;

    const blob = await canvasToBlob(canvas, format, quality);

    const ext = format === "image/png" ? "png" : "jpg";
    const filename = `${base}-page-${pad3(p)}.${ext}`;
    outputs.push({ filename, blob });
  }

  const wantZip = !!zipToggle.checked;
  const canZip = typeof window.JSZip !== "undefined";

  if (wantZip && canZip) {
    await downloadAsZip(`${base}-pages.zip`, outputs);
  } else {
    if (wantZip && !canZip) {
      setStatus("ZIP selected, but JSZip not found. Downloading individually…");
      await sleep(350);
    }
    await downloadIndividually(outputs);
  }
}

async function downloadAsZip(zipName, outputs) {
  setStatus("Creating ZIP…");
  const zip = new window.JSZip();
  outputs.forEach((o) => zip.file(o.filename, o.blob));
  const zipBlob = await zip.generateAsync({ type: "blob" });
  downloadBlob(zipName, zipBlob);
}

async function downloadIndividually(outputs) {
  for (let i = 0; i < outputs.length; i++) {
    setStatus(`Downloading ${i + 1}/${outputs.length}…`);
    downloadBlob(outputs[i].filename, outputs[i].blob);
    await sleep(120);
  }
}

// -------------------- Status messages --------------------

function clearStatus() {
  statusEl.className = "";
  statusEl.textContent = "";
}

function setError(msg) {
  statusEl.className = "tool-status-error";
  statusEl.textContent = msg;
  runBtn.disabled = true;
  clearBtn.disabled = false;
}

function setStatus(msg) {
  statusEl.className = "tool-status-info";
  statusEl.textContent = msg;
}

function setSuccess(msg) {
  statusEl.className = "tool-status-success";
  statusEl.textContent = msg;
}

// -------------------- Helpers --------------------

function resetUI() {
  currentFile = null;
  pdfDoc = null;
  pageCount = 0;

  zipAuto = true;
  zipToggle.checked = false;
  updateZipHint(0);

  pagesInput.value = "";
  pagesInput.disabled = true;
  pagesSummaryEl.textContent = "—";
  enableQuickFill(false);

  imgFormat.value = "image/png";
  scaleSelect.value = "1.5";
  jpegQuality.value = "85";
  jpegQualityVal.textContent = "85%";

  imgFormat.disabled = true;
  scaleSelect.disabled = true;
  jpegQuality.disabled = true;

  imageOptionsEl.classList.add("hidden");
  jpegQualityWrap.classList.add("hidden");

  runBtn.disabled = true;
  clearBtn.disabled = true;

  uploadSection.style.display = "block";
  workspaceSection.style.display = "none";

  // Re-enable footer peek
  if (toolMain) {
    toolMain.removeAttribute("data-disable-footer-peek");
  }

  // Show subtitle again
  if (pageSubtitle) {
    pageSubtitle.classList.remove("hidden");
  }

  fileNameEl.textContent = "—";
  fileMetaEl.textContent = "—";

  clearStatus();
}

function baseName(filename) {
  return String(filename ?? "document.pdf").replace(/\.[^.]+$/, "");
}

function sanitizeBase(name) {
  return name
    .replace(/[^\w\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "document";
}

function pad3(n) {
  return String(n).padStart(3, "0");
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) reject(new Error("toBlob returned null"));
      else resolve(blob);
    }, type, quality);
  });
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
  return `${mb.toFixed(2)} MB`;
}

// Init
resetUI();