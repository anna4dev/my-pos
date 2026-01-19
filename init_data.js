const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const path = require("path");

const DEFAULT_USERNAME = "1";
const DEFAULT_PASSWORD = "1";
const SALT_ROUNDS = 10;

// 1. Connect to database (Automatically creates file if it doesn't exist)
// Ensure path consistency with main.js / db.js
const dbFolder = path.join(__dirname, "database");

// Ensure the database directory exists
const fs = require("fs");
if (!fs.existsSync(dbFolder)) {
  fs.mkdirSync(dbFolder);
}
const dbPath = path.join(dbFolder, "pos.sqlite");

// Initialize better-sqlite3 instance
const db = new Database(dbPath, { verbose: console.log });

console.log("Initializing database...");

// 2. Ensure table structures exist (Create tables)
const createTables = `
    -- 1. Categories table (Base data)
    CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL
    );

    -- 2. Products table (Base data)
    CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category_id INTEGER,
        name TEXT NOT NULL,
        price INTEGER NOT NULL,
        options TEXT,
        FOREIGN KEY(category_id) REFERENCES categories(id)
    );
    
    -- 3. Users table
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL
    );

    -- 4. Orders table (Summary information)
    CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_no TEXT NOT NULL,             -- Unique order number
        total_amount INTEGER NOT NULL,      -- Total amount (in cents)
        discount_amount INTEGER DEFAULT 0,  -- Discount amount (optional)
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 5. Order items table (Details for each product, locked price for auditing)
    CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,          -- Reference to orders.id
        product_name TEXT NOT NULL,         -- Locked product name
        category_name TEXT NOT NULL,        -- Locked category name
        unit_price INTEGER NOT NULL,        -- Locked transaction price
        quantity INTEGER NOT NULL,          -- Quantity
        options_used TEXT,                  -- Locked specifications (JSON string)
        FOREIGN KEY(order_id) REFERENCES orders(id)
    );
`;
db.exec(createTables);

// 3. Clear old menu data (For re-initialization, keeping transaction history)
db.exec("DELETE FROM products");
db.exec("DELETE FROM categories");
// To clear transactions: db.exec('DELETE FROM orders'); db.exec('DELETE FROM order_items');

// 4. Prepared Statements
const insertCategory = db.prepare("INSERT INTO categories (name) VALUES (?)");
const insertProduct = db.prepare(
  "INSERT INTO products (category_id, name, price, options) VALUES (?, ?, ?, ?)"
);
const insertUser = db.prepare(
  "INSERT INTO users (username, password_hash) VALUES (?, ?)"
);
const getUserCount = db.prepare("SELECT COUNT(*) AS count FROM users");

