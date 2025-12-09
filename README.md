# File43

File43 is a local-only media converter app built with Electron + Node + FFmpeg.

- Drag & drop up to 20 files
- Converts sequentially (no overload)
- Supports multiple input formats: **MP4, MOV, MKV, AVI, WEBM, MP3, WAV, M4A, FLAC, OGG**
- Supports multiple output formats: **MP3, WAV, AAC, FLAC, OGG, M4A**
- Batch output format + per-file override
- Individual downloads or “Download All as ZIP”
- Retry failed conversions
- Dark / Light mode toggle
- Summary: total files, successful, failed, time taken, link to output folder
- Runs completely on your machine (no cloud)

---

## Requirements

- **Node.js** (v18+ recommended)

FFmpeg is bundled automatically via [`@ffmpeg-installer/ffmpeg`], so you don’t need to install it separately.

---

## Getting Started

Clone the repo:

```bash
TLDR just copy the next four lines to open the app from terminal.

git clone https://github.com/BradAlmonte/file43.git
cd file43
npm install
npm run app



Install dependencies:

npm install

Run as a desktop app (Electron)
npm run app


This:

starts the local Node/Express server on port 3000

opens an Electron window that loads http://localhost:3000

Run in your browser (optional)
npm start


Then open:

http://localhost:3000


Usage

Drag & drop files into the drop zone (max 20).

Choose a batch output format at the top.

Optionally override the output format for any individual file.

Click Start Conversion.

Download files individually, or click Download All as ZIP.

Check the Summary section for:

Total files

Successful

Failed

Time taken (this batch)

Link to view all converted files.

All processing happens locally on your machine.


Notes

uploads/ and output/ are created at runtime and ignored by Git.

You can safely delete the output folder to clear old conversions.
