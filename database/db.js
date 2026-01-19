const { app } = require("electron"); // 1. Import app module to get the user data path
const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

// --- Path Configuration Optimization (Ensures write access after packaging) ---
const dbDirectory = app.getPath("userData");
const dbPath = path.join(dbDirectory, "pos.sqlite");

// Ensure the database directory exists
if (!fs.existsSync(dbDirectory)) {
  fs.mkdirSync(dbDirectory, { recursive: true });
}

// Connect to the database instance
const db = new Database(dbPath);

// --- Database Initialization (Using new table structure) ---
db.exec(`
    -- 1. Categories Table
    CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL
    );

    -- 2. Products Table
    CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category_id INTEGER,
        name TEXT NOT NULL,
        price INTEGER NOT NULL,
        options TEXT,
        FOREIGN KEY(category_id) REFERENCES categories(id)
    );

    -- 3. Orders Main Table (Updated structure)
    CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_no TEXT NOT NULL UNIQUE,
        total_amount INTEGER NOT NULL,
        discount_amount INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 4. Order Items Table (New structure)
    CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        product_name TEXT NOT NULL,
        category_name TEXT NOT NULL,
        unit_price INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        options_used TEXT,
        FOREIGN KEY(order_id) REFERENCES orders(id)
    );

    -- Users Table
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL
    );
`);

// --- Prepared Statements ---
const getCategories = db.prepare("SELECT * FROM categories");
const getProductsByCat = db.prepare(
  "SELECT * FROM products WHERE category_id = ?"
);
const getUserByUsernameStmt = db.prepare(
  "SELECT id, username, password_hash FROM users WHERE username = ?"
);

// Category queries
const getAllProductsStmt = db.prepare(
  "SELECT id, category_id, name, price, options FROM products ORDER BY category_id, id"
);
const getAllCategoriesStmt = db.prepare(
  "SELECT id, name FROM categories ORDER BY id"
);
const insertCategoryStmt = db.prepare(
  "INSERT INTO categories (name) VALUES (?)"
);
const updateCategoryStmt = db.prepare(
  "UPDATE categories SET name = ? WHERE id = ?"
);
const deleteCategoryStmt = db.prepare("DELETE FROM categories WHERE id = ?");

const deleteProductsByCategoryStmt = db.prepare(
  "DELETE FROM products WHERE category_id = ?"
);
// Count the number of products under a category
const countProductsInCategoryStmt = db.prepare(
  "SELECT COUNT(id) AS count FROM products WHERE category_id = ?"
);

// Product queries
const getProductByIdStmt = db.prepare(
  "SELECT id, category_id, name, price, options FROM products WHERE id = ?"
);
const insertProductStmt = db.prepare(
  "INSERT INTO products (category_id, name, price, options) VALUES (?, ?, ?, ?)"
);
const updateProductStmt = db.prepare(
  "UPDATE products SET category_id = ?, name = ?, price = ?, options = ? WHERE id = ?"
);
const deleteProductStmt = db.prepare("DELETE FROM products WHERE id = ?");

// Order main table insertion
const insertOrder = db.prepare(`
    INSERT INTO orders (order_no, total_amount, created_at) 
    VALUES (?, ?, ?)
`);

// Order items table insertion
const insertOrderItem = db.prepare(`
    INSERT INTO order_items (order_id, product_name, category_name, unit_price, quantity, options_used) 
    VALUES (@orderId, @productName, @categoryName, @unitPrice, @quantity, @optionsUsed)
`);

// --- Report Queries (Prepared Statements) ---
const getReportsStatement = db.prepare(`
    SELECT
        T1.order_no,
        T1.created_at,
        T1.total_amount,
        T1.discount_amount,
        T2.product_name,
        T2.category_name,
        T2.unit_price,
        T2.quantity,
        T2.options_used
    FROM orders AS T1
    INNER JOIN order_items AS T2 ON T1.id = T2.order_id
    WHERE T1.created_at BETWEEN @startDate AND @endDate
    ORDER BY T1.created_at DESC, T1.order_no
`);

