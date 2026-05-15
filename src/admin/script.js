// Global Application State
const state = {
  categories: [],
  products: [],
  cart: [], // Structure: { id, name, price, options: [], count, categoryName, categoryId }
  currentCategoryId: null,
  orderListPage: 1,
  ordersPerPage: 10,
  totalOrders: 0,
  totalPages: 0,
};

// --- DOM Elements Cache ---
const elements = {
  categoryList: document.getElementById("category-list"),
  productGrid: document.getElementById("product-grid"),
  cartList: document.getElementById("cart-list"),
  grandTotal: document.getElementById("grand-total"),
  checkoutBtn: document.getElementById("checkout-btn"),
  showReportBtn: document.getElementById("show-report-btn"),
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

// --- Render Functions ---

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
    // Add a class tag if there are options for CSS and JS logic
    card.className = hasOptions ? "product-card has-options" : "product-card";

    card.dataset.id = prod.id;
    card.dataset.name = prod.name;
    card.dataset.price = prod.price;

    // Main info (Product name and price)
    const nameDiv = document.createElement("div");
    nameDiv.className = "product-name";
    nameDiv.textContent = prod.name;

    const priceDiv = document.createElement("div");
    priceDiv.className = "product-price";
    priceDiv.textContent = `¥ ${(prod.price / 100).toFixed(2)}`;

    card.appendChild(nameDiv);
    card.appendChild(priceDiv);

    // --- Core Modification: Render Option Buttons (e.g., Hot/Ice) ---
    if (hasOptions) {
      const optionDiv = document.createElement("div");
      optionDiv.className = "product-option-buttons";

      ops.forEach((choice) => {
        const btn = document.createElement("button");
        btn.className = "option-choice-btn";
        btn.textContent = choice;
        btn.dataset.action = "add-item-with-option";
        btn.dataset.option = choice; // Store option value

        btn.addEventListener("click", handleOptionButton);

        optionDiv.appendChild(btn);
      });

      card.appendChild(optionDiv);
    }
    // --- End Option Buttons Rendering ---

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

    // --- 1. [top] info part: name + qty + options ---
    const mainRowDiv = document.createElement("div");
    mainRowDiv.className = "item-main-row";

    const infoDiv = document.createElement("div");
    infoDiv.className = "item-info";

    // 1a. name area
    const nameSpan = document.createElement("span");
    nameSpan.className = "item-name";
    nameSpan.textContent = item.name;
    infoDiv.appendChild(nameSpan);

    // 1b. quantity area
    const qtySpan = document.createElement("span");
    qtySpan.className = "item-qty";
    qtySpan.textContent = ` x${item.count}`;
    infoDiv.appendChild(qtySpan);

    // 1c. options area
    if (optionsText) {
      const optionsSpan = document.createElement("span");
      optionsSpan.className = "item-options";
      optionsSpan.textContent = `(${optionsText})`;
      infoDiv.appendChild(optionsSpan);
    }

    mainRowDiv.appendChild(infoDiv);
    li.appendChild(mainRowDiv);

    // --- 2. [bottom] price area + controls area ---
    const controlsRowDiv = document.createElement("div");
    controlsRowDiv.className = "item-controls-row";

    // 2a. price area (now located on the left)
    const priceDiv = document.createElement("div");
    priceDiv.className = "item-price";
    priceDiv.textContent = `¥ ${(itemTotal / 100).toFixed(2)}`;
    controlsRowDiv.appendChild(priceDiv);

    // 2b. controls area (now located on the right)
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

// --- Event Handlers ---

async function handleCategoryClick(event) {
  const btn = event.target.closest(".category-btn");
  if (!btn) return;

  const newId = parseInt(btn.dataset.id);
  if (state.currentCategoryId === newId) return;

  // Remove old active status
  document.querySelector(".category-btn.active")?.classList.remove("active");
  btn.classList.add("active");

  state.currentCategoryId = newId;

  // Get products under this category from main process
  const products = await window.api.getProducts(newId);
  state.products = products;
  renderProducts();
}

function handleOptionButton(event) {
  event.stopPropagation();

  const btn = event.currentTarget; // The clicked button
  const option = btn.dataset.option; // Get option value ('Hot' or 'Ice')
  const card = btn.closest(".product-card"); // Find parent card to get product data

  if (!card) return;

  // --- Add to Cart Logic (Copy and use option) ---

  const categoryName =
    state.categories.find((c) => c.id === state.currentCategoryId)?.name ||
    "未分类";

  // Construct product object
  const product = {
    id: parseInt(card.dataset.id),
    name: card.dataset.name,
    price: parseInt(card.dataset.price),
    options: [option], // Use selected option only
    count: 1,
    categoryName: categoryName,
    categoryId: state.currentCategoryId,
  };

  // Check if cart already has an item with same ID and same specifications (Exact match)
  const optionsKey = JSON.stringify(product.options);
  const existingIndex = state.cart.findIndex(
    (item) =>
      item.id === product.id && JSON.stringify(item.options) === optionsKey,
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

  // Check safety due to stopPropagation
  if (card.classList.contains("has-options")) {
    return;
  }

  const categoryName =
    state.categories.find((c) => c.id === state.currentCategoryId)?.name ||
    "未分类";

  // Construct product object (No options)
  const product = {
    id: parseInt(card.dataset.id),
    name: card.dataset.name,
    price: parseInt(card.dataset.price),
    options: [], // Empty options
    count: 1,
    categoryName: categoryName,
    categoryId: state.currentCategoryId,
  };

  // Check if cart has same product and specifications
  const optionsKey = JSON.stringify(product.options);
  const existingIndex = state.cart.findIndex(
    (item) =>
      item.id === product.id && JSON.stringify(item.options) === optionsKey,
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
      // Remove item if count reaches 0
      state.cart.splice(index, 1);
    }
  } else if (action === "remove") {
    state.cart.splice(index, 1);
  }

  // Re-render cart
  renderCart();
}

async function handleCheckout() {
  if (state.cart.length === 0) return;

  const total = state.cart.reduce(
    (sum, item) => sum + item.price * item.count,
    0,
  );

  elements.checkoutBtn.disabled = true;
  elements.checkoutBtn.textContent = "处理中...";

  // Call main process for checkout
  const result = await window.api.checkout({
    items: state.cart,
    total: total,
  });

  if (result.success) {
    alert(
      `结账成功！订单号: ${result.orderNo}. 总金额: ¥ ${(total / 100).toFixed(
        2,
      )}`,
    );

    // Call print receipt
    const printResult = await window.api.printReceipt({
      items: state.cart,
      total: total,
      orderNo: result.orderNo,
      createdAt: result.createdAt,
    });
    if (printResult.success) {
      console.log("Receipt printing command sent.");
    } else {
      console.error("Receipt printing failed.");
    }

    state.cart = []; // Clear local cart
    renderCart();
  } else {
    alert(`结账失败: ${result.error || "数据库错误"}`);
  }

  elements.checkoutBtn.disabled = true;
  elements.checkoutBtn.textContent = "立即结账";
}

function showOrderListView() {
  elements.mainDiv.style.display = "none";
  elements.managementView.style.display = "none";
  elements.orderListView.style.display = "block";
}

function showProductGridView() {
  elements.mainDiv.style.display = "flex";
  elements.orderListView.style.display = "none";
  elements.managementView.style.display = "none";
}

// ----------------------------------------------------
// Order List Handler Functions
// ----------------------------------------------------

// Switch to order list view and load first page
function handleShowOrderHistory() {
  showOrderListView();
  // Load from page 1 every time the view is entered
  loadOrders(1);
}

// Asynchronously load order data
async function loadOrders(page) {
  state.orderListPage = page;

  // Create and show loading overlay
  const overlay = document.createElement("div");
  overlay.className = "loading-overlay";
  overlay.textContent = "加载中...";

  // Insert into orderListView, covering its content
  elements.orderListView.appendChild(overlay);

  const limit = state.ordersPerPage;
  const offset = (page - 1) * limit;

  const result = await window.api.getPaginatedOrders({ limit, offset });

  // Remove overlay regardless of success or failure
  elements.orderListView.removeChild(overlay);

  if (result.success) {
    state.totalOrders = result.totalCount;
    state.totalPages = Math.ceil(result.totalCount / limit);

    // Render new list, replacing old content
    renderOrderList(result.data);
  } else {
    // Show error message only on failure to avoid clearing successful content
    const errorEl = document.createElement("p");
    errorEl.className = "error-message";
    errorEl.textContent = `加载失败: ${result.error}`;
    elements.orderListView.appendChild(errorEl);
  }
}

// Render order list and pagination controls

// Render pagination buttons
function renderPaginationControls() {
  if (state.totalPages <= 1) return null;

  const paginationDiv = createEl("div", "pagination");

  // --- Previous Page Button ---
  const prevBtn = createEl("button", "page-btn", "上一页");
  prevBtn.dataset.page = state.orderListPage - 1;
  if (state.orderListPage === 1) {
    prevBtn.disabled = true;
  }
  paginationDiv.appendChild(prevBtn);

  // --- Page Number Buttons ---
  for (let i = 1; i <= state.totalPages; i++) {
    const pageBtn = createEl("button", "page-btn", i);
    pageBtn.dataset.page = i;
    if (i === state.orderListPage) {
      pageBtn.classList.add("active");
    }
    paginationDiv.appendChild(pageBtn);
  }

  // --- Next Page Button ---
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
    `共 ${state.totalOrders} 条记录 / ${state.totalPages} 页`,
  );
  paginationDiv.appendChild(infoSpan);

  return paginationDiv; // Returns DOM element
}

