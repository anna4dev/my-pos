const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  // 1. Data Fetching (ipcRenderer.invoke is used for operations requiring a response from the main process)
  /**
   * Get initial data (Categories and default products)
   */
  getInitialData: () => ipcRenderer.invoke("get-initial-data"),

  /**
   * Fetch product list when switching categories
   */
  getProducts: (catId) => ipcRenderer.invoke("get-products", catId),

  // Paginated list for order history
  getPaginatedOrders: (pagination) =>
    ipcRenderer.invoke("get-paginated-orders", pagination),

  // Get individual order details
  getOrderDetails: (orderId) =>
    ipcRenderer.invoke("get-order-details", orderId),

  /**
   * Fetch transaction report data
   * @param {string} startDate - Start time in ISO format
   * @param {string} endDate - End time in ISO format
   */
  getReports: (startDate, endDate) =>
    ipcRenderer.invoke("get-reports", { startDate, endDate }),

  // 2. Commands/Interactions (ipcRenderer.invoke used for checkout, requires a result)
  /**
   * Submit checkout and wait for database operation to complete
   * @param {object} cartData - Object containing { items, total }
   */
  checkout: (cartData) => ipcRenderer.invoke("checkout", cartData),

  // 3. Asynchronous Notifications (ipcRenderer.send for operations where result is not tracked)
  /**
   * Update cart status and notify main process to sync with customer display
   * @param {object} cartData - Object containing { items, total }
   */
  updateCart: (cartData) => ipcRenderer.send("cart-update", cartData),

  // Interface for printing receipts
  printReceipt: (orderData) => ipcRenderer.invoke("print-receipt", orderData),

  // Interface for saving files
  saveCsvFile: (csvContent, defaultFilename) =>
    ipcRenderer.invoke("save-csv-file", csvContent, defaultFilename),

  // Authentication interface
  authenticate: (credentials) =>
    ipcRenderer.invoke("authenticate", credentials),

  // 4. Listeners (ipcRenderer.on for receiving push messages from main process)
  /**
   * Listen for cart synchronization messages (used by customer display)
   * @param {function} callback - Callback function to receive data
   */
  onCartSync: (callback) => {
    // Remove existing listeners to prevent duplicate registrations
    ipcRenderer.removeAllListeners("sync-cart");
    // Register new listener
    ipcRenderer.on("sync-cart", (event, value) => callback(value));
  },

  // Product Management
  getAllProductsAndCategories: () => ipcRenderer.invoke("list-products"),
  getProductById: (id) => ipcRenderer.invoke("get-product", id),
  insertProduct: (pData) => ipcRenderer.invoke("add-product", pData),
  updateProduct: (pData) => ipcRenderer.invoke("edit-product", pData),
  deleteProduct: (id) => ipcRenderer.invoke("del-product", id),

  // Category Management
  getAllCategories: () => ipcRenderer.invoke("list-categories"),
  insertCategory: (cData) => ipcRenderer.invoke("add-category", cData),
  updateCategory: (cData) => ipcRenderer.invoke("edit-category", cData),
  deleteCategory: (id) => ipcRenderer.invoke("del-category", id),

  // Category Modal
  openCategoryModal: (data) => ipcRenderer.invoke("open-category-modal", data),
  onCategoryModalInit: (callback) =>
    ipcRenderer.on("init-category-modal", (e, d) => callback(d)),
  closeCategoryModal: (data) => ipcRenderer.send("close-category-modal", data),

  // Product Modal
  openProductModal: (data) => ipcRenderer.invoke("open-product-modal", data),
  onProductModalInit: (callback) =>
    ipcRenderer.on("init-product-modal", (e, d) => callback(d)),
  closeProductModal: (data) => ipcRenderer.send("close-product-modal", data),
});