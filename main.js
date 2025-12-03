const { app, BrowserWindow, screen, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");

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

  // if (displays.length > 1) { // <-- 暂时注释掉这行

  // 如果是双屏，使用外部显示器 (保留原逻辑，但现在是可选的)
  const externalDisplay =
    displays.find((display) => display.bounds.x !== 0) || displays[1];

  let customerWinOptions = {};

  if (displays.length > 1) {
    // 双屏环境：全屏显示在第二个屏幕
    customerWinOptions = {
      x: externalDisplay.bounds.x,
      y: externalDisplay.bounds.y,
      width: externalDisplay.bounds.width,
      height: externalDisplay.bounds.height,
      frame: false,
      fullscreen: true,
    };
  } else {
    // 单屏环境：作为 Admin 窗口旁边的一个小窗口显示
    customerWinOptions = {
      width: 400, // 设定一个合适的小尺寸
      height: 600,
      x: 850, // 放在 Admin 窗口旁边 (假设 Admin 窗口宽度为 800)
      y: 50,
      frame: true, // 加上边框，方便拖动
    };
  }

  customerWin = new BrowserWindow({
    ...customerWinOptions,
    webPreferences: { preload: path.join(__dirname, "preload.js") },
  });
  customerWin.loadFile("src/customer/index.html");
  // } // <-- 暂时注释掉这行
}

app.whenReady().then(() => {
  console.log("Database User Data Path:", app.getPath("userData"));
  // CRITICAL: 数据库模块必须在 app 就绪后加载，以确保 app.getPath('userData') 可用
  const db = require("./database/db");

  createWindows();

  // --- IPC 通信逻辑 ---

  // 响应：获取初始化数据 (UNCHANGED)
  ipcMain.handle("get-initial-data", () => {
    console.log("[MAIN] 收到获取初始化数据的请求.");
    try {
      const categories = db.getAllCategories();
      console.log(`[MAIN] 数据库返回 ${categories.length} 个类别.`);
      const cateId = categories && categories.length ? categories[0].id : 1;
      return {
        categories: categories,
        products: db.getProducts(cateId),
      };
    } catch (e) {
      console.error("[MAIN] 数据库查询失败:", e);
      // 返回一个空数组，避免应用崩溃
      return { categories: [], products: [] };
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

  // 新增：导出流水报表 (NEW)
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

        console.log(`[MAIN] 报告成功保存到: ${filePath}`);
        return { success: true, path: filePath };
      } catch (error) {
        console.error(`[MAIN] 文件写入失败: ${error}`);
        return { success: false, error: error.message };
      }
    }
  );

  ipcMain.handle("print-receipt", async (event, orderData) => {
    if (!orderData || !orderData.items || orderData.items.length === 0) {
        return { success: false, error: '缺少有效的订单数据' };
    }

    let printWindow = new BrowserWindow({
      show: true, // 关键：设置为隐藏窗口，用户不可见
      webPreferences: {
        // 确保打印窗口也能使用 preload 脚本
        preload: path.join(__dirname, "preload.js"),
        // 允许在打印窗口中执行 Node.js API (安全起见，通常不需要)
        // nodeIntegration: false,
        contextIsolation: true,
      },
      width: 400, // 热敏打印机宽度通常较小
      height: 800,
    });

    // 🚀 核心调试步骤 1：自动打开开发者工具，方便检查 DOM 和 Console
    printWindow.webContents.openDevTools(); 

    // 1. 加载打印模板
    const receiptPath = path.join(__dirname, "src/receipt/receipt.html");
    await printWindow.loadFile(receiptPath);

    // 2. 将数据注入到打印窗口的 JS 环境中
    console.log(orderData)
    await printWindow.webContents.executeJavaScript(`
        window.renderReceipt(${JSON.stringify(orderData)});
    `);

    // // 3. 执行静默打印
    // const result = await printWindow.webContents.print({
    //   silent: false, // 关键：不显示打印对话框，直接打印
    //   printBackground: true, // 打印背景颜色/图片
    //   deviceName: "", // 留空则使用默认打印机，或指定热敏打印机名称
    // });

    // // 4. 打印完成后关闭隐藏窗口
    // printWindow.close();
    // printWindow = null;

    return { success: true };
  });

  // 其他 Electron 事件处理
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });
});
