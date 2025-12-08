const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  // 1. 数据获取 (ipcRenderer.invoke 用于需要等待主进程返回数据的操作)
  /**
   * 获取初始数据 (分类和默认商品)
   */
  getInitialData: () => ipcRenderer.invoke("get-initial-data"),

  /**
   * 切换分类时获取商品列表
   */
  getProducts: (catId) => ipcRenderer.invoke("get-products", catId),

  // 历史订单分页列表
  getPaginatedOrders: (pagination) =>
    ipcRenderer.invoke("get-paginated-orders", pagination),

  // 获取单个订单明细
  getOrderDetails: (orderId) =>
    ipcRenderer.invoke("get-order-details", orderId),

  /**
   * 获取订单流水报表
   * @param {string} startDate - ISO 格式的开始时间
   * @param {string} endDate - ISO 格式的结束时间
   */
  getReports: (startDate, endDate) =>
    ipcRenderer.invoke("get-reports", { startDate, endDate }),

  // 2. 命令/交互 (ipcRenderer.invoke 用于结账，需要返回结果)
  /**
   * 提交结账，需要等待数据库操作完成
   * @param {object} cartData - 包含 { items, total } 的对象
   */
  checkout: (cartData) => ipcRenderer.invoke("checkout", cartData),

  // 3. 异步通知 (ipcRenderer.send 用于不关心返回结果的同步操作)
  /**
   * 更新购物车状态，通知主进程同步给客显
   * @param {object} cartData - 包含 { items, total } 的对象
   */
  updateCart: (cartData) => ipcRenderer.send("cart-update", cartData),

  // 暴露打印小票的新接口
  printReceipt: (orderData) => ipcRenderer.invoke("print-receipt", orderData),

  // 暴露保存文件的新接口
  saveCsvFile: (csvContent, defaultFilename) =>
    ipcRenderer.invoke("save-csv-file", csvContent, defaultFilename),

  // 认证接口
  authenticate: (credentials) =>
    ipcRenderer.invoke("authenticate", credentials),

  // 4. 监听 (ipcRenderer.on 仅用于接收主进程推送的消息，如客显同步)
  /**
   * 监听主进程推送的购物车同步消息 (用于客显端)
   * @param {function} callback - 接收数据的回调函数
   */
  onCartSync: (callback) => {
    // 移除旧的监听器，防止重复注册
    ipcRenderer.removeAllListeners("sync-cart");
    // 注册新的监听器
    ipcRenderer.on("sync-cart", (event, value) => callback(value));
  },

  // 商品管理
  getAllProductsAndCategories: () => ipcRenderer.invoke("list-products"),
  getProductById: (id) => ipcRenderer.invoke("get-product", id),
  insertProduct: (pData) => ipcRenderer.invoke("add-product", pData),
  updateProduct: (pData) => ipcRenderer.invoke("edit-product", pData),
  deleteProduct: (id) => ipcRenderer.invoke("del-product", id),

  // 分类管理
  getAllCategories: () => ipcRenderer.invoke("list-categories"),
  insertCategory: (cData) => ipcRenderer.invoke("add-category", cData),
  updateCategory: (cData) => ipcRenderer.invoke("edit-category", cData),
  deleteCategory: (id) => ipcRenderer.invoke("del-category", id),
});
