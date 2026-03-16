const uploadZone = document.getElementById("uploadZone");
const fileInput = document.getElementById("fileInput");
const uploadPrompt = document.getElementById("uploadPrompt");
const fileSummary = document.getElementById("fileSummary");
const chooseDifferent = document.getElementById("chooseDifferent");
const thumb = document.getElementById("thumb");
const fileName = document.getElementById("fileName");
const fileSize = document.getElementById("fileSize");

const infoGrid = document.getElementById("infoGrid");
const dimensionInfoEl = document.getElementById("dimensionInfo");
const propertyInfoEl = document.getElementById("propertyInfo");
const statusEl = document.getElementById("status");

let currentThumbUrl = null;

/* ---------------- Upload handling ---------------- */

uploadZone.addEventListener("click", (e) => {
  if (e.target === chooseDifferent) return;
  fileInput.click();
});

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
  if (file) await loadFile(file);
  fileInput.value = "";
});

fileInput.addEventListener("change", async (e) => {
  const file = e.target?.files?.[0] ?? null;
  if (file) await loadFile(file);
});

chooseDifferent.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();
  fileInput.click();
});

/* ---------------- File loading ---------------- */

async function loadFile(file) {
  resetUI();
  if (!file) return;

  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    setError("Please upload a JPG, PNG, or WebP image.");
    return;
  }

  try {
    setStatus("Reading image...");

    const dims = await getImageDimensions(file);

    const mp = (dims.width * dims.height) / 1_000_000;
    const aspect = simplifyRatio(dims.width, dims.height);
    const orientation = getOrientation(dims.width, dims.height);
    const uncompressedBytes = dims.width * dims.height * 4;

    let hasAlpha = false;
    if (file.type !== "image/jpeg") {
      hasAlpha = await detectAlpha(file, dims);
    }

    const header = await tryReadHeader(file, 256 * 1024);
    const props = header ? parseImagePropertiesFromHeader(header, file.type) : null;

    fileName.textContent = file.name;
    fileSize.textContent = formatBytes(file.size);

    currentThumbUrl = URL.createObjectURL(file);
    thumb.src = currentThumbUrl;

    uploadPrompt.classList.add("hidden");
    fileSummary.classList.remove("hidden");
    uploadZone.classList.add("has-file");

    renderDimensionsSection(dims, mp, aspect, orientation, uncompressedBytes);
    renderPropertiesSection(file.type, hasAlpha, props);

    infoGrid.classList.remove("hidden");
    clearStatus();
  } catch (err) {
    console.error(err);
    setError("Something went wrong while reading this image.");
  }
}

function resetUI() {
  dimensionInfoEl.innerHTML = "";
  propertyInfoEl.innerHTML = "";
  infoGrid.classList.add("hidden");

  uploadPrompt.classList.remove("hidden");
  fileSummary.classList.add("hidden");
  uploadZone.classList.remove("has-file");

  if (currentThumbUrl) {
    URL.revokeObjectURL(currentThumbUrl);
    currentThumbUrl = null;
  }

  thumb.removeAttribute("src");
  clearStatus();
}

/* ---------------- Rendering ---------------- */

function renderDimensionsSection(dims, mp, aspect, orientation, uncompressedBytes) {
  dimensionInfoEl.innerHTML = "";
  addRow(dimensionInfoEl, "Dimensions", `${dims.width} × ${dims.height}`);
  addRow(dimensionInfoEl, "Megapixels", `${mp.toFixed(2)} MP`);
  addRow(dimensionInfoEl, "Aspect ratio", `${aspect.a}:${aspect.b}`);
  addRow(dimensionInfoEl, "Orientation", orientation);
  addRow(dimensionInfoEl, "Uncompressed memory", formatBytes(uncompressedBytes));
}

