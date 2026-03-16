const uploadZone = document.getElementById("uploadZone");
const uploadPrompt = document.getElementById("uploadPrompt");
const fileSummary = document.getElementById("fileSummary");
const fileInput = document.getElementById("fileInput");
const chooseDifferent = document.getElementById("chooseDifferent");

const fileNameEl = document.getElementById("fileName");
const fileSizeEl = document.getElementById("fileSize");
const fileTypeEl = document.getElementById("fileType");

const inputText = document.getElementById("inputText");
const algorithmSelect = document.getElementById("algorithmSelect");
const allHashesCheckbox = document.getElementById("allHashesCheckbox");

const generateBtn = document.getElementById("generateBtn");
const clearBtn = document.getElementById("clearBtn");

const statusEl = document.getElementById("status");

const progressWrap = document.getElementById("progressWrap");
const progressLabel = document.getElementById("progressLabel");
const progressPercent = document.getElementById("progressPercent");
const progressBar = document.getElementById("progressBar");

const resultSection = document.getElementById("resultSection");
const resultMeta = document.getElementById("resultMeta");
const resultList = document.getElementById("resultList");
const copyAllBtn = document.getElementById("copyAllBtn");
const downloadBtn = document.getElementById("downloadBtn");

const ALL_ALGORITHMS = [
  "MD5",
  "SHA-1",
  "SHA-256",
  "SHA-384",
  "SHA-512",
  "CRC32",
  "BLAKE2b",
  "xxHash64"
];

const FILE_CHUNK_SIZE = 2 * 1024 * 1024;

let currentFile = null;
let worker = null;
let currentResults = [];
let isBusy = false;

/* ---------------- Upload wiring ---------------- */

uploadZone.addEventListener("click", () => {
  if (!isBusy) fileInput.click();
});

uploadZone.addEventListener("keydown", (e) => {
  if (isBusy) return;
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    fileInput.click();
  }
});

uploadZone.addEventListener("dragenter", (e) => {
  e.preventDefault();
  if (!isBusy) uploadZone.classList.add("drag-over");
});

uploadZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  if (!isBusy) uploadZone.classList.add("drag-over");
});

uploadZone.addEventListener("dragleave", () => {
  uploadZone.classList.remove("drag-over");
});

uploadZone.addEventListener("drop", (e) => {
  e.preventDefault();
  uploadZone.classList.remove("drag-over");
  if (isBusy) return;

  const file = e.dataTransfer?.files?.[0] ?? null;
  loadFile(file);
  fileInput.value = "";
});

fileInput.addEventListener("change", (e) => {
  const file = e.target.files?.[0] ?? null;
  loadFile(file);
});

chooseDifferent?.addEventListener("click", (e) => {
  e.preventDefault();
  if (!isBusy) fileInput.click();
});

/* ---------------- Controls ---------------- */

allHashesCheckbox.addEventListener("change", () => {
  algorithmSelect.disabled = allHashesCheckbox.checked || isBusy;
  clearStatus();
});

generateBtn.addEventListener("click", async () => {
  if (isBusy) return;

  clearStatus();
  hideResults();

  const source = getInputSource();
  if (!source) {
    setError("Choose a file or paste text first.");
    return;
  }

  const algorithms = allHashesCheckbox.checked
    ? [...ALL_ALGORITHMS]
    : [algorithmSelect.value];

  try {
    setBusy(true);
    setProgress(0, source.kind === "file" ? "Hashing file…" : "Hashing text…");

    const startedAt = performance.now();
    const results = await hashSource(source, algorithms);
    const elapsedMs = Math.max(1, Math.round(performance.now() - startedAt));

    currentResults = results;
    renderResults(results);
    resultMeta.textContent = buildResultMeta(source, algorithms, elapsedMs);

    showResults();
    syncResultButtons();
    setSuccess("Done.");
  } catch (err) {
    console.error(err);
    setError("Something went wrong while generating the hash.");
  } finally {
    setBusy(false);
  }
});

