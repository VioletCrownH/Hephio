/* ============================================================
   Hephio Split PDF
   Extract pages, delete pages, or split into multiple PDFs

   Requires:
   - /assets/vendor/pdf/pdf-lib.umd.min.js (window.PDFLib)
   - /assets/vendor/zip/jszip.min.js (window.JSZip)
   ============================================================ */

document.addEventListener("DOMContentLoaded", () => {
  const uploadSection = document.getElementById("uploadSection");
  const uploadZone = document.getElementById("uploadZone");
  const fileInput = document.getElementById("fileInput");

  const workspaceSection = document.getElementById("workspaceSection");
  const changeFileBtn = document.getElementById("changeFileBtn");

  const fileNameEl = document.getElementById("fileName");
  const fileMetaEl = document.getElementById("fileMeta");

  const pageSubtitle = document.getElementById("pageSubtitle");

  const splitOptionsPanel = document.getElementById("splitOptionsPanel");

  const pagesInput = document.getElementById("pagesInput");
  const pagesHintEl = document.getElementById("pagesHint");

  const btnOdd = document.getElementById("btnOdd");
  const btnEven = document.getElementById("btnEven");
  const btnFirst = document.getElementById("btnFirst");
  const btnLast = document.getElementById("btnLast");

  const zipToggle = document.getElementById("zipToggle");
  const zipHint = document.getElementById("zipHint");

  const runBtn = document.getElementById("runBtn");
  const clearBtn = document.getElementById("clearBtn");

  const statusEl = document.getElementById("status");

  let currentFile = null;
  let currentPdf = null;
  let pageCount = 0;
  let locked = false;

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

  pagesInput.addEventListener("input", () => {
    clearStatus();
    syncButtonState();
    updateZipHint();
  });

  document.querySelectorAll('input[name="mode"]').forEach((el) => {
    el.addEventListener("change", () => {
      updateModeUI();
      syncButtonState();
      updateZipHint();
    });
  });

  document.querySelectorAll('input[name="splitStyle"]').forEach((el) => {
    el.addEventListener("change", () => {
      clearStatus();
      updateModeUI();
      syncButtonState();
      updateZipHint();
    });
  });

  zipToggle?.addEventListener("change", () => {
    clearStatus();
  });

  btnOdd.addEventListener("click", () => quickFill("odd"));
  btnEven.addEventListener("click", () => quickFill("even"));
  btnFirst.addEventListener("click", () => quickFill("first"));
  btnLast.addEventListener("click", () => quickFill("last"));

  clearBtn.addEventListener("click", () => {
    resetUI();
  });

  runBtn.addEventListener("click", async () => {
    if (!currentFile || !currentPdf || locked) return;

    runBtn.disabled = true;
    setStatus("Working…", "info");

    try {
      const mode = getMode();
      let ok = false;

      if (mode === "extract") {
        ok = await runExtract();
      } else if (mode === "delete") {
        ok = await runDelete();
      } else {
        ok = await runSplitMany();
      }

      if (ok) {
        setStatus("Done.", "success");
      }
    } catch (err) {
      console.error(err);
      setStatus("Something went wrong while processing this PDF.", "error");
    } finally {
      syncButtonState();
    }
  });

  async function loadFile(file) {
    if (!file) return;

    if (file.type !== "application/pdf") {
      setStatus("Please upload a PDF file.", "error");
      return;
    }

    if (!window.PDFLib?.PDFDocument) {
      setStatus("PDF engine not loaded (pdf-lib).", "error");
      return;
    }

    currentFile = file;
    clearBtn.disabled = false;

    setStatus("Analyzing…", "info");

    try {
      const bytes = await file.arrayBuffer();
      currentPdf = await window.PDFLib.PDFDocument.load(bytes);
      pageCount = currentPdf.getPageCount();
      locked = false;

      uploadSection.style.display = "none";
      workspaceSection.style.display = "";

      const toolMain = document.getElementById("toolMain");
      if (toolMain) {
        toolMain.classList.remove("has-extra-space");
        toolMain.style.height = "auto";
      }

      if (pageSubtitle) {
        pageSubtitle.classList.add("hidden");
      }

      fileNameEl.textContent = file.name;
      fileMetaEl.textContent = `${formatBytes(file.size)} • ${pageCount} page${pageCount === 1 ? "" : "s"}`;

      pagesInput.disabled = false;
      enableQuickFill(true);

      updateModeUI();
      clearStatus();
    } catch (err) {
      console.error("Load failed:", err);
      locked = true;
      currentPdf = null;
      pageCount = 0;

      let errorMsg = "This PDF appears password-protected or unreadable.";
      if (err.message) {
        if (err.message.includes("password") || err.message.includes("encrypted")) {
          errorMsg = "This PDF appears password-protected or unreadable.";
        } else {
          errorMsg = `Error loading PDF: ${err.message}`;
        }
      }

      setStatus(errorMsg, "error");
    } finally {
      syncButtonState();
      updateZipHint();
    }
  }

  function updateModeUI() {
    const mode = getMode();

    if (!currentFile || locked) {
      splitOptionsPanel.style.display = "none";
      pagesInput.disabled = true;
      enableQuickFill(false);
      return;
    }

    if (mode === "split") {
      splitOptionsPanel.style.display = "";

      const style = getSplitStyle();
      if (style === "pages") {
        pagesInput.value = "";
        pagesInput.disabled = true;
        enableQuickFill(false);
      } else {
        pagesInput.disabled = false;
        enableQuickFill(true);
      }

      runBtn.textContent = "Split & Download";
      pagesHintEl.textContent =
        style === "pages"
          ? "One PDF per page will be created."
          : "Enter multiple ranges for multiple outputs (example: 1-2,3-4).";
    } else {
      splitOptionsPanel.style.display = "none";
      pagesInput.disabled = false;
      enableQuickFill(true);

      runBtn.textContent = mode === "extract" ? "Extract & Download" : "Delete & Download";
      pagesHintEl.textContent = "Use commas and ranges. Page numbers start at 1.";
    }
  }

  function enableQuickFill(enabled) {
    [btnOdd, btnEven, btnFirst, btnLast].forEach((b) => {
      b.disabled = !enabled;
    });
  }

  function syncButtonState() {
    clearBtn.disabled = !currentFile;

    if (!currentFile || locked || !currentPdf || !pageCount) {
      runBtn.disabled = true;
      return;
    }

    const mode = getMode();

    if (mode === "split" && getSplitStyle() === "pages") {
      runBtn.disabled = pageCount <= 1;
      return;
    }

    const raw = pagesInput.value.trim();
    runBtn.disabled = raw.length === 0;
    if (runBtn.disabled) return;

    const parsed = parsePageSpec(raw, pageCount);
    runBtn.disabled = !parsed.ok;
  }

  function getMode() {
    return document.querySelector('input[name="mode"]:checked')?.value ?? "extract";
  }

  function getSplitStyle() {
    return document.querySelector('input[name="splitStyle"]:checked')?.value ?? "ranges";
  }

  function quickFill(kind) {
    if (!pageCount) return;

    if (kind === "odd") pagesInput.value = buildOddEvenList(pageCount, "odd");
    if (kind === "even") pagesInput.value = buildOddEvenList(pageCount, "even");
    if (kind === "first") pagesInput.value = "1";
    if (kind === "last") pagesInput.value = String(pageCount);

    syncButtonState();
    updateZipHint();
  }

  function updateZipHint() {
    if (!zipHint) return;

    const mode = getMode();
    if (mode !== "split") return;

    const style = getSplitStyle();
    if (style === "pages") {
      zipHint.textContent = "ZIP is recommended for many pages (one PDF per page).";
      return;
    }

    const raw = pagesInput.value.trim();
    if (!raw) {
      zipHint.textContent = "ZIP is recommended when multiple files will be created.";
      return;
    }

    const parsed = parseRanges(raw, pageCount);
    if (parsed.ok) {
      const n = parsed.ranges.length;
      zipHint.textContent =
        n >= 2 ? "Multiple outputs detected — ZIP is recommended." : "Single output detected — ZIP is optional.";
    } else {
      zipHint.textContent = "ZIP is recommended when multiple files will be created.";
    }
  }

  async function runExtract() {
    const spec = pagesInput.value.trim();
    const parsed = parsePageSpec(spec, pageCount);

    if (!parsed.ok) {
      setStatus(parsed.error, "error");
      return false;
    }

    if (parsed.pages.length === pageCount) {
      setStatus("That selects every page. Extract is intended for selecting a subset.", "error");
      return false;
    }

    const blob = await buildPdfForPages(parsed.pages);
    const base = sanitizeBase(baseName(currentFile.name));
    const label = compactLabelFromSpec(spec);
    await downloadBlob(`${base}-extract-${label}.pdf`, blob);
    return true;
  }

  async function runDelete() {
    const spec = pagesInput.value.trim();
    const parsed = parsePageSpec(spec, pageCount);

    if (!parsed.ok) {
      setStatus(parsed.error, "error");
      return false;
    }

    if (parsed.pages.length === pageCount) {
      setStatus("That would delete every page. Choose fewer pages to delete.", "error");
      return false;
    }

    const toDelete = new Set(parsed.pages);
    const keep = [];
    for (let p = 1; p <= pageCount; p++) {
      if (!toDelete.has(p)) keep.push(p);
    }

    const blob = await buildPdfForPages(keep);
    const base = sanitizeBase(baseName(currentFile.name));
    const label = compactLabelFromSpec(spec);
    await downloadBlob(`${base}-delete-${label}.pdf`, blob);
    return true;
  }

  async function runSplitMany() {
    const style = getSplitStyle();
    const base = sanitizeBase(baseName(currentFile.name));
    const outputs = [];

    if (style === "pages") {
      for (let p = 1; p <= pageCount; p++) {
        setStatus(`Building page ${p}/${pageCount}…`, "info");
        const blob = await buildPdfForPages([p]);
        outputs.push({ filename: `${base}-page-${pad2(p)}.pdf`, blob });
      }
    } else {
      const spec = pagesInput.value.trim();
      const parsed = parseRanges(spec, pageCount);

      if (!parsed.ok) {
        setStatus(parsed.error, "error");
        return false;
      }

      if (parsed.ranges.length === 1) {
        const r = parsed.ranges[0];
        const pages = pagesFromRange(r.start, r.end);

        if (pages.length === pageCount) {
          setStatus("That selects every page. Use a subset to split.", "error");
          return false;
        }

        const blob = await buildPdfForPages(pages);
        await downloadBlob(`${base}-extract-${r.label}.pdf`, blob);
        return true;
      }

      for (let i = 0; i < parsed.ranges.length; i++) {
        const r = parsed.ranges[i];
        setStatus(`Building part ${i + 1}/${parsed.ranges.length} (${r.label})…`, "info");
        const pages = pagesFromRange(r.start, r.end);
        const blob = await buildPdfForPages(pages);
        outputs.push({ filename: `${base}-part-${pad2(i + 1)}-${r.label}.pdf`, blob });
      }
    }

    if (!outputs.length) {
      setStatus("No output files were created.", "error");
      return false;
    }

    const useZip = !!zipToggle?.checked;

    if (useZip) {
      await downloadAsZip(`${base}-split.zip`, outputs);
    } else {
      await downloadIndividually(outputs);
    }

    return true;
  }

  async function buildPdfForPages(pages1Based) {
    const indices = pages1Based.map((p) => p - 1);
    const { PDFDocument } = window.PDFLib;

    const outPdf = await PDFDocument.create();
    const copied = await outPdf.copyPages(currentPdf, indices);
    copied.forEach((p) => outPdf.addPage(p));

    const outBytes = await outPdf.save();
    return new Blob([outBytes], { type: "application/pdf" });
  }

  async function downloadAsZip(zipName, outputs) {
    if (!window.JSZip) throw new Error("JSZip not loaded");

    setStatus("Creating ZIP…", "info");

    const zip = new window.JSZip();
    outputs.forEach((o) => zip.file(o.filename, o.blob));

    const zipBlob = await zip.generateAsync({ type: "blob" });
    await downloadBlob(zipName, zipBlob);
  }

  async function downloadIndividually(outputs) {
    for (let i = 0; i < outputs.length; i++) {
      setStatus(`Downloading ${i + 1}/${outputs.length}…`, "info");
      await downloadBlob(outputs[i].filename, outputs[i].blob);
      await sleep(300);
    }
  }

  function parsePageSpec(input, maxPage) {
    const r = parseRanges(input, maxPage);
    if (!r.ok) return r;

    const pages = new Set();
    for (const range of r.ranges) {
      for (let p = range.start; p <= range.end; p++) {
        pages.add(p);
      }
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
        ranges.push({ start: n, end: n, label: String(n) });
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

        ranges.push({ start: a, end: b, label: `${a}-${b}` });
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

  function pagesFromRange(start, end) {
    const out = [];
    for (let p = start; p <= end; p++) out.push(p);
    return out;
  }

  function buildOddEvenList(maxPage, mode) {
    const pages = [];
    for (let p = 1; p <= maxPage; p++) {
      if (mode === "odd" && p % 2 === 1) pages.push(p);
      if (mode === "even" && p % 2 === 0) pages.push(p);
    }
    return pages.join(",");
  }

  function setStatus(message, kind = "info") {
    if (kind === "info") {
      statusEl.textContent = message;
      statusEl.className = "tool-status-info";
    } else if (kind === "success") {
      statusEl.textContent = message;
      statusEl.className = "tool-status-success";
    } else {
      statusEl.textContent = message;
      statusEl.className = "tool-status-error";
    }
  }

  function clearStatus() {
    statusEl.textContent = "";
    statusEl.className = "";
  }

  function resetUI() {
    currentFile = null;
    currentPdf = null;
    pageCount = 0;
    locked = false;

    uploadSection.style.display = "";
    workspaceSection.style.display = "none";

    const toolMain = document.getElementById("toolMain");
    if (toolMain) {
      toolMain.classList.add("has-extra-space");
      toolMain.style.height = "auto";
    }

    if (pageSubtitle) {
      pageSubtitle.classList.remove("hidden");
    }

    pagesInput.value = "";
    pagesInput.disabled = true;
    fileNameEl.textContent = "—";
    fileMetaEl.textContent = "—";

    document.querySelector('input[name="mode"][value="extract"]')?.click();
    document.querySelector('input[name="splitStyle"][value="ranges"]')?.click();

    if (zipToggle) {
      zipToggle.checked = true;
    }

    enableQuickFill(false);

    runBtn.disabled = true;
    clearBtn.disabled = true;

    clearStatus();
    updateModeUI();
  }

  function baseName(filename) {
    return String(filename ?? "document.pdf").replace(/\.[^.]+$/, "");
  }

  function sanitizeBase(name) {
    return name.replace(/[^\w\-]+/g, "_").slice(0, 60) || "document";
  }

  function compactLabelFromSpec(spec) {
    return spec.trim().replace(/\s+/g, "").replace(/,/g, "_") || "pages";
  }

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  async function downloadBlob(filename, blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.style.display = "none";

    document.body.appendChild(a);
    a.click();

    await sleep(150);

    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(2)} MB`;
  }

  resetUI();
});