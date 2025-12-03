// 全局应用状态
const state = {
    categories: [],
    products: [],
    cart: [], // 结构: { id, name, price, options: [], count, categoryName, categoryId }
    currentCategoryId: null
};

// --- DOM 元素缓存 ---
const elements = {
    categoryList: document.getElementById('category-list'),
    productGrid: document.getElementById('product-grid'),
    cartList: document.getElementById('cart-list'),
    grandTotal: document.getElementById('grand-total'),
    checkoutBtn: document.getElementById('checkout-btn'),
    reportModal: document.getElementById('report-modal'),
    exportCsvBtn: document.getElementById('export-csv-btn'),
    showReportBtn: document.getElementById('show-report-btn'),
    closeModalBtn: document.getElementById('close-modal-btn'),
    startDateInput: document.getElementById('start-date'),
    endDateInput: document.getElementById('end-date'),
    // subTotal: document.getElementById('sub-total'),
};

// --- 渲染函数 ---

function renderCategories() {
    elements.categoryList.innerHTML = '';
    state.categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'category-btn';
        btn.textContent = cat.name;
        btn.dataset.id = cat.id;
        if (cat.id === state.currentCategoryId) {
            btn.classList.add('active');
        }
        elements.categoryList.appendChild(btn);
    });
}


function renderProducts() {
        console.log('test 123', state.products)

    elements.productGrid.innerHTML = '';

    state.products.forEach(prod => {
        const ops = JSON.parse(prod.options);
        const hasOptions = ops && ops.length > 0;
        const card = document.createElement('div');
        // 添加一个 class 标记是否有选项，方便 CSS 和 JS 判断
        card.className = hasOptions ? 'product-card has-options' : 'product-card'; 
        
        card.dataset.id = prod.id;
        card.dataset.name = prod.name;
        card.dataset.price = prod.price; 
        
        // 主信息 (商品名和价格)
        const nameDiv = document.createElement('div');
        nameDiv.className = 'product-name';
        nameDiv.textContent = prod.name; 
        
        const priceDiv = document.createElement('div');
        priceDiv.className = 'product-price';
        priceDiv.textContent = `¥ ${(prod.price / 100).toFixed(2)}`; 
        
        card.appendChild(nameDiv);
        card.appendChild(priceDiv);

        // --- 核心修改：渲染冷/热选项按钮 ---
        if (hasOptions) {
            const optionDiv = document.createElement('div');
            optionDiv.className = 'product-option-buttons';
            
            ops.forEach(choice => {
                const btn = document.createElement('button');
                btn.className = 'option-choice-btn';
                btn.textContent = choice;
                btn.dataset.action = 'add-item-with-option';
                btn.dataset.option = choice; // 存储选项值
                
                // ⚠️ 关键：直接将点击事件绑定到按钮上
                btn.addEventListener('click', handleOptionButton); 

                optionDiv.appendChild(btn);
            });
            
            card.appendChild(optionDiv); 
        }
        // --- 选项按钮渲染结束 ---

        elements.productGrid.appendChild(card);
    });
}

function renderCart() {
    let total = 0;
    elements.cartList.innerHTML = '';

    state.cart.forEach((item, index) => {
        const itemTotal = item.price * item.count;
        total += itemTotal;
        
        const li = document.createElement('li');
        li.className = 'cart-item'; // ⚠️ CSS 需要调整，让 li 内部元素垂直堆叠
        li.dataset.index = index;
        
        const optionsText = item.options && item.options.length > 0 
            ? item.options.join(', ') 
            : '';

        // --- 1. 创建主内容行容器 (商品名 + 价格) ---
        const mainRowDiv = document.createElement('div');
        mainRowDiv.className = 'item-main-row';

        // 1a. 创建 item-info 容器
        const infoDiv = document.createElement('div');
        infoDiv.className = 'item-info';
        
        // 插入商品名称和数量
        infoDiv.textContent = `${item.name} (x${item.count})`; 

        // 插入商品规格
        if (optionsText) {
            const optionsSpan = document.createElement('span');
            optionsSpan.className = 'item-options';
            optionsSpan.textContent = `(${optionsText})`;
            infoDiv.appendChild(optionsSpan);
        }
        
        // 1b. 插入价格
        const priceDiv = document.createElement('div');
        priceDiv.className = 'item-price';
        priceDiv.textContent = `¥ ${(itemTotal / 100).toFixed(2)}`;
        
        // 将 info 和 price 放入主行
        mainRowDiv.appendChild(infoDiv);
        mainRowDiv.appendChild(priceDiv);
        
        li.appendChild(mainRowDiv);

        // --- 2. 创建控制按钮行容器 (新的一行) ---
        const controlsRowDiv = document.createElement('div');
        controlsRowDiv.className = 'item-controls-row';

        // 2a. 插入控制按钮
        const controlsDiv = document.createElement('div');
        controlsDiv.className = 'item-controls';
        
        const decBtn = document.createElement('button');
        decBtn.dataset.action = 'decrease';
        decBtn.textContent = '减';
        
        const incBtn = document.createElement('button');
        incBtn.dataset.action = 'increase';
        incBtn.textContent = '加';
        
        const remBtn = document.createElement('button');
        remBtn.dataset.action = 'remove';
        remBtn.textContent = '删除';
        
        controlsDiv.appendChild(decBtn);
        controlsDiv.appendChild(incBtn);
        controlsDiv.appendChild(remBtn);
        
        controlsRowDiv.appendChild(controlsDiv);

        li.appendChild(controlsRowDiv);
        // --- 结构调整结束 ---

        elements.cartList.appendChild(li);
    });

    // ... (其余代码不变)
    const displayTotal = (total / 100).toFixed(2);
    // elements.subTotal.textContent = `¥ ${displayTotal}`;
    elements.grandTotal.textContent = `¥ ${displayTotal}`;
    elements.checkoutBtn.disabled = state.cart.length === 0;

    window.api.updateCart({ items: state.cart, total: total });
}

