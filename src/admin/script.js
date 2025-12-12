// 全局应用状态
const state = {
  categories: [],
  products: [],
  cart: [], // 结构: { id, name, price, options: [], count, categoryName, categoryId }
  currentCategoryId: null,
  orderListPage: 1,
  ordersPerPage: 10,
  totalOrders: 0,
  totalPages: 0,
};

// --- DOM 元素缓存 ---
const elements = {
  categoryList: document.getElementById("category-list"),
  productGrid: document.getElementById("product-grid"),
  cartList: document.getElementById("cart-list"),
  grandTotal: document.getElementById("grand-total"),
  checkoutBtn: document.getElementById("checkout-btn"),
  reportModal: document.getElementById("report-modal"),
  exportCsvBtn: document.getElementById("export-csv-btn"),
  showReportBtn: document.getElementById("show-report-btn"),
  closeModalBtn: document.getElementById("close-modal-btn"),
  startDateInput: document.getElementById("start-date"),
  endDateInput: document.getElementById("end-date"),
  showOrderHistoryBtn: document.getElementById("show-orders-btn"),
  orderListView: document.getElementById("order-list-view"),
  mainDiv: document.getElementById("app-container"),
  showManagementBtn: document.getElementById("show-management-btn"),
  managementView: document.getElementById("management-view"),
};

function createEl(tag, className, textContent) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (textContent !== undefined) el.textContent = textContent;
  return el;
}

// --- 渲染函数 ---

function renderCategories() {
  elements.categoryList.innerHTML = "";
  state.categories.forEach((cat) => {
    const btn = document.createElement("button");
    btn.className = "category-btn";
    btn.textContent = cat.name;
    btn.dataset.id = cat.id;
    if (cat.id === state.currentCategoryId) {
      btn.classList.add("active");
    }
    elements.categoryList.appendChild(btn);
  });
}

