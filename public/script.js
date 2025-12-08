// File43 multi-file frontend with formats, theme, queue controls, retry, and summary

console.log("File43 multi-file script loaded");

const dropZone = document.getElementById("dropZone");
const fileInput = document.getElementById("fileInput");
const startBtn = document.getElementById("startBtn");
const downloadAllBtn = document.getElementById("downloadAllBtn");
const clearQueueBtn = document.getElementById("clearQueueBtn");
const fileListEl = document.getElementById("fileList");
const globalStatusEl = document.getElementById("globalStatus");
const summaryEl = document.getElementById("summary");
const globalFormatSelect = document.getElementById("globalFormatSelect");
const themeToggle = document.getElementById("themeToggle");

const MAX_FILES = 20;
const allowedOutputFormats = ["mp3", "wav", "aac", "flac", "ogg", "m4a"];
const allowedInputExts = [".mp4", ".mov", ".mkv", ".avi", ".webm", ".mp3", ".wav", ".m4a", ".flac", ".ogg"];

let fileQueue = []; // { id, file, status, downloadUrl, errorMessage, format }
let isProcessing = false;
let batchStartTime = null;

/* ========== THEME ========== */
function applyTheme(theme) {
  if (theme === "light") {
    document.body.classList.add("light-mode");
    themeToggle.textContent = "Light";
  } else {
    document.body.classList.remove("light-mode");
    themeToggle.textContent = "Dark";
  }
  localStorage.setItem("file43Theme", theme);
}

function initTheme() {
  const saved = localStorage.getItem("file43Theme");
  if (saved === "light" || saved === "dark") {
    applyTheme(saved);
  } else {
    applyTheme("dark");
  }
}

themeToggle.addEventListener("click", () => {
  const isLight = document.body.classList.contains("light-mode");
  applyTheme(isLight ? "dark" : "light");
});

initTheme();

/* ========== BUTTON STATE / GLOBAL STATUS ========== */
function hasCompleted() {
  return fileQueue.some((item) => item.status === "done");
}

function recalcButtons() {
  if (isProcessing) {
    startBtn.disabled = true;
    clearQueueBtn.disabled = true;
    downloadAllBtn.disabled = !hasCompleted();
    startBtn.classList.add("loading");
  } else {
    startBtn.classList.remove("loading");
    const hasFiles = fileQueue.length > 0;
    startBtn.disabled = !hasFiles;
    clearQueueBtn.disabled = !hasFiles;
    downloadAllBtn.disabled = !hasCompleted();
  }
}

function setGlobalStatus(message, type = "") {
  globalStatusEl.textContent = message;
  globalStatusEl.className = "global-status";
  if (type) globalStatusEl.classList.add(type);
}

