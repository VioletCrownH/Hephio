const quantityInput = document.getElementById("quantityInput");
const generateBtn = document.getElementById("generateBtn");

const emptyState = document.getElementById("emptyState");
const uuidList = document.getElementById("uuidList");
const resultMeta = document.getElementById("resultMeta");

const copyAllBtn = document.getElementById("copyAllBtn");
const downloadBtn = document.getElementById("downloadBtn");
const clearBtn = document.getElementById("clearBtn");

const statusEl = document.getElementById("status");

let currentUuids = [];

/* ---------------- Events ---------------- */

generateBtn.addEventListener("click", () => {
  clearStatus();

  if (!supportsRandomUuid()) {
    setError("This browser does not support UUID generation.");
    return;
  }

  const quantity = getValidatedQuantity();
  if (quantity === null) return;

  currentUuids = generateUuids(quantity);
  renderUuidList();
});

copyAllBtn.addEventListener("click", async () => {
  if (!currentUuids.length) return;

  const text = currentUuids.join("\n");

  try {
    await navigator.clipboard.writeText(text);
    setSuccess("Copied all UUIDs.");
  } catch (err) {
    fallbackCopy(text, "Copied all UUIDs.");
  }
});

downloadBtn.addEventListener("click", () => {
  if (!currentUuids.length) return;

  const text = currentUuids.join("\n");
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const filename = `uuid-v4-${currentUuids.length}.txt`;

  downloadBlob(filename, blob);
  setSuccess("Download ready.");
});

clearBtn.addEventListener("click", () => {
  currentUuids = [];
  quantityInput.value = "10";
  renderUuidList();
  clearStatus();
});

quantityInput.addEventListener("input", () => {
  clearStatus();
});

/* ---------------- Core ---------------- */

function supportsRandomUuid() {
  return !!(window.crypto && typeof window.crypto.randomUUID === "function");
}

function getValidatedQuantity() {
  const raw = quantityInput.value.trim();

  if (!raw) {
    setError("Enter a quantity between 1 and 500.");
    return null;
  }

  const value = Number(raw);

  if (!Number.isInteger(value) || value < 1 || value > 500) {
    setError("Quantity must be a whole number between 1 and 500.");
    return null;
  }

  return value;
}

function generateUuids(count) {
  const results = [];

  for (let i = 0; i < count; i++) {
    results.push(window.crypto.randomUUID());
  }

  return results;
}

/* ---------------- Render ---------------- */

function renderUuidList() {
  uuidList.innerHTML = "";

  if (!currentUuids.length) {
    emptyState.classList.remove("hidden");
    uuidList.classList.add("hidden");
    resultMeta.textContent = "0 UUIDs";
    syncActionButtons();
    return;
  }

  emptyState.classList.add("hidden");
  uuidList.classList.remove("hidden");
  resultMeta.textContent = `${currentUuids.length} UUID${currentUuids.length === 1 ? "" : "s"}`;

  currentUuids.forEach((uuid, index) => {
    const row = document.createElement("div");
    row.className = "tool-uuid-row";

    const main = document.createElement("div");
    main.className = "tool-uuid-main";

    const label = document.createElement("div");
    label.className = "tool-uuid-index";
    label.textContent = `#${index + 1}`;

    const value = document.createElement("div");
    value.className = "tool-uuid-value";
    value.textContent = uuid;

    main.appendChild(label);
    main.appendChild(value);

    const actions = document.createElement("div");
    actions.className = "tool-uuid-actions";

    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "tool-btn-ghost-small";
    copyBtn.textContent = "Copy";

    copyBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(uuid);
        setSuccess(`Copied UUID #${index + 1}.`);
      } catch (err) {
        fallbackCopy(uuid, `Copied UUID #${index + 1}.`);
      }
    });

    actions.appendChild(copyBtn);
    row.appendChild(main);
    row.appendChild(actions);

    uuidList.appendChild(row);
  });

  syncActionButtons();
}

function syncActionButtons() {
  const hasResults = currentUuids.length > 0;

  copyAllBtn.disabled = !hasResults;
  downloadBtn.disabled = !hasResults;
  clearBtn.disabled = !hasResults;
}

/* ---------------- Helpers ---------------- */

function fallbackCopy(text, successMessage) {
  const temp = document.createElement("textarea");
  temp.value = text;
  document.body.appendChild(temp);
  temp.select();
  document.execCommand("copy");
  temp.remove();

  setSuccess(successMessage || "Copied.");
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

/* ---------------- Status ---------------- */

function clearStatus() {
  statusEl.textContent = "";
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

/* ---------------- Init ---------------- */

renderUuidList();