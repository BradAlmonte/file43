
## Requirements

- **Docker** (recommended for easiest setup)
- **Node.js** (v18+ if running locally without Docker)

FFmpeg is bundled automatically via [`@ffmpeg-installer/ffmpeg`], so you don’t need to install it separately.

---

## Getting Started with Docker

1. Clone the repo:

```bash
git clone https://github.com/YOUR-USERNAME/file43.git
cd file43
Build the Docker image:
docker build -t file43 .
Run the container (default port 4315):
docker run -it --rm -p 4315:4315 file43

Or map to a custom port:

docker run -it --rm -p 3005:3005 -e PORT=3005 file43
Open your browser:
http://localhost:4315
Getting Started with Node.js / Electron

If you want to run it as a desktop app:

Install dependencies:
npm install
Run as a desktop app (Electron):
npm run app
This starts a local Node/Express server (default port 4315)
Opens an Electron window pointing to http://localhost:4315
Run in your browser only (optional):
npm start

Then open:

http://localhost:4315
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
You can safely delete the output/ folder to clear old conversions.
When using Docker, the server listens on 0.0.0.0 inside the container; you can map it to any host port.