/* ========== SUMMARY ========== */
function formatDuration(ms) {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

function updateSummary() {
  if (fileQueue.length === 0) {
    summaryEl.textContent = "";
    return;
  }

  const total = fileQueue.length;
  const success = fileQueue.filter((i) => i.status === "done").length;
  const failed = fileQueue.filter((i) => i.status === "error").length;
  const elapsed =
    batchStartTime !== null ? formatDuration(performance.now() - batchStartTime) : "—";

  summaryEl.innerHTML = `
    <div><strong>Summary</strong></div>
    <div>Total files: ${total}</div>
    <div>Successful: ${success}</div>
    <div>Failed: ${failed}</div>
    <div>Time taken (this batch): ${elapsed}</div>
    <div>Output folder: <a href="/output-list" target="_blank">View converted files</a></div>
  `;
}

/* ========== ROW HELPERS ========== */
function createFileRow(item) {
  const row = document.createElement("div");
  row.className = "file-row";
  row.dataset.id = item.id;

  const formatOptions = [
    `<option value="">Use batch default (${globalFormatSelect.value.toUpperCase()})</option>`,
    ...allowedOutputFormats.map(
      (fmt) =>
        `<option value="${fmt}">${fmt.toUpperCase()}</option>`
    ),
  ].join("");

  row.innerHTML = `
    <div class="file-main">
      <span class="file-name">${item.file.name}</span>
      <span class="file-status">Queued</span>
    </div>
    <select class="format-select">
      ${formatOptions}
    </select>
    <div class="progress-bar">
      <div class="progress-fill" style="width: 0%;"></div>
    </div>
    <div class="file-actions">
      <a class="download-link hidden">Download</a>
      <button type="button" class="retry-btn hidden">Retry</button>
      <button type="button" class="remove-btn">Remove</button>
    </div>
  `;

  fileListEl.appendChild(row);

  const formatSelect = row.querySelector(".format-select");
  formatSelect.addEventListener("change", () => {
    const val = formatSelect.value;
    item.format = val || null; // null means use global
  });
}

function refreshPerFileDefaultLabels() {
  const selects = fileListEl.querySelectorAll(".format-select");
  selects.forEach((sel) => {
    if (sel.options.length > 0) {
      sel.options[0].textContent = `Use batch default (${globalFormatSelect.value.toUpperCase()})`;
    }
  });
}

globalFormatSelect.addEventListener("change", () => {
  refreshPerFileDefaultLabels();
});

function getRowById(id) {
  return fileListEl.querySelector(`.file-row[data-id="${id}"]`);
}

function updateRowStatus(id, text) {
  const row = getRowById(id);
  if (!row) return;
  const statusEl = row.querySelector(".file-status");
  statusEl.textContent = text;
}

function updateRowProgress(id, percentage) {
  const row = getRowById(id);
  if (!row) return;
  const fill = row.querySelector(".progress-fill");
  fill.style.width = `${percentage}%`;
}

function setRowDownloadLink(id, url) {
  const row = getRowById(id);
  if (!row) return;
  const link = row.querySelector(".download-link");
  link.href = url;
  link.classList.remove("hidden");
  link.setAttribute("download", "");
}

function setActiveRow(id) {
  fileListEl.querySelectorAll(".file-row").forEach((row) => {
    row.classList.remove("active");
  });
  if (id === null || id === undefined) return;
  const row = getRowById(id);
  if (row) row.classList.add("active");
}

function markFileError(item, message) {
  item.status = "error";
  item.errorMessage = message;

  const row = getRowById(item.id);
  if (!row) return;

  row.classList.add("error");
  updateRowStatus(item.id, "Error – click Retry");
  updateRowProgress(item.id, 0);

  const retryBtn = row.querySelector(".retry-btn");
  if (retryBtn) retryBtn.classList.remove("hidden");

  setGlobalStatus(
    "Some files failed. You can retry individual files that show an error.",
    "error"
  );
  updateSummary();
}

function markFileSuccess(item) {
  item.status = "done";
  const row = getRowById(item.id);
  if (!row) return;
  row.classList.remove("error");
  updateRowStatus(item.id, "Done");
  const retryBtn = row.querySelector(".retry-btn");
  if (retryBtn) retryBtn.classList.add("hidden");
  updateSummary();
}

/* ========== FILE ADDING / QUEUE ========== */
function addFilesToQueue(files) {
  const currentCount = fileQueue.length;
  const remainingSlots = MAX_FILES - currentCount;

  const validFiles = Array.from(files).filter((file) => {
    const ext = (file.name.split(".").pop() || "").toLowerCase();
    return allowedInputExts.includes("." + ext);
  });

  if (validFiles.length === 0) {
    setGlobalStatus("No supported files found in selection.", "error");
    return;
  }

  const toAdd = validFiles.slice(0, remainingSlots);

  if (validFiles.length > remainingSlots) {
    setGlobalStatus(
      `Only ${remainingSlots} more files allowed (max ${MAX_FILES}). Extra files ignored.`,
      "error"
    );
  }

  toAdd.forEach((file) => {
    const id = Date.now() + Math.random();
    const item = {
      id,
      file,
      status: "queued",
      downloadUrl: null,
      errorMessage: null,
      format: null, // per-file output, null => use global
    };
    fileQueue.push(item);
    createFileRow(item);
  });

  if (fileQueue.length > 0) {
    setGlobalStatus(
      `${fileQueue.length} file(s) queued. Click "Start Conversion".`,
      "info"
    );
  }

  updateSummary();
  recalcButtons();
}

/* ========== DRAG & DROP & CLICK ========== */
dropZone.addEventListener("click", () => {
  fileInput.click();
});

fileInput.addEventListener("change", (e) => {
  if (!e.target.files) return;
  addFilesToQueue(e.target.files);
  fileInput.value = "";
});

dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("drag-over");
});

dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("drag-over");
});

dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("drag-over");
  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
    addFilesToQueue(e.dataTransfer.files);
    e.dataTransfer.clearData();
  }
});

/* ========== CONVERSION LOGIC (SEQUENTIAL) ========== */
function getTargetFormatForItem(item) {
  if (item.format && allowedOutputFormats.includes(item.format)) {
    return item.format;
  }
  const globalFmt = globalFormatSelect.value;
  if (allowedOutputFormats.includes(globalFmt)) return globalFmt;
  return "mp3";
}

async function convertFile(item) {
  const row = getRowById(item.id);
  if (row) {
    row.classList.remove("error");
    const retryBtn = row.querySelector(".retry-btn");
    if (retryBtn) retryBtn.classList.add("hidden");
  }

  const format = getTargetFormatForItem(item);

  updateRowStatus(item.id, `Converting to ${format.toUpperCase()}...`);
  updateRowProgress(item.id, 20);

  const formData = new FormData();
  formData.append("video", item.file);
  formData.append("format", format);

  try {
    const res = await fetch("/convert", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Conversion failed.");
    }

    item.downloadUrl = data.downloadUrl;
    markFileSuccess(item);
    updateRowProgress(item.id, 100);
    setRowDownloadLink(item.id, data.downloadUrl);
  } catch (err) {
    console.error("Error converting file:", err);
    markFileError(item, err.message || "Unknown error");
  } finally {
    recalcButtons();
  }
}

