const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const path = require("path");

const DEFAULT_USERNAME = "admin";
const DEFAULT_PASSWORD = "123456";
const SALT_ROUNDS = 10;

// 1. 连接数据库 (如果没有文件会自动创建)
// 这里的路径要和你在 main.js / db.js 里定义的一致
const dbFolder = path.join(__dirname, "database");
// 确保 database 目录存在 (better-sqlite3 会自动创建文件，但目录需要)
const fs = require("fs");
if (!fs.existsSync(dbFolder)) {
  fs.mkdirSync(dbFolder);
}
const dbPath = path.join(dbFolder, "pos.sqlite");

// 初始化 better-sqlite3 实例
const db = new Database(dbPath, { verbose: console.log });

console.log("⏳ 正在初始化数据库...");

// 2. 确保表结构存在 (建表)
const createTables = `
    -- 1. 类别表 (基础数据)
    CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL
    );

    -- 2. 菜品表 (基础数据)
    CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category_id INTEGER,
        name TEXT NOT NULL,
        price INTEGER NOT NULL,
        options TEXT,
        FOREIGN KEY(category_id) REFERENCES categories(id)
    );
    
    -- ✅ 3. 用户表 (新增)
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL
    );

    -- 4. 订单主表 (记录订单汇总信息)
    CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_no TEXT NOT NULL,             -- 唯一订单号
        total_amount INTEGER NOT NULL,      -- 订单总金额 (分)
        discount_amount INTEGER DEFAULT 0,  -- 优惠金额 (分, 可选)
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 5. 订单详情表 (记录每一条商品，锁定当时价格，方便对账)
    CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,          -- 关联到 orders.id
        product_name TEXT NOT NULL,         -- 锁定的商品名称
        category_name TEXT NOT NULL,        -- 锁定的类别名称 (方便报表分组)
        unit_price INTEGER NOT NULL,        -- 锁定的成交单价 (分)
        quantity INTEGER NOT NULL,          -- 数量
        options_used TEXT,                  -- 锁定的规格选项 (JSON 字符串)
        FOREIGN KEY(order_id) REFERENCES orders(id)
    );
`;
db.exec(createTables);

// 3. 清空旧的菜单数据 (方便重新初始化，保留流水)
db.exec("DELETE FROM products");
db.exec("DELETE FROM categories");
// 如果需要清空流水：db.exec('DELETE FROM orders'); db.exec('DELETE FROM order_items');

// 4. 预编译语句 (Prepared Statements)
const insertCategory = db.prepare("INSERT INTO categories (name) VALUES (?)");
const insertProduct = db.prepare(
  "INSERT INTO products (category_id, name, price, options) VALUES (?, ?, ?, ?)"
);
const insertUser = db.prepare(
  "INSERT INTO users (username, password_hash) VALUES (?, ?)"
);
const getUserCount = db.prepare("SELECT COUNT(*) AS count FROM users");

