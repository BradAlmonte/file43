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
let ffmpegPath = ffmpegInstaller.path;
if (ffmpegPath.includes("app.asar")) {
  ffmpegPath = ffmpegPath.replace("app.asar", "app.asar.unpacked");
}
ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();

// Use PORT from environment variable if provided, else default to 4315
const PORT = process.env.PORT || 4315;

// Base directory for writable data (uploads/output)
const baseDir = process.env.FILE43_BASE_DIR || __dirname;

// Directories for user data
const uploadDir = path.join(baseDir, "uploads");
const outputDir = path.join(baseDir, "output");

// Ensure directories exist
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

// Middleware
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

// Allowed file types
const allowedInputExts = [".mp4",".mov",".mkv",".avi",".webm",".mp3",".wav",".m4a",".flac",".ogg"];
const allowedOutputFormats = ["mp3","wav","aac","flac","ogg","m4a"];

// Multer storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, file.originalname)
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowedInputExts.includes(ext));
  }
});

// Convert single file
app.post("/convert", upload.single("video"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const inputPath = req.file.path;
  const originalBase = path.basename(req.file.originalname, path.extname(req.file.originalname));

  let targetFormat = (req.body.format || "mp3").toLowerCase();
  if (!allowedOutputFormats.includes(targetFormat)) targetFormat = "mp3";

  const pattern = req.body.namingPattern || "original";
  const index = parseInt(req.body.index || "0", 10) || 0;

  const now = new Date();
  const dateSuffix = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;

  let baseName = originalBase;
  switch(pattern){
    case "suffixConverted": baseName = `${originalBase}_converted`; break;
    case "dateSuffix": baseName = `${originalBase}_${dateSuffix}`; break;
    case "indexPrefix": baseName = index>0 ? `${index}_${originalBase}` : originalBase; break;
  }

  const outputName = `${baseName}.${targetFormat}`;
  const outputPath = path.join(outputDir, outputName);

  ffmpeg(inputPath)
    .toFormat(targetFormat)
    .on("error", err => {
      console.error("FFmpeg error:", err.message);
      fs.unlink(inputPath, () => {});
      res.status(500).json({ error: "Conversion failed: " + err.message });
    })
    .on("end", () => {
      fs.unlink(inputPath, () => {});
      res.json({ downloadUrl: "/download/" + encodeURIComponent(outputName) });
    })
    .save(outputPath);
});

// Single file download
app.get("/download/:filename", (req, res) => {
  const filePath = path.join(outputDir, req.params.filename);
  if (!fs.existsSync(filePath)) return res.status(404).send("File not found");
  res.download(filePath, req.params.filename);
});

// ZIP download
app.post("/download-zip", (req, res) => {
  const files = req.body.files;
  if (!Array.isArray(files) || files.length === 0) return res.status(400).json({ error: "No files provided for ZIP." });

  res.setHeader("Content-Disposition", 'attachment; filename="File43_downloads.zip"');
  res.setHeader("Content-Type", "application/zip");

  const archive = archiver("zip", { zlib: { level: 9 } });
  archive.on("error", err => { console.error(err); res.status(500).end(); });
  archive.pipe(res);

  files.forEach(f => {
    const filePath = path.join(outputDir, f);
    if (fs.existsSync(filePath)) archive.file(filePath, { name: f });
  });

  archive.finalize();
});

// Open the output folder in OS file manager
app.post("/open-output", (req, res) => {
  const folder = outputDir;
  const cmd = process.platform === "darwin" ? `open "${folder}"` :
              process.platform === "win32" ? `start "" "${folder}"` :
              `xdg-open "${folder}"`;

  exec(cmd, err => {
    if(err){ console.error(err); return res.status(500).json({ error: "Unable to open folder." }); }
    res.json({ ok: true });
  });
});

// Simple output list page
app.get("/output-list", (req,res) => {
  fs.readdir(outputDir, (err, files) => {
    if(err){ console.error(err); return res.status(500).send("Error reading output directory."); }
    const links = files.map(f => `<li><a href="/download/${encodeURIComponent(f)}">${f}</a></li>`).join("");
    res.send(`
      <html>
        <head><meta charset="utf-8"><title>File43 Output Files</title></head>
        <body>
          <h2>File43 Output Files</h2>
          <ul>${links || "<li>No files yet.</li>"}</ul>
        </body>
      </html>
    `);
  });
});

// Single listener (Docker-friendly)
app.listen(PORT, "0.0.0.0", () => {
  console.log(`File43 server running at http://localhost:${PORT}`);
  console.log(`Uploads directory: ${uploadDir}`);
  console.log(`Output directory: ${outputDir}`);
});