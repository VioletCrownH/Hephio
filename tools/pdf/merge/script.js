// /tools/pdf/merge/script.js
//
// Merge PDF tool for Hephio
// - Drag/drop or click upload (multiple files)
// - Shows per-file page counts
// - Reorder + remove files
// - Blocks merge if any locked/encrypted
//
// Requires pdf-lib UMD loaded via script tag

document.addEventListener("DOMContentLoaded", () => {
  const uploadZone = document.getElementById("uploadZone");
  const fileInput = document.getElementById("fileInput");

  const uploadSection = document.getElementById("uploadSection");
  const workspaceSection = document.getElementById("workspaceSection");

  const summaryTitle = document.getElementById("summaryTitle");
  const summaryMeta = document.getElementById("summaryMeta");
  const pagesTotalEl = document.getElementById("pagesTotal");

  const addMoreBtn = document.getElementById("addMoreBtn");
  const listEl = document.getElementById("list");
  const lockedNote = document.getElementById("lockedNote");

  const mergeBtn = document.getElementById("mergeBtn");
  const clearBtn = document.getElementById("clearBtn");
  const statusEl = document.getElementById("status");

  // items: [{ file: File, pages: number|null, locked: boolean }]
  let items = [];

  // ------------- Upload wiring -------------

  uploadZone.addEventListener("click", () => fileInput.click());
  uploadZone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fileInput.click();
    }
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
    const dropped = Array.from(e.dataTransfer?.files ?? []);
    await addFiles(dropped);
  });

  fileInput.addEventListener("change", async (e) => {
    const newlyPicked = Array.from(e.target.files ?? []);
    fileInput.value = ""; // allow re-selecting same file later
    await addFiles(newlyPicked);
  });

  addMoreBtn.addEventListener("click", () => fileInput.click());

  // ------------- Actions -------------

  clearBtn.addEventListener("click", () => resetUI());

  mergeBtn.addEventListener("click", async () => {
    if (!canMerge()) return;

    setStatus("Merging PDFs…");
    mergeBtn.disabled = true;
    clearBtn.disabled = true;

    try {
      if (!window.PDFLib?.PDFDocument) throw new Error("pdf-lib not loaded");
      const { PDFDocument } = window.PDFLib;

      const outPdf = await PDFDocument.create();

      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        setStatus(`Reading ${i + 1}/${items.length}: ${it.file.name}`);

        const bytes = await it.file.arrayBuffer();
        const srcPdf = await PDFDocument.load(bytes);

        const copiedPages = await outPdf.copyPages(srcPdf, srcPdf.getPageIndices());
        copiedPages.forEach((p) => outPdf.addPage(p));
      }

      setStatus("Finalizing PDF…");
      const outBytes = await outPdf.save();

      const blob = new Blob([outBytes], { type: "application/pdf" });
      downloadBlob(makeMergedName(items), blob);

      setSuccess("Merged successfully!");
    } catch (err) {
      console.error(err);
      const msg = String(err?.message ?? err);

      if (msg.toLowerCase().includes("encrypted") || msg.toLowerCase().includes("password")) {
        setError("One or more PDFs appear password-protected. Remove them to merge.");
      } else {
        setError("Something went wrong while merging these PDFs.");
      }
    } finally {
      syncButtons();
    }
  });

  // ------------- Core logic -------------

  async function addFiles(files) {
    clearStatus();

    if (!files.length) return;

    const pdfs = files.filter(
      (f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")
    );

    if (!pdfs.length) {
      setError("Please select PDF files.");
      return;
    }

    // Deduplicate by (name + size + lastModified)
    const existingKeys = new Set(items.map((it) => fileKey(it.file)));

    const toAdd = [];
    for (const f of pdfs) {
      const key = fileKey(f);
      if (!existingKeys.has(key)) {
        existingKeys.add(key);
        toAdd.push(f);
      }
    }

    if (!toAdd.length) {
      setStatus("Those files are already added.");
      return;
    }

    // Ensure workspace is visible
    uploadSection.style.display = "none";
    workspaceSection.style.display = "block";

    // Disable footer peek when files are loaded
    const toolMain = document.getElementById("toolMain");
    if (toolMain) {
      toolMain.dataset.disableFooterPeek = "true";
      toolMain.style.height = "auto";
      toolMain.style.minHeight = "auto";
      toolMain.classList.remove("has-extra-space");
    }

    // Hide subtitle when files are loaded
    const pageSubtitle = document.getElementById("pageSubtitle");
    if (pageSubtitle) {
      pageSubtitle.classList.add("hidden");
    }

    // Add placeholders
    const startIndex = items.length;
    for (const f of toAdd) items.push({ file: f, pages: null, locked: false });

    render();
    syncButtons();

    // Analyze sequentially
    if (!window.PDFLib?.PDFDocument) {
      setError("pdf-lib is not available. Check your vendor script path.");
      return;
    }

    const { PDFDocument } = window.PDFLib;

    for (let i = startIndex; i < items.length; i++) {
      const it = items[i];
      setStatus(`Analyzing: ${it.file.name}`);

      try {
        const bytes = await it.file.arrayBuffer();
        const doc = await PDFDocument.load(bytes);
        it.pages = doc.getPageCount();
        it.locked = false;
      } catch (err) {
        console.warn("Analyze failed:", it.file.name, err);
        it.pages = null;
        it.locked = true;
      }

      render();
      syncButtons();
    }

    clearStatus();
  }

  function fileKey(f) {
    return `${f.name}::${f.size}::${f.lastModified}`;
  }

  function canMerge() {
    if (items.length < 2) return false;
    if (items.some((it) => it.locked)) return false;
    if (items.some((it) => it.pages == null)) return false; // still analyzing
    return true;
  }

  function syncButtons() {
    mergeBtn.disabled = !canMerge();
    clearBtn.disabled = items.length === 0;
  }

  // ------------- Rendering -------------

  function render() {
    renderSummary();
    renderList();
    renderLockedNote();
  }

  function renderSummary() {
    const count = items.length;

    summaryTitle.textContent = count
      ? `${count} PDF${count === 1 ? "" : "s"} ready to merge`
      : "—";

    const totalSize = items.reduce((sum, it) => sum + it.file.size, 0);
    const knownPages = items.every((it) => typeof it.pages === "number");

    summaryMeta.textContent = count
      ? `${formatBytes(totalSize)} • ${knownPages ? totalPages() + " total pages" : "Analyzing page counts…"}`
      : "—";

    pagesTotalEl.textContent = count
      ? (knownPages ? `${totalPages()} total pages` : "Analyzing…")
      : "—";
  }

  function totalPages() {
    return items.reduce((sum, it) => sum + (it.pages || 0), 0);
  }

  function renderLockedNote() {
    lockedNote.style.display = items.some((it) => it.locked) ? "block" : "none";
  }

  function renderList() {
    listEl.innerHTML = "";
    if (!items.length) return;

    items.forEach((it, idx) => {
      const row = document.createElement("div");
      row.className = "pdf-merge-item";

      const left = document.createElement("div");
      left.className = "pdf-merge-item-info";

      const name = document.createElement("div");
      name.className = "pdf-merge-item-name";
      name.textContent = `${idx + 1}. ${it.file.name}`;

      const meta = document.createElement("div");
      meta.className = "pdf-merge-item-meta";

      const pagePart = it.locked
        ? "🔒 Locked"
        : typeof it.pages === "number"
          ? `${it.pages} page${it.pages === 1 ? "" : "s"}`
          : "Analyzing…";

      meta.textContent = `${formatBytes(it.file.size)} • ${pagePart}`;

      left.appendChild(name);
      left.appendChild(meta);

      const controls = document.createElement("div");
      controls.className = "pdf-merge-item-controls";

      const upBtn = document.createElement("button");
      upBtn.className = "tool-btn-icon";
      upBtn.innerHTML = "↑";
      upBtn.disabled = idx === 0;
      upBtn.setAttribute("aria-label", "Move up");
      upBtn.addEventListener("click", () => moveItem(idx, idx - 1));

      const downBtn = document.createElement("button");
      downBtn.className = "tool-btn-icon";
      downBtn.innerHTML = "↓";
      downBtn.disabled = idx === items.length - 1;
      downBtn.setAttribute("aria-label", "Move down");
      downBtn.addEventListener("click", () => moveItem(idx, idx + 1));

      const removeBtn = document.createElement("button");
      removeBtn.className = "tool-btn-outline-small";
      removeBtn.textContent = "Remove";
      removeBtn.addEventListener("click", () => {
        items.splice(idx, 1);
        if (!items.length) resetUI();
        else {
          render();
          syncButtons();
        }
      });

      controls.appendChild(upBtn);
      controls.appendChild(downBtn);
      controls.appendChild(removeBtn);

      row.appendChild(left);
      row.appendChild(controls);

      listEl.appendChild(row);
    });
  }

  function moveItem(from, to) {
    if (to < 0 || to >= items.length) return;
    const [moved] = items.splice(from, 1);
    items.splice(to, 0, moved);
    render();
    syncButtons();
  }

  // ------------- Output naming -------------

  function makeMergedName(items) {
    if (!items.length) return "merged.pdf";

    const first = items[0]?.file?.name ?? "merged.pdf";
    const base = first.replace(/\.pdf$/i, "");
    const count = items.length;

    if (count <= 1) return `${sanitizeBase(base)}.pdf`;

    return `${sanitizeBase(base)}+${count - 1}.pdf`;
  }

  function sanitizeBase(name) {
    return name.replace(/[^\w\-]+/g, "_").slice(0, 60) || "merged";
  }

  // ------------- Status -------------

  function clearStatus() {
    statusEl.textContent = "";
    statusEl.className = "";
  }

  function setError(msg) {
    statusEl.textContent = msg;
    statusEl.className = "tool-status-error";
  }

  function setStatus(msg) {
    statusEl.textContent = msg;
    statusEl.className = "tool-status-info";
  }

  function setSuccess(msg) {
    statusEl.textContent = msg;
    statusEl.className = "tool-status-success";
  }

  // ------------- Reset -------------

  function resetUI() {
    items = [];
    fileInput.value = "";

    uploadSection.style.display = "block";
    workspaceSection.style.display = "none";

    summaryTitle.textContent = "—";
    summaryMeta.textContent = "—";
    pagesTotalEl.textContent = "—";
    listEl.innerHTML = "";
    lockedNote.style.display = "none";

    mergeBtn.disabled = true;
    clearBtn.disabled = true;

    // Re-enable footer peek
    const toolMain = document.getElementById("toolMain");
    if (toolMain) {
      toolMain.dataset.disableFooterPeek = "false";
      toolMain.classList.add("has-extra-space");
      if (typeof adjustFooterPeek === "function") {
        adjustFooterPeek();
      }
    }

    // Show subtitle
    const pageSubtitle = document.getElementById("pageSubtitle");
    if (pageSubtitle) {
      pageSubtitle.classList.remove("hidden");
    }

    clearStatus();
  }

  // ------------- Helpers -------------

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
});