/**
 * Whatever Cafe POS - Shared Authentication & Page Guard Service
 * กำหนดสิทธิ์ตามเงื่อนไข:
 * - cashier : ดูได้เฉพาะหน้า /order.html (ขายหน้าร้าน) ล็อกสาขาตามพนักงาน ไม่สามารถเปลี่ยนสาขาได้ ไม่มี Navbar เปลี่ยนหน้า
 * - admin   : ดูได้เฉพาะหน้า /report.html (รายงานยอดขาย) ล็อกสาขาตามพนักงาน ไม่สามารถเปลี่ยนสาขาได้ ไม่มี Navbar เปลี่ยนหน้า
 * - manager : สามารถดู report ได้ของทุกสาขา และจัดการเมนู & สต็อก สามารถกดเปลี่ยนสาขาได้
 */

const Auth = {
  // Escape text before it goes into innerHTML (names come from the database)
  escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  },

  // Coffee-cup mark shown inside the orange circle in the top bar
  brandMarkSvg:
    '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M16 11h1.5a2.5 2.5 0 0 1 0 5H16"/><path d="M8 3.5c-.8 1 .8 2 0 3M12 3.5c-.8 1 .8 2 0 3"/></svg>',

  getToken() {
    try {
      const params = new URLSearchParams(window.location.search);
      const qToken = params.get("token");
      if (qToken) {
        localStorage.setItem("wn_token", qToken);
        return qToken;
      }
    } catch {}
    return localStorage.getItem("wn_token") || null;
  },

  getUser() {
    try {
      const params = new URLSearchParams(window.location.search);
      const qUser = params.get("user");
      if (qUser) {
        const parsed = JSON.parse(decodeURIComponent(qUser));
        localStorage.setItem("wn_user", JSON.stringify(parsed));
        return parsed;
      }
    } catch {}
    try {
      const data = localStorage.getItem("wn_user");
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  getBranchId() {
    const user = this.getUser();
    // Cashier และ Barista ล็อกตามสาขาที่ตนเองประจำการ
    if (user && (user.role === "cashier" || user.role === "barista")) {
      return user.branchId ? Number(user.branchId) : 1;
    }
    // Admin (HQ) และ Manager สามารถเลือกดูได้ทุกสาขา
    const saved = localStorage.getItem("wn_branch_id");
    if (saved) return Number(saved);
    return user?.branchId ? Number(user.branchId) : 1;
  },

  setBranchId(id) {
    const user = this.getUser();
    if (user && (user.role === "cashier" || user.role === "barista")) {
      return;
    }
    localStorage.setItem("wn_branch_id", String(id));
  },

  setSession(token, user) {
    localStorage.setItem("wn_token", token);
    localStorage.setItem("wn_user", JSON.stringify(user));
    if (user.branchId) {
      localStorage.setItem("wn_branch_id", String(user.branchId));
    }
  },

  logout() {
    localStorage.removeItem("wn_token");
    localStorage.removeItem("wn_user");
    window.location.href = "/login.html";
  },

  requireAuth() {
    const token = this.getToken();
    const user = this.getUser();
    if (!token || !user) {
      window.location.href = "/login.html";
      return false;
    }
    return true;
  },

  getRoleHomePage(role) {
    if (role === "cashier") return "/order.html";
    if (role === "barista") return "/barista.html";
    if (role === "manager") return "/menu.html";
    if (role === "admin") return "/admin.html";
    return "/login.html";
  },

  getRolePageTitle(role, pageName = "") {
    if (role === "cashier") return "ขายหน้าร้าน";
    if (role === "barista") return "บาร์";
    if (role === "admin") return "สำนักงานใหญ่";
    return "";
  },

  getRoleLabel(role) {
    const labels = {
      cashier: "แคชเชียร์",
      barista: "บาริสต้า",
      manager: "ผู้จัดการร้าน",
      admin: "ผู้ดูแลระบบ",
    };
    return labels[role] || role;
  },

  // ตรวจสอบสิทธิ์เฉพาะเจาะจงของหน้านั้น ๆ
  requireRolePage(allowedRoles) {
    if (!this.requireAuth()) return false;
    const user = this.getUser();
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

    if (!roles.includes(user.role)) {
      const roleLabels = {
        cashier: "Cashier (ขายหน้าร้าน)",
        barista: "Barista (บาริสต้า - คิวเตรียมเครื่องดื่ม)",
        manager: "Manager (จัดการเมนู & ดูรายงานทุกสาขา)",
        admin: "Admin (ผู้ดูแลระบบสูงสุด HQ - คุมพนักงาน สมาชิก และสาขา)",
      };
      const allowedText = roles.map((r) => roleLabels[r] || r).join(" หรือ ");
      const myText = roleLabels[user.role] || user.role;

      alert(
        `สิทธิ์ไม่ตรงกับหน้านี้!\nบทบาทของคุณ: ${myText}\nหน้านี้สงวนไว้สำหรับ: ${allowedText}\nระบบจะนำท่านกลับไปยังหน้าของคุณทันที`
      );
      window.location.href = this.getRoleHomePage(user.role);
      return false;
    }
    return true;
  },

  async api(method, url, body) {
    const token = this.getToken();
    const headers = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    try {
      const res = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      if (res.status === 401) {
        this.logout();
        return { ok: false, error: "Session หมดอายุ กรุณาเข้าสู่ระบบใหม่" };
      }

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { ok: false, status: res.status, error: data.error || `HTTP ${res.status}`, data };
      }
      return { ok: true, status: res.status, data };
    } catch (err) {
      return { ok: false, error: "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้" };
    }
  },

  showToast(message, type = "info") {
    let container = document.getElementById("wnToastContainer");
    if (!container) {
      container = document.createElement("div");
      container.id = "wnToastContainer";
      document.body.appendChild(container);
    }
    const toast = document.createElement("div");
    toast.className = `wn-toast ${type}`;
    toast.innerHTML = `<span>${Auth.escapeHtml(message)}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transition = "opacity 0.3s ease";
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  },

  async renderNavbar(pageName = "") {
    const header = document.getElementById("wnHeader");
    if (!header) return;

    const user = this.getUser();
    if (!user) return;

    const currentBranchId = this.getBranchId();

    // Fetch branches from API
    let branches = [
      { branch_id: 1, name: "สยาม (BTS สยาม)" },
      { branch_id: 2, name: "สีลม (BTS ศาลาแดง)" }
    ];
    try {
      const res = await fetch("/api/branches");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) branches = data;
      }
    } catch (e) {
      console.warn("Could not load branches from API", e);
    }

    const pageBadgeTitle = this.getRolePageTitle(user.role, pageName);

    // 1. จัดการส่วนสลับสาขาและแถบลิงก์:
    // - Admin: จัดการระบบ HQ เท่านั้น (ไม่เข้าถึงรายงานยอดขาย)
    // - Manager: จัดการเมนู และดูรายงานยอดขาย
    // - Cashier: ขายหน้าร้านประจำสาขา
    let branchWidgetHtml = "";
    let navLinksHtml = "";

    if (user.role === "admin") {
      branchWidgetHtml = `<div class="wn-branch-locked">ทุกสาขา</div>`;
      navLinksHtml = "";
    } else if (user.role === "manager") {
      const branchOptions = branches
        .map(
          (b) =>
            `<option value="${b.branch_id}" ${
              b.branch_id === currentBranchId ? "selected" : ""
            }>${Auth.escapeHtml(b.name)}</option>`
        )
        .join("");

      branchWidgetHtml = `
        <div class="wn-branch-select-box">
          <label for="wnNavBranch" class="wn-sr-only">สาขา</label>
          <select id="wnNavBranch" class="wn-branch-select">
            ${branchOptions}
          </select>
        </div>
      `;
      navLinksHtml = `
        <div class="wn-nav-links">
          <a href="/menu.html" class="wn-nav-item ${pageName === "menu" ? "active" : ""}" ${pageName === "menu" ? 'aria-current="page"' : ""}>
            <svg class="wn-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h11v6a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z"/><path d="M16 10h1.5a2.5 2.5 0 0 1 0 5H16"/><path d="M9 3v2M12 3v2"/></svg>
            เมนูและสต็อก
          </a>
          <a href="/report.html" class="wn-nav-item ${pageName === "report" ? "active" : ""}" ${pageName === "report" ? 'aria-current="page"' : ""}>
            <svg class="wn-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>
            ยอดขาย
          </a>
        </div>
      `;
    } else if (user.role === "barista") {
      const myBranch = branches.find((b) => b.branch_id === currentBranchId);
      const myBranchName = myBranch ? myBranch.name : user.branchName || "สาขาของฉัน";

      branchWidgetHtml = `<div class="wn-branch-locked">สาขา${this.escapeHtml(myBranchName)}</div>`;
      navLinksHtml = "";
    } else {
      const myBranch = branches.find((b) => b.branch_id === currentBranchId);
      const myBranchName = myBranch ? myBranch.name : user.branchName || "สาขาของฉัน";

      branchWidgetHtml = `<div class="wn-branch-locked">สาขา${this.escapeHtml(myBranchName)}</div>`;
    }

    header.innerHTML = `
      <nav class="wn-navbar">
        <div class="wn-brand">
          <span class="wn-brand-mark" aria-hidden="true">${this.brandMarkSvg}</span>
          <div class="wn-brand-title">Whatever <span>cafe</span></div>
          ${pageBadgeTitle ? `<div class="wn-brand-sub">${pageBadgeTitle}</div>` : ""}
        </div>

        ${navLinksHtml}

        <div class="wn-nav-right">
          <div class="wn-nav-branch">
            <svg class="wn-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>
            ${branchWidgetHtml}
          </div>

          <div class="wn-user-pill">
            <span class="wn-user-avatar" aria-hidden="true">${this.escapeHtml((user.name || "?").trim().charAt(0))}</span>
            <span class="wn-user-info">
              <span class="wn-user-name" title="${this.escapeHtml(user.name)}">${this.escapeHtml(user.name)}</span>
              <span class="wn-user-role">${this.getRoleLabel(user.role)}</span>
            </span>
          </div>

          <button id="wnBtnLogout" class="wn-btn-logout" aria-label="ออกจากระบบ">
            <svg class="wn-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 17l-5-5 5-5"/><path d="M5 12h11"/></svg>
            <span>ออกจากระบบ</span>
          </button>
        </div>
      </nav>
    `;

    // Handle branch change for manager
    if (user.role === "manager") {
      const branchSelect = document.getElementById("wnNavBranch");
      if (branchSelect) {
        branchSelect.addEventListener("change", (e) => {
          const newBranchId = Number(e.target.value);
          this.setBranchId(newBranchId);
          window.dispatchEvent(new CustomEvent("branchChanged", { detail: { branchId: newBranchId } }));
        });
      }
    }

    // Handle logout with Confirmation Modal UI
    const logoutBtn = document.getElementById("wnBtnLogout");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", async () => {
        const confirmed = await this.confirmLogout();
        if (confirmed) {
          this.logout();
        }
      });
    }
  },

  /**
   * UI หน้ายืนยันความแน่ใจ (Confirmation Modal Dialog System)
   * ใช้งานแทน window.confirm() เพื่อความสวยงาม สอดคล้องกับ Whatever Cafe POS Design System
   * @param {Object} options
   * @returns {Promise<boolean>} true เมื่อกดยืนยัน, false เมื่อกดยกเลิก
   */
  confirmModal({
    title = "ยืนยันการดำเนินการ",
    message = "คุณแน่ใจหรือไม่ที่จะดำเนินการนี้?",
    subtext = "",
    confirmText = "ยืนยัน",
    cancelText = "ยกเลิก",
    type = "primary", // 'danger' | 'warning' | 'primary'
  } = {}) {
    return new Promise((resolve) => {
      // ลบ Overlay เก่าหากมีค้างอยู่
      const oldOverlay = document.getElementById("wnConfirmOverlay");
      if (oldOverlay) oldOverlay.remove();

      const overlay = document.createElement("div");
      overlay.id = "wnConfirmOverlay";
      overlay.className = "wn-confirm-overlay";

      const btnConfirmClass =
        type === "danger"
          ? "wn-btn wn-btn-danger"
          : type === "warning"
          ? "wn-btn wn-btn-warning"
          : "wn-btn wn-btn-primary";

      overlay.innerHTML = `
        <div class="wn-confirm-modal ${type}" role="dialog" aria-modal="true" aria-labelledby="wnConfirmTitle">
          <h3 id="wnConfirmTitle" class="wn-confirm-title">${Auth.escapeHtml(title)}</h3>
          <p class="wn-confirm-message">${Auth.escapeHtml(message)}</p>
          ${subtext ? `<p class="wn-confirm-subtext">${Auth.escapeHtml(subtext)}</p>` : ""}
          <div class="wn-confirm-actions">
            <button type="button" class="wn-btn wn-btn-secondary" id="wnConfirmBtnCancel">${cancelText}</button>
            <button type="button" class="${btnConfirmClass}" id="wnConfirmBtnOk">${confirmText}</button>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);

      // Trigger animation
      requestAnimationFrame(() => {
        overlay.classList.add("active");
      });

      const btnCancel = overlay.querySelector("#wnConfirmBtnCancel");
      const btnOk = overlay.querySelector("#wnConfirmBtnOk");

      const closeDialog = (result) => {
        overlay.classList.remove("active");
        document.removeEventListener("keydown", keyHandler);
        setTimeout(() => {
          overlay.remove();
        }, 200);
        resolve(result);
      };

      const keyHandler = (e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          closeDialog(false);
        } else if (e.key === "Enter") {
          e.preventDefault();
          closeDialog(true);
        }
      };

      btnCancel.addEventListener("click", () => closeDialog(false));
      btnOk.addEventListener("click", () => closeDialog(true));
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) closeDialog(false);
      });

      document.addEventListener("keydown", keyHandler);
      btnOk.focus();
    });
  },

  /**
   * UI หน้ายืนยันออกจากระบบ (Logout Confirmation Modal)
   */
  async confirmLogout() {
    return this.confirmModal({
      title: "ยืนยันการออกจากระบบ",
      message: "คุณต้องการออกจากระบบ Whatever Cafe POS หรือไม่?",
      subtext: "เซสชันการทำงานปัจจุบันจะสิ้นสุดลง และจะต้องลงชื่อเข้าใช้ใหม่อีกครั้ง",
      confirmText: "ออกจากระบบ",
      cancelText: "ยกเลิก",
      type: "danger",
    });
  },

  /**
   * UI หน้ายืนยันล้างบิล (Clear Bill Confirmation Modal)
   */
  async confirmClearBill() {
    return this.confirmModal({
      title: "ยืนยันการล้างบิล",
      message: "คุณต้องการล้างรายการเครื่องดื่มทั้งหมดในบิลนี้หรือไม่?",
      subtext: "รายการที่เลือกไว้ทั้งหมดและสิทธิ์สมาชิกจะถูกลบออกจากบิลปัจจุบัน",
      confirmText: "ล้างบิลทันที",
      cancelText: "ยกเลิก",
      type: "danger",
    });
  },

  /**
   * UI หน้ายืนยันการลบเมนู (Delete Menu Confirmation Modal)
   */
  async confirmDeleteMenu(menuName = "") {
    return this.confirmModal({
      title: "ยืนยันการลบเมนู",
      message: `คุณต้องการลบเมนู "${menuName}" ออกจากระบบหรือไม่?`,
      subtext: "การลบจะไม่สามารถกู้คืนได้ และเมนูนี้จะไม่ปรากฏในหน้าขายหน้าร้านอีกต่อไป",
      confirmText: "ลบเมนูนี้",
      cancelText: "ยกเลิก",
      type: "danger",
    });
  },
};