function renderOrderList(orders) {
  elements.orderListView.innerHTML = "";

  // Construct: Back button and Header
  const headerDiv = createEl("div", "order-list-header");

  const backBtn = createEl("button", "control-btn", "← 返回商品列表");
  backBtn.id = "back-to-products-btn";

  const titleH2 = createEl("h2", null, "历史订单列表");

  const infoSpan = createEl(
    "span",
    null,
    `共 ${state.totalOrders} 条记录 / ${state.totalPages} 页`,
  );

  headerDiv.appendChild(backBtn);
  headerDiv.appendChild(titleH2);
  headerDiv.appendChild(infoSpan);

  elements.orderListView.appendChild(headerDiv);

  // Handle case with no data
  if (orders.length === 0) {
    elements.orderListView.appendChild(
      createEl("p", null, "没有找到任何订单记录。"),
    );

    // Bind back button event (allow returning even if no data)
    backBtn.addEventListener("click", showProductGridView);
    return;
  }

  // Construct: Order list table
  const table = createEl("table", "order-table");
  const thead = createEl("thead");
  const tbody = createEl("tbody");

  // Table header
  const headerRow = createEl("tr");
  ["订单号", "总金额", "时间", "明细"].forEach((text) => {
    headerRow.appendChild(createEl("th", null, text));
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  // Table content
  orders.forEach((order) => {
    const row = createEl("tr");
    row.dataset.orderId = order.id;

    const totalDisplay = (order.total_amount / 100).toFixed(2);

    row.appendChild(createEl("td", null, order.order_no));
    row.appendChild(createEl("td", null, `¥ ${totalDisplay}`));
    row.appendChild(
      createEl("td", null, new Date(order.created_at).toLocaleString()),
    );

    // Detail button
    const detailCell = createEl("td");
    const detailBtn = createEl("button", "detail-btn", "查看");
    detailBtn.dataset.id = order.id;
    detailCell.appendChild(detailBtn);
    row.appendChild(detailCell);

    tbody.appendChild(row);
  });
  table.appendChild(tbody);
  elements.orderListView.appendChild(table);

  // Construct: Pagination controls
  const paginationControls = renderPaginationControls();
  if (paginationControls) {
    elements.orderListView.appendChild(paginationControls);

    // Bind pagination button events
    paginationControls.querySelectorAll(".page-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const newPage = parseInt(e.target.dataset.page);
        if (newPage > 0 && newPage <= state.totalPages) {
          loadOrders(newPage);
        }
      });
    });
  }

  // Bind event listener: back button
  backBtn.addEventListener("click", showProductGridView);

  // Bind detail buttons
  elements.orderListView.querySelectorAll(".detail-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const orderId = parseInt(e.target.dataset.id);
      showOrderDetailModal(orderId);
    });
  });
}

