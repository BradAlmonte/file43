// electron-main.js
const { app, BrowserWindow } = require("electron");
const path = require("path");

// Start your existing Express server
require("./server"); // server.js will start on PORT 3000

function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 720,
    minWidth: 800,
    minHeight: 600,
    title: "File43",
    backgroundColor: "#050509",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Load your local web app
  win.loadURL("http://localhost:3000");

  // For debugging:
  // win.webContents.openDevTools();
}

app.whenReady().then(() => {
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
