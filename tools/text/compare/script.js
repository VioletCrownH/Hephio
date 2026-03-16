// Hephio - Compare Text
// Unified diff with line-level and word-level highlighting
// Features: ignore case, ignore whitespace, sync scroll, cursor lock via diff mapping

const inputLeft = document.getElementById("inputLeft");
const inputRight = document.getElementById("inputRight");

const metaLeft = document.getElementById("metaLeft");
const metaRight = document.getElementById("metaRight");

const optIgnoreCase = document.getElementById("optIgnoreCase");
const optIgnoreWhitespace = document.getElementById("optIgnoreWhitespace");
const optSyncScroll = document.getElementById("optSyncScroll");
const optCursorLock = document.getElementById("optCursorLock");

const btnCompare = document.getElementById("btnCompare");
const btnClear = document.getElementById("btnClear");
const btnCopyDiff = document.getElementById("btnCopyDiff");
const btnDownloadDiff = document.getElementById("btnDownloadDiff");
const btnCopyLeft = document.getElementById("btnCopyLeft");
const btnCopyRight = document.getElementById("btnCopyRight");

const diffOutput = document.getElementById("diffOutput");
const resultSub = document.getElementById("resultSub");
const statusEl = document.getElementById("status");

const countAdded = document.getElementById("countAdded");
const countRemoved = document.getElementById("countRemoved");
const countChanged = document.getElementById("countChanged");

let lineMapLeftToRight = [];
let lineMapRightToLeft = [];
let syncingScroll = false;

function setStatus(msg, kind = "") {
  statusEl.textContent = msg || "";
  statusEl.classList.remove("error");
  if (kind === "error") statusEl.classList.add("error");
}

function updateMeta() {
  const leftLines = normalizeNewlines(inputLeft.value).split("\n").filter(() => true);
  const rightLines = normalizeNewlines(inputRight.value).split("\n").filter(() => true);

  metaLeft.textContent = `${countNonEmptyOrZero(leftLines).toLocaleString()} lines`;
  metaRight.textContent = `${countNonEmptyOrZero(rightLines).toLocaleString()} lines`;
}

function countNonEmptyOrZero(lines) {
  if (lines.length === 1 && lines[0] === "") return 0;
  return lines.length;
}

