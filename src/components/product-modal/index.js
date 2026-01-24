// product-modal.js
class ProductModal extends BaseModal {
  constructor() {
    super({ apiName: "Product" });
    this.inputs = {
      category: document.getElementById("product-category-input"),
      name: document.getElementById("product-name-input"),
      price: document.getElementById("product-price-input"),
      options: document.getElementById("product-options-input"),
    };
  }

  async render(data) {
    // 1. get options for select
    const res = await window.api.getAllCategories();
    if (!res.success) return alert("分类加载失败");

    const categorySelect = this.inputs.category;
    categorySelect.length = 0;

    res.data.forEach((cat) => {
      // new Option(text, value, defaultSelected, selected)
      const isSelected = this.isEdit && data.category_id === cat.id;
      categorySelect.add(new Option(cat.name, cat.id, isSelected, isSelected));
    });

    this.el.title.textContent = this.isEdit
      ? `编辑商品：${data.name}`
      : "新增商品";

    if (this.isEdit) {
      this.inputs.name.value = data.name;
      this.inputs.category.value = data.category_id;
      this.inputs.price.value = data.price;
      try {
        const optArr = JSON.parse(data.options || "[]");
        this.inputs.options.value = optArr.join(", ");
      } catch (e) {
        this.inputs.options.value = "";
      }
    }

    this.focusInput(this.inputs.name);
  }

  handleSubmit() {
    const name = this.inputs.name.value.trim();
    const price = parseInt(this.inputs.price.value);

    if (!name || isNaN(price)) {
      return this.showError("请检查名称和价格是否正确");
    }

    const payload = {
      id: this.isEdit ? this.initData.id : null,
      category_id: parseInt(this.inputs.category.value),
      name: name,
      price: price,
      options: this.inputs.options.value
        .split(",")
        .map((v) => v.trim())
        .filter((v) => v.length > 0),
    };

    this.close({ success: true, data: payload });
  }
}

new ProductModal().init();