async function showOrderDetailModal(orderId) {
  // 2. Asynchronously fetch data
  const result = await window.api.getOrderDetails(orderId);

  if (!result.success || !result.data) {
    alert(
      `加载订单 ${orderId} 失败: ${result.error || "订单不存在或加载错误"}`,
    );
    return;
  }

  const orderData = result.data;

  // 3. Build modal DOM structure (backdrop + content)

  // Backdrop: covers screen for closing
  const modal = document.createElement("div");
  modal.className = "modal-backdrop";
  modal.id = "order-detail-modal";

  // Content Box: actual popup content
  const contentBox = document.createElement("div");
  contentBox.className = "modal-content";

  // 4. Render order details
  contentBox.appendChild(renderOrderDetails(orderData));

  // 5. Add close button
  const closeBtn = createEl("button", "modal-close-btn", "关闭");
  // Close modal on button click or backdrop click
  closeBtn.onclick = () => document.body.removeChild(modal);

  // Close on backdrop click
  modal.onclick = (e) => {
    if (e.target === modal) {
      document.body.removeChild(modal);
    }
  };

  contentBox.appendChild(closeBtn);
  modal.appendChild(contentBox);

  // 6. Insert into body and display
  document.body.appendChild(modal);
}

function renderOrderDetails(order) {
  const container = document.createElement("div");
  container.className = "order-detail-container";

  // --- Header Info (Order No, Time) ---
  container.appendChild(createEl("h3", null, `订单号: ${order.order_no}`));
  container.appendChild(
    createEl(
      "p",
      null,
      `创建时间: ${new Date(order.created_at).toLocaleString()}`,
    ),
  );
  container.appendChild(createEl("hr"));

  // --- Items Table (Product List) ---
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
    // Safely display specifications to prevent XSS
    const optionsText = item.options.length > 0 ? item.options.join(", ") : "—";

    row.appendChild(createEl("td", "item-name", item.product_name));
    row.appendChild(createEl("td", "item-options", optionsText));
    row.appendChild(createEl("td", "item-quantity", `x${item.quantity}`));
    row.appendChild(
      createEl("td", "item-price", `¥ ${(item.unit_price / 100).toFixed(2)}`),
    );
    row.appendChild(
      createEl("td", "item-total", `¥ ${(itemTotal / 100).toFixed(2)}`),
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
      `总计金额: ¥ ${(order.total_amount / 100).toFixed(2)}`,
    ),
  );
  container.appendChild(totalDiv);

  return container;
}

