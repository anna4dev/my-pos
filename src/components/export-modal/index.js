// src/components/export-modal/index.js
class ExportModal extends BaseModal {
  constructor() {
    super({ apiName: "Report" });
    this.inputs = {
      start: document.getElementById("start-date"),
      end: document.getElementById("end-date"),
    };

    // 重新指向特定 ID 的按钮
    this.el.submitBtn = document.getElementById("export-csv-btn");
    this.el.cancelBtn = document.getElementById("close-modal-btn");
  }

  async render(data) {
    // Win7 的 date input 如果没有初始值会显示 mm/dd/yyyy，体验不好
    const today = new Date().toISOString().split("T")[0];
    this.inputs.start.value = today;
    this.inputs.end.value = today;

    this.el.title.textContent = "导出销售流水";
    this.focusInput(this.inputs.start);
  }

  setLoading(isLoading, text = "导出 CSV") {
    if (!this.el.submitBtn) return;
    this.el.submitBtn.disabled = isLoading;
    this.el.submitBtn.textContent = isLoading ? "正在查询..." : text;
  }

  async handleSubmit() {
    const startDate = this.inputs.start.value;
    const endDate = this.inputs.end.value;

    if (!startDate || !endDate) {
      return this.showError("请选择日期范围");
    }

    // 转换为当天 00:00:00 到 23:59:59
    const startISO = new Date(`${startDate}T00:00:00.000Z`).toISOString();
    const endISO = new Date(`${endDate}T23:59:59.999Z`).toISOString();

    this.setLoading(true);

    try {
      const result = await window.api.getReports(startISO, endISO);

      if (result.success && result.data && result.data.length > 0) {
        const csv = this.formatDataForCsv(result.data);
        const filename = `销售流水_${startDate}_至_${endDate}.csv`;

        const saveResult = await window.api.saveCsvFile(csv, filename);

        if (saveResult.success) {
          // 导出成功直接关闭
          this.close({ success: true, path: saveResult.path });
        } else {
          // 用户取消保存不报错，只需停止 loading
          console.log("User cancelled save");
        }
      } else if (result.success && result.data?.length === 0) {
        this.showError("该日期范围内没有数据");
      } else {
        this.showError(result.error || "获取数据失败");
      }
    } catch (err) {
      this.showError("导出出错，请检查网络或数据库");
    } finally {
      this.setLoading(false);
    }
  }

  formatDataForCsv(data) {
    if (!data || data.length === 0) return "";

    // Ensure numbers in data are displayed in the correct format
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
        (row.total_amount / 100).toFixed(2), // Convert to decimal from cents
        row.product_name,
        row.category_name,
        (row.unit_price / 100).toFixed(2),
        row.quantity,
        row.options_used ? JSON.parse(row.options_used).join(";") : "",
      ]
        .map((field) => `"${String(field).replace(/"/g, '""')}"`)
        .join(","); // CSV security handling

      csvContent.push(rowData);
    });

    return csvContent.join("\n");
  }
}

// 初始化
new ExportModal().init();