function renderProducts() {
  elements.productGrid.innerHTML = "";

  state.products.forEach((prod) => {
    const ops = JSON.parse(prod.options);
    const hasOptions = ops && ops.length > 0;
    const card = document.createElement("div");
    // 添加一个 class 标记是否有选项，方便 CSS 和 JS 判断
    card.className = hasOptions ? "product-card has-options" : "product-card";

    card.dataset.id = prod.id;
    card.dataset.name = prod.name;
    card.dataset.price = prod.price;

    // 主信息 (商品名和价格)
    const nameDiv = document.createElement("div");
    nameDiv.className = "product-name";
    nameDiv.textContent = prod.name;

    const priceDiv = document.createElement("div");
    priceDiv.className = "product-price";
    priceDiv.textContent = `¥ ${(prod.price / 100).toFixed(2)}`;

    card.appendChild(nameDiv);
    card.appendChild(priceDiv);

    // --- 核心修改：渲染冷/热选项按钮 ---
    if (hasOptions) {
      const optionDiv = document.createElement("div");
      optionDiv.className = "product-option-buttons";

      ops.forEach((choice) => {
        const btn = document.createElement("button");
        btn.className = "option-choice-btn";
        btn.textContent = choice;
        btn.dataset.action = "add-item-with-option";
        btn.dataset.option = choice; // 存储选项值

        btn.addEventListener("click", handleOptionButton);

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
  elements.cartList.innerHTML = "";

  state.cart.forEach((item, index) => {
    const itemTotal = item.price * item.count;
    total += itemTotal;

    const li = document.createElement("li");
    li.className = "cart-item";
    li.dataset.index = index;

    const optionsText =
      item.options && item.options.length > 0 ? item.options.join(", ") : "";

    // --- 1. 创建主内容行容器 (商品名 + 价格) ---
    const mainRowDiv = document.createElement("div");
    mainRowDiv.className = "item-main-row";

    // 1a. 创建 item-info 容器
    const infoDiv = document.createElement("div");
    infoDiv.className = "item-info";

    // 插入商品名称和数量
    infoDiv.textContent = `${item.name} (x${item.count})`;

    // 插入商品规格
    if (optionsText) {
      const optionsSpan = document.createElement("span");
      optionsSpan.className = "item-options";
      optionsSpan.textContent = `(${optionsText})`;
      infoDiv.appendChild(optionsSpan);
    }

    // 1b. 插入价格
    const priceDiv = document.createElement("div");
    priceDiv.className = "item-price";
    priceDiv.textContent = `¥ ${(itemTotal / 100).toFixed(2)}`;

    // 将 info 和 price 放入主行
    mainRowDiv.appendChild(infoDiv);
    mainRowDiv.appendChild(priceDiv);

    li.appendChild(mainRowDiv);

    // --- 2. 创建控制按钮行容器 (新的一行) ---
    const controlsRowDiv = document.createElement("div");
    controlsRowDiv.className = "item-controls-row";

    // 2a. 插入控制按钮
    const controlsDiv = document.createElement("div");
    controlsDiv.className = "item-controls";

    const decBtn = document.createElement("button");
    decBtn.dataset.action = "decrease";
    decBtn.textContent = "减";

    const incBtn = document.createElement("button");
    incBtn.dataset.action = "increase";
    incBtn.textContent = "加";

    const remBtn = document.createElement("button");
    remBtn.dataset.action = "remove";
    remBtn.textContent = "删除";

    controlsDiv.appendChild(decBtn);
    controlsDiv.appendChild(incBtn);
    controlsDiv.appendChild(remBtn);

    controlsRowDiv.appendChild(controlsDiv);

    li.appendChild(controlsRowDiv);

    elements.cartList.appendChild(li);
  });

  const displayTotal = (total / 100).toFixed(2);
  elements.grandTotal.textContent = `¥ ${displayTotal}`;
  elements.checkoutBtn.disabled = state.cart.length === 0;

  window.api.updateCart({ items: state.cart, total: total });
}

// --- 事件处理函数 ---

async function handleCategoryClick(event) {
  const btn = event.target.closest(".category-btn");
  if (!btn) return;

  const newId = parseInt(btn.dataset.id);
  if (state.currentCategoryId === newId) return;

  // 移除旧的 active 状态
  document.querySelector(".category-btn.active")?.classList.remove("active");
  btn.classList.add("active");

  state.currentCategoryId = newId;

  // 从主进程获取该分类下的商品
  const products = await window.api.getProducts(newId);
  state.products = products;
  renderProducts();
}

function handleOptionButton(event) {
  event.stopPropagation();

  const btn = event.currentTarget; // 被点击的按钮
  const option = btn.dataset.option; // 获取选项值 ('热' 或 '冷')
  const card = btn.closest(".product-card"); // 查找父卡片以获取商品数据

  if (!card) return;

  // --- Add to Cart Logic (复制并使用选项) ---

  const categoryName =
    state.categories.find((c) => c.id === state.currentCategoryId)?.name ||
    "未分类";

  // 构造商品对象
  const product = {
    id: parseInt(card.dataset.id),
    name: card.dataset.name,
    price: parseInt(card.dataset.price),
    options: [option], // 仅使用选中的选项
    count: 1,
    categoryName: categoryName,
    categoryId: state.currentCategoryId,
  };

  // 检查购物车是否有相同商品+相同规格的项 (精确匹配)
  const optionsKey = JSON.stringify(product.options);
  const existingIndex = state.cart.findIndex(
    (item) =>
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
  const card = event.target.closest(".product-card");
  if (!card) return;

  // 理论上由于 stopPropagation，这个检查更多是安全保障
  if (card.classList.contains("has-options")) {
    return;
  }

  const categoryName =
    state.categories.find((c) => c.id === state.currentCategoryId)?.name ||
    "未分类";

  // 构造商品对象 (无选项)
  const product = {
    id: parseInt(card.dataset.id),
    name: card.dataset.name,
    price: parseInt(card.dataset.price),
    options: [], // 选项为空
    count: 1,
    categoryName: categoryName,
    categoryId: state.currentCategoryId,
  };

  // 检查购物车是否有相同商品+相同规格的项
  const optionsKey = JSON.stringify(product.options);
  const existingIndex = state.cart.findIndex(
    (item) =>
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
  const btn = event.target.closest("button");
  if (!btn) return;

  const action = btn.dataset.action;
  const listItem = btn.closest(".cart-item");
  const index = parseInt(listItem.dataset.index);
  const item = state.cart[index];

  if (action === "increase") {
    item.count++;
  } else if (action === "decrease") {
    if (item.count > 1) {
      item.count--;
    } else {
      // 数量减到 0 时移除
      state.cart.splice(index, 1);
    }
  } else if (action === "remove") {
    state.cart.splice(index, 1);
  }

  // 重新渲染购物车
  renderCart();
}

async function handleCheckout() {
  if (state.cart.length === 0) return;

  const total = state.cart.reduce(
    (sum, item) => sum + item.price * item.count,
    0
  );

  elements.checkoutBtn.disabled = true;
  elements.checkoutBtn.textContent = "处理中...";

  // 调用主进程结账
  const result = await window.api.checkout({
    items: state.cart,
    total: total,
  });

  if (result.success) {
    alert(
      `结账成功！订单号: ${result.orderNo}. 总金额: ¥ ${(total / 100).toFixed(
        2
      )}`
    );

    // 调用打印小票
    const printResult = await window.api.printReceipt({
      items: state.cart,
      total: total,
      orderNo: result.orderNo,
      createdAt: result.createdAt,
    });
    if (printResult.success) {
      console.log("小票打印指令已发送。");
    } else {
      console.error("小票打印失败。");
    }

    state.cart = []; // 清空本地购物车
    renderCart();
  } else {
    alert(`结账失败: ${result.error || "数据库错误"}`);
  }

  elements.checkoutBtn.disabled = true;
  elements.checkoutBtn.textContent = "立即结账";
}

// --- 报表导出逻辑 ---

function formatDataForCsv(data) {
  if (!data || data.length === 0) return "";

  // 确保数据中的数字以正确的格式显示
  const headers = [
    "订单号",
    "下单时间",
    "订单总金额",
    "商品名称",
    "类别",
    "单价",
    "数量",
    "规格",
  ];
  const csvContent = [headers.join(",")];

  data.forEach((row) => {
    const rowData = [
      row.order_no,
      new Date(row.created_at).toLocaleString("zh-CN"),
      (row.total_amount / 100).toFixed(2), // 转换成分
      row.product_name,
      row.category_name,
      (row.unit_price / 100).toFixed(2),
      row.quantity,
      row.options_used ? JSON.parse(row.options_used).join(";") : "",
    ]
      .map((field) => `"${String(field).replace(/"/g, '""')}"`)
      .join(","); // CSV安全处理

    csvContent.push(rowData);
  });

  return csvContent.join("\n");
}

function downloadCsv(csv, filename) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } else {
    alert("您的浏览器不支持直接下载，请尝试其他浏览器或复制内容。");
  }
}

async function handleExportCsv() {
  const startDate = elements.startDateInput.value;
  const endDate = elements.endDateInput.value;

  if (!startDate || !endDate) {
    alert("请选择完整的日期范围！");
    return;
  }

  // 构造 ISO 时间字符串，确保包含全天的范围
  const startISO = new Date(startDate + "T00:00:00.000Z").toISOString();
  const endISO = new Date(endDate + "T23:59:59.999Z").toISOString();

  elements.exportCsvBtn.textContent = "查询中...";
  elements.exportCsvBtn.disabled = true;

  const result = await window.api.getReports(startISO, endISO);

  elements.exportCsvBtn.textContent = "导出 CSV";
  elements.exportCsvBtn.disabled = false;

  if (result.success && result.data && result.data.length > 0) {
    const csv = formatDataForCsv(result.data);
    const filename = `pos_report_${startDate}_to_${endDate}.csv`;

    // 替换 downloadCsv：调用主进程保存文件
    const saveResult = await window.api.saveCsvFile(csv, filename); // <-- NEW IPC CALL

    if (saveResult.success) {
      alert(`流水导出成功！文件已保存到：\n${saveResult.path}`);
      elements.reportModal.style.display = "none";
    } else {
      // 用户取消保存，或写入失败
      alert(`文件保存失败或已取消: ${saveResult.error || "用户取消"}`);
    }
  } else if (result.success && result.data.length === 0) {
    alert("该日期范围内没有交易流水。");
  } else {
    alert(`导出失败: ${result.error || "未知错误"}`);
  }
}

function showOrderListView() {
  elements.mainDiv.style.display = "none";
  elements.managementView.style.display = "none";
  elements.orderListView.style.display = "block";
  // 确保报告模式关闭
  elements.reportModal.style.display = "none";
}

function showProductGridView() {
  elements.mainDiv.style.display = "flex";
  elements.orderListView.style.display = "none";
  elements.managementView.style.display = "none";
}

// ----------------------------------------------------
// 订单列表处理函数
// ----------------------------------------------------

// 切换到订单列表视图并加载第一页
function handleShowOrderHistory() {
  showOrderListView();
  // 每次进入时，从第一页开始加载
  loadOrders(1);
}

// 异步加载订单数据
async function loadOrders(page) {
  state.orderListPage = page;

  // 创建并显示加载覆盖层
  const overlay = document.createElement("div");
  overlay.className = "loading-overlay";
  overlay.textContent = "加载中...";

  // 插入到 orderListView 中，覆盖其内容
  elements.orderListView.appendChild(overlay);

  const limit = state.ordersPerPage;
  const offset = (page - 1) * limit;

  const result = await window.api.getPaginatedOrders({ limit, offset });

  // 无论成功或失败，先移除覆盖层
  elements.orderListView.removeChild(overlay);

  if (result.success) {
    state.totalOrders = result.totalCount;
    state.totalPages = Math.ceil(result.totalCount / limit);

    // 渲染新列表，这会替换旧内容
    renderOrderList(result.data);
  } else {
    // 只在加载失败时显示错误消息，避免清空成功内容
    const errorEl = document.createElement("p");
    errorEl.className = "error-message";
    errorEl.textContent = `加载失败: ${result.error}`;
    elements.orderListView.appendChild(errorEl);
  }
}

// 渲染订单列表和分页控件

// 渲染分页按钮
function renderPaginationControls() {
  if (state.totalPages <= 1) return null;

  const paginationDiv = createEl("div", "pagination");

  // --- 上一页 Button ---
  const prevBtn = createEl("button", "page-btn", "上一页");
  prevBtn.dataset.page = state.orderListPage - 1;
  if (state.orderListPage === 1) {
    prevBtn.disabled = true;
  }
  paginationDiv.appendChild(prevBtn);

  // --- 页面数字 Buttons ---
  for (let i = 1; i <= state.totalPages; i++) {
    const pageBtn = createEl("button", "page-btn", i);
    pageBtn.dataset.page = i;
    if (i === state.orderListPage) {
      pageBtn.classList.add("active");
    }
    paginationDiv.appendChild(pageBtn);
  }

  // --- 下一页 Button ---
  const nextBtn = createEl("button", "page-btn", "下一页");
  nextBtn.dataset.page = state.orderListPage + 1;
  if (state.orderListPage === state.totalPages) {
    nextBtn.disabled = true;
  }
  paginationDiv.appendChild(nextBtn);

  // --- Info Span ---
  const infoSpan = createEl(
    "span",
    null,
    `共 ${state.totalOrders} 条记录 / ${state.totalPages} 页`
  );
  paginationDiv.appendChild(infoSpan);

  return paginationDiv; // 返回 DOM 元素
}

function renderOrderList(orders) {
  elements.orderListView.innerHTML = "";

  // 构造：返回按钮和标题 (Header)
  const headerDiv = createEl("div", "order-list-header");

  const backBtn = createEl("button", "control-btn", "← 返回商品列表");
  backBtn.id = "back-to-products-btn";

  const titleH2 = createEl("h2", null, "历史订单列表");

  const infoSpan = createEl(
    "span",
    null,
    `共 ${state.totalOrders} 条记录 / ${state.totalPages} 页`
  );

  headerDiv.appendChild(backBtn);
  headerDiv.appendChild(titleH2);
  headerDiv.appendChild(infoSpan);

  elements.orderListView.appendChild(headerDiv);

  // 处理无数据情况
  if (orders.length === 0) {
    elements.orderListView.appendChild(
      createEl("p", null, "没有找到任何订单记录。")
    );

    // 绑定返回按钮事件 (即使没有数据，也要能返回)
    backBtn.addEventListener("click", showProductGridView);
    return;
  }

  // 构造：订单列表表格
  const table = createEl("table", "order-table");
  const thead = createEl("thead");
  const tbody = createEl("tbody");

  // 表头
  const headerRow = createEl("tr");
  ["订单号", "总金额", "时间", "明细"].forEach((text) => {
    headerRow.appendChild(createEl("th", null, text));
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  // 表格内容
  orders.forEach((order) => {
    const row = createEl("tr");
    row.dataset.orderId = order.id;

    const totalDisplay = (order.total_amount / 100).toFixed(2);

    row.appendChild(createEl("td", null, order.order_no));
    row.appendChild(createEl("td", null, `¥ ${totalDisplay}`));
    row.appendChild(
      createEl("td", null, new Date(order.created_at).toLocaleString())
    );

    // 明细按钮
    const detailCell = createEl("td");
    const detailBtn = createEl("button", "detail-btn", "查看");
    detailBtn.dataset.id = order.id;
    detailCell.appendChild(detailBtn);
    row.appendChild(detailCell);

    tbody.appendChild(row);
  });
  table.appendChild(tbody);
  elements.orderListView.appendChild(table);

  // 构造：分页控件
  // 这里暂时使用原始的字符串拼接返回，但最好也进行重构。
  const paginationControls = renderPaginationControls();
  if (paginationControls) {
    elements.orderListView.appendChild(paginationControls);

    // 绑定分页按钮事件 (直接 targeting the returned element)
    paginationControls.querySelectorAll(".page-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const newPage = parseInt(e.target.dataset.page);
        if (newPage > 0 && newPage <= state.totalPages) {
          loadOrders(newPage);
        }
      });
    });
  }

  // 绑定事件监听器：返回按钮
  backBtn.addEventListener("click", showProductGridView);

  // 绑定明细按钮
  elements.orderListView.querySelectorAll(".detail-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const orderId = parseInt(e.target.dataset.id);
      showOrderDetailModal(orderId);
    });
  });
}

async function showOrderDetailModal(orderId) {
  // 2. 异步获取数据
  const result = await window.api.getOrderDetails(orderId);

  if (!result.success || !result.data) {
    alert(
      `加载订单 ${orderId} 失败: ${result.error || "订单不存在或加载错误"}`
    );
    return;
  }

  const orderData = result.data;

  // 3. 构建模态框的 DOM 结构 (backdrop + content)

  // Backdrop: 覆盖整个屏幕，用于关闭
  const modal = document.createElement("div");
  modal.className = "modal-backdrop";
  modal.id = "order-detail-modal";

  // Content Box: 实际的弹窗内容
  const contentBox = document.createElement("div");
  contentBox.className = "modal-content";

  // 4. 渲染订单明细
  contentBox.appendChild(renderOrderDetails(orderData));

  // 5. 添加关闭按钮
  const closeBtn = createEl("button", "modal-close-btn", "关闭");
  // 点击关闭按钮或点击背景时关闭模态框
  closeBtn.onclick = () => document.body.removeChild(modal);

  // 点击背景时关闭
  modal.onclick = (e) => {
    if (e.target === modal) {
      document.body.removeChild(modal);
    }
  };

  contentBox.appendChild(closeBtn);
  modal.appendChild(contentBox);

  // 6. 插入到 Body 并显示
  document.body.appendChild(modal);
}

function renderOrderDetails(order) {
  const container = document.createElement("div");
  container.className = "order-detail-container";

  // --- Header Info (订单号, 时间) ---
  container.appendChild(createEl("h3", null, `订单号: ${order.order_no}`));
  container.appendChild(
    createEl(
      "p",
      null,
      `创建时间: ${new Date(order.created_at).toLocaleString()}`
    )
  );
  container.appendChild(createEl("hr"));

  // --- Items Table (商品列表) ---
  const table = createEl("table", "order-items-table");

  // Table Header
  const thead = createEl("thead");
  const headerRow = createEl("tr");
  ["商品名称", "规格", "数量", "单价", "小计"].forEach((text) => {
    headerRow.appendChild(createEl("th", null, text));
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  // Table Body
  const tbody = createEl("tbody");
  order.items.forEach((item) => {
    const row = createEl("tr");
    const itemTotal = item.unit_price * item.quantity;
    // 安全地显示规格，防止 XSS
    const optionsText = item.options.length > 0 ? item.options.join(", ") : "—";

    row.appendChild(createEl("td", "item-name", item.product_name));
    row.appendChild(createEl("td", "item-options", optionsText));
    row.appendChild(createEl("td", "item-quantity", `x${item.quantity}`));
    row.appendChild(
      createEl("td", "item-price", `¥ ${(item.unit_price / 100).toFixed(2)}`)
    );
    row.appendChild(
      createEl("td", "item-total", `¥ ${(itemTotal / 100).toFixed(2)}`)
    );

    tbody.appendChild(row);
  });
  table.appendChild(tbody);
  container.appendChild(table);

  // --- Total Footer ---
  const totalDiv = createEl("div", "order-total-footer");
  totalDiv.appendChild(
    createEl(
      "strong",
      null,
      `总计金额: ¥ ${(order.total_amount / 100).toFixed(2)}`
    )
  );
  container.appendChild(totalDiv);

  return container;
}

function showProductManagementView() {
  // 隐藏其他视图
  elements.mainDiv.style.display = "none";
  elements.orderListView.style.display = "none";
  // 显示商品管理视图
  elements.managementView.style.display = "block";
}

// ----------------------------------------------------
// 商品管理处理函数
// ----------------------------------------------------
function handleShowProductManagement() {
  showProductManagementView();
  renderProductManagementInterface();
}

function renderProductTable(products, categories) {
  return "<p>商品列表表格占位...</p>";
}

async function handleCategoryDelete(e) {
  const categoryId = parseInt(e.target.dataset.id);
  const categoryName = e.target
    .closest(".category-item")
    .querySelector(".category-name").textContent;

  // 提示信息应包含将要删除的内容，警告用户会丢失商品。
  const confirmationMessage =
    `确认删除分类 "${categoryName}" 吗？\n\n` +
    `此操作将永久删除此分类及该分类下的所有商品，数据无法恢复！`;

  if (!confirm(confirmationMessage)) {
    // 用户点击了“取消”
    console.log(`用户取消了删除分类 ID: ${categoryId} 的操作。`);
    return;
  }

  // 1. 调用 IPC 接口执行删除操作
  const result = await window.api.deleteCategory(categoryId);

  if (result.success) {
    const count = result.deletedProductsCount;
    let message = `分类 "${categoryName}" 删除成功！`;

    // 2. 显示删除结果的反馈（这里继续使用 alert，仅用于反馈结果）
    if (count > 0) {
      message += `\n已同时删除了 ${count} 个关联商品。`;
    } else {
      message += `\n该分类下没有关联商品被删除。`;
    }

    alert(message);

    // 3. 刷新界面
    renderProductManagementInterface();
  } else {
    alert(`删除分类失败: ${result.error}`);
  }
}

async function renderProductManagementInterface() {
  // 1. 设置加载提示 (只写一次 DOM)
  // 保持加载提示，但不使用 innerHTML 清空，而是使用更轻量的方式
  elements.managementView.innerHTML =
    '<button id="back-to-products-btn" class="control-btn">← 返回商品列表</button><h2>商品和分类管理</h2><p id="loading-message">加载中...</p>';

  // 获取数据 (这是耗时且异步的操作)
  const result = await window.api.getAllProductsAndCategories();

  if (!result.success) {
    // 如果失败，只更新错误提示
    elements.managementView.querySelector(
      "#loading-message"
    ).textContent = `加载数据失败: ${result.error}`;
    return;
  }

  const { categories, products } = result.data;

  // 2. 渲染内容到 DocumentFragment (性能优化)
  const fragment = document.createDocumentFragment();

  // 标题和返回按钮
  const headerHtml =
    '<button id="back-to-products-btn" class="control-btn">← 返回商品列表</button><h2>商品和分类管理</h2>';
  const headerContainer = document.createElement("div");
  headerContainer.innerHTML = headerHtml;
  fragment.appendChild(headerContainer);

  // 渲染分类和商品区域
  const categoryArea = renderCategoryManagementList(categories);
  const productArea = renderProductManagementTable(products, categories);

  fragment.appendChild(categoryArea);
  fragment.appendChild(productArea);

  // 3. 替换内容
  // 清空旧内容
  elements.managementView.innerHTML = "";
  // 写入新内容
  elements.managementView.appendChild(fragment);

  // 4. 绑定事件
  bindManagementEvents();
}

function renderCategoryManagementList(categories) {
  const container = createEl("div", "management-section");

  // 标题和新增按钮
  const header = createEl("div", "management-header");
  header.appendChild(
    createEl("h3", null, `分类管理 (${categories.length} 个)`)
  );
  const addBtn = createEl("button", null, "✚ 新增分类");
  addBtn.id = "add-category-btn";
  header.appendChild(addBtn);
  container.appendChild(header);

  // 分类列表
  const listDiv = createEl("div", "category-management-list");

  categories.forEach((c) => {
    const item = createEl("div", "category-item");
    item.dataset.id = c.id;

    const nameSpan = createEl("span", "category-name", c.name);
    item.appendChild(nameSpan);

    const actions = createEl("div", "category-actions");

    const editBtn = createEl("button", "edit-category-btn danger-btn", "编辑");
    editBtn.dataset.id = c.id;
    editBtn.dataset.name = c.name;

    const deleteBtn = createEl(
      "button",
      "delete-category-btn danger-btn",
      "删除"
    );
    deleteBtn.dataset.id = c.id;

    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);
    item.appendChild(actions);
    listDiv.appendChild(item);
  });

  container.appendChild(listDiv);
  return container;
}

function renderProductManagementTable(products, categories) {
  const container = createEl("div", "management-section");

  // 标题和新增按钮
  const header = createEl("div", "management-header");
  header.appendChild(createEl("h3", null, `商品管理 (${products.length} 个)`));
  const addBtn = createEl("button", null, "✚ 新增商品");
  addBtn.id = "add-product-btn";
  header.appendChild(addBtn);
  container.appendChild(header);

  // 表格主体
  const table = createEl("table", "product-management-table");
  const thead = createEl("thead");
  const tbody = createEl("tbody");

  // 表头
  const headers = ["ID", "分类", "商品名", "价格 (元)", "规格", "操作"];
  const headerRow = createEl("tr");
  headers.forEach((text) => headerRow.appendChild(createEl("th", null, text)));
  thead.appendChild(headerRow);
  table.appendChild(thead);

  // 表格内容
  products.forEach((p) => {
    const row = createEl("tr");
    row.dataset.id = p.id;

    const category = categories.find((c) => c.id === p.category_id);
    const categoryName = category ? category.name : "未分类";
    const priceDisplay = (p.price / 100).toFixed(2);

    // 尝试解析规格，并安全显示
    let optionsText = "";
    try {
      const options = JSON.parse(p.options || "[]");
      optionsText = options.length > 0 ? options.join(", ") : "—";
    } catch (e) {
      optionsText = "格式错误";
    }

    row.appendChild(createEl("td", null, p.id));
    row.appendChild(createEl("td", null, categoryName));
    row.appendChild(createEl("td", null, p.name));
    row.appendChild(createEl("td", null, priceDisplay));
    row.appendChild(createEl("td", "product-options-cell", optionsText));

    // 操作单元格
    const actionsCell = createEl("td", "action-cell");
    const editBtn = createEl("button", "edit-product-btn danger-btn", "编辑");
    editBtn.dataset.id = p.id;
    const deleteBtn = createEl(
      "button",
      "delete-product-btn danger-btn",
      "删除"
    );
    deleteBtn.dataset.id = p.id;

    actionsCell.appendChild(editBtn);
    actionsCell.appendChild(deleteBtn);
    row.appendChild(actionsCell);

    tbody.appendChild(row);
  });

  table.appendChild(tbody);
  container.appendChild(table);
  return container;
}

/**
 *  模态框辅助函数：显示分类编辑/新增表单
 * @param {object | null} category - 待编辑的分类对象，null 表示新增
 */
async function onEditCategory(category) {
  const result = await window.api.openCategoryModal(category);
  if (!result.success) return;

  await window.api.updateCategory(result); // 你的业务逻辑
  renderProductManagementInterface();
}

async function onAddCategory() {
  const result = await window.api.openCategoryModal(null);
  if (!result.success) return;

  await window.api.insertCategory(result);
  renderProductManagementInterface();
}

/**
 *  模态框辅助函数：显示商品编辑/新增表单 (简化版)
 *  完整的实现需要获取所有分类供选择，并处理 options 数组
 * @param {object | null} product - 待编辑的商品对象，null 表示新增
 */
async function onEditProduct(data) {
  const result = await window.api.openProductModal(data);
  if (!result.success) return;

  await window.api.updateProduct(result.data); // 你的业务逻辑
  renderProductManagementInterface();
}

async function onAddProduct() {
  const result = await window.api.openProductModal(null);
  if (!result.success) return;

  await window.api.insertProduct(result.data);
  renderProductManagementInterface();
}

async function handleProductDelete(e) {
  const productId = parseInt(e.target.dataset.id);

  if (!confirm(`确定要删除商品 ID: ${productId} 吗？`)) {
    return;
  }

  const result = await window.api.deleteProduct(productId);

  if (result.success) {
    alert("商品删除成功！");
    renderProductManagementInterface(); // 刷新列表
  } else {
    alert(`商品删除失败：${result.error}`);
  }
}

function bindManagementEvents() {
  const view = elements.managementView;

  view
    .querySelector("#back-to-products-btn")
    .addEventListener("click", async () => {
      await loadDataAndRenderPOS();
      showProductGridView();
    });

  // 1. 分类删除事件 (重点)
  view.querySelectorAll(".delete-category-btn").forEach((btn) => {
    btn.addEventListener("click", handleCategoryDelete);
  });

  // 2. 商品删除事件 (简单删除)
  view.querySelectorAll(".delete-product-btn").forEach((btn) => {
    btn.addEventListener("click", handleProductDelete);
  });

  // 3. 其它事件 (占位，待实现模态框逻辑)
  view
    .querySelector("#add-category-btn")
    .addEventListener("click", () => onAddCategory());
  view
    .querySelector("#add-product-btn")
    .addEventListener("click", () => onAddProduct());
  view.querySelectorAll(".edit-category-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      // 从 data-* 属性获取数据并传入模态框
      onEditCategory({
        id: parseInt(e.target.dataset.id),
        name: e.target.dataset.name,
      });
    });
  });
  view.querySelectorAll(".edit-product-btn").forEach(async (btn) => {
    btn.addEventListener("click", async (e) => {
      const productId = parseInt(e.target.dataset.id);
      const result = await window.api.getProductById(productId);
      console.log(result);
      if (result) {
        return onEditProduct(result);
      }
      alert("商品查询失败");
    });
  });
}

