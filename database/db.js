const { app } = require('electron'); // 1. 引入 app 模块以获取用户数据路径
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// --- 路径配置优化 (确保打包后可写入) ---
const dbDirectory = app.getPath('userData'); 
const dbPath = path.join(dbDirectory, 'pos.sqlite');

// 确保数据库目录存在
if (!fs.existsSync(dbDirectory)) {
    fs.mkdirSync(dbDirectory, { recursive: true });
}

// 连接数据库实例
const db = new Database(dbPath); 

// --- 数据库初始化 (使用新的表结构) ---
db.exec(`
    -- 1. 类别表
    CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL
    );

    -- 2. 菜品表
    CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category_id INTEGER,
        name TEXT NOT NULL,
        price INTEGER NOT NULL,
        options TEXT,
        FOREIGN KEY(category_id) REFERENCES categories(id)
    );

    -- 3. 订单主表 (更新后的结构)
    CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_no TEXT NOT NULL,
        total_amount INTEGER NOT NULL,
        discount_amount INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 4. 订单详情表 (新增的结构)
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

    -- 用户表
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL
    );
`);


// --- 预编译语句 (Prepared Statements) ---
const getCategories = db.prepare('SELECT * FROM categories');
const getProductsByCat = db.prepare('SELECT * FROM products WHERE category_id = ?');
const getUserByUsernameStmt = db.prepare('SELECT id, username, password_hash FROM users WHERE username = ?');

// 分类
const getAllProductsStmt = db.prepare('SELECT id, category_id, name, price, options FROM products ORDER BY category_id, id');
const getAllCategoriesStmt = db.prepare('SELECT id, name FROM categories ORDER BY id');
const insertCategoryStmt = db.prepare('INSERT INTO categories (name) VALUES (?)');
const updateCategoryStmt = db.prepare('UPDATE categories SET name = ? WHERE id = ?');
const deleteCategoryStmt = db.prepare('DELETE FROM categories WHERE id = ?');

const deleteProductsByCategoryStmt = db.prepare('DELETE FROM products WHERE category_id = ?');
// 统计分类下的商品数量
const countProductsInCategoryStmt = db.prepare('SELECT COUNT(id) AS count FROM products WHERE category_id = ?');

// 商品
const getProductByIdStmt = db.prepare('SELECT id, category_id, name, price, options FROM products WHERE id = ?');
const insertProductStmt = db.prepare('INSERT INTO products (category_id, name, price, options) VALUES (?, ?, ?, ?)');
const updateProductStmt = db.prepare('UPDATE products SET category_id = ?, name = ?, price = ?, options = ? WHERE id = ?');
const deleteProductStmt = db.prepare('DELETE FROM products WHERE id = ?');


// 订单主表插入语句
const insertOrder = db.prepare(`
    INSERT INTO orders (order_no, total_amount, created_at) 
    VALUES (?, ?, ?)
`);

// 订单详情表插入语句
const insertOrderItem = db.prepare(`
    INSERT INTO order_items (order_id, product_name, category_name, unit_price, quantity, options_used) 
    VALUES (@orderId, @productName, @categoryName, @unitPrice, @quantity, @optionsUsed)
`);

// --- 报表查询语句 (Prepared Statements) ---
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

// --- 历史订单语句 (Prepared Statements) ---
// 1. 获取总订单数
const getTotalOrdersCount = db.prepare('SELECT COUNT(*) AS count FROM orders');

// 2. 获取分页订单列表
const getOrdersPaged = db.prepare(`
    SELECT id, order_no, total_amount, created_at
    FROM orders
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
`);

// 3. 获取订单主信息
const getOrderMain = db.prepare('SELECT * FROM orders WHERE id = ?');

// 4. 获取订单项明细
const getOrderItems = db.prepare(
    "SELECT product_name, options_used, quantity, unit_price FROM order_items WHERE order_id = ?"
);


/**
 * 生成一个简单的订单号 (YYYYMMDDHHMMSS + 随机数)
 */
function generateOrderNo() {
    const now = new Date();
    // 简化订单号生成，确保 order_no 不为空
    return now.getFullYear().toString() + 
           (now.getMonth() + 1).toString().padStart(2, '0') + 
           now.getDate().toString().padStart(2, '0') + 
           now.getHours().toString().padStart(2, '0') + 
           now.getMinutes().toString().padStart(2, '0') + 
           now.getSeconds().toString().padStart(2, '0') +
           Math.floor(Math.random() * 900 + 100).toString(); // 3位随机数
}

// --- 核心模块：事务处理 ---

