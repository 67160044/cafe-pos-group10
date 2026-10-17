/**
 * Whatever Cafe POS - Shared Authentication & Page Guard Service
 * กำหนดสิทธิ์ตามเงื่อนไข:
 * - cashier : ดูได้เฉพาะหน้า /order.html (ขายหน้าร้าน) ล็อกสาขาตามพนักงาน ไม่สามารถเปลี่ยนสาขาได้ ไม่มี Navbar เปลี่ยนหน้า
 * - admin   : ดูได้เฉพาะหน้า /report.html (รายงานยอดขาย) ล็อกสาขาตามพนักงาน ไม่สามารถเปลี่ยนสาขาได้ ไม่มี Navbar เปลี่ยนหน้า
 * - manager : สามารถดู report ได้ของทุกสาขา และจัดการเมนู & สต็อก สามารถกดเปลี่ยนสาขาได้
 */

const Auth = {
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
    if (role === "cashier") return "หน้าขายหน้าร้าน (POS)";
    if (role === "barista") return "บาร์เครื่องดื่ม (Barista KDS)";
    if (role === "admin") {
      return "หน้าควบคุมระบบ (HQ - ทุกสาขา)";
    }
    if (role === "manager") {
      return pageName === "menu" ? "หน้าจัดการเมนู & สต็อก" : "หน้ารายงานยอดขาย (ทุกสาขา)";
    }
    return "";
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
    toast.innerHTML = `<span>${message}</span>`;
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
      branchWidgetHtml = `
        <div class="wn-branch-locked" title="Admin สำนักงานใหญ่ ดูแลทุกสาขา" style="display:flex;align-items:center;gap:6px;background:rgba(242,101,34,0.18);padding:6px 14px;border-radius:var(--wn-radius);font-size:12.5px;color:#ffedd5;border:1px solid rgba(242,101,34,0.35);">
          <span>ทุกสาขา (สำนักงานใหญ่ HQ)</span>
        </div>
      `;
      navLinksHtml = "";
    } else if (user.role === "manager") {
      const branchOptions = branches
        .map(
          (b) =>
            `<option value="${b.branch_id}" ${
              b.branch_id === currentBranchId ? "selected" : ""
            }>${b.name}</option>`
        )
        .join("");

      branchWidgetHtml = `
        <div class="wn-branch-select-box">
          <label for="wnNavBranch">สาขา:</label>
          <select id="wnNavBranch" class="wn-branch-select">
            ${branchOptions}
          </select>
        </div>
      `;
      navLinksHtml = `
        <div class="wn-nav-links">
          <a href="/menu.html" class="wn-nav-item ${pageName === "menu" ? "active" : ""}">
            จัดการเมนู & สต็อก
          </a>
          <a href="/report.html" class="wn-nav-item ${pageName === "report" ? "active" : ""}">
            รายงานยอดขาย (ทุกสาขา)
          </a>
        </div>
      `;
    } else if (user.role === "barista") {
      const myBranch = branches.find((b) => b.branch_id === currentBranchId);
      const myBranchName = myBranch ? myBranch.name : user.branchName || "สาขาของฉัน";

      branchWidgetHtml = `
        <div class="wn-branch-locked" title="ล็อกตามบาร์เครื่องดื่มสาขานี้ ไม่สามารถเปลี่ยนสาขาได้" style="display:flex;align-items:center;gap:6px;background:rgba(217,119,6,0.18);padding:6px 14px;border-radius:var(--wn-radius);font-size:13px;color:#fef3c7;border:1px solid rgba(217,119,6,0.35);">
          <span>บาร์${myBranchName}</span>
          <span style="font-size:10.5px;background:rgba(217,119,6,0.3);padding:1px 6px;border-radius:4px;color:#fde68a;">Barista KDS</span>
        </div>
      `;
      navLinksHtml = "";
    } else {
      const myBranch = branches.find((b) => b.branch_id === currentBranchId);
      const myBranchName = myBranch ? myBranch.name : user.branchName || "สาขาของฉัน";

      branchWidgetHtml = `
        <div class="wn-branch-locked" title="ล็อกตามพนักงานสาขานี้ ไม่สามารถเปลี่ยนสาขาได้" style="display:flex;align-items:center;gap:6px;background:rgba(255,255,255,0.08);padding:6px 14px;border-radius:var(--wn-radius);font-size:13px;color:#cbd5e1;border:1px solid rgba(255,255,255,0.12);">
          <span>${myBranchName}</span>
          <span style="font-size:10.5px;background:rgba(255,255,255,0.15);padding:1px 6px;border-radius:4px;color:#94a3b8;">สาขาของคุณ</span>
        </div>
      `;
    }

    header.innerHTML = `
      <nav class="wn-navbar">
        <div class="wn-brand">
          <div class="wn-brand-badge">Whatever Cafe POS</div>
          <div>
            <div class="wn-brand-title">Whatever Cafe POS</div>
            <div class="wn-brand-sub">${pageBadgeTitle}</div>
          </div>
        </div>

        ${navLinksHtml}

        <div class="wn-nav-right">
          ${branchWidgetHtml}

          <div class="wn-user-pill">
            <div class="wn-user-avatar">${user.name.charAt(0) || "U"}</div>
            <div class="wn-user-info">
              <span class="wn-user-name">${user.name}</span>
              <span class="wn-role-badge ${user.role}">${user.role}</span>
            </div>
          </div>

          <button id="wnBtnLogout" class="wn-btn-logout" title="ออกจากระบบ">
            ออกจากระบบ
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
    icon = "❓",
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
        <div class="wn-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="wnConfirmTitle">
          <div class="wn-confirm-icon-wrap ${type}">
            ${icon}
          </div>
          <h3 id="wnConfirmTitle" class="wn-confirm-title">${title}</h3>
          <p class="wn-confirm-message">${message}</p>
          ${subtext ? `<p class="wn-confirm-subtext">${subtext}</p>` : ""}
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
      icon: "🚪",
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
      icon: "🗑️",
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
      icon: "⚠️",
      confirmText: "ลบเมนูนี้",
      cancelText: "ยกเลิก",
      type: "danger",
    });
  },
};