function showProductManagementView() {
  // Hide other views
  elements.mainDiv.style.display = "none";
  elements.orderListView.style.display = "none";
  // Show product management view
  elements.managementView.style.display = "block";
}

// ----------------------------------------------------
// Product Management Handler Functions
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

  // Confirmation message warns the user about lost products
  const confirmationMessage =
    `确认删除分类 "${categoryName}" 吗？\n\n` +
    `此操作将永久删除此分类及该分类下的所有商品，数据无法恢复！`;

  if (!confirm(confirmationMessage)) {
    // User clicked "Cancel"
    console.log(`User cancelled deletion of Category ID: ${categoryId}.`);
    return;
  }

  // 1. Call IPC interface to perform deletion
  const result = await window.api.deleteCategory(categoryId);

  if (result.success) {
    const count = result.deletedProductsCount;
    let message = `分类 "${categoryName}" 删除成功！`;

    // 2. Show feedback of deletion results
    if (count > 0) {
      message += `\n已同时删除了 ${count} 个关联商品。`;
    } else {
      message += `\n该分类下没有关联商品被删除。`;
    }

    alert(message);

    // 3. Refresh interface
    renderProductManagementInterface();
  } else {
    alert(`删除分类失败: ${result.error}`);
  }
}

async function renderProductManagementInterface() {
  // 1. Set loading indicator (write DOM once)
  elements.managementView.innerHTML =
    '<button id="back-to-products-btn" class="control-btn">← 返回商品列表</button><h2>商品和分类管理</h2><p id="loading-message">加载中...</p>';

  // Fetch data (time-consuming asynchronous operation)
  const result = await window.api.getAllProductsAndCategories();

  if (!result.success) {
    // Update error message on failure
    elements.managementView.querySelector("#loading-message").textContent =
      `加载数据失败: ${result.error}`;
    return;
  }

  const { categories, products } = result.data;

  // 2. Render content to DocumentFragment for performance optimization
  const fragment = document.createDocumentFragment();

  // Header and back button
  const headerHtml =
    '<button id="back-to-products-btn" class="control-btn">← 返回商品列表</button><h2>商品和分类管理</h2>';
  const headerContainer = document.createElement("div");
  headerContainer.innerHTML = headerHtml;
  fragment.appendChild(headerContainer);

  // Render category and product areas
  const categoryArea = renderCategoryManagementList(categories);
  const productArea = renderProductManagementTable(products, categories);

  fragment.appendChild(categoryArea);
  fragment.appendChild(productArea);

  // 3. Replace content
  elements.managementView.innerHTML = "";
  elements.managementView.appendChild(fragment);

  // 4. Bind events
  bindManagementEvents();
}

