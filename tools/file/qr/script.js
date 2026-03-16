const qrInput = document.getElementById("qrInput");
const sizeSelect = document.getElementById("sizeSelect");
const formatSelect = document.getElementById("formatSelect");
const marginSelect = document.getElementById("marginSelect");
const errorCorrectionSelect = document.getElementById("errorCorrectionSelect");

const previewEmpty = document.getElementById("previewEmpty");
const qrPreview = document.getElementById("qrPreview");
const previewMeta = document.getElementById("previewMeta");

const downloadBtn = document.getElementById("downloadBtn");
const copyBtn = document.getElementById("copyBtn");
const clearBtn = document.getElementById("clearBtn");
const statusEl = document.getElementById("status");

let qrCode = null;

/* ---------------- Init ---------------- */

initQrCode();
updatePreview();

/* ---------------- Events ---------------- */

qrInput.addEventListener("input", () => {
  clearStatus();
  updatePreview();
});

sizeSelect.addEventListener("change", () => {
  clearStatus();
  updatePreview();
});

formatSelect.addEventListener("change", () => {
  clearStatus();
  updatePreviewMeta();
});

marginSelect.addEventListener("change", () => {
  clearStatus();
  updatePreview();
});

errorCorrectionSelect.addEventListener("change", () => {
  clearStatus();
  updatePreview();
});

downloadBtn.addEventListener("click", async () => {
  const value = getInputValue();
  if (!value || !qrCode) return;

  try {
    setStatus("Preparing download...");

    const extension = formatSelect.value;
    const filename = makeFileName(value);

    await qrCode.download({
      name: filename,
      extension
    });

    setSuccess("Done.");
  } catch (err) {
    console.error(err);
    setError("Something went wrong while downloading the QR code.");
  }
});

copyBtn.addEventListener("click", async () => {
  const value = getInputValue();
  if (!value || !qrCode) return;

  try {
    if (!supportsImageClipboard()) {
      setError("Image copy is not supported in this browser.");
      return;
    }

    setStatus("Copying image...");

    const blob = await qrCode.getRawData("png");
    if (!blob) {
      setError("Could not copy the QR image.");
      return;
    }

    await navigator.clipboard.write([
      new ClipboardItem({
        [blob.type]: blob
      })
    ]);

    setSuccess("Copied image.");
  } catch (err) {
    console.error(err);
    setError("Could not copy the QR image.");
  }
});

clearBtn.addEventListener("click", () => {
  qrInput.value = "";
  sizeSelect.value = "512";
  formatSelect.value = "png";
  marginSelect.value = "8";
  errorCorrectionSelect.value = "M";

  clearStatus();
  updatePreview();
});

/* ---------------- QR setup ---------------- */

function initQrCode() {
  if (!window.QRCodeStyling) {
    setError("QR library failed to load.");
    return;
  }

  qrCode = new window.QRCodeStyling({
    width: getSize(),
    height: getSize(),
    type: "canvas",
    data: "",
    margin: getMargin(),
    qrOptions: {
      errorCorrectionLevel: getErrorCorrection()
    },
    dotsOptions: {
      color: "#111111",
      type: "square"
    },
    backgroundOptions: {
      color: "#ffffff"
    }
  });

  qrPreview.innerHTML = "";
  qrCode.append(qrPreview);
}

function updatePreview() {
  const value = getInputValue();
  const hasValue = value.length > 0;

  updatePreviewMeta();

  if (!qrCode) return;

  if (!hasValue) {
    previewEmpty.classList.remove("hidden");
    qrPreview.classList.add("hidden");
    downloadBtn.disabled = true;
    copyBtn.disabled = true;

    qrCode.update({
      data: "",
      width: getSize(),
      height: getSize(),
      margin: getMargin(),
      qrOptions: {
        errorCorrectionLevel: getErrorCorrection()
      }
    });

    return;
  }

  previewEmpty.classList.add("hidden");
  qrPreview.classList.remove("hidden");

  qrCode.update({
    data: value,
    width: getSize(),
    height: getSize(),
    margin: getMargin(),
    qrOptions: {
      errorCorrectionLevel: getErrorCorrection()
    }
  });

  downloadBtn.disabled = false;
  copyBtn.disabled = false;
}

function updatePreviewMeta() {
  const format = formatSelect.value.toUpperCase();
  const size = getSize();
  previewMeta.textContent = `${format} • ${size} × ${size}`;
}

/* ---------------- Helpers ---------------- */

function getInputValue() {
  return qrInput.value.trim();
}

function getSize() {
  return Number(sizeSelect.value);
}

function getMargin() {
  return Number(marginSelect.value);
}

function getErrorCorrection() {
  return errorCorrectionSelect.value;
}

function makeFileName(value) {
  if (!value) return "qr-code";

  const cleaned = value
    .replace(/^https?:\/\//i, "")
    .replace(/^mailto:/i, "")
    .replace(/^tel:/i, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

  const base = cleaned.slice(0, 40);

  if (!base) return "qr-code";

  return `${base}-qr`;
}

function supportsImageClipboard() {
  return !!(
    navigator.clipboard &&
    navigator.clipboard.write &&
    window.ClipboardItem
  );
}

/* ---------------- Status ---------------- */

function clearStatus() {
  statusEl.textContent = "";
  statusEl.className = "tool-status-message";
}

function setStatus(msg) {
  statusEl.textContent = msg;
  statusEl.className = "tool-status-message";
}

function setSuccess(msg) {
  statusEl.textContent = msg;
  statusEl.className = "tool-status-success";
}

function setError(msg) {
  statusEl.textContent = msg;
  statusEl.className = "tool-status-error";
}