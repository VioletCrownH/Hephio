const plainInput = document.getElementById("plainInput");
const encodedInput = document.getElementById("encodedInput");

const encodeBtn = document.getElementById("encodeBtn");
const decodeBtn = document.getElementById("decodeBtn");

const copyPlainBtn = document.getElementById("copyPlainBtn");
const copyEncodedBtn = document.getElementById("copyEncodedBtn");

const swapBtn = document.getElementById("swapBtn");
const clearBtn = document.getElementById("clearBtn");

const plainMeta = document.getElementById("plainMeta");
const encodedMeta = document.getElementById("encodedMeta");

const statusEl = document.getElementById("status");


/* ---------------- Encode ---------------- */

encodeBtn.addEventListener("click", () => {

  clearStatus();

  const value = plainInput.value;

  if (!value) {
    encodedInput.value = "";
    updateCounts();
    return;
  }

  try {

    const encoded = encodeURIComponent(value);

    encodedInput.value = encoded;

    updateCounts();

  } catch (err) {

    setError("Could not encode this text.");

  }

});


/* ---------------- Decode ---------------- */

decodeBtn.addEventListener("click", () => {

  clearStatus();

  const value = encodedInput.value;

  if (!value) {
    plainInput.value = "";
    updateCounts();
    return;
  }

  try {

    const decoded = decodeURIComponent(value);

    plainInput.value = decoded;

    updateCounts();

  } catch (err) {

    setError("Invalid encoded text.");

  }

});


/* ---------------- Swap ---------------- */

swapBtn.addEventListener("click", () => {

  const a = plainInput.value;
  const b = encodedInput.value;

  plainInput.value = b;
  encodedInput.value = a;

  updateCounts();
  clearStatus();

});


/* ---------------- Clear ---------------- */

clearBtn.addEventListener("click", () => {

  plainInput.value = "";
  encodedInput.value = "";

  updateCounts();
  clearStatus();

});


/* ---------------- Copy ---------------- */

copyPlainBtn.addEventListener("click", async () => {

  const value = plainInput.value;

  if (!value) return;

  try {

    await navigator.clipboard.writeText(value);

    setSuccess("Copied plain text.");

  } catch {

    fallbackCopy(value);

  }

});


copyEncodedBtn.addEventListener("click", async () => {

  const value = encodedInput.value;

  if (!value) return;

  try {

    await navigator.clipboard.writeText(value);

    setSuccess("Copied encoded text.");

  } catch {

    fallbackCopy(value);

  }

});


/* ---------------- Helpers ---------------- */

function updateCounts() {

  plainMeta.textContent = `${plainInput.value.length} characters`;
  encodedMeta.textContent = `${encodedInput.value.length} characters`;

}

function fallbackCopy(text) {

  const temp = document.createElement("textarea");

  temp.value = text;

  document.body.appendChild(temp);

  temp.select();

  document.execCommand("copy");

  temp.remove();

  setSuccess("Copied.");

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

updateCounts();