function normalizeNewlines(text) {
  return (text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function normalizeLineForCompare(line) {
  let out = line;
  if (optIgnoreWhitespace.checked) {
    out = out.trim().replace(/\s+/g, " ");
  }
  if (optIgnoreCase.checked) {
    out = out.toLowerCase();
  }
  return out;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function tokenizeWords(text) {
  // preserve whitespace + punctuation chunks well enough for diff rendering
  return text.match(/\s+|[^\s]+/g) || [];
}

function lcsDiff(a, b, equalFn = (x, y) => x === y) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (equalFn(a[i], b[j])) dp[i][j] = 1 + dp[i + 1][j + 1];
      else dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const ops = [];
  let i = 0;
  let j = 0;

  while (i < m && j < n) {
    if (equalFn(a[i], b[j])) {
      ops.push({ type: "equal", aIndex: i, bIndex: j, a: a[i], b: b[j] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ type: "remove", aIndex: i, bIndex: null, a: a[i], b: null });
      i++;
    } else {
      ops.push({ type: "add", aIndex: null, bIndex: j, a: null, b: b[j] });
      j++;
    }
  }

  while (i < m) {
    ops.push({ type: "remove", aIndex: i, bIndex: null, a: a[i], b: null });
    i++;
  }

  while (j < n) {
    ops.push({ type: "add", aIndex: null, bIndex: j, a: null, b: b[j] });
    j++;
  }

  return ops;
}

function pairChangedOps(ops) {
  const paired = [];
  for (let i = 0; i < ops.length; i++) {
    const curr = ops[i];
    const next = ops[i + 1];

    if (curr?.type === "remove" && next?.type === "add") {
      paired.push({
        type: "change",
        aIndex: curr.aIndex,
        bIndex: next.bIndex,
        a: curr.a,
        b: next.b
      });
      i++;
    } else if (curr?.type === "add" && next?.type === "remove") {
      paired.push({
        type: "change",
        aIndex: next.aIndex,
        bIndex: curr.bIndex,
        a: next.a,
        b: curr.b
      });
      i++;
    } else {
      paired.push(curr);
    }
  }
  return paired;
}

function wordDiffHtml(aLine, bLine) {
  const aTokens = tokenizeWords(aLine);
  const bTokens = tokenizeWords(bLine);

  const equalFn = (x, y) => {
    const nx = optIgnoreCase.checked ? x.toLowerCase() : x;
    const ny = optIgnoreCase.checked ? y.toLowerCase() : y;
    return nx === ny;
  };

  const ops = lcsDiff(aTokens, bTokens, equalFn);

  let removedHtml = "";
  let addedHtml = "";

  for (const op of ops) {
    if (op.type === "equal") {
      const token = escapeHtml(op.a);
      removedHtml += token;
      addedHtml += token;
    } else if (op.type === "remove") {
      removedHtml += `<mark class="tool-diff-word-del">${escapeHtml(op.a)}</mark>`;
    } else if (op.type === "add") {
      addedHtml += `<mark class="tool-diff-word-add">${escapeHtml(op.b)}</mark>`;
    }
  }

  return { removedHtml, addedHtml };
}

function buildLineMaps(pairedOps) {
  lineMapLeftToRight = [];
  lineMapRightToLeft = [];

  for (const op of pairedOps) {
    if (op.type === "equal" || op.type === "change") {
      if (op.aIndex != null && op.bIndex != null) {
        lineMapLeftToRight[op.aIndex] = op.bIndex;
        lineMapRightToLeft[op.bIndex] = op.aIndex;
      }
    }
  }
}

function renderUnifiedDiff(pairedOps) {
  let added = 0;
  let removed = 0;
  let changed = 0;
  let html = "";

  for (const op of pairedOps) {
    if (op.type === "equal") {
      html += `
        <div class="tool-diff-line tool-diff-line-equal">
          <span class="tool-diff-gutter"> </span>
          <span class="tool-diff-line-num">${op.aIndex + 1}</span>
          <span class="tool-diff-line-num">${op.bIndex + 1}</span>
          <span class="tool-diff-line-text">${escapeHtml(op.a)}</span>
        </div>
      `;
    } else if (op.type === "remove") {
      removed++;
      html += `
        <div class="tool-diff-line tool-diff-line-remove">
          <span class="tool-diff-gutter">-</span>
          <span class="tool-diff-line-num">${op.aIndex + 1}</span>
          <span class="tool-diff-line-num"> </span>
          <span class="tool-diff-line-text">${escapeHtml(op.a)}</span>
        </div>
      `;
    } else if (op.type === "add") {
      added++;
      html += `
        <div class="tool-diff-line tool-diff-line-add">
          <span class="tool-diff-gutter">+</span>
          <span class="tool-diff-line-num"> </span>
          <span class="tool-diff-line-num">${op.bIndex + 1}</span>
          <span class="tool-diff-line-text">${escapeHtml(op.b)}</span>
        </div>
      `;
    } else if (op.type === "change") {
      changed++;
      const { removedHtml, addedHtml } = wordDiffHtml(op.a, op.b);

      html += `
        <div class="tool-diff-line tool-diff-line-remove">
          <span class="tool-diff-gutter">-</span>
          <span class="tool-diff-line-num">${op.aIndex + 1}</span>
          <span class="tool-diff-line-num"> </span>
          <span class="tool-diff-line-text">${removedHtml}</span>
        </div>
        <div class="tool-diff-line tool-diff-line-add">
          <span class="tool-diff-gutter">+</span>
          <span class="tool-diff-line-num"> </span>
          <span class="tool-diff-line-num">${op.bIndex + 1}</span>
          <span class="tool-diff-line-text">${addedHtml}</span>
        </div>
      `;
    }
  }

  diffOutput.innerHTML = html || `<div class="tool-diff-empty">No differences to show.</div>`;

  countAdded.textContent = String(added);
  countRemoved.textContent = String(removed);
  countChanged.textContent = String(changed);

  const total = added + removed + changed;
  resultSub.textContent = total === 0 ? "No differences found" : `${total} differences found`;
}

function compareTexts() {
  const leftRaw = normalizeNewlines(inputLeft.value);
  const rightRaw = normalizeNewlines(inputRight.value);

  if (!leftRaw.trim() && !rightRaw.trim()) {
    diffOutput.innerHTML = `<div class="tool-diff-empty">Paste text into both sides to compare.</div>`;
    countAdded.textContent = "0";
    countRemoved.textContent = "0";
    countChanged.textContent = "0";
    resultSub.textContent = "Compare two text blocks to see changes";
    setStatus("Paste text into both panes first.", "error");
    return;
  }

  const leftLines = leftRaw.split("\n");
  const rightLines = rightRaw.split("\n");

  const leftNorm = leftLines.map(normalizeLineForCompare);
  const rightNorm = rightLines.map(normalizeLineForCompare);

  const baseOps = lcsDiff(
    leftNorm,
    rightNorm,
    (a, b) => a === b
  );

  // restore original lines into ops
  const ops = baseOps.map(op => {
    if (op.type === "equal") {
      return {
        ...op,
        a: leftLines[op.aIndex],
        b: rightLines[op.bIndex]
      };
    }
    if (op.type === "remove") {
      return {
        ...op,
        a: leftLines[op.aIndex]
      };
    }
    return {
      ...op,
      b: rightLines[op.bIndex]
    };
  });

  const pairedOps = pairChangedOps(ops);
  buildLineMaps(pairedOps);
  renderUnifiedDiff(pairedOps);
  setStatus("Compared text successfully.", "");
}

function getCaretLine(textarea) {
  const text = textarea.value.slice(0, textarea.selectionStart);
  return text.split("\n").length - 1;
}

function scrollToLine(textarea, targetLine) {
  if (targetLine == null || targetLine < 0) return;

  const lines = textarea.value.split("\n");
  let pos = 0;
  for (let i = 0; i < Math.min(targetLine, lines.length); i++) {
    pos += lines[i].length + 1;
  }

  textarea.focus();
  textarea.setSelectionRange(pos, pos);

  const lineHeight = parseFloat(getComputedStyle(textarea).lineHeight) || 20;
  textarea.scrollTop = Math.max(0, targetLine * lineHeight - textarea.clientHeight / 3);
}

function handleCursorLock(source) {
  if (!optCursorLock.checked) return;

  if (source === "left") {
    const line = getCaretLine(inputLeft);
    const mapped = lineMapLeftToRight[line];
    if (mapped != null) {
      scrollToLine(inputRight, mapped);
    }
  } else {
    const line = getCaretLine(inputRight);
    const mapped = lineMapRightToLeft[line];
    if (mapped != null) {
      scrollToLine(inputLeft, mapped);
    }
  }
}

function syncScroll(source, target) {
  if (!optSyncScroll.checked || syncingScroll) return;

  syncingScroll = true;
  const maxSource = Math.max(1, source.scrollHeight - source.clientHeight);
  const maxTarget = Math.max(1, target.scrollHeight - target.clientHeight);
  const ratio = source.scrollTop / maxSource;
  target.scrollTop = ratio * maxTarget;
  syncingScroll = false;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    setStatus("Copied to clipboard.", "");
  } catch {
    setStatus("Copy failed. Your browser may block clipboard access.", "error");
  }
}

function diffOutputToPlainText() {
  return diffOutput.innerText || "";
}

function downloadDiff() {
  const text = diffOutputToPlainText();
  if (!text.trim()) {
    setStatus("Nothing to download yet. Compare text first.", "error");
    return;
  }

  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "hephio-compare-text-diff.txt";
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
  setStatus("Downloaded diff.", "");
}

function clearAll() {
  inputLeft.value = "";
  inputRight.value = "";
  diffOutput.innerHTML = `<div class="tool-diff-empty">Paste text into both sides to compare.</div>`;
  countAdded.textContent = "0";
  countRemoved.textContent = "0";
  countChanged.textContent = "0";
  resultSub.textContent = "Compare two text blocks to see changes";
  lineMapLeftToRight = [];
  lineMapRightToLeft = [];
  updateMeta();
  setStatus("");
}

/* Events */
inputLeft.addEventListener("input", updateMeta);
inputRight.addEventListener("input", updateMeta);

inputLeft.addEventListener("scroll", () => syncScroll(inputLeft, inputRight));
inputRight.addEventListener("scroll", () => syncScroll(inputRight, inputLeft));

["click", "keyup"].forEach(evt => {
  inputLeft.addEventListener(evt, () => handleCursorLock("left"));
  inputRight.addEventListener(evt, () => handleCursorLock("right"));
});

btnCompare.addEventListener("click", compareTexts);
btnClear.addEventListener("click", clearAll);

btnCopyDiff.addEventListener("click", () => copyText(diffOutputToPlainText()));
btnDownloadDiff.addEventListener("click", downloadDiff);
btnCopyLeft.addEventListener("click", () => copyText(inputLeft.value || ""));
btnCopyRight.addEventListener("click", () => copyText(inputRight.value || ""));

/* Init */
clearAll();
