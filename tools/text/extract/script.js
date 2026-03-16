// Hephio - Extract From Text
// Extract: Emails, URLs, Domains, Phone Numbers, Numbers, Hashtags, @Mentions
// Options: Remove duplicates (default unchecked), Sort A->Z, Newline output

const uploadZone = document.getElementById("uploadZone");
const fileInput = document.getElementById("fileInput");
const uploadPrompt = document.getElementById("uploadPrompt");
const filePreview = document.getElementById("filePreview");
const fileNameEl = document.getElementById("fileName");
const fileSizeEl = document.getElementById("fileSize");
const charCountEl = document.getElementById("charCount");
const chooseDifferent = document.getElementById("chooseDifferent");

const textInput = document.getElementById("textInput");
const inputMeta = document.getElementById("inputMeta");
const optDedup = document.getElementById("optDedup");

const resultPanel = document.getElementById("resultPanel");
const resultTitle = document.getElementById("resultTitle");
const resultSub = document.getElementById("resultSub");
const resultMeta = document.getElementById("resultMeta");
const resultOutput = document.getElementById("resultOutput");

const btnCopy = document.getElementById("btnCopy");
const btnDownload = document.getElementById("btnDownload");
const btnClear = document.getElementById("btnClear");

const statusEl = document.getElementById("status");

let currentFileBase = "hephio-text";

function setStatus(msg, kind = "") {
  statusEl.textContent = msg || "";
  statusEl.classList.remove("error");
  if (kind === "error") statusEl.classList.add("error");
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let idx = 0;
  let n = bytes;
  while (n >= 1024 && idx < units.length - 1) {
    n /= 1024;
    idx++;
  }
  const value = idx === 0 ? String(Math.round(n)) : n.toFixed(1).replace(/\.0$/, "");
  return `${value} ${units[idx]}`;
}

function sanitizeBaseName(name) {
  const base = (name || "hephio-text").replace(/\.[^.]+$/, "").trim().slice(0, 60);
  return base || "hephio-text";
}

function resetFileUI() {
  uploadZone.classList.remove("has-file");
  filePreview.classList.add("hidden");
  uploadPrompt.classList.remove("hidden");
  fileNameEl.textContent = "filename.txt";
  fileSizeEl.textContent = "—";
  charCountEl.textContent = "—";
  currentFileBase = "hephio-text";
  fileInput.value = "";
}

function updateInputMeta() {
  const n = (textInput.value || "").length;
  inputMeta.textContent = `${n.toLocaleString()} chars`;
  if (uploadZone.classList.contains("has-file")) {
    charCountEl.textContent = n.toLocaleString();
  }
}

