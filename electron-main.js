// electron-main.js
const { app, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");

// Force the app name (fixes menu bar + Cmd+Tab label)
app.setName("File43");

function createWindow() {
  const iconPath = path.join(__dirname, "public", "file43-icon.png");
  const appVersion = app.getVersion();

  const win = new BrowserWindow({
    width: 1000,
    height: 720,
    minWidth: 800,
    minHeight: 600,
    title: "File43",
    backgroundColor: "#050509",

    // ✅ Use the normal OS frame so the window is draggable
    frame: true,
    titleBarStyle: "default",

    icon: iconPath,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Pass version to renderer as a query param
  win.loadURL(`http://localhost:3000/?v=${encodeURIComponent(appVersion)}`);

  // win.webContents.openDevTools(); // uncomment to debug
}

app.whenReady().then(() => {
  const iconPath = path.join(__dirname, "public", "file43-icon.png");

  // macOS dock icon
  if (process.platform === "darwin" && fs.existsSync(iconPath) && app.dock) {
    app.dock.setIcon(iconPath);
  }

  // Tell the backend where to store uploads/output when packaged
  process.env.FILE43_BASE_DIR = app.getPath("userData");

  // Start Express server AFTER setting FILE43_BASE_DIR
  require("./server");

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