/**
 * 结账并记录订单流水。
 * @param {object[]} items - 购物车商品数组: [{ name, price, count, categoryName, optionsUsed, ... }]
 * @param {number} totalAmount - 订单总金额 (分)
 */
const createOrder = db.transaction((items, totalAmount) => {
    // 1. 插入订单主记录
    const orderNo = generateOrderNo();
    const createdAt = new Date().toISOString();
    const orderInfo = insertOrder.run(orderNo, totalAmount, createdAt);
    const orderId = orderInfo.lastInsertRowid;

    // 2. 循环插入订单详情记录
    for (const item of items) {
        insertOrderItem.run({
            orderId: orderId,
            productName: item.name,
            categoryName: item.categoryName || '未分类', // 确保有值
            unitPrice: item.price,
            quantity: item.count,
            optionsUsed: JSON.stringify(item.options || [])
        });
    }

    return { success: true, orderId: orderId, orderNo: orderNo, createdAt };
});

/**
 * 获取指定日期范围内的订单流水。
 * @param {string} startDate - 开始日期 (ISO 8601 格式，如 '2025-12-01T00:00:00.000Z')
 * @param {string} endDate - 结束日期 (ISO 8601 格式，如 '2025-12-31T23:59:59.999Z')
 * @returns {object[]} - 扁平化的流水记录数组。
 */
function getReports(startDate, endDate) {
    // 确保日期参数格式正确，用于 SQL 的 BETWEEN 语句
    return getReportsStatement.all({
        startDate: startDate,
        endDate: endDate
    });
}


// --- 模块导出 ---
module.exports = {
    getAllCategories: () => getCategories.all(),
    getProducts: (catId) => getProductsByCat.all(catId),
    getUserByUsername: (username) => getUserByUsernameStmt.get(username),
    createOrder: createOrder,
    getReports: getReports,
    // 1. 获取分页订单列表和总数
    getPaginatedOrders: (limit, offset) => {
        // 使用预编译语句获取总记录数
        const totalResult = getTotalOrdersCount.get();
        const totalCount = totalResult.count;

        // 使用预编译语句获取当前页的订单数据
        const data = getOrdersPaged.all(limit, offset);

        return { data: data, totalCount: totalCount };
    },

    // 2. 获取单个订单的完整明细
    getOrderDetails: (orderId) => {
        // 1. 使用预编译语句获取订单主信息
        const order = getOrderMain.get(orderId);

        if (!order) {
            return null;
        }

        // 2. 使用预编译语句获取订单项明细
        const items = getOrderItems.all(orderId);

        // 3. 转换 JSON 字符串到数组对象
        order.items = items.map((item) => ({
            ...item,
            options: JSON.parse(item.options_used || "[]"),
        }));

        return order;
    },
    /**
     * 新增分类
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
     * 更新分类
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
     * 删除分类
     * @param {number} id - 分类ID
     */
    delCategory: (id) => {
        try {
            // 1. 统计将要删除的商品数量，用于返回给前端进行提醒
            const { count } = countProductsInCategoryStmt.get(id);

            // 2. 创建事务函数
            const deleteTransaction = db.transaction(() => {
                // a. 删除该分类下的所有商品
                deleteProductsByCategoryStmt.run(id);

                // b. 删除分类本身
                const deleteCategoryResult = deleteCategoryStmt.run(id);
                
                if (deleteCategoryResult.changes === 0) {
                     // 抛出错误，回滚事务
                    throw new Error("Category not found or already deleted.");
                }
            });

            // 3. 执行事务
            deleteTransaction();
            
            // 4. 返回删除的商品数量给前端
            return { success: true, deletedProductsCount: count };

        } catch (error) {
            console.error("DB Error: delCategory Transaction Failed", error);
            // 确保只返回通用的错误信息
            return { success: false, error: "删除分类失败: " + error.message };
        }
    },

    // --- 商品管理 CRUD ---

    getProductById: (id) => getProductByIdStmt.get(id),
    /**
     * 新增商品
     * @param {object} pData - { category_id, name, price, options }
     */
    addProduct: (pData) => {
        try {
            // 选项需要序列化为 JSON 字符串
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
     * 更新商品
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
     * 删除商品
     * @param {number} id - 商品ID
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
            // 在同一时刻获取，确保数据一致
            const categories = getAllCategoriesStmt.all();
            const products = getAllProductsStmt.all(); 

            return { 
                success: true, 
                data: { categories, products } 
            };
        } catch (error) {
            console.error("DB Error: getAllProductsAndCategories", error);
            return { success: false, error: error.message };
        }
    },
};