// Hephio - Password Generator
// Uses crypto.getRandomValues for secure randomness.

const lenSlider = document.getElementById("lenSlider");
const lenInput = document.getElementById("lenInput");
const lenValue = document.getElementById("lenValue");
const qtySelect = document.getElementById("qtySelect");

const optLower = document.getElementById("optLower");
const optUpper = document.getElementById("optUpper");
const optNumbers = document.getElementById("optNumbers");
const optSymbols = document.getElementById("optSymbols");

const optGuarantee = document.getElementById("optGuarantee");
const optNoAmbiguous = document.getElementById("optNoAmbiguous");

const strengthText = document.getElementById("strengthText");
const strengthBars = document.getElementById("strengthBars");

const btnGenerate = document.getElementById("btnGenerate");
const btnReset = document.getElementById("btnReset");

const statusEl = document.getElementById("status");
const resultSub = document.getElementById("resultSub");
const passwordList = document.getElementById("passwordList");
const btnCopyAll = document.getElementById("btnCopyAll");

const SETS = {
  lower: "abcdefghijklmnopqrstuvwxyz",
  upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  numbers: "0123456789",
  symbols: "!@#$%^&*()-_=+[]{}|;:,.<>/?~"
};

const AMBIGUOUS = new Set(["O", "0", "l", "1", "I"]);

function setStatus(msg, kind = "") {
  statusEl.textContent = msg || "";
  statusEl.classList.remove("error");
  if (kind === "error") statusEl.classList.add("error");
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function syncLengthUI(value) {
  const v = clamp(Number(value) || 16, 8, 64);
  lenSlider.value = String(v);
  lenInput.value = String(v);
  lenValue.textContent = String(v);
  updateStrengthPreview();
}

function getSelectedSets() {
  const sets = [];
  if (optLower.checked) sets.push("lower");
  if (optUpper.checked) sets.push("upper");
  if (optNumbers.checked) sets.push("numbers");
  if (optSymbols.checked) sets.push("symbols");
  return sets;
}

function buildCharset(selectedSets) {
  let chars = "";
  for (const s of selectedSets) chars += SETS[s];

  if (optNoAmbiguous.checked) {
    chars = [...chars].filter(c => !AMBIGUOUS.has(c)).join("");
  }
  return chars;
}

function cryptoRandomInt(maxExclusive) {
  // unbiased rejection sampling
  if (maxExclusive <= 0) throw new Error("Invalid maxExclusive");
  const max = 0xffffffff;
  const limit = max - (max % maxExclusive);

  const buf = new Uint32Array(1);
  while (true) {
    crypto.getRandomValues(buf);
    const x = buf[0];
    if (x < limit) return x % maxExclusive;
  }
}

function randomCharFrom(str) {
  return str[cryptoRandomInt(str.length)];
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = cryptoRandomInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function generateOnePassword(length, selectedSets) {
  const charset = buildCharset(selectedSets);
  if (!charset) throw new Error("No characters available. Adjust your options.");

  const out = [];

  // Guarantee at least one char from each selected set
  if (optGuarantee.checked && selectedSets.length > 0) {
    for (const s of selectedSets) {
      let setChars = SETS[s];
      if (optNoAmbiguous.checked) {
        setChars = [...setChars].filter(c => !AMBIGUOUS.has(c)).join("");
      }
      if (!setChars) continue;
      out.push(randomCharFrom(setChars));
    }
  }

  while (out.length < length) {
    out.push(randomCharFrom(charset));
  }

  shuffleArray(out);
  return out.join("");
}

function scoreStrength(length, selectedSetsCount, hasSymbols) {
  // Simple, transparent heuristic
  // length buckets + variety buckets -> 0..3 levels
  let score = 0;

  if (length >= 12) score++;
  if (length >= 16) score++;
  if (length >= 24) score++;

  if (selectedSetsCount >= 2) score++;
  if (selectedSetsCount >= 3) score++;
  if (selectedSetsCount >= 4) score++;

  if (hasSymbols && length >= 12) score++;

  // clamp into 0..3 bands
  if (score <= 2) return 0;       // Weak
  if (score <= 4) return 1;       // OK
  if (score <= 6) return 2;       // Strong
  return 3;                        // Very Strong
}

function renderStrength(level) {
  // level: 0..3
  // bars: Weak=2, OK=4, Strong=6, VeryStrong=8
  const bars = [...strengthBars.querySelectorAll(".tool-strength-bar")];

  const fillCount = level === 0 ? 2 : level === 1 ? 4 : level === 2 ? 6 : 8;
  const cls = level === 0 ? "weak" : level === 1 ? "ok" : "strong";

  strengthBars.classList.remove("weak", "ok", "strong");
  strengthBars.classList.add(cls);

  bars.forEach((b, idx) => {
    b.classList.toggle("filled", idx < fillCount);
  });

  strengthText.textContent = level === 0 ? "Weak" : level === 1 ? "OK" : level === 2 ? "Strong" : "Very Strong";
}

function updateStrengthPreview() {
  const length = clamp(Number(lenSlider.value) || 16, 8, 64);
  const sets = getSelectedSets();
  const level = scoreStrength(length, sets.length, optSymbols.checked);
  renderStrength(level);
}

function clearPasswords() {
  passwordList.innerHTML = "";
  resultSub.textContent = "0 generated";
}

function renderPasswords(passwords) {
  passwordList.innerHTML = "";

  passwords.forEach((pwd, idx) => {
    const row = document.createElement("div");
    row.className = "tool-password-row";

    const input = document.createElement("input");
    input.className = "tool-password-value";
    input.type = "text";
    input.readOnly = true;
    input.value = pwd;
    input.setAttribute("aria-label", `Generated password ${idx + 1}`);

    const btn = document.createElement("button");
    btn.className = "tool-btn-ghost-small";
    btn.type = "button";
    btn.textContent = "Copy";
    btn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(pwd);
        setStatus("Copied password to clipboard.", "");
      } catch {
        setStatus("Copy failed. Your browser may block clipboard access.", "error");
      }
    });

    row.appendChild(input);
    row.appendChild(btn);
    passwordList.appendChild(row);
  });

  resultSub.textContent = `${passwords.length} generated`;
}

