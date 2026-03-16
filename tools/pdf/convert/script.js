import * as pdfjsLib from '/assets/vendor/pdfjs/pdf.min.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc =
  '/assets/vendor/pdfjs/pdf.worker.min.mjs';

const uploadZone = document.getElementById("uploadZone");
const uploadPrompt = document.getElementById("uploadPrompt");
const fileSummary = document.getElementById("fileSummary");

const fileInput = document.getElementById("fileInput");
const chooseDifferent = document.getElementById("chooseDifferent");

const fileNameEl = document.getElementById("fileName");
const fileSizeEl = document.getElementById("fileSize");
const pageCountEl = document.getElementById("pageCount");

const settingsPanel = document.getElementById("settingsPanel");

const formatSelect = document.getElementById("formatSelect");
const scaleInput = document.getElementById("scaleInput");
const scaleVal = document.getElementById("scaleVal");

const convertBtn = document.getElementById("convertBtn");
const statusEl = document.getElementById("status");

let currentFile = null;
let pdfDoc = null;

/* Upload zone */

uploadZone.addEventListener("click", () => fileInput.click());

uploadZone.addEventListener("dragover", e => {
  e.preventDefault();
  uploadZone.classList.add("drag-over");
});

uploadZone.addEventListener("dragleave", () => {
  uploadZone.classList.remove("drag-over");
});

uploadZone.addEventListener("drop", async e => {
  e.preventDefault();
  uploadZone.classList.remove("drag-over");

  const file = e.dataTransfer.files?.[0];
  loadFile(file);
});

fileInput.addEventListener("change", e => {
  loadFile(e.target.files?.[0]);
});

chooseDifferent.addEventListener("click", e => {
  e.preventDefault();
  fileInput.click();
});

/* Slider */

scaleInput.addEventListener("input", () => {
  scaleVal.textContent = `${scaleInput.value}×`;
});

/* Convert */

convertBtn.addEventListener("click", async () => {

  if (!pdfDoc) return;

  setStatus("Rendering pages…");
  convertBtn.disabled = true;

  try {

    const format = formatSelect.value;
    const scale = Number(scaleInput.value);

    const zip = new JSZip();

    for (let i = 1; i <= pdfDoc.numPages; i++) {

      setStatus(`Processing page ${i} of ${pdfDoc.numPages}…`);

      const page = await pdfDoc.getPage(i);

      const viewport = page.getViewport({ scale });

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({
        canvasContext: ctx,
        viewport
      }).promise;

      const blob = await new Promise(res =>
        canvas.toBlob(res, format === "png" ? "image/png" : "image/jpeg", 0.92)
      );

      zip.file(`page-${i}.${format}`, blob);

    }

    setStatus("Preparing download…");

    const zipBlob = await zip.generateAsync({ type: "blob" });

    downloadBlob("pdf-images.zip", zipBlob);

    setSuccess("Done.");

  }
  catch (err) {

    console.error(err);
    setError("Conversion failed.");

  }

  convertBtn.disabled = false;

});

/* Load file */

async function loadFile(file) {

  resetUI();

  if (!file || file.type !== "application/pdf") {
    setError("Please upload a PDF file.");
    return;
  }

  currentFile = file;

  try {

    const arrayBuffer = await file.arrayBuffer();

    pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    fileNameEl.textContent = file.name;
    fileSizeEl.textContent = formatBytes(file.size);
    pageCountEl.textContent = pdfDoc.numPages;

    uploadPrompt.classList.add("hidden");
    fileSummary.classList.remove("hidden");
    uploadZone.classList.add("has-file");

    settingsPanel.classList.remove("hidden");

  }
  catch (err) {

    console.error(err);
    setError("Unable to read this PDF.");

  }

}

/* Helpers */

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

  return `${(kb / 1024).toFixed(2)} MB`;

}

/* Status */

function clearStatus() {
  statusEl.textContent = "";
  statusEl.classList.remove("error");
}

function setStatus(msg) {
  statusEl.textContent = msg;
  statusEl.classList.remove("error");
}

function setError(msg) {
  statusEl.textContent = msg;
  statusEl.classList.add("error");
}

function setSuccess(msg) {
  statusEl.textContent = msg;
  statusEl.classList.remove("error");
}

function resetUI() {

  pdfDoc = null;
  currentFile = null;

  uploadPrompt.classList.remove("hidden");
  fileSummary.classList.add("hidden");
  uploadZone.classList.remove("has-file");

  settingsPanel.classList.add("hidden");

  clearStatus();

}