// --- 事件处理函数 ---

async function handleCategoryClick(event) {
    const btn = event.target.closest('.category-btn');
    if (!btn) return;

    const newId = parseInt(btn.dataset.id);
    if (state.currentCategoryId === newId) return;

    // 移除旧的 active 状态
    document.querySelector('.category-btn.active')?.classList.remove('active');
    btn.classList.add('active');

    state.currentCategoryId = newId;
    
    // 从主进程获取该分类下的商品
    const products = await window.api.getProducts(newId);
    state.products = products;
    renderProducts();
}

function handleOptionButton(event) {
    // ⚠️ 阻止事件继续传播，防止触发父级 card 的 handleProductClick
    event.stopPropagation(); 
    
    const btn = event.currentTarget; // 被点击的按钮
    const option = btn.dataset.option; // 获取选项值 ('热' 或 '冷')
    const card = btn.closest('.product-card'); // 查找父卡片以获取商品数据

    if (!card) return; 

    // --- Add to Cart Logic (复制并使用选项) ---
    
    const categoryName = state.categories.find(c => c.id === state.currentCategoryId)?.name || '未分类';

    // 构造商品对象
    const product = {
        id: parseInt(card.dataset.id),
        name: card.dataset.name,
        price: parseInt(card.dataset.price),
        options: [option], // 仅使用选中的选项
        count: 1,
        categoryName: categoryName,
        categoryId: state.currentCategoryId
    };

    // 检查购物车是否有相同商品+相同规格的项 (精确匹配)
    const optionsKey = JSON.stringify(product.options);
    const existingIndex = state.cart.findIndex(item => 
        item.id === product.id && JSON.stringify(item.options) === optionsKey
    );

    if (existingIndex !== -1) {
        state.cart[existingIndex].count++;
    } else {
        state.cart.push(product);
    }
    
    renderCart();
}

function handleProductClick(event) {
    const card = event.target.closest('.product-card');
    if (!card) return;
    
    // 理论上由于 stopPropagation，这个检查更多是安全保障
    if (card.classList.contains('has-options')) {
        return; 
    }
    
    const categoryName = state.categories.find(c => c.id === state.currentCategoryId)?.name || '未分类';
    
    // 构造商品对象 (无选项)
    const product = {
        id: parseInt(card.dataset.id),
        name: card.dataset.name,
        price: parseInt(card.dataset.price),
        options: [], // 选项为空
        count: 1,
        categoryName: categoryName,
        categoryId: state.currentCategoryId
    };

    // 检查购物车是否有相同商品+相同规格的项
    const optionsKey = JSON.stringify(product.options);
    const existingIndex = state.cart.findIndex(item => 
        item.id === product.id && JSON.stringify(item.options) === optionsKey
    );

    if (existingIndex !== -1) {
        state.cart[existingIndex].count++;
    } else {
        state.cart.push(product);
    }
    
    renderCart();
}

function handleCartControls(event) {
    const btn = event.target.closest('button');
    if (!btn) return;
    
    const action = btn.dataset.action;
    const listItem = btn.closest('.cart-item');
    const index = parseInt(listItem.dataset.index);
    const item = state.cart[index];

    if (action === 'increase') {
        item.count++;
    } else if (action === 'decrease') {
        if (item.count > 1) {
            item.count--;
        } else {
            // 数量减到 0 时移除
            state.cart.splice(index, 1);
        }
    } else if (action === 'remove') {
        state.cart.splice(index, 1);
    }

    // 重新渲染购物车
    renderCart();
}

