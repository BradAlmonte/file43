// server.js
const express = require("express");
const multer = require("multer");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegInstaller = require("@ffmpeg-installer/ffmpeg");
const fs = require("fs");
const path = require("path");
const archiver = require("archiver");
const { exec } = require("child_process");

// Use the bundled FFmpeg binary from @ffmpeg-installer/ffmpeg
// In a packaged Electron app, the binary lives in app.asar.unpacked
let ffmpegPath = ffmpegInstaller.path;
if (ffmpegPath.includes("app.asar")) {
  ffmpegPath = ffmpegPath.replace("app.asar", "app.asar.unpacked");
}
ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
const PORT = 3000;

// Base directory for writable data (uploads/output)
// In packaged app: set by Electron to app.getPath("userData")
// In dev: default to __dirname (project root)
const baseDir = process.env.FILE43_BASE_DIR || __dirname;

// Directories for user data
const uploadDir = path.join(baseDir, "uploads");
const outputDir = path.join(baseDir, "output");

// Ensure directories exist
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

// Static files are still served from project/public (inside asar when packaged)
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

const allowedInputExts = [
  ".mp4",
  ".mov",
  ".mkv",
  ".avi",
  ".webm",
  ".mp3",
  ".wav",
  ".m4a",
  ".flac",
  ".ogg"
];

const allowedOutputFormats = ["mp3", "wav", "aac", "flac", "ogg", "m4a"];

// Multer storage config
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname); // keep original filename
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedInputExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Unsupported file type: " + ext));
    }
  }
});

// Convert single file
app.post("/convert", upload.single("video"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const inputPath = req.file.path;
  const originalBase = path.basename(
    req.file.originalname,
    path.extname(req.file.originalname)
  );

  let targetFormat = (req.body.format || "mp3").toLowerCase();
  if (!allowedOutputFormats.includes(targetFormat)) {
    targetFormat = "mp3";
  }

  const pattern = req.body.namingPattern || "original";
  const index = parseInt(req.body.index || "0", 10) || 0;

  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const dateSuffix = `${yyyy}-${mm}-${dd}`;

  let baseName = originalBase;

  switch (pattern) {
    case "suffixConverted":
      baseName = `${originalBase}_converted`;
      break;
    case "dateSuffix":
      baseName = `${originalBase}_${dateSuffix}`;
      break;
    case "indexPrefix":
      baseName = index > 0 ? `${index}_${originalBase}` : originalBase;
      break;
    case "original":
    default:
      baseName = originalBase;
      break;
  }

  const outputName = `${baseName}.${targetFormat}`;
  const outputPath = path.join(outputDir, outputName);

  ffmpeg(inputPath)
    .toFormat(targetFormat)
    .on("error", (err) => {
      console.error("FFmpeg error:", err.message);
      fs.unlink(inputPath, () => {});
      return res
        .status(500)
        .json({ error: "Conversion failed: " + err.message });
    })
    .on("end", () => {
      fs.unlink(inputPath, () => {});
      return res.json({
        downloadUrl: "/download/" + encodeURIComponent(outputName)
      });
    })
    .save(outputPath);
});

// Single file download
app.get("/download/:filename", (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(outputDir, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send("File not found");
  }

  res.download(filePath, filename);
});

// ZIP download
app.post("/download-zip", (req, res) => {
  const files = req.body.files;

  if (!Array.isArray(files) || files.length === 0) {
    return res.status(400).json({ error: "No files provided for ZIP." });
  }

  res.setHeader(
    "Content-Disposition",
    'attachment; filename="File43_downloads.zip"'
  );
  res.setHeader("Content-Type", "application/zip");

  const archive = archiver("zip", { zlib: { level: 9 } });
  archive.on("error", (err) => {
    console.error("Archive error:", err.message);
    res.status(500).end();
  });

  archive.pipe(res);

  files.forEach((filename) => {
    const filePath = path.join(outputDir, filename);
    if (fs.existsSync(filePath)) {
      archive.file(filePath, { name: filename });
    }
  });

  archive.finalize();
});

// Open the output folder in the OS file manager
app.post("/open-output", (req, res) => {
  const folder = outputDir;
  let cmd;

  if (process.platform === "darwin") {
    cmd = `open "${folder}"`; // macOS
  } else if (process.platform === "win32") {
    cmd = `start "" "${folder}"`; // Windows
  } else {
    cmd = `xdg-open "${folder}"`; // Linux
  }

  exec(cmd, (err) => {
    if (err) {
      console.error("Error opening output folder:", err);
      return res.status(500).json({ error: "Unable to open folder." });
    }
    res.json({ ok: true });
  });
});

// Simple output list page
app.get("/output-list", (req, res) => {
  fs.readdir(outputDir, (err, files) => {
    if (err) {
      console.error("Error reading output dir:", err);
      return res.status(500).send("Error reading output directory.");
    }

    const links = files
      .map(
        (f) =>
          `<li><a href="/download/${encodeURIComponent(f)}">${f}</a></li>`
      )
      .join("");

    res.send(`
      <html>
        <head>
          <meta charset="utf-8" />
          <title>File43 Output Files</title>
        </head>
        <body>
          <h2>File43 Output Files</h2>
          <ul>${links || "<li>No files yet.</li>"}</ul>
        </body>
      </html>
    `);
  });
});

app.listen(PORT, () => {
  console.log(`File43 server running at http://localhost:${PORT}`);
  console.log(`Uploads directory: ${uploadDir}`);
  console.log(`Output directory: ${outputDir}`);
});
