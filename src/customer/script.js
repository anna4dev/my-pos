// DOM 元素缓存
const elements = {
    cartList: document.getElementById('customer-cart-list'),
    totalDisplay: document.getElementById('customer-total'),
    emptyMessage: document.getElementById('empty-message')
};

/**
 * 接收主进程同步的数据并渲染屏幕
 * @param {object} cartData - 包含 { items, total } 的对象
 */
function renderScreen(cartData) {
    const items = cartData.items || [];
    const total = cartData.total || 0;
    
    // 清空旧列表，保留表头
    const list = elements.cartList;
    while (list.children.length > 1) {
        list.removeChild(list.lastChild);
    }
    
    if (items.length === 0) {
        // ... (创建空消息的逻辑不变)
        elements.emptyMessage = document.createElement('li');
        elements.emptyMessage.id = 'empty-message';
        elements.emptyMessage.textContent = '请开始点单';
        list.appendChild(elements.emptyMessage);
    } else {
        items.forEach(item => {
            const itemTotal = item.price * item.count;
            
            const li = document.createElement('li');
            li.className = 'customer-item';
            
            // --- 替换 li.innerHTML 的安全构造 ---
            
            // 1. 商品名称和选项容器
            const nameSpan = document.createElement('span');
            nameSpan.className = 'item-name';
            // 插入商品名
            nameSpan.textContent = item.name + ' '; 
            
            // 2. 选项/规格 (Options)
            if (item.options && item.options.length > 0) {
                const optionsSpan = document.createElement('span');
                optionsSpan.className = 'item-options';
                // ✅ 安全：使用 textContent 插入选项文本
                optionsSpan.textContent = `(${item.options.join(', ')})`;
                nameSpan.appendChild(optionsSpan);
            }
            li.appendChild(nameSpan);
            
            // 3. 数量
            const countSpan = document.createElement('span');
            countSpan.className = 'center';
            countSpan.textContent = `x${item.count}`;
            li.appendChild(countSpan);
            
            // 4. 单价
            const priceSpan = document.createElement('span');
            priceSpan.className = 'center';
            priceSpan.textContent = (item.price / 100).toFixed(2);
            li.appendChild(priceSpan);
            
            // 5. 小计
            const totalSpan = document.createElement('span');
            totalSpan.className = 'center';
            totalSpan.textContent = (itemTotal / 100).toFixed(2);
            li.appendChild(totalSpan);

            // --- 安全构造结束 ---
            
            list.appendChild(li);
        });
    }

    // 更新总金额显示 (超大字体)
    elements.totalDisplay.textContent = `¥ ${(total / 100).toFixed(2)}`;
}

// --- 初始化 ---
function init() {
    // 监听主进程发来的同步消息
    window.api.onCartSync(renderScreen);
}

document.addEventListener('DOMContentLoaded', init);