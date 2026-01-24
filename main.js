const { app, BrowserWindow, screen, ipcMain, dialog } = require("electron");
const bcrypt = require("bcryptjs");
const path = require("path");
const fs = require("fs");

// const logPath = "C:\\electron-debug.log";
const log = (msg) => {
  // if (process.platform === "darwin") {
  console.log(msg);
  // } else {
  //   fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${msg}\n`);
  // }
};

let adminWin = null;
let customerWin = null;

function createWindows() {
  const displays = screen.getAllDisplays();

  // 1. Create main admin/staff window
  adminWin = new BrowserWindow({
    width: 1024,
    height: 768,
    // Performance optimization: Disable hardware acceleration (may be needed for older Win 7 machines)
    // webPreferences: { preload: path.join(__dirname, 'preload.js'), webSecurity: true, contextIsolation: true, sandbox: false, disableHtml5MediaPlayback: true, scrollBounce: false }
    webPreferences: { preload: path.join(__dirname, "preload.js") },
  });
  adminWin.loadFile("src/admin/index.html");

  // 2. Dual-screen detection: If a second screen exists, create the customer display window
  if (displays.length > 1) {
    const externalDisplay =
      displays.find((display) => display.bounds.x !== 0) || displays[1];

    customerWin = new BrowserWindow({
      x: externalDisplay.bounds.x, // Use external display coordinates
      y: externalDisplay.bounds.y,
      width: externalDisplay.bounds.width,
      height: externalDisplay.bounds.height,
      frame: false,
      fullscreen: true,
      webPreferences: { preload: path.join(__dirname, "preload.js") },
    });

    customerWin.loadFile("src/customer/index.html");
  }
}

function openCategoryModal(data) {
  return new Promise((resolve) => {
    const modal = new BrowserWindow({
      width: 450,
      height: 250,
      parent: adminWin,
      modal: true,
      show: false,
      resizable: false,
      minimizable: false,
      maximizable: false,
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
      },
    });

    modal.loadFile("src/components/category-modal/index.html");

    // Pass data to modal
    modal.webContents.once("did-finish-load", () => {
      modal.webContents.send("init-category-modal", data);
      // modal.show();
      modal.webContents
        .executeJavaScript(
          `
        new Promise(resolve => {
          const height = document.body.scrollHeight;
          resolve(height);
        });
      `,
        )
        .then((contentHeight) => {
          modal.setSize(450, contentHeight + 40); // Add margin to content height
          modal.center();
          modal.show();
        });
    });

    // Return data from modal
    ipcMain.once("close-category-modal", (event, result) => {
      resolve(result);
      modal.close();
    });
  });
}

function openProductModal(data) {
  return new Promise((resolve) => {
    const modal = new BrowserWindow({
      width: 450,
      height: 250,
      parent: adminWin,
      modal: true,
      show: false,
      resizable: false,
      minimizable: false,
      maximizable: false,
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
      },
    });

    modal.loadFile("src/components/product-modal/index.html");

    // Pass data to modal
    modal.webContents.once("did-finish-load", () => {
      modal.webContents.send("init-product-modal", data);
      // modal.show();
      modal.webContents
        .executeJavaScript(
          `
        new Promise(resolve => {
          const height = document.body.scrollHeight;
          console.log(height);
          resolve(height);
        });
      `,
        )
        .then((contentHeight) => {
          modal.setSize(450, contentHeight + 80); // Add margin to content height
          modal.center();
          modal.show();
        });
    });

    // Return data from modal
    ipcMain.once("close-product-modal", (event, result) => {
      resolve(result);
      modal.close();
    });
  });
}

