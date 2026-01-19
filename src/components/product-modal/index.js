window.api.onProductModalInit(async (data) => {
  const isEdit = !!data;
  const categoriesResult = await window.api.getAllCategories();

  if (!categoriesResult.success) {
    alert("无法加载分类列表，请稍后再试。");
    return;
  }
  const categories = categoriesResult.data;

  const titleEl = document.getElementById("modal-title");
  const errorEl = document.getElementById("error");

  const categorySelect = document.getElementById("product-category-input");
  const nameInput = document.getElementById("product-name-input");
  const priceInput = document.getElementById("product-price-input");
  const optionsInput = document.getElementById("product-options-input");

  titleEl.innerText = isEdit ? `编辑商品：${data.name}` : "新增商品";

  // Render category dropdown options
  categorySelect.innerHTML = categories
    .map(
      (cat) =>
        `<option value="${cat.id}" ${
          isEdit && data.category_id === cat.id ? "selected" : ""
        }>${cat.name}</option>`
    )
    .join("");

  if (isEdit) {
    nameInput.value = data.name;
    priceInput.value = data.price;

    try {
      const arr = JSON.parse(data.options || "[]");
      optionsInput.value = arr.join(", ");
    } catch {
      optionsInput.value = "";
    }
  }

  // Reliable focus method for Windows 7 environments
  setTimeout(() => {
    nameInput.focus();
    nameInput.selectionStart = nameInput.selectionEnd = nameInput.value.length;
  }, 50);

  document.getElementById("submit-btn").onclick = () => {
    const result = {
      id: isEdit ? data.id : null,
      category_id: parseInt(categorySelect.value),
      name: nameInput.value.trim(),
      price: parseInt(priceInput.value),
      options: optionsInput.value
        .split(",")
        .map((x) => x.trim())
        .filter((x) => x.length > 0),
    };

    if (!result.name || isNaN(result.price)) {
      errorEl.textContent = "请检查输入。";
      nameInput.focus();
      return;
    }

    window.api.closeProductModal({
      success: true,
      data: result,
    });
  };

  document.getElementById("cancel-btn").onclick = () => {
    window.api.closeProductModal({ success: false });
  };
});