clearBtn.addEventListener("click", () => {
  resetUI();
});

copyAllBtn.addEventListener("click", async () => {
  if (!currentResults.length) return;

  const text = currentResults.map((row) => `${row.algorithm}: ${row.value}`).join("\n");
  const ok = await copyToClipboard(text);

  if (ok) setSuccess("Copied all hashes.");
  else setError("Could not copy automatically. Please copy manually.");
});

downloadBtn.addEventListener("click", async () => {
  if (!currentResults.length) return;

  const text = currentResults.map((row) => `${row.algorithm}: ${row.value}`).join("\n");
  await downloadTextFile(makeOutputFilename(), text);
});

/* ---------------- Input handling ---------------- */

function loadFile(file) {
  clearStatus();
  if (!file) return;

  currentFile = file;

  uploadZone.classList.add("has-file");
  uploadPrompt.classList.add("hidden");
  fileSummary.classList.remove("hidden");

  fileNameEl.textContent = file.name;
  fileSizeEl.textContent = formatBytes(file.size);
  fileTypeEl.textContent = file.type || "Unknown";

  setSuccess("File ready.");
}

function clearFile() {
  currentFile = null;

  uploadZone.classList.remove("has-file");
  uploadPrompt.classList.remove("hidden");
  fileSummary.classList.add("hidden");

  fileNameEl.textContent = "—";
  fileSizeEl.textContent = "—";
  fileTypeEl.textContent = "—";
}

function getInputSource() {
  if (currentFile) {
    return {
      kind: "file",
      file: currentFile
    };
  }

  const text = inputText.value;
  if (text.length > 0) {
    return {
      kind: "text",
      text
    };
  }

  return null;
}

/* ---------------- Worker hashing ---------------- */

async function hashSource(source, algorithms) {
  ensureWorker();

  if (source.kind === "text") {
    const bytes = new TextEncoder().encode(source.text);

    return await runWorkerHash({
      algorithms,
      kind: "text",
      totalBytes: bytes.byteLength,
      feed: async () => {
        worker.postMessage(
          {
            type: "chunk",
            chunk: bytes.buffer,
            loaded: bytes.byteLength,
            total: bytes.byteLength
          },
          [bytes.buffer]
        );
        worker.postMessage({ type: "end" });
      }
    });
  }

  return await runWorkerHash({
    algorithms,
    kind: "file",
    totalBytes: source.file.size,
    feed: async () => {
      let offset = 0;

      while (offset < source.file.size) {
        const chunk = await source.file.slice(offset, offset + FILE_CHUNK_SIZE).arrayBuffer();
        offset += chunk.byteLength;

        worker.postMessage(
          {
            type: "chunk",
            chunk,
            loaded: offset,
            total: source.file.size
          },
          [chunk]
        );
      }

      worker.postMessage({ type: "end" });
    }
  });
}

function ensureWorker() {
  if (worker) {
    worker.terminate();
  }

  worker = new Worker("./hash-worker.js", { type: "module" });
}

function runWorkerHash({ algorithms, kind, totalBytes, feed }) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let ready = false;

    worker.onmessage = async (event) => {
      const msg = event.data;

      if (msg.type === "ready") {
        ready = true;
        try {
          await feed();
        } catch (err) {
          if (!settled) reject(err);
        }
        return;
      }

      if (msg.type === "progress") {
        const pct = msg.total > 0 ? Math.round((msg.loaded / msg.total) * 100) : 100;
        setProgress(pct, kind === "file" ? "Hashing file…" : "Hashing text…");
        return;
      }

      if (msg.type === "done") {
        settled = true;
        resolve(msg.results || []);
        return;
      }

      if (msg.type === "error") {
        settled = true;
        reject(new Error(msg.message || "Worker error"));
      }
    };

    worker.onerror = (err) => {
      if (!settled) reject(err);
    };

    worker.postMessage({
      type: "start",
      algorithms,
      total: totalBytes
    });

    if (!ready) {
      setProgress(0, "Preparing hash engine…");
    }
  });
}