function renderPropertiesSection(mimeType, hasAlpha, props) {
  propertyInfoEl.innerHTML = "";

  const bitDepth = props?.bitDepth != null ? `${props.bitDepth}-bit` : "Unknown";

  let progressive = "N/A";
  let interlaced = "N/A";

  if (mimeType === "image/jpeg") {
    progressive = props?.progressive != null ? (props.progressive ? "Yes" : "No") : "Unknown";
  }

  if (mimeType === "image/png") {
    interlaced = props?.interlaced != null ? (props.interlaced ? "Yes" : "No") : "Unknown";
  }

  addRow(propertyInfoEl, "Bit depth", bitDepth);
  addRow(propertyInfoEl, "Transparency", hasAlpha ? "Yes" : "No");
  addRow(propertyInfoEl, "Progressive JPEG", progressive);
  addRow(propertyInfoEl, "Interlaced PNG", interlaced);
}

/* ---------------- Image analysis ---------------- */

async function getImageDimensions(file) {
  const bmp = await createImageBitmap(file);
  const out = { width: bmp.width, height: bmp.height };
  bmp.close?.();
  return out;
}

async function detectAlpha(file, dims) {
  const img = await fileToImage(file);

  const maxSide = 256;
  const scale = Math.min(1, maxSide / Math.max(dims.width, dims.height));
  const w = Math.max(1, Math.round(dims.width * scale));
  const h = Math.max(1, Math.round(dims.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);

  const data = ctx.getImageData(0, 0, w, h).data;

  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 255) return true;
  }

  return false;
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

/* ---------------- Header parsing ---------------- */

async function tryReadHeader(file, maxBytes) {
  try {
    const slice = file.slice(0, Math.min(file.size, maxBytes));
    return await slice.arrayBuffer();
  } catch {
    return null;
  }
}

function parseImagePropertiesFromHeader(buffer, mimeType) {
  const u8 = new Uint8Array(buffer);

  if (mimeType === "image/png") return parsePngProps(u8);
  if (mimeType === "image/jpeg") return parseJpegProps(u8);
  if (mimeType === "image/webp") return {};

  return {};
}

function parsePngProps(u8) {
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < sig.length; i++) {
    if (u8[i] !== sig[i]) return {};
  }

  const bitDepth = u8[24];
  const interlace = u8[28];

  return {
    bitDepth: Number.isFinite(bitDepth) ? bitDepth : null,
    interlaced: interlace === 1
  };
}

function parseJpegProps(u8) {
  if (u8[0] !== 0xff || u8[1] !== 0xd8) return {};

  let i = 2;
  let progressive = null;
  let precision = null;

  while (i < u8.length - 1) {
    if (u8[i] !== 0xff) {
      i++;
      continue;
    }

    while (u8[i] === 0xff) i++;
    const marker = u8[i++];

    if (marker === 0xd9 || marker === 0xda) break;
    if (marker >= 0xd0 && marker <= 0xd7) continue;

    if (i + 1 >= u8.length) break;
    const len = (u8[i] << 8) | u8[i + 1];
    if (len < 2) break;

    if (marker === 0xc0 || marker === 0xc2) {
      progressive = marker === 0xc2;
      const pIndex = i + 2;
      if (pIndex < u8.length) precision = u8[pIndex];
      break;
    }

    i += len;
  }

  return {
    progressive,
    bitDepth: precision != null ? precision : 8
  };
}

/* ---------------- UI helpers ---------------- */

function addRow(containerEl, label, value) {
  const row = document.createElement("div");
  row.className = "tool-image-info-row";

  const labelEl = document.createElement("span");
  labelEl.className = "tool-image-info-label";
  labelEl.textContent = label;

  const valueEl = document.createElement("span");
  valueEl.className = "tool-image-info-value";
  valueEl.textContent = value;

  row.appendChild(labelEl);
  row.appendChild(valueEl);
  containerEl.appendChild(row);
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
}

function gcd(a, b) {
  while (b !== 0) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a;
}

function simplifyRatio(w, h) {
  const g = gcd(w, h);
  return { a: Math.round(w / g), b: Math.round(h / g) };
}

function getOrientation(w, h) {
  if (w === h) return "Square";
  return w > h ? "Landscape" : "Portrait";
}

/* ---------------- Status ---------------- */

function setError(msg) {
  statusEl.textContent = msg;
  statusEl.className = "tool-status-error";
}

function setStatus(msg) {
  statusEl.textContent = msg;
  statusEl.className = "tool-status-message";
}

function clearStatus() {
  statusEl.textContent = "";
  statusEl.className = "tool-status-message";
}