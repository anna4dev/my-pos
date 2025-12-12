window.api.onCategoryModalInit((data) => {
  const isEdit = !!data;
  document.getElementById("modal-title").innerText = isEdit
    ? `编辑分类：${data.name}`
    : "新增分类";

  const input = document.getElementById("category-name");
  if (isEdit) input.value = data.name;

  // Win7 下 100% 有效的聚焦方式
  setTimeout(() => {
    input.focus();
    input.selectionStart = input.selectionEnd = input.value.length;
  }, 50);

  document.getElementById("submit-btn").onclick = () => {
    const name = input.value.trim();
    if (!name) {
      document.getElementById("error").innerText = "请输入名称";
      return;
    }

    window.api.closeCategoryModal({
      success: true,
      name,
      id: isEdit ? data.id : null,
    });
  };

  document.getElementById("cancel-btn").onclick = () => {
    window.api.closeCategoryModal({ success: false });
  };
});