/* ---------------- Results ---------------- */

function renderResults(results) {
  resultList.innerHTML = "";

  results.forEach((row) => {
    const item = document.createElement("div");
    item.className = "tool-hash-result-row";

    item.innerHTML = `
      <div class="tool-hash-result-main">
        <div class="tool-hash-result-algorithm">${escapeHtml(row.algorithm)}</div>
        <div class="tool-hash-result-value">${escapeHtml(row.value)}</div>
      </div>
      <div class="tool-hash-result-actions">
        <button class="tool-btn-ghost-small" type="button" data-copy="${escapeHtmlAttr(row.value)}">Copy</button>
      </div>
    `;

    resultList.appendChild(item);
  });

  resultList.querySelectorAll("[data-copy]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const value = btn.getAttribute("data-copy") || "";
      const ok = await copyToClipboard(value);

      if (ok) setSuccess("Copied hash.");
      else setError("Could not copy automatically. Please copy manually.");
    });
  });
}

function showResults() {
  resultSection.classList.remove("hidden");
}

function hideResults() {
  currentResults = [];
  resultSection.classList.add("hidden");
  resultList.innerHTML = "";
  resultMeta.textContent = "—";
  syncResultButtons();
}

function buildResultMeta(source, algorithms, elapsedMs) {
  const algLabel = algorithms.length === 1 ? algorithms[0] : `${algorithms.length} hashes`;
  const inputLabel =
    source.kind === "file"
      ? `${source.file.name} · ${formatBytes(source.file.size)}`
      : `${formatCount(source.text.length)} of text`;

  return `${algLabel} · ${inputLabel} · ${elapsedMs} ms`;
}

/* ---------------- Progress ---------------- */

function setProgress(percent, label) {
  progressWrap.classList.remove("hidden");
  progressLabel.textContent = label;
  progressPercent.textContent = `${percent}%`;
  progressBar.style.width = `${percent}%`;
}

function hideProgress() {
  progressWrap.classList.add("hidden");
  progressLabel.textContent = "Hashing…";
  progressPercent.textContent = "0%";
  progressBar.style.width = "0%";
}

/* ---------------- UI state ---------------- */

function syncResultButtons() {
  const hasResults = currentResults.length > 0;
  copyAllBtn.disabled = isBusy || !hasResults;
  downloadBtn.disabled = isBusy || !hasResults;
}

function setBusy(busy) {
  isBusy = busy;

  generateBtn.disabled = busy;
  clearBtn.disabled = busy;

  algorithmSelect.disabled = busy || allHashesCheckbox.checked;
  allHashesCheckbox.disabled = busy;

  inputText.disabled = busy;
  fileInput.disabled = busy;
  uploadZone.classList.toggle("is-busy", busy);

  syncResultButtons();

  if (!busy) {
    hideProgress();
  }
}

function resetUI() {
  if (worker) {
    worker.terminate();
    worker = null;
  }

  clearFile();

  inputText.value = "";
  algorithmSelect.value = "SHA-256";
  allHashesCheckbox.checked = false;
  algorithmSelect.disabled = false;

  hideResults();
  hideProgress();

  clearStatus();
  setBusy(false);
}

/* ---------------- Clipboard / download ---------------- */

async function copyToClipboard(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fallback below
  }

  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "readonly");
    ta.style.position = "absolute";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, ta.value.length);
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
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

  await delay(150);

  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function makeOutputFilename() {
  if (currentFile) {
    return `${stripExtension(currentFile.name)}-hashes.txt`;
  }
  return "hashes.txt";
}

function stripExtension(name) {
  return name.replace(/\.[^.]+$/, "");
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

/* ---------------- Helpers ---------------- */

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(2)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

function formatCount(count) {
  return count === 1 ? "1 character" : `${count.toLocaleString()} characters`;
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeHtmlAttr(str) {
  return escapeHtml(str);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* ---------------- Init ---------------- */

resetUI();