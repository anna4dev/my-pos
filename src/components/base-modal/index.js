class BaseModal {
  constructor(options = {}) {
    this.apiName = options.apiName;
    this.initData = null;
    this.isEdit = false;

    // cache DOM
    this.el = {
      title: document.getElementById("modal-title"),
      error: document.getElementById("error"),
      submitBtn:
        document.getElementById("submit-btn") ||
        document.querySelector(".primary-btn"),
      cancelBtn:
        document.getElementById("cancel-btn") ||
        document.querySelector(".secondary-btn"),
    };
  }

  init() {
    if (!window.api || !window.api.onModalInit) {
      console.error(
        "Critical Error: Preload API 'onModalInit' is not defined.",
      );
      return;
    }

    window.api.onModalInit(async (data) => {
      console.log(`[${this.apiName} Modal] Initializing with data:`, data);
      this.initData = data;
      this.isEdit = !!data;

      try {
        await this.render(data);
        this.bindEvents();
        if (this.el.title) this.el.title.style.visibility = "visible";
        window.api.notifyModalReady();
      } catch (err) {
        console.error("Render failed:", err);
        this.showError("界面加载失败，请重试");
      }
    });
  }

  /**
   * rewrite by caller
   * @param {any} data
   */
  async render(data) {
    // default title
    if (this.el.title) {
      this.el.title.textContent = this.isEdit
        ? `编辑${this.apiName}`
        : `新增${this.apiName}`;
    }
  }

  /**
   * scalability
   */
  bindEvents() {
    if (this.el.submitBtn) {
      this.el.submitBtn.onclick = () => this.handleSubmit();
    }
    if (this.el.cancelBtn) {
      this.el.cancelBtn.onclick = () => this.handleCancel();
    }
  }

  /**
   * send result to parent
   * @param {Object} payload { success: boolean, data: any }
   */
  close(payload) {
    if (window.api && window.api.sendCloseModal) {
      window.api.sendCloseModal(payload);
    } else {
      console.error(
        "Critical Error: Preload method 'sendCloseModal' not found.",
      );
      // compatible
      window.close();
    }
  }

  /**
   * rewrite by caller
   */
  handleSubmit() {
    console.warn("Subclasses must implement handleSubmit()");
  }

  handleCancel() {
    this.close({ success: false });
  }

  /**
   * Win7 adaptation
   */
  focusInput(inputEl) {
    if (!inputEl) return;
    setTimeout(() => {
      inputEl.focus();
      // input to the end of text
      if (
        inputEl.tagName === "INPUT" &&
        (inputEl.type === "text" || inputEl.type === "number")
      ) {
        const len = inputEl.value.length;
        inputEl.setSelectionRange(len, len);
      }
    }, 150);
  }

  showError(msg) {
    if (this.el.error) {
      this.el.error.textContent = msg;
      this.el.error.style.display = "block";
      this.el.error.style.color = "#e74c3c";

      setTimeout(() => {
        this.el.error.textContent = "";
      }, 3000);
    } else {
      alert(msg);
    }
  }
}

window.BaseModal = BaseModal;
