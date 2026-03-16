const uploadZone = document.getElementById("uploadZone");
const uploadPrompt = document.getElementById("uploadPrompt");
const fileSummary = document.getElementById("fileSummary");
const fileInput = document.getElementById("fileInput");
const chooseDifferent = document.getElementById("chooseDifferent");

const fileNameEl = document.getElementById("fileName");
const fileSizeEl = document.getElementById("fileSize");
const fileTypeEl = document.getElementById("fileType");

const inputText = document.getElementById("inputText");
const dataUrlCheckbox = document.getElementById("dataUrlCheckbox");

const encodeTextBtn = document.getElementById("encodeTextBtn");
const decodeTextBtn = document.getElementById("decodeTextBtn");
const encodeFileBtn = document.getElementById("encodeFileBtn");

const statusEl = document.getElementById("status");

const resultSection = document.getElementById("resultSection");
const outputText = document.getElementById("outputText");
const outputMeta = document.getElementById("outputMeta");

const copyBtn = document.getElementById("copyBtn");
const downloadBtn = document.getElementById("downloadBtn");
const clearBtn = document.getElementById("clearBtn");

let currentFile = null;

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

/* ---------------- Actions ---------------- */

encodeTextBtn.addEventListener("click", () => {
  clearStatus();

  const value = inputText.value;
  if (!value.trim()) {
    setError("Paste some text to encode.");
    return;
  }

  try {
    const encoded = utf8ToBase64(value);
    setOutput(encoded);
    setSuccess("Text encoded.");
  } catch (err) {
    console.error(err);
    setError("Something went wrong while encoding the text.");
  }
});

decodeTextBtn.addEventListener("click", () => {
  clearStatus();

  const value = inputText.value;
  if (!value.trim()) {
    setError("Paste Base64 to decode.");
    return;
  }

  try {
    const decoded = base64ToUtf8(value);
    setOutput(decoded);
    setSuccess("Base64 decoded.");
  } catch (err) {
    console.error(err);
    setError("That does not appear to be valid Base64 text.");
  }
});

encodeFileBtn.addEventListener("click", async () => {
  clearStatus();

  if (!currentFile) {
    setError("Choose a file first.");
    return;
  }

  setBusy(true);
  setStatus("Encoding file...");

  try {
    const bytes = await currentFile.arrayBuffer();
    let encoded = bytesToBase64(new Uint8Array(bytes));

    if (dataUrlCheckbox.checked) {
      const mime = currentFile.type || "application/octet-stream";
      encoded = `data:${mime};base64,${encoded}`;
    }

    setOutput(encoded);
    setSuccess("File encoded.");
  } catch (err) {
    console.error(err);
    setError("Something went wrong while encoding the file.");
  } finally {
    setBusy(false);
  }
});

copyBtn.addEventListener("click", async () => {
  if (!outputText.value) return;

  const ok = await copyToClipboard(outputText.value);
  if (ok) {
    setSuccess("Copied to clipboard.");
  } else {
    setError("Could not copy automatically. Please copy the output manually.");
  }
});

downloadBtn.addEventListener("click", async () => {
  if (!outputText.value) return;

  const filename = makeOutputFilename();
  await downloadTextFile(filename, outputText.value);
});

clearBtn.addEventListener("click", () => {
  resetUI();
});

/* ---------------- File load + UI state ---------------- */

function resetUI() {
  currentFile = null;

  uploadZone.classList.remove("has-file");
  uploadPrompt.classList.remove("hidden");
  fileSummary.classList.add("hidden");

  fileNameEl.textContent = "—";
  fileSizeEl.textContent = "—";
  fileTypeEl.textContent = "—";

  inputText.value = "";
  outputText.value = "";
  outputMeta.textContent = "0 characters";
  resultSection.classList.add("hidden");

  dataUrlCheckbox.checked = false;

  clearStatus();
  setBusy(false);
  syncOutputButtons();
}

