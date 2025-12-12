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

  // 1. 创建员工主窗口
  adminWin = new BrowserWindow({
    width: 1024,
    height: 768,
    // 性能优化：禁用硬件加速 (Win 7 老机器可能需要)
    // webPreferences: { preload: path.join(__dirname, 'preload.js'), webSecurity: true, contextIsolation: true, sandbox: false, disableHtml5MediaPlayback: true, scrollBounce: false }
    webPreferences: { preload: path.join(__dirname, "preload.js") },
  });
  adminWin.loadFile("src/admin/index.html");

  // 2. 检测双屏：如果有第二个屏幕，创建客显窗口
  if (displays.length > 1) {
    const externalDisplay =
      displays.find((display) => display.bounds.x !== 0) || displays[1];

    customerWin = new BrowserWindow({
      x: externalDisplay.bounds.x, // 使用外部显示器的起始坐标
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

    // 数据传入 modal
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
      `
        )
        .then((contentHeight) => {
          modal.setSize(450, contentHeight + 40); // 内容加一点 margin
          modal.center();
          modal.show();
        });
    });

    // modal 返回数据
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

    // 数据传入 modal
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
      `
        )
        .then((contentHeight) => {
          modal.setSize(450, contentHeight + 80); // 内容加一点 margin
          modal.center();
          modal.show();
        });
    });

    // modal 返回数据
    ipcMain.once("close-product-modal", (event, result) => {
      resolve(result);
      modal.close();
    });
  });
}