async function processQueueSequentially() {
  if (isProcessing) return;

  if (fileQueue.length === 0) {
    setGlobalStatus("Add at least one supported file first.", "error");
    return;
  }

  isProcessing = true;
  batchStartTime = performance.now();
  setGlobalStatus("Converting files one by one…", "info");
  recalcButtons();
  updateSummary();

  for (const item of fileQueue) {
    if (item.status === "done") continue;
    setActiveRow(item.id);
    await convertFile(item);
  }

  setActiveRow(null);
  isProcessing = false;
  recalcButtons();

  const anyError = fileQueue.some((item) => item.status === "error");
  if (anyError) {
    setGlobalStatus(
      "Finished with some errors. You can retry failed files.",
      "error"
    );
  } else {
    setGlobalStatus(
      "All files processed. You can download individually or as ZIP.",
      "success"
    );
  }
  updateSummary();
}

/* ========== DOWNLOAD ALL AS ZIP ========== */
async function downloadAllAsZip() {
  const completed = fileQueue.filter(
    (item) => item.status === "done" && item.downloadUrl
  );

  if (completed.length === 0) {
    setGlobalStatus("No completed files to include in ZIP yet.", "error");
    return;
  }

  const fileNames = completed.map((item) => {
    const url = item.downloadUrl;
    return decodeURIComponent(url.split("/").pop());
  });

  try {
    setGlobalStatus("Preparing ZIP…", "info");
    downloadAllBtn.disabled = true;

    const res = await fetch("/download-zip", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ files: fileNames }),
    });

    if (!res.ok) {
      throw new Error("Failed to create ZIP.");
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "File43_downloads.zip";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    setGlobalStatus("ZIP download started.", "success");
  } catch (err) {
    console.error("Error downloading ZIP:", err);
    setGlobalStatus("Error creating ZIP.", "error");
  } finally {
    recalcButtons();
  }
}

/* ========== QUEUE CONTROLS (clear, remove, retry) ========== */
clearQueueBtn.addEventListener("click", () => {
  if (isProcessing) {
    setGlobalStatus(
      "Wait for the current conversion to finish before clearing.",
      "error"
    );
    return;
  }

  fileQueue = [];
  fileListEl.innerHTML = "";
  setGlobalStatus("Queue cleared.", "info");
  batchStartTime = null;
  updateSummary();
  recalcButtons();
});

// Event delegation for remove + retry
fileListEl.addEventListener("click", (e) => {
  const removeBtn = e.target.closest(".remove-btn");
  const retryBtn = e.target.closest(".retry-btn");
  if (!removeBtn && !retryBtn) return;

  const row = e.target.closest(".file-row");
  if (!row) return;
  const id = row.dataset.id;
  const index = fileQueue.findIndex((item) => String(item.id) === String(id));
  if (index === -1) return;
  const item = fileQueue[index];

  // Remove file from queue
  if (removeBtn) {
    if (isProcessing && item.status !== "done" && item.status !== "error") {
      setGlobalStatus(
        "Can't remove a file while it's being converted.",
        "error"
      );
      return;
    }
    fileQueue.splice(index, 1);
    row.remove();
    setGlobalStatus("File removed from queue.", "info");
    updateSummary();
    recalcButtons();
    return;
  }

  // Retry failed file
  if (retryBtn) {
    if (isProcessing) {
      setGlobalStatus(
        "Wait until the current conversion finishes, then retry.",
        "error"
      );
      return;
    }
    if (item.status !== "error") return;

    item.status = "queued";
    item.downloadUrl = null;
    item.errorMessage = null;

    row.classList.remove("error");
    updateRowStatus(item.id, "Queued (retrying…)");
    updateRowProgress(item.id, 0);

    isProcessing = true;
    recalcButtons();
    setActiveRow(item.id);

    (async () => {
      await convertFile(item);
      isProcessing = false;
      setActiveRow(null);

      const anyError = fileQueue.some((it) => it.status === "error");
      if (anyError) {
        setGlobalStatus(
          "Finished retry with some errors. You can retry again if needed.",
          "error"
        );
      } else {
        setGlobalStatus(
          "Retry finished. All files processed successfully.",
          "success"
        );
      }
      updateSummary();
      recalcButtons();
    })();
  }
});

/* ========== BUTTON HANDLERS ========== */
startBtn.addEventListener("click", () => {
  processQueueSequentially();
});

downloadAllBtn.addEventListener("click", () => {
  downloadAllAsZip();
});

// initial state
recalcButtons();
setGlobalStatus("Drop files to get started.", "info");
updateSummary();