async function handleCheckout() {
    if (state.cart.length === 0) return;

    const total = state.cart.reduce((sum, item) => sum + (item.price * item.count), 0);
    
    elements.checkoutBtn.disabled = true;
    elements.checkoutBtn.textContent = '处理中...';

    // 调用主进程结账
    const result = await window.api.checkout({ 
        items: state.cart, 
        total: total 
    });

    if (result.success) {
        alert(`结账成功！订单号: ${result.orderNo}. 总金额: ¥ ${(total / 100).toFixed(2)}`);

        // 🚀 调用打印小票
        const printResult = await window.api.printReceipt({
            items: state.cart, 
            total: total,
            orderNo: result.orderNo,
            createdAt: result.createdAt
        });
        if (printResult.success) {
            console.log('小票打印指令已发送。');
        } else {
            console.error('小票打印失败。');
        }

        state.cart = []; // 清空本地购物车
        renderCart();
    } else {
        alert(`结账失败: ${result.error || '数据库错误'}`);
    }

    elements.checkoutBtn.disabled = false;
    elements.checkoutBtn.textContent = '立即结账';
}

// --- 报表导出逻辑 ---

function formatDataForCsv(data) {
    if (!data || data.length === 0) return '';
    
    // 确保数据中的数字以正确的格式显示
    const headers = ["订单号", "下单时间", "订单总金额", "商品名称", "类别", "单价", "数量", "规格"];
    const csvContent = [headers.join(',')];

    data.forEach(row => {
        const rowData = [
            row.order_no,
            new Date(row.created_at).toLocaleString('zh-CN'),
            (row.total_amount / 100).toFixed(2), // 转换成分
            row.product_name,
            row.category_name,
            (row.unit_price / 100).toFixed(2),
            row.quantity,
            row.options_used ? JSON.parse(row.options_used).join(';') : ''
        ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(','); // CSV安全处理
        
        csvContent.push(rowData);
    });
    
    return csvContent.join('\n');
}

function downloadCsv(csv, filename) {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    if (link.download !== undefined) { 
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } else {
        alert('您的浏览器不支持直接下载，请尝试其他浏览器或复制内容。');
    }
}

async function handleExportCsv() {
    const startDate = elements.startDateInput.value;
    const endDate = elements.endDateInput.value;

    if (!startDate || !endDate) {
        alert('请选择完整的日期范围！');
        return;
    }
    
    // 构造 ISO 时间字符串，确保包含全天的范围
    const startISO = new Date(startDate + 'T00:00:00.000Z').toISOString();
    const endISO = new Date(endDate + 'T23:59:59.999Z').toISOString();

    elements.exportCsvBtn.textContent = '查询中...';
    elements.exportCsvBtn.disabled = true;

    const result = await window.api.getReports(startISO, endISO);

    elements.exportCsvBtn.textContent = '导出 CSV';
    elements.exportCsvBtn.disabled = false;

    if (result.success && result.data && result.data.length > 0) {
        const csv = formatDataForCsv(result.data);
        const filename = `pos_report_${startDate}_to_${endDate}.csv`;
        
        // 替换 downloadCsv：调用主进程保存文件
        const saveResult = await window.api.saveCsvFile(csv, filename); // <-- NEW IPC CALL

        if (saveResult.success) {
            alert(`流水导出成功！文件已保存到：\n${saveResult.path}`);
            elements.reportModal.style.display = 'none';
        } else {
            // 用户取消保存，或写入失败
             alert(`文件保存失败或已取消: ${saveResult.error || '用户取消'}`);
        }
        
    } else if (result.success && result.data.length === 0) {
        alert('该日期范围内没有交易流水。');
    } else {
        alert(`导出失败: ${result.error || '未知错误'}`);
    }
}

// --- 初始化与监听 ---

async function init() {
    // 绑定事件监听器 (使用事件委托)
    elements.categoryList.addEventListener('click', handleCategoryClick);
    elements.productGrid.addEventListener('click', handleProductClick);
    elements.cartList.addEventListener('click', handleCartControls);
    elements.checkoutBtn.addEventListener('click', handleCheckout);
    
    // 报表 Modal 监听
    elements.showReportBtn.addEventListener('click', () => { elements.reportModal.style.display = 'flex'; });
    elements.closeModalBtn.addEventListener('click', () => { elements.reportModal.style.display = 'none'; });
    elements.exportCsvBtn.addEventListener('click', handleExportCsv);
    
    // 首次加载数据
    try {
        const data = await window.api.getInitialData();
        console.log('test', data)
        state.categories = data.categories;
        state.products = data.products;
        
        // 默认激活第一个分类
        if (data.categories.length > 0) {
            state.currentCategoryId = data.categories[0].id;
        }


        renderCategories();
        renderProducts();

    } catch (error) {
        console.error("初始化数据失败:", error);
        alert("应用初始化失败，请检查数据库连接或 init_data.js 是否运行。");
    }
}

document.addEventListener('DOMContentLoaded', init);