// abstruct modal opening
async function openModalWithResult(
  parentWin,
  folderName,
  width,
  height,
  payload,
) {
  const modal = new BrowserWindow({
    width,
    height,
    parent: parentWin,
    modal: true,
    show: false,
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  modal.loadFile(
    path.join(__dirname, `src/components/${folderName}/index.html`),
  );

  return new Promise((resolve) => {
    // 1. init data for modal
    modal.webContents.once("did-finish-load", () => {
      modal.webContents.send("modal-init-data", payload);
    });
    ipcMain.once(`render-ready-${modal.id}`, () => {
      modal.show(); // show modal when dom ready
    });

    // 2. listen to close signal
    // ipcMain.once ensure destory window
    const responseChannel = `modal-result-${modal.id}`;

    ipcMain.once(responseChannel, (event, result) => {
      resolve(result);
      if (!modal.isDestroyed()) modal.close();
    });

    // 3. other case
    modal.on("closed", () => {
      ipcMain.removeAllListeners(responseChannel);
      resolve({ success: false, msg: "Closed by user" });
    });
  });
}

app.whenReady().then(() => {
  log("Database User Data Path:", app.getPath("userData"));
  // CRITICAL: Database module must be loaded after app is ready to ensure app.getPath('userData') is available
  const db = require("./database/db");

  createWindows();

  // --- IPC Communication Logic ---
  ipcMain.on("modal-ready-request", (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      // trigger createModal
      ipcMain.emit(`render-ready-${win.id}`);
    }
  });

  ipcMain.handle("open-category-modal", async (event, payload) => {
    // return await openCategoryModal(payload);
    const parent = BrowserWindow.fromWebContents(event.sender);
    return await openModalWithResult(
      parent,
      "category-modal",
      450,
      280,
      payload,
    );
  });

  ipcMain.handle("open-product-modal", async (event, payload) => {
    // return await openProductModal(payload);
    const parent = BrowserWindow.fromWebContents(event.sender);
    return await openModalWithResult(
      parent,
      "product-modal",
      450,
      550,
      payload,
    );
  });

  ipcMain.on("close-modal-request", (event, result) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    // trigger modal by id
    ipcMain.emit(`modal-result-${win.id}`, event, result);
  });

  // Response: Get initial data
  ipcMain.handle("get-initial-data", () => {
    log("[MAIN] Received request for initial data.");
    try {
      const categories = db.getAllCategories();
      log(`[MAIN] Database returned ${categories.length} categories.`);
      const cateId = categories && categories.length ? categories[0].id : 1;
      return {
        success: true,
        categories: categories,
        products: db.getProducts(cateId),
      };
    } catch (e) {
      console.error("[MAIN] Database query failed:", e);
      // Return empty arrays to prevent app crash
      return { success: false, error: e, categories: [], products: [] };
    }
  });

  // Response: Switch category
  ipcMain.handle("get-products", (event, catId) => {
    return db.getProducts(catId);
  });

  // Core: Cart update -> Sync to customer display
  ipcMain.on("cart-update", (event, cartData) => {
    if (customerWin) {
      customerWin.webContents.send("sync-cart", cartData);
    }
  });

  // Core: Checkout (Adapts to createOrder(items, totalAmount) signature)
  ipcMain.handle("checkout", async (event, { items, total }) => {
    try {
      // db.createOrder now requires items (details) and total (amount)
      const result = db.createOrder(items, total);

      if (result.success) {
        // Clear customer display on success
        if (customerWin) {
          customerWin.webContents.send("sync-cart", { items: [], total: 0 });
        }
      }
      return result; // Return order number etc. to renderer process
    } catch (e) {
      console.error("Checkout failed:", e);
      return { success: false, error: e.message };
    }
  });

  // New: Export transaction reports
  ipcMain.handle("get-reports", async (event, { startDate, endDate }) => {
    try {
      // db.getReports returns flattened transaction records
      return { success: true, data: db.getReports(startDate, endDate) };
    } catch (e) {
      console.error("Report generation failed:", e);
      return { success: false, error: e.message };
    }
  });

  // Response: Handle request to save CSV file
  ipcMain.handle(
    "save-csv-file",
    async (event, csvContent, defaultFilename) => {
      // 1. Show save dialog to let user choose file path
      const { filePath } = await dialog.showSaveDialog({
        title: "Save POS Transaction Report",
        defaultPath: path.join(app.getPath("downloads"), defaultFilename), // Default to downloads directory
        filters: [{ name: "CSV Files", extensions: ["csv"] }],
      });

      if (!filePath) {
        // User cancelled save operation
        return { success: false, error: "User cancelled save dialog" };
      }

      // 2. Write CSV content to chosen path
      try {
        // Write file with utf-8 encoding
        fs.writeFileSync(filePath, csvContent, "utf-8");

        log(`[MAIN] Report successfully saved to: ${filePath}`);
        return { success: true, path: filePath };
      } catch (error) {
        console.error(`[MAIN] File write failed: ${error}`);
        return { success: false, error: error.message };
      }
    },
  );

  // Paginated order list retrieval
  ipcMain.handle("get-paginated-orders", async (event, { limit, offset }) => {
    try {
      const result = db.getPaginatedOrders(limit, offset);

      return {
        success: true,
        data: result.data,
        totalCount: result.totalCount,
      };
    } catch (error) {
      console.error("Failed to retrieve paginated orders:", error);
      return { success: false, error: error.message };
    }
  });

  // Get individual order details
  ipcMain.handle("get-order-details", async (event, orderId) => {
    try {
      const order = db.getOrderDetails(orderId);

      if (!order) {
        return { success: false, error: "Order not found" };
      }

      return { success: true, data: order };
    } catch (error) {
      console.error(`Failed to retrieve details for order ${orderId}:`, error);
      return { success: false, error: error.message };
    }
  });

  // Receipt Printing
  ipcMain.handle("print-receipt", async (event, orderData) => {
    if (!orderData || !orderData.items || orderData.items.length === 0) {
      return { success: false, error: "Missing valid order data" };
    }

    let printWindow = new BrowserWindow({
      show: false, // Hidden window
      width: 400,
      height: 800,
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
        contextIsolation: true,
      },
    });

    const receiptPath = path.join(__dirname, "src/receipt/receipt.html");
    await printWindow.loadFile(receiptPath);

    // Wait for page to finish rendering
    await printWindow.webContents.executeJavaScript(`
    new Promise((resolve) => {
      function tryRender() {
        if (window.renderReceipt) {
          resolve(true);
        } else {
          setTimeout(tryRender, 50);
        }
      }
      tryRender();
    });
  `);

    // Inject order data and trigger rendering
    await printWindow.webContents.executeJavaScript(`
    window.renderReceipt(${JSON.stringify(orderData)});
  `);

    // Execute printing
    const printerName = "GP-C80 Series"; // Thermal printer name
    const result = await printWindow.webContents.print({
      silent: true,
      printBackground: true,
      deviceName: "",
    });

    // Close printing window
    setTimeout(() => {
      printWindow.close();
      printWindow = null;
    }, 5000);

    return { success: process.platform === "win32" ? result : true };
  });

  // User Authentication
  ipcMain.handle("authenticate", async (event, { username, password }) => {
    try {
      const user = db.getUserByUsername(username);

      if (!user) {
        return { success: false, error: "Invalid username or password" };
      }

      // bcrypt.compare is an asynchronous operation
      const isMatch = await bcrypt.compare(password, user.password_hash);

      if (isMatch) {
        return { success: true };
      } else {
        // Password mismatch
        return { success: false, error: "Invalid username or password" };
      }
    } catch (e) {
      console.error("System error during authentication:", e);
      return {
        success: false,
        error: "System authentication error, please contact admin",
      };
    }
  });

  // Category Management
  ipcMain.handle("list-categories", (event) => {
    try {
      const result = db.getAllCategories();
      return { success: !!result, data: result };
    } catch (error) {
      console.error(`Failed to retrieve categories:`, error);
      return { success: false, error: error.message };
    }
  });
  ipcMain.handle("add-category", (event, pData) => {
    return db.addCategory(pData);
  });

  ipcMain.handle("edit-category", (event, pData) => {
    return db.updateCategory(pData);
  });

  ipcMain.handle("del-category", (event, id) => {
    try {
      return db.delCategory(id);
    } catch (error) {
      // Catch system-level errors or unhandled exceptions from db.js
      console.error(`Failed to delete category ${id}:`, error);
      return { success: false, error: error.message };
    }
  });

  // Product Management
  ipcMain.handle("list-products", (event) => {
    return db.getAllProductsAndCategories();
  });

  ipcMain.handle("get-product", (event, id) => {
    return db.getProductById(id);
  });
  ipcMain.handle("add-product", (event, pData) => {
    return db.addProduct(pData);
  });

  ipcMain.handle("edit-product", (event, pData) => {
    return db.updateProduct(pData);
  });

  ipcMain.handle("del-product", (event, id) => {
    return db.delProduct(id);
  });

  // Other Electron event handling
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });
});