app.whenReady().then(() => {
  log("Database User Data Path:", app.getPath("userData"));
  // CRITICAL: 数据库模块必须在 app 就绪后加载，以确保 app.getPath('userData') 可用
  const db = require("./database/db");

  createWindows();

  // --- IPC 通信逻辑 ---
  ipcMain.handle("open-category-modal", async (event, payload) => {
    return await openCategoryModal(payload);
  });

  ipcMain.handle("open-product-modal", async (event, payload) => {
    return await openProductModal(payload);
  });

  // 响应：获取初始化数据 (UNCHANGED)
  ipcMain.handle("get-initial-data", () => {
    log("[MAIN] 收到获取初始化数据的请求.");
    try {
      const categories = db.getAllCategories();
      log(`[MAIN] 数据库返回 ${categories.length} 个类别.`);
      const cateId = categories && categories.length ? categories[0].id : 1;
      return {
        success: true,
        categories: categories,
        products: db.getProducts(cateId),
      };
    } catch (e) {
      console.error("[MAIN] 数据库查询失败:", e);
      // 返回一个空数组，避免应用崩溃
      return { success: false, error: e, categories: [], products: [] };
    }
  });

  // 响应：切换分类 (UNCHANGED)
  ipcMain.handle("get-products", (event, catId) => {
    return db.getProducts(catId);
  });

  // 核心：购物车更新 -> 同步给客显 (UNCHANGED)
  ipcMain.on("cart-update", (event, cartData) => {
    if (customerWin) {
      customerWin.webContents.send("sync-cart", cartData);
    }
  });

  // 核心：结账 (UPDATED: 适应新的 createOrder(items, totalAmount) 签名)
  ipcMain.handle("checkout", async (event, { items, total }) => {
    try {
      // db.createOrder 现在需要 items (商品详情) 和 total (总金额)
      const result = db.createOrder(items, total);

      if (result.success) {
        // 成功后清空客显
        if (customerWin) {
          customerWin.webContents.send("sync-cart", { items: [], total: 0 });
        }
      }
      return result; // 返回订单号等信息给渲染进程
    } catch (e) {
      console.error("Checkout failed:", e);
      return { success: false, error: e.message };
    }
  });

  // 新增：导出流水报表
  ipcMain.handle("get-reports", async (event, { startDate, endDate }) => {
    try {
      // db.getReports 返回扁平化的交易记录
      return { success: true, data: db.getReports(startDate, endDate) };
    } catch (e) {
      console.error("Report generation failed:", e);
      return { success: false, error: e.message };
    }
  });

  // 响应：处理保存 CSV 文件的请求
  ipcMain.handle(
    "save-csv-file",
    async (event, csvContent, defaultFilename) => {
      // 1. 弹出保存对话框，让用户选择文件路径
      const { filePath } = await dialog.showSaveDialog({
        title: "保存 POS 交易报告",
        defaultPath: path.join(app.getPath("downloads"), defaultFilename), // 默认在下载目录
        filters: [{ name: "CSV 文件", extensions: ["csv"] }],
      });

      if (!filePath) {
        // 用户取消了保存操作
        return { success: false, error: "User cancelled save dialog" };
      }

      // 2. 将 CSV 内容写入用户选择的路径
      try {
        // 写入文件，使用 utf-8 编码，确保中文不乱码
        fs.writeFileSync(filePath, csvContent, "utf-8");

        log(`[MAIN] 报告成功保存到: ${filePath}`);
        return { success: true, path: filePath };
      } catch (error) {
        console.error(`[MAIN] 文件写入失败: ${error}`);
        return { success: false, error: error.message };
      }
    }
  );

  // 分页获取订单列表
  ipcMain.handle("get-paginated-orders", async (event, { limit, offset }) => {
    try {
      const result = db.getPaginatedOrders(limit, offset);

      return {
        success: true,
        data: result.data,
        totalCount: result.totalCount,
      };
    } catch (error) {
      console.error("获取分页订单失败:", error);
      return { success: false, error: error.message };
    }
  });

  // 获取单个订单明细
  ipcMain.handle("get-order-details", async (event, orderId) => {
    try {
      const order = db.getOrderDetails(orderId);

      if (!order) {
        return { success: false, error: "订单未找到" };
      }

      return { success: true, data: order };
    } catch (error) {
      console.error(`获取订单 ${orderId} 明细失败:`, error);
      return { success: false, error: error.message };
    }
  });

  // print
  ipcMain.handle("print-receipt", async (event, orderData) => {
    if (!orderData || !orderData.items || orderData.items.length === 0) {
      return { success: false, error: "缺少有效的订单数据" };
    }

    let printWindow = new BrowserWindow({
      show: false, // 隐藏窗口
      width: 400,
      height: 800,
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
        contextIsolation: true,
      },
    });

    const receiptPath = path.join(__dirname, "src/receipt/receipt.html");
    await printWindow.loadFile(receiptPath);

    // 等待页面完全渲染
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

    // 注入订单数据并触发渲染
    await printWindow.webContents.executeJavaScript(`
    window.renderReceipt(${JSON.stringify(orderData)});
  `);

    // 执行打印
    const printerName = "GP-C80 Series"; // Win7 热敏打印机名称，可含空格
    const result = await printWindow.webContents.print({
      silent: true,
      printBackground: true,
      deviceName: "",
    });

    // 关闭打印窗口
    setTimeout(() => {
      printWindow.close();
      printWindow = null;
    }, 5000);

    return { success: process.platform === "win32" ? result : true };
  });

  // 用户认证
  ipcMain.handle("authenticate", async (event, { username, password }) => {
    try {
      const user = db.getUserByUsername(username);

      if (!user) {
        return { success: false, error: "用户名或密码错误" };
      }

      // bcrypt.compare 是异步操作
      const isMatch = await bcrypt.compare(password, user.password_hash);

      if (isMatch) {
        return { success: true };
      } else {
        // 密码不匹配
        return { success: false, error: "用户名或密码错误" };
      }
    } catch (e) {
      console.error("认证过程中发生系统错误:", e);
      return { success: false, error: "系统认证错误，请联系管理员" };
    }
  });

  // 分类管理
  ipcMain.handle("list-categories", (event) => {
    try {
      const result = db.getAllCategories();
      return { success: !!result, data: result };
    } catch (error) {
      console.error(`获取分类失败:`, error);
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
      // 捕获系统级错误或 db.js 未处理的异常
      console.error(`删除分类 ${id} 失败:`, error);
      return { success: false, error: error.message };
    }
  });

  // 商品管理
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

  // 其他 Electron 事件处理
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });
});