function normalizeLineEndings(s) {
  return (s || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function dedupIfNeeded(items) {
  if (!optDedup.checked) return items;
  const seen = new Set();
  const out = [];
  for (const it of items) {
    const key = it.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  return out;
}

function sortAlpha(items) {
  // Sort case-insensitively but preserve original case
  return [...items].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

// --- Extractors ---
function extractEmails(text) {
  // Practical email regex (not RFC-perfect, but good for utility tool)
  const re = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
  return text.match(re) || [];
}

function extractUrls(text) {
  // Grab http/https URLs. Stop at whitespace or common closing punctuation.
  const re = /\bhttps?:\/\/[^\s<>"')\]]+/gi;
  const matches = text.match(re) || [];
  // Trim trailing punctuation that often sticks to URLs
  return matches.map(u => u.replace(/[.,!?;:]+$/g, ""));
}

function extractDomains(text) {
  // Domains come from:
  // 1) URLs (preferred) and
  // 2) bare domains like example.com or sub.example.co.uk
  const domains = [];

  // from URLs
  const urls = extractUrls(text);
  for (const u of urls) {
    try {
      const d = new URL(u).hostname;
      if (d) domains.push(d.toLowerCase());
    } catch {
      // ignore
    }
  }

  // bare domains (avoid emails)
  // Matches: example.com, sub.example.co.uk, hephio.com:8080 (strip port)
  const bareRe = /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,})(?::\d{2,5})?\b/gi;
  const bare = text.match(bareRe) || [];
  for (const b of bare) {
    // skip things that look like emails already captured (contains @ nearby)
    if (b.includes("@")) continue;
    const cleaned = b.toLowerCase().replace(/:\d{2,5}$/, "");
    domains.push(cleaned);
  }

  // remove obvious false positives where the "domain" is part of an email token
  // (e.g. "email.com" from "user@email.com" may appear from bareRe)
  // We'll filter by ensuring it does not appear immediately after '@' in the source
  const filtered = domains.filter(d => !new RegExp(`@${escapeRegExp(d)}\\b`, "i").test(text));

  return filtered;
}

function extractPhones(text) {
  // Heuristic for phone-like patterns; avoids super short digit strings.
  // Handles: +1 (512) 555-1212, 512-555-1212, 512 555 1212, (512)5551212
  const re = /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}\b/g;
  return text.match(re) || [];
}

function extractNumbers(text) {
  // Extract numbers including commas/decimals, optional leading sign.
  // Examples: -12, 1,234, 98.6, 3.1415
  const re = /(?<![\p{L}\p{N}])[-+]?\d{1,3}(?:,\d{3})*(?:\.\d+)?(?![\p{L}\p{N}])/gu;
  return text.match(re) || [];
}

function extractHashtags(text) {
  // #tag, #tag123, allow underscores
  const re = /#[\p{L}\p{N}_]+/gu;
  return text.match(re) || [];
}

function extractMentions(text) {
  // @username (common social handle patterns)
  const re = /@[\p{L}\p{N}_]{2,30}/gu;
  return text.match(re) || [];
}

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// --- Main extract dispatcher ---
function runExtract(kind) {
  const raw = normalizeLineEndings(textInput.value || "");
  if (!raw.trim()) {
    setStatus("Paste text or upload a .txt file first.", "error");
    return;
  }

  let items = [];
  let title = "Results";

  switch (kind) {
    case "emails":
      title = "Emails";
      items = extractEmails(raw);
      break;
    case "urls":
      title = "URLs";
      items = extractUrls(raw);
      break;
    case "domains":
      title = "Domains";
      items = extractDomains(raw);
      break;
    case "phones":
      title = "Phone Numbers";
      items = extractPhones(raw);
      break;
    case "numbers":
      title = "Numbers";
      items = extractNumbers(raw);
      break;
    case "hashtags":
      title = "Hashtags";
      items = extractHashtags(raw);
      break;
    case "mentions":
      title = "@Mentions";
      items = extractMentions(raw);
      break;
    default:
      title = "Results";
      items = [];
  }

  items = items.map(s => String(s).trim()).filter(Boolean);
  items = dedupIfNeeded(items);
  items = sortAlpha(items);

  const outText = items.join("\n");
  resultTitle.textContent = title;
  resultSub.textContent = `${items.length.toLocaleString()} found`;
  resultOutput.value = outText;
  resultMeta.textContent = `${outText.length.toLocaleString()} chars`;

  setStatus(items.length ? `Extracted ${items.length} ${title.toLowerCase()}.` : `No ${title.toLowerCase()} found.`, "");
}

async function loadTextFile(file) {
  const isTxt = file.type === "text/plain" || file.name.toLowerCase().endsWith(".txt");
  if (!isTxt) {
    setStatus("Please upload a .txt file.", "error");
    return;
  }

  const text = await file.text();
  textInput.value = text;

  uploadZone.classList.add("has-file");
  uploadPrompt.classList.add("hidden");
  filePreview.classList.remove("hidden");

  fileNameEl.textContent = file.name;
  fileSizeEl.textContent = formatBytes(file.size);
  charCountEl.textContent = text.length.toLocaleString();

  currentFileBase = sanitizeBaseName(file.name);

  updateInputMeta();
  setStatus("File loaded. Choose what you want to extract.", "");
}

function preventDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}

/* Copy / download / clear */
async function copyResults() {
  const text = resultOutput.value || "";
  if (!text) {
    setStatus("No results to copy yet.", "error");
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    setStatus("Copied results to clipboard.", "");
  } catch {
    resultOutput.focus();
    resultOutput.select();
    const ok = document.execCommand("copy");
    setStatus(ok ? "Copied results to clipboard." : "Copy failed. Manually select and copy.", ok ? "" : "error");
  }
}

function downloadResults() {
  const text = resultOutput.value || "";
  if (!text) {
    setStatus("No results to download yet.", "error");
    return;
  }

  const title = (resultTitle.textContent || "results").toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9\-]/g, "");
  const filename = `${currentFileBase}-extract-${title}.txt`;

  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
  setStatus(`Downloaded ${filename}`, "");
}

function clearAll() {
  textInput.value = "";
  resultOutput.value = "";
  resultTitle.textContent = "Results";
  resultSub.textContent = "0 found";
  resultMeta.textContent = "0 chars";
  resetFileUI();
  updateInputMeta();
  setStatus("Cleared.", "");
}

/* ---------------------------
   Events
---------------------------- */
uploadZone.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", async (e) => {
  const file = e.target.files?.[0] || null;
  if (file) await loadTextFile(file);
});

chooseDifferent?.addEventListener("click", (e) => {
  e.preventDefault();
  resetFileUI();
  setStatus("Choose a different file or paste text.", "");
  updateInputMeta();
});

// Drag/drop
["dragenter", "dragover", "dragleave", "drop"].forEach((evt) =>
  uploadZone.addEventListener(evt, preventDefaults)
);
uploadZone.addEventListener("dragover", () => uploadZone.classList.add("drag-over"));
uploadZone.addEventListener("dragleave", () => uploadZone.classList.remove("drag-over"));
uploadZone.addEventListener("drop", async (e) => {
  uploadZone.classList.remove("drag-over");
  const file = e.dataTransfer?.files?.[0] || null;
  if (file) await loadTextFile(file);
});

// Live meta updates
textInput.addEventListener("input", () => {
  updateInputMeta();
});

// Button row actions
document.querySelectorAll("[data-extract]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const kind = btn.getAttribute("data-extract");
    runExtract(kind);
  });
});

// Results actions
btnCopy.addEventListener("click", copyResults);
btnDownload.addEventListener("click", downloadResults);
btnClear.addEventListener("click", clearAll);

// Init
resetFileUI();
updateInputMeta();
