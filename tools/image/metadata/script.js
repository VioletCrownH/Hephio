import * as exifr from "https://cdn.jsdelivr.net/npm/exifr@7.1.3/dist/full.esm.mjs";

document.addEventListener("DOMContentLoaded", () => {
  const uploadSection = document.getElementById("uploadSection");
  const workspaceSection = document.getElementById("workspaceSection");

  const uploadZone = document.getElementById("uploadZone");
  const fileInput = document.getElementById("fileInput");
  const changeFileBtn = document.getElementById("changeFileBtn");

  const fileNameEl = document.getElementById("fileName");
  const fileMetaEl = document.getElementById("fileMeta");

  const filePreviewImage = document.getElementById("filePreviewImage");
  const filePreviewFallback = document.getElementById("filePreviewFallback");

  const fileInfoBlock = document.getElementById("fileInfoBlock");
  const metaBlock = document.getElementById("metaBlock");

  const stripBtn = document.getElementById("stripBtn");
  const downloadBtn = document.getElementById("downloadBtn");

  const statusEl = document.getElementById("status");

  const required = [
    uploadSection,
    workspaceSection,
    uploadZone,
    fileInput,
    changeFileBtn,
    fileNameEl,
    fileMetaEl,
    filePreviewImage,
    filePreviewFallback,
    fileInfoBlock,
    metaBlock,
    stripBtn,
    downloadBtn,
    statusEl,
  ];

  if (required.some((el) => !el)) {
    console.error("Metadata: Missing expected DOM elements. Check HTML IDs.");
    if (statusEl) {
      statusEl.textContent = "Setup error: missing page elements (check console).";
      statusEl.style.color = "#b91c1c";
    }
    return;
  }

  let currentFile = null;
  let cleanBlob = null;
  let dims = null;
  let previewUrl = null;

  /* ---------------- Upload Wiring ---------------- */

  uploadZone.addEventListener("click", () => fileInput.click());

  uploadZone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fileInput.click();
    }
  });

  changeFileBtn.addEventListener("click", () => {
    resetToUpload();
    fileInput.click();
  });

  fileInput.addEventListener("change", async (e) => {
    const file = e.target.files?.[0] ?? null;
    await loadFile(file);
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
  });

  /* ---------------- Button Wiring ---------------- */

  stripBtn.addEventListener("click", async () => {
    if (!currentFile) return;
    await stripMetadata(currentFile);
  });

  downloadBtn.addEventListener("click", () => {
    if (!currentFile || !cleanBlob) return;
    downloadCleaned(currentFile.name, cleanBlob);
  });

  /* ---------------- Load File ---------------- */

  async function loadFile(file) {
    clearStatus();
    if (!file) return;

    if (!["image/jpeg", "image/png"].includes(file.type)) {
      setError("Please upload a JPG or PNG image.");
      return;
    }

    try {
      setStatus("Loading image…");

      currentFile = file;
      cleanBlob = null;
      dims = null;

      downloadBtn.disabled = true;
      downloadBtn.style.display = "none";
      stripBtn.disabled = true;

      try {
        dims = await getImageDimensions(file);
      } catch {
        setError("Something went wrong while reading this image.");
        return;
      }

      uploadSection.style.display = "none";
      workspaceSection.style.display = "block";

      const toolMain = document.getElementById("toolMain");
      if (toolMain) {
        toolMain.classList.remove("has-extra-space");
        toolMain.style.height = "auto";
      }

      const pageSubtitle = document.getElementById("pageSubtitle");
      if (pageSubtitle) {
        pageSubtitle.classList.add("hidden");
      }

      fileNameEl.textContent = file.name;
      fileMetaEl.textContent = `${formatBytes(file.size)} • ${dims.width} × ${dims.height}`;

      renderPreview(file);
      renderFileInfo(file, dims);

      try {
        const meta = await extractMetadata(file);
        renderMetadata(meta);
      } catch {
        renderMetadata(null);
      }

      stripBtn.disabled = false;
      clearStatus();
    } catch (err) {
      console.error(err);
      setError("Something went wrong while loading this image.");
      resetToUpload();
    }
  }

  function resetToUpload() {
    currentFile = null;
    cleanBlob = null;
    dims = null;
    fileInput.value = "";

    clearPreview();

    stripBtn.disabled = true;
    downloadBtn.disabled = true;
    downloadBtn.style.display = "none";

    fileInfoBlock.innerHTML = "";
    metaBlock.innerHTML = "";

    workspaceSection.style.display = "none";
    uploadSection.style.display = "block";

    const toolMain = document.getElementById("toolMain");
    if (toolMain) {
      toolMain.classList.add("has-extra-space");
      toolMain.style.height = "auto";
    }

    const pageSubtitle = document.getElementById("pageSubtitle");
    if (pageSubtitle) {
      pageSubtitle.classList.remove("hidden");
    }

    clearStatus();
  }

  /* ---------------- Preview ---------------- */

  function renderPreview(file) {
    clearPreview();

    previewUrl = URL.createObjectURL(file);
    filePreviewImage.src = previewUrl;
    filePreviewImage.classList.remove("hidden");
    filePreviewFallback.classList.add("hidden");
  }

  function clearPreview() {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      previewUrl = null;
    }

    filePreviewImage.removeAttribute("src");
    filePreviewImage.classList.add("hidden");
    filePreviewFallback.classList.remove("hidden");
  }

  /* ---------------- Metadata Extraction ---------------- */

  async function extractMetadata(file) {
    const raw = await exifr.parse(file, {
      gps: true,
      translateValues: true,
    });

    if (!raw) return null;

    const meta = normalizeMeta(raw);
    return hasAnyMeta(meta) ? meta : null;
  }

  function normalizeMeta(raw) {
    const date =
      raw.DateTimeOriginal ||
      raw.CreateDate ||
      raw.ModifyDate ||
      null;

    const cameraMake = cleanString(raw.Make);
    const cameraModel = cleanString(raw.Model);

    const lat = typeof raw.latitude === "number" ? raw.latitude : null;
    const lon = typeof raw.longitude === "number" ? raw.longitude : null;

    return {
      dateTaken:
        date instanceof Date
          ? date.toISOString()
          : typeof date === "string"
            ? date
            : null,
      cameraMake,
      cameraModel,
      gps:
        lat !== null && lon !== null
          ? { lat: roundCoord(lat), lon: roundCoord(lon) }
          : null,
    };
  }

  function hasAnyMeta(meta) {
    return Boolean(
      meta?.dateTaken ||
      meta?.cameraMake ||
      meta?.cameraModel ||
      meta?.gps
    );
  }

  function cleanString(val) {
    if (!val) return null;
    const s = String(val).trim();
    return s.length ? s : null;
  }

  function roundCoord(n) {
    return Math.round(n * 1e5) / 1e5;
  }

  /* ---------------- Render UI ---------------- */

  function renderFileInfo(file, dimsObj) {
    fileInfoBlock.innerHTML = "";

    addInfoRow(fileInfoBlock, "File name", file.name);
    addInfoRow(fileInfoBlock, "File size", formatBytes(file.size));
    addInfoRow(fileInfoBlock, "File type", file.type);

    if (dimsObj) {
      addInfoRow(fileInfoBlock, "Dimensions", `${dimsObj.width} × ${dimsObj.height}`);
    }
  }

  function renderMetadata(meta) {
    metaBlock.innerHTML = "";

    if (!meta) {
      const empty = document.createElement("p");
      empty.className = "tool-info-empty";
      empty.textContent = "No embedded metadata found in this image.";
      metaBlock.appendChild(empty);
      return;
    }

    if (meta.dateTaken) {
      addInfoRow(metaBlock, "Date taken", formatDate(meta.dateTaken));
    }
    if (meta.cameraMake) {
      addInfoRow(metaBlock, "Camera make", meta.cameraMake);
    }
    if (meta.cameraModel) {
      addInfoRow(metaBlock, "Camera model", meta.cameraModel);
    }
    if (meta.gps) {
      addInfoRow(metaBlock, "GPS coordinates", `${meta.gps.lat}, ${meta.gps.lon}`);
    }
  }

  function addInfoRow(container, label, value) {
    if (!value) return;

    const row = document.createElement("div");
    row.className = "tool-meta-row";

    const labelEl = document.createElement("span");
    labelEl.className = "tool-meta-label";
    labelEl.textContent = label;

    const valueEl = document.createElement("span");
    valueEl.className = "tool-meta-value";
    valueEl.textContent = value;

    row.appendChild(labelEl);
    row.appendChild(valueEl);
    container.appendChild(row);
  }

  /* ---------------- Strip Metadata ---------------- */

  async function stripMetadata(file) {
    setStatus("Removing metadata…");

    try {
      const img = await fileToImage(file);

      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;

      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("No 2D canvas context");

      ctx.drawImage(img, 0, 0);

      const outType = file.type === "image/png" ? "image/png" : "image/jpeg";
      cleanBlob = await canvasToBlob(canvas, outType, 0.92);

      renderMetadata(null);

      downloadBtn.disabled = false;
      downloadBtn.style.display = "block";
      stripBtn.disabled = true;

      setStatus("Metadata removed successfully. Download your cleaned image.");
    } catch (err) {
      console.error(err);
      setError("Something went wrong while processing this image.");
    }
  }

  /* ---------------- Download ---------------- */

  function downloadCleaned(originalName, blob) {
    const cleanName = makeCleanFilename(originalName, blob.type);
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = cleanName;
    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);
  }

  function makeCleanFilename(originalName, mimeType) {
    const base = originalName.replace(/\.[^.]+$/, "");
    const ext = mimeType === "image/png" ? "png" : "jpg";
    return `${base}-clean.${ext}`;
  }

  /* ---------------- Helpers ---------------- */

  async function getImageDimensions(file) {
    const bmp = await createImageBitmap(file);
    const out = { width: bmp.width, height: bmp.height };
    bmp.close?.();
    return out;
  }

  function fileToImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();

      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Image decode failed"));
      };

      img.src = url;
    });
  }

  function canvasToBlob(canvas, type, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) reject(new Error("toBlob returned null"));
          else resolve(blob);
        },
        type,
        type === "image/jpeg" ? quality : undefined
      );
    });
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(2)} MB`;
  }

  function formatDate(dateStr) {
    try {
      const d = new Date(dateStr);
      return d.toLocaleString();
    } catch {
      return dateStr;
    }
  }

  function setError(msg) {
    statusEl.textContent = msg;
    statusEl.style.color = "#b91c1c";
  }

  function setStatus(msg) {
    statusEl.textContent = msg;
    statusEl.style.color = "#64748b";
  }

  function clearStatus() {
    statusEl.textContent = "";
    statusEl.style.color = "#64748b";
  }
});