// --- Order History Queries (Prepared Statements) ---
// 1. Get total count of orders
const getTotalOrdersCount = db.prepare("SELECT COUNT(*) AS count FROM orders");

// 2. Get paged order list
const getOrdersPaged = db.prepare(`
    SELECT id, order_no, total_amount, created_at
    FROM orders
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
`);

// 3. Get main order info
const getOrderMain = db.prepare("SELECT * FROM orders WHERE id = ?");

// 4. Get order item details
const getOrderItems = db.prepare(
  "SELECT product_name, options_used, quantity, unit_price FROM order_items WHERE order_id = ?"
);

/**
 * Generates an order number in the format YYYYMMDD{4-digit sequence number}.
 */
function generateOrderNo() {
  const now = new Date();
  // Simplify order number generation, ensuring order_no is not empty
  const todayDatePart =
    now.getFullYear().toString() +
    (now.getMonth() + 1).toString().padStart(2, "0") +
    now.getDate().toString().padStart(2, "0");

  let currentSerial = 1; // Default starts at 0001
  const latestOrder = db
    .prepare("SELECT order_no FROM orders ORDER BY id DESC LIMIT 1")
    .get();
  if (latestOrder) {
    const lastOrderNo = latestOrder.order_no;
    // The first 8 digits are the date part
    const lastDatePart = lastOrderNo.substring(0, 8);

    if (lastDatePart === todayDatePart) {
      // If it is an order from today: extract the last 4-digit sequence and increment by 1
      const lastSerialPart = lastOrderNo.substring(8);
      // Convert string to integer and increment
      currentSerial = parseInt(lastSerialPart, 10) + 1;
    }
    // Otherwise (if not today's order), currentSerial remains default value 1
  }

  // 3. Format the sequence number to 4 digits with leading zeros
  const serialPart = currentSerial.toString().padStart(4, "0");

  // 4. Combine and return the new order number
  const newOrderNo = todayDatePart + serialPart;

  return newOrderNo;
}

// --- Core Module: Transaction Processing ---

/**
 * Checkout and record order transactions.
 * @param {object[]} items - Array of items in cart: [{ name, price, count, categoryName, optionsUsed, ... }]
 * @param {number} totalAmount - Total order amount (in cents/smallest unit)
 */
const createOrder = db.transaction((items, totalAmount) => {
  // 1. Insert main order record
  const orderNo = generateOrderNo();
  const createdAt = new Date().toISOString();
  const orderInfo = insertOrder.run(orderNo, totalAmount, createdAt);
  const orderId = orderInfo.lastInsertRowid;

  // 2. Loop to insert order item details
  for (const item of items) {
    insertOrderItem.run({
      orderId: orderId,
      productName: item.name,
      categoryName: item.categoryName || "Uncategorized", // Ensure value exists
      unitPrice: item.price,
      quantity: item.count,
      optionsUsed: JSON.stringify(item.options || []),
    });
  }

  return { success: true, orderId: orderId, orderNo: orderNo, createdAt };
});

/**
 * Get order transaction logs within a specified date range.
 * @param {string} startDate - Start date (ISO 8601 format, e.g., '2025-12-01T00:00:00.000Z')
 * @param {string} endDate - End date (ISO 8601 format, e.g., '2025-12-31T23:59:59.999Z')
 * @returns {object[]} - Flattened array of transaction records.
 */
function getReports(startDate, endDate) {
  // Ensure date parameter formatting is correct for SQL BETWEEN statement
  return getReportsStatement.all({
    startDate: startDate,
    endDate: endDate,
  });
}