async function copyAllPasswords() {
  const values = [...passwordList.querySelectorAll(".tool-password-value")].map(el => el.value).filter(Boolean);
  if (!values.length) {
    setStatus("Nothing to copy yet. Generate passwords first.", "error");
    return;
  }
  const text = values.join("\n");
  try {
    await navigator.clipboard.writeText(text);
    setStatus("Copied all passwords to clipboard.", "");
  } catch {
    setStatus("Copy failed. Your browser may block clipboard access.", "error");
  }
}

function generate() {
  setStatus("");
  clearPasswords();

  const length = clamp(Number(lenSlider.value) || 16, 8, 64);
  const qty = clamp(Number(qtySelect.value) || 1, 1, 5);
  const sets = getSelectedSets();

  if (sets.length === 0) {
    setStatus("Select at least one character set (lowercase/uppercase/numbers/symbols).", "error");
    return;
  }

  try {
    const passwords = [];
    for (let i = 0; i < qty; i++) {
      passwords.push(generateOnePassword(length, sets));
    }
    renderPasswords(passwords);
    updateStrengthPreview();
    setStatus("Generated.", "");
    
    // Remove footer peek after first generation (similar to file upload behavior)
    if (window.removeFooterPeek) {
      window.removeFooterPeek();
    }
  } catch (e) {
    setStatus(e?.message || "Could not generate password.", "error");
  }
}

function resetAll() {
  lenSlider.value = "16";
  lenInput.value = "16";
  qtySelect.value = "1";

  optLower.checked = true;
  optUpper.checked = true;
  optNumbers.checked = true;
  optSymbols.checked = false;

  optGuarantee.checked = true;
  optNoAmbiguous.checked = false;

  lenValue.textContent = "16";
  clearPasswords();
  updateStrengthPreview();
  setStatus("");
}

/* Events */
lenSlider.addEventListener("input", () => syncLengthUI(lenSlider.value));
lenInput.addEventListener("input", () => syncLengthUI(lenInput.value));

[optLower, optUpper, optNumbers, optSymbols, optGuarantee, optNoAmbiguous].forEach(el => {
  el.addEventListener("change", updateStrengthPreview);
});

btnGenerate.addEventListener("click", generate);
btnReset.addEventListener("click", resetAll);
btnCopyAll.addEventListener("click", copyAllPasswords);

/* Init */
resetAll();