function renderCategoryManagementList(categories) {
  const container = createEl("div", "management-section");

  // Title and Add button
  const header = createEl("div", "management-header");
  header.appendChild(
    createEl("h3", null, `分类管理 (${categories.length} 个)`),
  );
  const addBtn = createEl("button", null, "✚ 新增分类");
  addBtn.id = "add-category-btn";
  header.appendChild(addBtn);
  container.appendChild(header);

  // Category list
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
      "删除",
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

  // Title and Add button
  const header = createEl("div", "management-header");
  header.appendChild(createEl("h3", null, `商品管理 (${products.length} 个)`));
  const addBtn = createEl("button", null, "✚ 新增商品");
  addBtn.id = "add-product-btn";
  header.appendChild(addBtn);
  container.appendChild(header);

  // Table body
  const table = createEl("table", "product-management-table");
  const thead = createEl("thead");
  const tbody = createEl("tbody");

  // Table headers
  const headers = ["ID", "分类", "商品名", "价格 (元)", "规格", "操作"];
  const headerRow = createEl("tr");
  headers.forEach((text) => headerRow.appendChild(createEl("th", null, text)));
  thead.appendChild(headerRow);
  table.appendChild(thead);

  // Table content
  products.forEach((p) => {
    const row = createEl("tr");
    row.dataset.id = p.id;

    const category = categories.find((c) => c.id === p.category_id);
    const categoryName = category ? category.name : "未分类";
    const priceDisplay = (p.price / 100).toFixed(2);

    // Parse specifications safely
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

    // Action cell
    const actionsCell = createEl("td", "action-cell");
    const editBtn = createEl("button", "edit-product-btn danger-btn", "编辑");
    editBtn.dataset.id = p.id;
    const deleteBtn = createEl(
      "button",
      "delete-product-btn danger-btn",
      "删除",
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
 * Modal helper: Show category edit/add form
 * @param {object | null} category - category object to edit, null for add
 */
async function onEditCategory(category) {
  const result = await window.api.openCategoryModal(category);
  if (!result.success) return;
  console.log(result);
  await window.api.updateCategory(result.data);
  renderProductManagementInterface();
}

async function onAddCategory() {
  const result = await window.api.openCategoryModal(null);
  if (!result.success) return;

  await window.api.insertCategory(result);
  renderProductManagementInterface();
}

/**
 * Modal helper: Show product edit/add form
 * @param {object | null} product - product object to edit, null for add
 */
async function onEditProduct(data) {
  const result = await window.api.openProductModal(data);
  if (!result.success) return;

  await window.api.updateProduct(result.data);
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
    renderProductManagementInterface(); // Refresh list
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

  // 1. Category deletion event
  view.querySelectorAll(".delete-category-btn").forEach((btn) => {
    btn.addEventListener("click", handleCategoryDelete);
  });

  // 2. Product deletion event
  view.querySelectorAll(".delete-product-btn").forEach((btn) => {
    btn.addEventListener("click", handleProductDelete);
  });

  // 3. Other events
  view
    .querySelector("#add-category-btn")
    .addEventListener("click", () => onAddCategory());
  view
    .querySelector("#add-product-btn")
    .addEventListener("click", () => onAddProduct());
  view.querySelectorAll(".edit-category-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      // Get data from data-* attributes and pass to modal
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
 * Asynchronously load latest product and category data, update state, and render POS.
 */
async function loadDataAndRenderPOS() {
  try {
    // 1. Call IPC interface to get latest data
    const result = await window.api.getInitialData();

    if (!result.success) {
      console.error("Failed to load initial data:", result.error);
      alert("加载商品数据失败，请检查数据库连接。");
      return;
    }

    // 2. Update global state
    state.categories = result.categories;
    state.products = result.products;

    // Ensure currentCategoryId is valid or points to first category
    if (result.categories.length > 0) {
      state.currentCategoryId = result.categories[0].id;
    }

    // 3. Render POS interface
    renderCategories();
    renderProducts();
  } catch (error) {
    console.error("Error loading main interface data:", error);
  }
}

// --- Initialization and Listening ---

async function init() {
  // Bind event listeners using event delegation
  elements.categoryList.addEventListener("click", handleCategoryClick);
  elements.productGrid.addEventListener("click", handleProductClick);
  elements.cartList.addEventListener("click", handleCartControls);
  elements.checkoutBtn.addEventListener("click", handleCheckout);
  elements.showOrderHistoryBtn.addEventListener(
    "click",
    handleShowOrderHistory,
  );
  elements.showManagementBtn.addEventListener(
    "click",
    handleShowProductManagement,
  );

  // Report Modal listeners
  elements.showReportBtn.addEventListener("click", async () => {
    const result = await window.api.openExportModal();
    if (result && result.success) {
      console.log("导出任务完成，文件保存路径:", result.path);
      // 这里可以做一个 admin 界面上的小提示（可选）
    } else {
      console.log("用户取消了导出或关闭了窗口");
    }
  });

  // Initial data load
  loadDataAndRenderPOS();
}

function setupLogin() {
  // Define DOM elements
  const loginOverlay = document.getElementById("login-overlay");
  const appContainer = document.getElementById("app-container");
  const loginBtn = document.getElementById("login-btn");
  const usernameInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");
  const errorMessageEl = document.getElementById("login-error-message");

  // Bind events
  loginBtn.addEventListener("click", handleLogin);
  // Allow login on Enter key press
  passwordInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      handleLogin();
    }
  });

  // Login handler function
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
      // Login success: hide overlay and show app content
      loginOverlay.style.display = "none";
      appContainer.style.display = "flex";

      init();
    } else {
      errorMessageEl.textContent = result.error;
      passwordInput.value = ""; // Clear password input
      loginBtn.disabled = false;
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  setupLogin();
});