/**
 * 异步加载最新的商品和分类数据，更新 state，并渲染主 POS 界面。
 */
async function loadDataAndRenderPOS() {
  try {
    // 1. 调用 IPC 接口获取最新数据
    const result = await window.api.getInitialData();

    if (!result.success) {
      console.error("加载初始数据失败:", result.error);
      alert("加载商品数据失败，请检查数据库连接。");
      return;
    }

    // 2. 更新全局 state
    state.categories = result.categories;
    state.products = result.products;

    // 确保 currentCategoryId 仍然有效或指向第一个分类
    if (result.categories.length > 0) {
      state.currentCategoryId = result.categories[0].id;
    }

    // 3. 渲染主 POS 界面
    renderCategories();
    renderProducts();
  } catch (error) {
    console.error("加载主界面数据时发生错误:", error);
  }
}

// --- 初始化与监听 ---

async function init() {
  // 绑定事件监听器 (使用事件委托)
  elements.categoryList.addEventListener("click", handleCategoryClick);
  elements.productGrid.addEventListener("click", handleProductClick);
  elements.cartList.addEventListener("click", handleCartControls);
  elements.checkoutBtn.addEventListener("click", handleCheckout);
  elements.showOrderHistoryBtn.addEventListener(
    "click",
    handleShowOrderHistory
  );
  elements.showManagementBtn.addEventListener(
    "click",
    handleShowProductManagement
  );

  // 报表 Modal 监听
  elements.showReportBtn.addEventListener("click", () => {
    elements.reportModal.style.display = "flex";
  });
  elements.closeModalBtn.addEventListener("click", () => {
    elements.reportModal.style.display = "none";
  });
  elements.exportCsvBtn.addEventListener("click", handleExportCsv);

  // 首次加载数据
  loadDataAndRenderPOS();
}

function setupLogin() {
  // 定义 DOM 元素
  const loginOverlay = document.getElementById("login-overlay");
  const appContainer = document.getElementById("app-container");
  const loginBtn = document.getElementById("login-btn");
  const usernameInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");
  const errorMessageEl = document.getElementById("login-error-message");

  // 绑定事件
  loginBtn.addEventListener("click", handleLogin);
  // 允许按回车键登录
  passwordInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      handleLogin();
    }
  });

  // 登录处理函数
  async function handleLogin() {
    const username = usernameInput.value;
    const password = passwordInput.value;
    errorMessageEl.textContent = "";
    loginBtn.disabled = true;

    if (!username || !password) {
      errorMessageEl.textContent = "请输入用户名和密码。";
      loginBtn.disabled = false;
      return;
    }

    const result = await window.api.authenticate({ username, password });

    if (result.success) {
      // 登录成功：隐藏登录层，显示应用主内容
      loginOverlay.style.display = "none";
      appContainer.style.display = "flex";

      init();
    } else {
      errorMessageEl.textContent = result.error;
      passwordInput.value = ""; // 清空密码输入框
      loginBtn.disabled = false;
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  setupLogin();
});