// --- Menu data definition ---
const menuData = [
  {
    category: "咖啡",
    items: [
      { name: "美式", price: 2200, options: ["热", "冷"] },
      { name: "咖啡拿铁", price: 2800, options: ["热", "冷"] },
      { name: "卡布奇诺", price: 2800, options: ["热", "冷"] },
      { name: "生椰咖啡拿铁", price: 3000, options: ["热", "冷"] },
      { name: "榛果拿铁", price: 3000, options: ["热", "冷"] },
      { name: "香草拿铁", price: 3000, options: ["热", "冷"] },
      { name: "焦糖玛奇朵", price: 3200, options: ["热", "冷"] },
      { name: "咖啡摩卡", price: 3200, options: ["热", "冷"] },
      { name: "阿芙佳朵", price: 3800, options: [] },
      { name: "红吸管咖啡", price: 3600, options: [] },
      { name: "生姜咖啡", price: 2800, options: ["热", "冷"] },
      { name: "生姜咖啡拿铁", price: 3000, options: ["热", "冷"] },
      { name: "手冲咖啡", price: 3600, options: ["热", "冷"] },
      { name: "黄油拿铁", price: 3200, options: ["热", "冷"] },
      { name: "巴旦木拿铁", price: 3000, options: ["热", "冷"] },
      { name: "豆浆拿铁", price: 3000, options: ["热", "冷"] },
    ],
  },
  {
    category: "牛奶 (不含咖啡)",
    items: [
      { name: "可可拿铁", price: 2800, options: ["热", "冷"] },
      { name: "提拉米苏拿铁", price: 2800, options: ["热", "冷"] },
      { name: "抹茶拿铁", price: 2800, options: ["热", "冷"] },
      { name: "椰子坚果拿铁", price: 2800, options: ["热", "冷"] },
      { name: "红茶拿铁", price: 2800, options: ["热", "冷"] },
      { name: "生姜拿铁", price: 2800, options: ["热", "冷"] },
      { name: "黑谷拿铁", price: 2800, options: ["热", "冷"] },
    ],
  },
  {
    category: "茶",
    items: [
      { name: "奶茶", price: 2000, options: ["杯"] },
      { name: "红茶", price: 2000, options: ["杯"] },
      { name: "绿茶", price: 2000, options: ["杯"] },
      { name: "普洱茶", price: 2000, options: ["杯"] },
      { name: "洋甘菊", price: 2000, options: ["杯"] },
      { name: "昆仑菊花3人", price: 6000, options: [""] },
      { name: "青柑普洱3人", price: 6000, options: [] },
      { name: "洋甘菊3人", price: 6000, options: [] },
      { name: "昆仑菊花4人", price: 8000, options: [] },
      { name: "青柑普洱4人", price: 8000, options: [] },
      { name: "洋甘菊4人", price: 8000, options: [] },
    ],
  },
  {
    category: "饮料",
    items: [
      { name: "柠檬", price: 2000, options: ["热", "冷"] },
      { name: "柚子", price: 2000, options: ["热", "冷"] },
      { name: "梅子", price: 2000, options: ["热", "冷"] },
      { name: "薏米", price: 2000, options: ["热", "冷"] },
      { name: "红参", price: 2000, options: ["热", "冷"] },
      { name: "生姜", price: 2000, options: ["热", "冷"] },
    ],
  },
  {
    category: "汽水",
    items: [
      { name: "美式咖啡", price: 2800, options: [] },
      { name: "柠檬", price: 2800, options: [] },
      { name: "蓝柠檬", price: 2800, options: [] },
      { name: "柚子", price: 2800, options: [] },
      { name: "梅子", price: 2800, options: [] },
    ],
  },
  {
    category: "果汁",
    items: [
      { name: "香蕉", price: 2000, options: [] },
      { name: "草莓", price: 3200, options: [] },
      { name: "芒果", price: 3200, options: [] },
      { name: "苹果+胡萝卜 (鲜榨)", price: 3200, options: [] },
      { name: "橙汁 (鲜榨)", price: 3200, options: [] },
    ],
  },
  {
    category: "甜点",
    items: [
      { name: "小松糕", price: 1200, options: ["巧克力", "椰子"] },
      { name: "巧克力曲奇 (包/两个)", price: 1000, options: [] },
      { name: "核桃派", price: 1200, options: [] },
      { name: "芝士蛋糕 (一块)", price: 3000, options: [] },
      { name: "巧克力 (一块)", price: 2500, options: [] },
      { name: "提拉米苏", price: 3200, options: [] },
    ],
  },
  {
    category: "主食",
    items: [
      { name: "三明治", price: 3000, options: [] },
      { name: "披萨", price: 4200, options: [] },
      { name: "肉酱意面", price: 3900, options: [] },
      { name: "三角紫菜包饭 (饭团)泡菜", price: 1200, options: [] },
      { name: "三角紫菜包饭 (饭团)牛肉", price: 1400, options: [] },
      { name: "石锅拌饭 (含牛肉)", price: 3300, options: [] },
      { name: "泡菜培根炒饭", price: 3000, options: [] },
      { name: "炒年糕", price: 3000, options: [] },
      { name: "韩式炒牛肉 (小)", price: 3800, options: [] },
      { name: "韩式炒牛肉 (大)", price: 5200, options: [] },
      { name: "韩式辣炒猪肉 (小)", price: 3000, options: [] },
      { name: "韩式辣炒猪肉 (大)", price: 4000, options: [] },
    ],
  },
];

async function initializeData() {
  const userCount = getUserCount.get().count;

  if (userCount === 0) {
    console.log(`Generating default admin password hash...`);
    // Use await for hashing
    const defaultHash = await bcrypt.hash(DEFAULT_PASSWORD, SALT_ROUNDS);

    // 2. Insert default user
    insertUser.run(DEFAULT_USERNAME, defaultHash);
    console.log(
      `Default user '${DEFAULT_USERNAME}' inserted with password: ${DEFAULT_PASSWORD}`
    );
  } else {
    console.log("User table is not empty, skipping default user insertion.");
  }

  // 3. Insert menu data
  const insertMenuTransaction = db.transaction(() => {
    for (const cat of menuData) {
      const info = insertCategory.run(cat.category);
      const newCatId = info.lastInsertRowid;

      for (const prod of cat.items) {
        insertProduct.run(
          newCatId,
          prod.name,
          prod.price,
          JSON.stringify(prod.options)
        );
      }
    }
  });
  insertMenuTransaction();
}

// Run initialization function
initializeData()
  .then(() => {
    console.log("Database initialization complete!");
    db.close();
  })
  .catch((err) => {
    console.error("Initialization failed:", err);
    db.close();
  });