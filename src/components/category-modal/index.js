// category-modal.js
class CategoryModal extends BaseModal {
  constructor() {
    super({ apiName: "Category" });
    this.input = document.getElementById("category-name");
  }

  async render(data) {
    this.el.title.textContent = this.isEdit
      ? `编辑分类：${data.name}`
      : "新增分类";
    if (this.isEdit) this.input.value = data.name;
    setTimeout(() => this.input.focus(), 100);
  }

  handleSubmit() {
    const name = this.input.value.trim();
    if (!name) {
      return this.showError("请输入分类名称");
    }

    this.close({
      success: true,
      data: { name, id: this.isEdit ? this.initData.id : null },
    });
  }
}

new CategoryModal().init();