// --- Module Exports ---
module.exports = {
  getAllCategories: () => getCategories.all(),
  getProducts: (catId) => getProductsByCat.all(catId),
  getUserByUsername: (username) => getUserByUsernameStmt.get(username),
  createOrder: createOrder,
  getReports: getReports,
  // 1. Get paged order list and total count
  getPaginatedOrders: (limit, offset) => {
    // Use prepared statement to get total count
    const totalResult = getTotalOrdersCount.get();
    const totalCount = totalResult.count;

    // Use prepared statement to get order data for current page
    const data = getOrdersPaged.all(limit, offset);

    return { data: data, totalCount: totalCount };
  },

  // 2. Get full details for a single order
  getOrderDetails: (orderId) => {
    // 1. Use prepared statement to get main order info
    const order = getOrderMain.get(orderId);

    if (!order) {
      return null;
    }

    // 2. Use prepared statement to get order items
    const items = getOrderItems.all(orderId);

    // 3. Convert JSON strings back to array objects
    order.items = items.map((item) => ({
      ...item,
      options: JSON.parse(item.options_used || "[]"),
    }));

    return order;
  },
  /**
   * Add new category
   * @param {object} cData - { name }
   */
  addCategory: (cData) => {
    try {
      const info = insertCategoryStmt.run(cData.name);
      return { success: true, id: info.lastInsertRowid };
    } catch (error) {
      console.error("DB Error: addCategory", error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Update category
   * @param {object} cData - { id, name }
   */
  updateCategory: (cData) => {
    try {
      updateCategoryStmt.run(cData.name, cData.id);
      return { success: true };
    } catch (error) {
      console.error("DB Error: updateCategory", error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Delete category
   * @param {number} id - Category ID
   */
  delCategory: (id) => {
    try {
      // 1. Count products to be deleted for frontend notification
      const { count } = countProductsInCategoryStmt.get(id);

      // 2. Create transaction function
      const deleteTransaction = db.transaction(() => {
        // a. Delete all products under this category
        deleteProductsByCategoryStmt.run(id);

        // b. Delete the category itself
        const deleteCategoryResult = deleteCategoryStmt.run(id);

        if (deleteCategoryResult.changes === 0) {
          // Throw error to roll back transaction
          throw new Error("Category not found or already deleted.");
        }
      });

      // 3. Execute transaction
      deleteTransaction();

      // 4. Return count of deleted products to frontend
      return { success: true, deletedProductsCount: count };
    } catch (error) {
      console.error("DB Error: delCategory Transaction Failed", error);
      // Ensure only generic error info is returned
      return { success: false, error: "Failed to delete category: " + error.message };
    }
  },

  // --- Product Management CRUD ---

  getProductById: (id) => getProductByIdStmt.get(id),
  /**
   * Add new product
   * @param {object} pData - { category_id, name, price, options }
   */
  addProduct: (pData) => {
    try {
      // Options need to be serialized as a JSON string
      const optionsJson = JSON.stringify(pData.options || []);
      const info = insertProductStmt.run(
        pData.category_id,
        pData.name,
        pData.price,
        optionsJson
      );
      return { success: true, id: info.lastInsertRowid };
    } catch (error) {
      console.error("DB Error: addProduct", error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Update product
   * @param {object} pData - { id, category_id, name, price, options }
   */
  updateProduct: (pData) => {
    try {
      const optionsJson = JSON.stringify(pData.options || []);
      updateProductStmt.run(
        pData.category_id,
        pData.name,
        pData.price,
        optionsJson,
        pData.id
      );
      return { success: true };
    } catch (error) {
      console.error("DB Error: updateProduct", error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Delete product
   * @param {number} id - Product ID
   */
  delProduct: (id) => {
    try {
      deleteProductStmt.run(id);
      return { success: true };
    } catch (error) {
      console.error("DB Error: delProduct", error);
      return { success: false, error: error.message };
    }
  },
  getAllProductsAndCategories: () => {
    try {
      // Fetch simultaneously to ensure data consistency
      const categories = getAllCategoriesStmt.all();
      const products = getAllProductsStmt.all();

      return {
        success: true,
        data: { categories, products },
      };
    } catch (error) {
      console.error("DB Error: getAllProductsAndCategories", error);
      return { success: false, error: error.message };
    }
  },
};