// --- 定义你的菜单 (数据结构不变) ---
const menuData = [
  {
    "category": "咖啡",
    "items": [
      { "name": "美式", "price": 2200, "options": ["热", "冷"] },
      { "name": "咖啡拿铁", "price": 2800, "options": ["热", "冷"] },
      { "name": "卡布奇诺", "price": 2800, "options": ["热", "冷"] },
      { "name": "生椰咖啡拿铁", "price": 3000, "options": ["热", "冷"] },
      { "name": "榛果拿铁", "price": 3000, "options": ["热", "冷"] },
      { "name": "香草拿铁", "price": 3000, "options": ["热", "冷"] },
      { "name": "焦糖玛奇朵", "price": 3200, "options": ["热", "冷"] },
      { "name": "咖啡摩卡", "price": 3200, "options": ["热", "冷"] },
      { "name": "阿芙佳朵", "price": 3800, "options": [] },
      { "name": "红吸管咖啡", "price": 3600, "options": [] },
      { "name": "生姜咖啡", "price": 2800, "options": ["热", "冷"] },
      { "name": "生姜咖啡拿铁", "price": 3000, "options": ["热", "冷"] },
      { "name": "手冲咖啡", "price": 3600, "options": ["热", "冷"] },
      { "name": "黄油拿铁", "price": 3200, "options": ["热", "冷"] },
      { "name": "巴旦木拿铁", "price": 3000, "options": ["热", "冷"] },
      { "name": "豆浆拿铁", "price": 3000, "options": ["热", "冷"] },
    ]
  },
  {
    "category": "牛奶 (不含咖啡)",
    "items": [
      { "name": "可可拿铁", "price": 2800, "options": ["热", "冷"] },
      { "name": "提拉米苏拿铁", "price": 2800, "options": ["热", "冷"] },
      { "name": "抹茶拿铁", "price": 2800, "options": ["热", "冷"] },
      { "name": "椰子坚果拿铁", "price": 2800, "options": ["热", "冷"] },
      { "name": "红茶拿铁", "price": 2800, "options": ["热", "冷"] },
      { "name": "生姜拿铁", "price": 2800, "options": ["热", "冷"] },
      { "name": "黑谷拿铁", "price": 2800, "options": ["热", "冷"] }
    ]
  },
  {
    "category": "茶",
    "items": [
      { "name": "奶茶", "price": 2000, "options": ["杯"] },
      { "name": "红茶", "price": 2000, "options": ["杯"] },
      { "name": "绿茶", "price": 2000, "options": ["杯"] },
      { "name": "普洱茶", "price": 2000, "options": ["杯"] },
      { "name": "洋甘菊", "price": 2000, "options": ["杯"] },
      { "name": "昆仑菊花", "price": 6000, "options": ["壶"] },
      { "name": "青柑普洱", "price": 6000, "options": ["壶"] },
      { "name": "洋甘菊", "price": 6000, "options": ["壶"] },
    ]
  },
  {
    "category": "饮料",
    "items": [
      { "name": "柠檬", "price": 2000, "options": ["热", "冷"] },
      { "name": "柚子", "price": 2000, "options": ["热", "冷"] },
      { "name": "生姜", "price": 2000, "options": ["热", "冷"] },
      { "name": "红茶", "price": 2000, "options": ["热", "冷"] },
      { "name": "橘子", "price": 2000, "options": ["热", "冷"] }
    ]
  },
  {
    "category": "汽水",
    "items": [
      { "name": "美式咖啡", "price": 2800, "options": [] },
      { "name": "柠檬/蓝莓", "price": 2800, "options": [] },
      { "name": "柚子/梅子", "price": 2800, "options": [] }
    ]
  },
  {
    "category": "果汁",
    "items": [
      { "name": "香蕉", "price": 2000, "options": [] },
      { "name": "草莓", "price": 3200, "options": [] },
      { "name": "芒果", "price": 3200, "options": [] },
      { "name": "苹果+胡萝卜 (鲜榨)", "price": 3200, "options": [] },
      { "name": "橙汁 (鲜榨)", "price": 3200, "options": [] }
    ]
  },
  {
    "category": "甜点",
    "items": [
      { "name": "小松糕", "price": 1200, "options": [] },
      { "name": "巧克力/椰子", "price": 1000, "options": [] },
      { "name": "巧克力曲奇 (包/两个)", "price": 1000, "options": [] },
      { "name": "核桃派", "price": 1200, "options": [] },
      { "name": "芝士蛋糕 (一块)", "price": 3000, "options": [] },
      { "name": "巧克力 (一块)", "price": 2500, "options": [] },
      { "name": "提拉米苏", "price": 3200, "options": [] }
    ]
  },
  {
    "category": "主食",
    "items": [
      { "name": "上引三明治", "price": 3000, "options": [] },
      { "name": "上引披萨", "price": 4200, "options": [] },
      { "name": "肉酱意面", "price": 3900, "options": [] },
      { "name": "三角紫菜包饭 (饭团)", "price": 1200, "options": ["泡菜", "牛肉"] },
      { "name": "石锅拌饭 (含牛肉)", "price": 3300, "options": [] },
      { "name": "泡菜培根炒饭", "price": 3000, "options": [] },
      { "name": "炒年糕", "price": 3000, "options": [] },
      { "name": "韩式炒牛肉 (小)", "price": 3800, "options": [] },
      { "name": "韩式炒牛肉 (大)", "price": 5200, "options": [] },
      { "name": "韩式辣炒猪肉 (小)", "price": 3000, "options": [] },
      { "name": "韩式辣炒猪肉 (大)", "price": 4000, "options": [] }
    ]
  }
];

async function initializeData() {
  const userCount = getUserCount.get().count;

  if (userCount === 0) {
    console.log(`🔑 正在生成默认管理员密码哈希...`);
    // 使用 await 等待哈希完成
    const defaultHash = await bcrypt.hash(DEFAULT_PASSWORD, SALT_ROUNDS);

    // 2. 插入默认用户
    insertUser.run(DEFAULT_USERNAME, defaultHash);
    console.log(
      `🔑 默认用户 '${DEFAULT_USERNAME}' 已插入，密码: ${DEFAULT_PASSWORD}`
    );
  } else {
    console.log("🔑 用户表非空，跳过默认用户插入。");
  }

  // 3. 插入菜单数据
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

// 运行初始化函数
initializeData()
  .then(() => {
    console.log("✅ 数据库初始化完成！");
    db.close();
  })
  .catch((err) => {
    console.error("❌ 初始化失败:", err);
    db.close();
  });