async function loadFile(file) {
  if (!file) return;

  clearStatus();
  currentFile = file;

  uploadZone.classList.add("has-file");
  uploadPrompt.classList.add("hidden");
  fileSummary.classList.remove("hidden");

  fileNameEl.textContent = file.name;
  fileSizeEl.textContent = formatBytes(file.size);
  fileTypeEl.textContent = file.type || "Unknown";

  // If it looks like a text file, load it into the textarea for Encode Text / Decode Base64.
  if (isTextLikeFile(file)) {
    try {
      const text = await file.text();
      inputText.value = text;
      setSuccess("Text file loaded. You can encode or decode it.");
    } catch (err) {
      console.error(err);
      setError("File selected, but its text could not be read.");
    }
  } else {
    setSuccess("File ready to encode.");
  }

  syncOutputButtons();
}

/* ---------------- Output ---------------- */

function setOutput(value) {
  outputText.value = value;
  outputMeta.textContent = formatCount(value.length);
  resultSection.classList.remove("hidden");
  syncOutputButtons();
}

function formatCount(count) {
  return count === 1 ? "1 character" : `${count.toLocaleString()} characters`;
}

function syncOutputButtons() {
  const hasOutput = !!outputText.value;
  copyBtn.disabled = !hasOutput;
  downloadBtn.disabled = !hasOutput;
}

/* ---------------- Base64 helpers ---------------- */

function utf8ToBase64(text) {
  const bytes = new TextEncoder().encode(text);
  return bytesToBase64(bytes);
}

function base64ToUtf8(input) {
  const cleaned = normalizeBase64Input(input);
  const bytes = base64ToBytes(cleaned);
  return new TextDecoder().decode(bytes);
}

function normalizeBase64Input(input) {
  let value = String(input).trim();

  const commaIndex = value.indexOf(",");
  if (value.startsWith("data:") && commaIndex !== -1) {
    value = value.slice(commaIndex + 1);
  }

  value = value.replace(/\s+/g, "");
  value = value.replace(/-/g, "+").replace(/_/g, "/");

  const paddingNeeded = value.length % 4;
  if (paddingNeeded === 2) value += "==";
  else if (paddingNeeded === 3) value += "=";
  else if (paddingNeeded === 1) {
    throw new Error("Invalid Base64 length");
  }

  return value;
}

function bytesToBase64(bytes) {
  const chunkSize = 0x8000;
  let binary = "";

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

/* ---------------- Clipboard / download ---------------- */

async function copyToClipboard(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through
  }

  try {
    outputText.removeAttribute("readonly");
    outputText.select();
    outputText.setSelectionRange(0, outputText.value.length);
    const ok = document.execCommand("copy");
    outputText.setAttribute("readonly", "readonly");
    return ok;
  } catch {
    outputText.setAttribute("readonly", "readonly");
    return false;
  }
}

async function downloadTextFile(filename, content) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
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

function makeOutputFilename() {
  if (currentFile && outputText.value.startsWith("data:")) {
    return `${stripExtension(currentFile.name)}-base64-data-url.txt`;
  }

  if (currentFile) {
    return `${stripExtension(currentFile.name)}-base64.txt`;
  }

  return "base64-output.txt";
}

function stripExtension(name) {
  return name.replace(/\.[^.]+$/, "");
}

/* ---------------- Status UI ---------------- */

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

function setBusy(isBusy) {
  encodeTextBtn.disabled = isBusy;
  decodeTextBtn.disabled = isBusy;
  encodeFileBtn.disabled = isBusy;
  copyBtn.disabled = isBusy || !outputText.value;
  downloadBtn.disabled = isBusy || !outputText.value;
}

/* ---------------- Helpers ---------------- */

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
}

function isTextLikeFile(file) {
  const type = file.type || "";
  const name = (file.name || "").toLowerCase();

  return (
    type.startsWith("text/") ||
    type.includes("json") ||
    type.includes("xml") ||
    type.includes("javascript") ||
    type.includes("ecmascript") ||
    name.endsWith(".txt") ||
    name.endsWith(".json") ||
    name.endsWith(".csv") ||
    name.endsWith(".xml") ||
    name.endsWith(".js") ||
    name.endsWith(".md")
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* ---------------- Init ---------------- */

resetUI();