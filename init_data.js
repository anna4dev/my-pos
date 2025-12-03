const Database = require('better-sqlite3');
const path = require('path');

// 1. 连接数据库 (如果没有文件会自动创建)
// 这里的路径要和你在 main.js / db.js 里定义的一致
const dbFolder = path.join(__dirname, 'database');
// 确保 database 目录存在 (better-sqlite3 会自动创建文件，但目录需要)
const fs = require('fs');
if (!fs.existsSync(dbFolder)) {
    fs.mkdirSync(dbFolder);
}
const dbPath = path.join(dbFolder, 'pos.sqlite');

// 初始化 better-sqlite3 实例
const db = new Database(dbPath, { verbose: console.log });

console.log('⏳ 正在初始化数据库...');

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

    -- 3. 订单主表 (记录订单汇总信息)
    CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_no TEXT NOT NULL,             -- 唯一订单号
        total_amount INTEGER NOT NULL,      -- 订单总金额 (分)
        discount_amount INTEGER DEFAULT 0,  -- 优惠金额 (分, 可选)
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 4. 订单详情表 (记录每一条商品，锁定当时价格，方便对账)
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
db.exec('DELETE FROM products');
db.exec('DELETE FROM categories');
// 如果需要清空流水：db.exec('DELETE FROM orders'); db.exec('DELETE FROM order_items');

// 4. 预编译语句 (Prepared Statements)
const insertCategory = db.prepare('INSERT INTO categories (name) VALUES (?)');
const insertProduct = db.prepare('INSERT INTO products (category_id, name, price, options) VALUES (?, ?, ?, ?)');

// --- 定义你的菜单 (数据结构不变) ---
const menuData = [
    {
        category: "咖啡",
        items: [
            { name: "美式咖啡 (Americano)", price: 2200, options: ["热", "冷"] },
            { name: "拿铁 (Latte)", price: 2800, options: ["热", "冷"] },
            { name: "香草拿铁", price: 3200, options: ["热", "冷"] },
            { name: "生姜咖啡", price: 3200, options: ["热", "冷"] },
            { name: "焦糖玛奇朵", price: 3200, options: ["热", "冷"] },
            { name: "汽水", price: 3200, options: [] }
        ]
    },
    {
        category: "牛奶",
        items: [
            { name: "可可拿铁", price: 3500, options: ["热", "冷"] },
            { name: "生姜拿铁", price: 3500, options: ["热", "冷"] },
            { name: "抹茶拿铁", price: 3800, options: ["热", "冷"] }
        ]
    },
    {
        category: "果汁",
        items: [
            { name: "香蕉", price: 3500, options: [] },
            { name: "草莓", price: 3500, options: [] },
            { name: "橙汁", price: 3500, options: [] },
            { name: "芒果", price: 3800, options: [] }
        ]
    },
    {
        category: "甜点",
        items: [
            { name: "纽约芝士蛋糕", price: 3500, options: [] },
            { name: "提拉米苏", price: 3800, options: [] }
        ]
    },
    {
        category: "主食",
        items: [
            { name: "经典肉酱面", price: 4500, options: ["大份", "正常"] },
            { name: "披萨", price: 4500, options: [] },
            { name: "紫菜包饭", price: 4500, options: ["泡菜", "牛肉"] },
            { name: "总汇三明治", price: 3200, options: [] }
        ]
    }
];

// --- 开始写入事务 ---
const startTransaction = db.transaction(() => {
    for (const cat of menuData) {
        // 1. 插入类别，获取生成的 ID
        const info = insertCategory.run(cat.category);
        const newCatId = info.lastInsertRowid;

        // 2. 插入该类别下的商品
        for (const prod of cat.items) {
            insertProduct.run(
                newCatId,
                prod.name,
                prod.price, // 比如 2200
                JSON.stringify(prod.options) // 转成字符串存: '["热","冷"]'
            );
        }
    }
});

startTransaction();

console.log('✅ 数据库初始化完成！菜单已写入 pos.sqlite，并创建了新的订单流水结构。');
console.log('⚠️ 请务必更新 db.js 中的 createOrder/checkout 逻辑，以适应新的 orders 和 order_items 表。');