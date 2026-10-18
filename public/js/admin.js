/**
 * Whatever Cafe POS - Admin Management Portal Controller
 * ควบคุม:
 * 1. จัดการพนักงานสาขา และสิทธิ์เข้าถึง (ยกเว้น Manager)
 * 2. จัดการระบบสมาชิกและโปรโมชั่น Cafe Club
 * 3. จัดการสาขาและข้อมูลร้าน (Multi-branch HQ)
 */

document.addEventListener("DOMContentLoaded", async () => {
  // 1. ตรวจสอบสิทธิ์ Admin สูงสุด
  if (!Auth.requireRolePage(["admin"])) {
    return;
  }

  // 2. เรนเดอร์ Navbar ของ Admin
  await Auth.renderNavbar("admin");

  // State Management
  let currentTab = "panelStaff";
  let branches = [];
  let staffList = [];
  let memberList = [];

  // DOM Elements
  const tabStaff = document.getElementById("tabStaff");
  const tabMembers = document.getElementById("tabMembers");
  const tabBranches = document.getElementById("tabBranches");

  const panelStaff = document.getElementById("panelStaff");
  const panelMembers = document.getElementById("panelMembers");
  const panelBranches = document.getElementById("panelBranches");

  const btnMainAdd = document.getElementById("btnMainAdd");

  // KPI Elements
  const kpiBranchesCount = document.getElementById("kpiBranchesCount");
  const kpiStaffCount = document.getElementById("kpiStaffCount");
  const kpiMembersCount = document.getElementById("kpiMembersCount");

  const tabStaffCount = document.getElementById("tabStaffCount");
  const tabMembersCount = document.getElementById("tabMembersCount");
  const tabBranchesCount = document.getElementById("tabBranchesCount");

  // Staff Elements
  const searchStaff = document.getElementById("searchStaff");
  const filterStaffBranch = document.getElementById("filterStaffBranch");
  const staffTableBody = document.getElementById("staffTableBody");
  const staffTotalText = document.getElementById("staffTotalText");

  // Member Elements
  const searchMember = document.getElementById("searchMember");
  const memberTableBody = document.getElementById("memberTableBody");
  const memberTotalText = document.getElementById("memberTotalText");

  // Branch Elements
  const branchGrid = document.getElementById("branchGrid");

  // Modals
  const staffModal = document.getElementById("staffModal");
  const staffForm = document.getElementById("staffForm");
  const staffModalTitle = document.getElementById("staffModalTitle");
  const staffFormId = document.getElementById("staffFormId");
  const staffFormName = document.getElementById("staffFormName");
  const staffFormEmail = document.getElementById("staffFormEmail");
  const staffFormPassword = document.getElementById("staffFormPassword");
  const staffPasswordHint = document.getElementById("staffPasswordHint");
  const staffFormBranch = document.getElementById("staffFormBranch");
  const staffFormRole = document.getElementById("staffFormRole");
  const staffBranchGroup = document.getElementById("staffBranchGroup");
  const staffRoleGroup = document.getElementById("staffRoleGroup");
  const staffAdminNotice = document.getElementById("staffAdminNotice");
  const btnSaveStaff = document.getElementById("btnSaveStaff");
  const btnCloseStaffModal = document.getElementById("btnCloseStaffModal");
  const btnCancelStaffModal = document.getElementById("btnCancelStaffModal");

  const memberModal = document.getElementById("memberModal");
  const memberForm = document.getElementById("memberForm");
  const memberModalTitle = document.getElementById("memberModalTitle");
  const memberFormId = document.getElementById("memberFormId");
  const memberFormName = document.getElementById("memberFormName");
  const memberFormPhone = document.getElementById("memberFormPhone");
  const memberFormPoints = document.getElementById("memberFormPoints");
  const memberFormDiscount = document.getElementById("memberFormDiscount");
  const btnCloseMemberModal = document.getElementById("btnCloseMemberModal");
  const btnCancelMemberModal = document.getElementById("btnCancelMemberModal");

  const branchModal = document.getElementById("branchModal");
  const branchForm = document.getElementById("branchForm");
  const branchModalTitle = document.getElementById("branchModalTitle");
  const branchFormId = document.getElementById("branchFormId");
  const branchFormName = document.getElementById("branchFormName");
  const branchFormAddress = document.getElementById("branchFormAddress");
  const btnCloseBranchModal = document.getElementById("btnCloseBranchModal");
  const btnCancelBranchModal = document.getElementById("btnCancelBranchModal");

  // ==========================================================================
  // Data Fetching & Initializer
  // ==========================================================================

  async function loadBranches() {
    try {
      const res = await Auth.api("GET", "/api/admin/branches");
      if (res.ok && res.data.success) {
        branches = res.data.branches || [];
        renderBranchOptions();
        renderBranchGrid();
        kpiBranchesCount.textContent = branches.length;
        tabBranchesCount.textContent = branches.length;
      }
    } catch (err) {
      console.error("Load branches error:", err);
    }
  }

  async function loadStaff() {
    try {
      const res = await Auth.api("GET", "/api/admin/staff");
      if (res.ok && res.data.success) {
        staffList = res.data.staff || [];
        renderStaffTable();
        // นับพนักงานสาขา (cashier และ barista)
        const activeStaff = staffList.filter((s) => s.role === "cashier" || s.role === "barista");
        kpiStaffCount.textContent = activeStaff.length;
        tabStaffCount.textContent = staffList.length;
      }
    } catch (err) {
      console.error("Load staff error:", err);
    }
  }

  async function loadMembers(query = "") {
    try {
      const url = query ? `/api/admin/members?q=${encodeURIComponent(query)}` : "/api/admin/members";
      const res = await Auth.api("GET", url);
      if (res.ok && res.data.success) {
        memberList = res.data.members || [];
        renderMemberTable();
        kpiMembersCount.textContent = memberList.length;
        tabMembersCount.textContent = memberList.length;
      }
    } catch (err) {
      console.error("Load members error:", err);
    }
  }

  async function loadAll() {
    await Promise.all([loadBranches(), loadStaff(), loadMembers()]);
  }

  // ==========================================================================
  // Tab Switcher
  // ==========================================================================

  function switchTab(targetPanelId) {
    currentTab = targetPanelId;

    [tabStaff, tabMembers, tabBranches].forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.panel === targetPanelId);
    });

    panelStaff.style.display = targetPanelId === "panelStaff" ? "block" : "none";
    panelMembers.style.display = targetPanelId === "panelMembers" ? "block" : "none";
    panelBranches.style.display = targetPanelId === "panelBranches" ? "block" : "none";

    // ปรับปุ่ม Action หลักตามแท็บ
    if (targetPanelId === "panelStaff") {
      btnMainAdd.textContent = "เพิ่มพนักงาน";
      btnMainAdd.style.display = "inline-flex";
    } else if (targetPanelId === "panelMembers") {
      btnMainAdd.textContent = "เพิ่มสมาชิก";
      btnMainAdd.style.display = "inline-flex";
    } else if (targetPanelId === "panelBranches") {
      btnMainAdd.textContent = "เพิ่มสาขา";
      btnMainAdd.style.display = "inline-flex";
    }
  }

  tabStaff.addEventListener("click", () => switchTab("panelStaff"));
  tabMembers.addEventListener("click", () => switchTab("panelMembers"));
  tabBranches.addEventListener("click", () => switchTab("panelBranches"));

  btnMainAdd.addEventListener("click", () => {
    if (currentTab === "panelStaff") {
      openStaffModal();
    } else if (currentTab === "panelMembers") {
      openMemberModal();
    } else if (currentTab === "panelBranches") {
      openBranchModal();
    }
  });

  // ==========================================================================
  // 1. Staff Management (พนักงาน & สิทธิ์เข้าถึง)
  // ==========================================================================

  function renderBranchOptions() {
    // Dropdown ในฟิลเตอร์พนักงาน
    filterStaffBranch.innerHTML = '<option value="all">ทุกสาขา</option>';
    branches.forEach((b) => {
      const opt = document.createElement("option");
      opt.value = b.branch_id;
      opt.textContent = `${b.name} (#${b.branch_id})`;
      filterStaffBranch.appendChild(opt);
    });

    // Dropdown ในฟอร์มพนักงาน
    staffFormBranch.innerHTML = "";
    branches.forEach((b) => {
      const opt = document.createElement("option");
      opt.value = b.branch_id;
      opt.textContent = `${b.name} (สาขาที่ ${b.branch_id})`;
      staffFormBranch.appendChild(opt);
    });
  }

  function renderStaffTable() {
    const q = (searchStaff.value || "").trim().toLowerCase();
    const branchFilter = filterStaffBranch.value;

    const filtered = staffList.filter((s) => {
      const matchText =
        (s.name && s.name.toLowerCase().includes(q)) ||
        (s.email && s.email.toLowerCase().includes(q));

      const matchBranch =
        branchFilter === "all" ||
        s.role === "admin" ||
        String(s.branch_id) === String(branchFilter);

      return matchText && matchBranch;
    });

    staffTotalText.textContent = filtered.length;

    if (filtered.length === 0) {
      staffTableBody.innerHTML = `
        <tr>
          <td colspan="6" class="wn-empty-row">
            ไม่พบข้อมูลพนักงานที่ตรงกับเงื่อนไข
          </td>
        </tr>
      `;
      return;
    }

    const currentUser = Auth.getUser();

    staffTableBody.innerHTML = filtered
      .map((s) => {
        const isSelf = currentUser && currentUser.userId === s.user_id;
        let branchBadge = "";
        if (s.role === "admin") {
          branchBadge = '<span>ทุกสาขา</span>';
        } else {
          branchBadge = s.branch_name
            ? `<span>${escapeHtml(s.branch_name)}</span>`
            : '<span style="color: var(--wn-gray);">-</span>';
        }

        let roleBadge = "";
        if (s.role === "admin") {
          roleBadge = '<span class="wn-role-badge admin">ผู้ดูแลระบบ</span>';
        } else if (s.role === "cashier") {
          roleBadge = '<span class="wn-role-badge cashier">แคชเชียร์</span>';
        } else if (s.role === "barista") {
          roleBadge = '<span class="wn-role-badge barista">บาริสต้า</span>';
        } else {
          roleBadge = `<span class="wn-role-badge">${escapeHtml(s.role)}</span>`;
        }

        const deleteBtn = isSelf
          ? `<button type="button" class="wn-btn wn-btn-secondary" style="padding: 4px 10px; font-size: 13px;" title="ไม่สามารถลบบัญชีของตัวเองได้" disabled>ลบ</button>`
          : `<button type="button" class="wn-btn wn-btn-outline-danger btn-delete-staff" data-id="${s.user_id}" data-name="${escapeHtml(s.name)}" style="padding: 4px 10px; font-size: 13px;">ลบ</button>`;

        return `
          <tr>
            <td class="wn-id">${s.user_id}</td>
            <td>
              <div class="wn-strong">${escapeHtml(s.name)}</div>
              ${isSelf ? '<small class="wn-self-note">บัญชีของคุณ</small>' : ""}
            </td>
            <td class="wn-email">${escapeHtml(s.email)}</td>
            <td>${branchBadge}</td>
            <td class="text-center">${roleBadge}</td>
            <td class="text-right">
              <div style="display: inline-flex; gap: 6px;">
                <button type="button" class="wn-btn wn-btn-secondary btn-edit-staff" data-id="${s.user_id}" style="padding: 4px 10px; font-size: 13px;">
                  แก้ไข
                </button>
                ${deleteBtn}
              </div>
            </td>
          </tr>
        `;
      })
      .join("");

    // Attach Event Listeners
    staffTableBody.querySelectorAll(".btn-edit-staff").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = Number(btn.dataset.id);
        const item = staffList.find((s) => s.user_id === id);
        if (item) openStaffModal(item);
      });
    });

    staffTableBody.querySelectorAll(".btn-delete-staff").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = Number(btn.dataset.id);
        const name = btn.dataset.name;
        handleDeleteStaff(id, name);
      });
    });
  }

  searchStaff.addEventListener("input", renderStaffTable);
  filterStaffBranch.addEventListener("change", renderStaffTable);

  function openStaffModal(item = null) {
    if (item) {
      staffFormId.value = item.user_id;
      staffFormName.value = item.name || "";
      staffFormEmail.value = item.email || "";
      staffFormPassword.value = "";
      staffPasswordHint.textContent = "เว้นว่างไว้ถ้าไม่เปลี่ยน";

      if (item.role === "admin") {
        staffModalTitle.textContent = `แก้ไขผู้ดูแลระบบ ${item.name}`;
        if (btnSaveStaff) btnSaveStaff.textContent = "บันทึก";
        if (staffBranchGroup) staffBranchGroup.style.display = "none";
        if (staffFormBranch) staffFormBranch.required = false;
        if (staffRoleGroup) staffRoleGroup.style.display = "none";
        if (staffFormRole) staffFormRole.required = false;
        if (staffAdminNotice) staffAdminNotice.style.display = "block";
      } else {
        staffModalTitle.textContent = `แก้ไขพนักงาน ${item.name}`;
        if (btnSaveStaff) btnSaveStaff.textContent = "บันทึกพนักงาน";
        if (staffBranchGroup) staffBranchGroup.style.display = "block";
        if (staffFormBranch) {
          staffFormBranch.required = true;
          staffFormBranch.value = item.branch_id || (branches[0] ? branches[0].branch_id : 1);
        }
        if (staffRoleGroup) staffRoleGroup.style.display = "block";
        if (staffFormRole) {
          staffFormRole.required = true;
          staffFormRole.value = item.role === "barista" ? "barista" : "cashier";
        }
        if (staffAdminNotice) staffAdminNotice.style.display = "none";
      }
    } else {
      staffModalTitle.textContent = "เพิ่มพนักงาน";
      if (btnSaveStaff) btnSaveStaff.textContent = "บันทึกพนักงาน";
      staffFormId.value = "";
      staffForm.reset();
      staffPasswordHint.textContent = "อย่างน้อย 4 ตัวอักษร";

      if (staffBranchGroup) staffBranchGroup.style.display = "block";
      if (staffFormBranch) {
        staffFormBranch.required = true;
        if (branches.length > 0) staffFormBranch.value = branches[0].branch_id;
      }
      if (staffRoleGroup) staffRoleGroup.style.display = "block";
      if (staffFormRole) {
        staffFormRole.required = true;
        staffFormRole.value = "cashier";
      }
      if (staffAdminNotice) staffAdminNotice.style.display = "none";
    }
    staffModal.classList.remove("hidden");
    staffFormName.focus();
  }

  function closeStaffModal() {
    staffModal.classList.add("hidden");
  }

  btnCloseStaffModal.addEventListener("click", closeStaffModal);
  btnCancelStaffModal.addEventListener("click", closeStaffModal);

  staffForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const id = staffFormId.value;
    const name = staffFormName.value.trim();
    const email = staffFormEmail.value.trim();
    const password = staffFormPassword.value.trim();

    if (!name || !email) {
      Auth.showToast("กรุณากรอกชื่อและอีเมลให้ครบถ้วน", "warning");
      return;
    }

    if (!id && !password) {
      Auth.showToast("กรุณากำหนดรหัสผ่านสำหรับพนักงานใหม่", "warning");
      return;
    }

    const isEditingAdmin = staffBranchGroup && staffBranchGroup.style.display === "none";
    const payload = {
      name,
      email,
    };
    if (!isEditingAdmin) {
      payload.branchId = Number(staffFormBranch.value);
      if (staffFormRole) {
        payload.role = staffFormRole.value === "barista" ? "barista" : "cashier";
      }
    }
    if (password) {
      payload.password = password;
    }

    const btnSubmit = document.getElementById("btnSaveStaff");
    btnSubmit.disabled = true;
    btnSubmit.textContent = "กำลังบันทึก...";

    try {
      let res;
      if (id) {
        res = await Auth.api("PUT", `/api/admin/staff/${id}`, payload);
      } else {
        res = await Auth.api("POST", "/api/admin/staff", payload);
      }

      if (res.ok && res.data.success) {
        Auth.showToast(res.data.message || "บันทึกข้อมูลพนักงานสำเร็จ", "info");
        closeStaffModal();
        await loadStaff();
      } else {
        Auth.showToast(res.error || "เกิดข้อผิดพลาดในการบันทึก", "error");
      }
    } finally {
      btnSubmit.disabled = false;
      btnSubmit.textContent = "บันทึกพนักงาน";
    }
  });

  async function handleDeleteStaff(id, name) {
    const ok = await Auth.confirmModal({
      title: "ยืนยันการลบบัญชีพนักงาน",
      message: `คุณต้องการลบพนักงาน "${name}" ออกจากระบบ Whatever Cafe หรือไม่?`,
      subtext: "ประวัติรายการขายในอดีตของพนักงานท่านนี้จะยังคงถูกบันทึกไว้อย่างถูกต้อง",
            confirmText: "ลบบัญชีนี้",
      cancelText: "ยกเลิก",
      type: "danger",
    });

    if (!ok) return;

    const res = await Auth.api("DELETE", `/api/admin/staff/${id}`);
    if (res.ok && res.data.success) {
      Auth.showToast(res.data.message || "ลบพนักงานเรียบร้อยแล้ว", "info");
      await loadStaff();
    } else {
      Auth.showToast(res.error || "ไม่สามารถลบพนักงานได้", "error");
    }
  }

  // ==========================================================================
  // 2. Member & Promotion Management (สมาชิก & โปรโมชั่น Cafe Club)
  // ==========================================================================

  function renderMemberTable() {
    const q = (searchMember.value || "").trim().toLowerCase();

    const filtered = memberList.filter((m) => {
      return (
        (m.name && m.name.toLowerCase().includes(q)) ||
        (m.phone && m.phone.includes(q))
      );
    });

    memberTotalText.textContent = filtered.length;

    if (filtered.length === 0) {
      memberTableBody.innerHTML = `
        <tr>
          <td colspan="7" class="wn-empty-row">
            ไม่พบข้อมูลสมาชิก Cafe Club ที่ตรงกับการค้นหา
          </td>
        </tr>
      `;
      return;
    }

    memberTableBody.innerHTML = filtered
      .map((m) => {
        const ratePercent = Math.round(Number(m.discount_rate || 0.05) * 100);
        let discountBadge = `<span class="wn-role-badge">${ratePercent}%</span>`;
        if (ratePercent >= 15) {
          discountBadge = `<span class="wn-role-badge admin">${ratePercent}% Platinum</span>`;
        } else if (ratePercent >= 10) {
          discountBadge = `<span class="wn-role-badge barista">${ratePercent}% Gold</span>`;
        }

        const formattedPhone = formatPhone(m.phone);
        const joinDate = m.joined_at ? new Date(m.joined_at).toLocaleDateString("th-TH") : "-";

        return `
          <tr>
            <td class="wn-id">${m.member_id}</td>
            <td class="wn-strong">${escapeHtml(m.name)}</td>
            <td>${formattedPhone}</td>
            <td class="text-center">
              <span class="wn-points">${Number(m.points || 0).toLocaleString()}</span>
            </td>
            <td class="text-center">${discountBadge}</td>
            <td class="wn-muted">${joinDate}</td>
            <td class="text-right">
              <div style="display: inline-flex; gap: 6px;">
                <button type="button" class="wn-btn wn-btn-secondary btn-edit-member" data-id="${m.member_id}" style="padding: 4px 10px; font-size: 13px;">
                  แก้ไข
                </button>
                <button type="button" class="wn-btn wn-btn-outline-danger btn-delete-member" data-id="${m.member_id}" data-name="${escapeHtml(m.name)}" style="padding: 4px 10px; font-size: 13px;">
                  ลบ
                </button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");

    // Attach Event Listeners
    memberTableBody.querySelectorAll(".btn-edit-member").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = Number(btn.dataset.id);
        const item = memberList.find((m) => m.member_id === id);
        if (item) openMemberModal(item);
      });
    });

    memberTableBody.querySelectorAll(".btn-delete-member").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = Number(btn.dataset.id);
        const name = btn.dataset.name;
        handleDeleteMember(id, name);
      });
    });
  }

  searchMember.addEventListener("input", () => {
    renderMemberTable();
  });

  function openMemberModal(item = null) {
    if (item) {
      memberModalTitle.textContent = `แก้ไขสมาชิก ${item.name}`;
      memberFormId.value = item.member_id;
      memberFormName.value = item.name || "";
      memberFormPhone.value = item.phone || "";
      memberFormPoints.value = item.points || 0;
      memberFormDiscount.value = Number(item.discount_rate || 0.05).toFixed(2);
    } else {
      memberModalTitle.textContent = "เพิ่มสมาชิก";
      memberFormId.value = "";
      memberForm.reset();
      memberFormPoints.value = 0;
      memberFormDiscount.value = "0.05";
    }
    memberModal.classList.remove("hidden");
    memberFormName.focus();
  }

  function closeMemberModal() {
    memberModal.classList.add("hidden");
  }

  btnCloseMemberModal.addEventListener("click", closeMemberModal);
  btnCancelMemberModal.addEventListener("click", closeMemberModal);

  memberForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const id = memberFormId.value;
    const name = memberFormName.value.trim();
    const phone = memberFormPhone.value.trim();
    const points = Number(memberFormPoints.value) || 0;
    const parsedDiscount = parseFloat(memberFormDiscount.value);
    const discountRate = Number.isNaN(parsedDiscount) ? 0.05 : parsedDiscount;

    if (!name || !phone) {
      Auth.showToast("กรุณากรอกชื่อและเบอร์โทรศัพท์", "warning");
      return;
    }

    if (!/^\d{10}$/.test(phone)) {
      Auth.showToast("เบอร์โทรศัพท์ต้องเป็นตัวเลข 10 หลัก", "warning");
      return;
    }

    const payload = {
      name,
      phone,
      points,
      discountRate,
    };

    const btnSubmit = document.getElementById("btnSaveMember");
    btnSubmit.disabled = true;
    btnSubmit.textContent = "กำลังบันทึก...";

    try {
      let res;
      if (id) {
        res = await Auth.api("PUT", `/api/admin/members/${id}`, payload);
      } else {
        res = await Auth.api("POST", "/api/admin/members", payload);
      }

      if (res.ok && res.data.success) {
        Auth.showToast(res.data.message || "บันทึกข้อมูลสมาชิกสำเร็จ", "info");
        closeMemberModal();
        await loadMembers();
      } else {
        Auth.showToast(res.error || "เกิดข้อผิดพลาดในการบันทึก", "error");
      }
    } finally {
      btnSubmit.disabled = false;
      btnSubmit.textContent = "บันทึกสมาชิก";
    }
  });

  async function handleDeleteMember(id, name) {
    const ok = await Auth.confirmModal({
      title: "ยืนยันการลบสมาชิก Cafe Club",
      message: `คุณต้องการลบสมาชิก "${name}" หรือไม่?`,
      subtext: "สิทธิประโยชน์ ส่วนลด 5% และแต้มสะสมทั้งหมดจะถูกยกเลิก",
            confirmText: "ลบสมาชิกนี้",
      cancelText: "ยกเลิก",
      type: "danger",
    });

    if (!ok) return;

    const res = await Auth.api("DELETE", `/api/admin/members/${id}`);
    if (res.ok && res.data.success) {
      Auth.showToast(res.data.message || "ลบสมาชิกเรียบร้อยแล้ว", "info");
      await loadMembers();
    } else {
      Auth.showToast(res.error || "ไม่สามารถลบสมาชิกได้", "error");
    }
  }

  // ==========================================================================
  // 3. Branch Management (จัดการสาขาและข้อมูลร้าน)
  // ==========================================================================

  function renderBranchGrid() {
    if (branches.length === 0) {
      branchGrid.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 30px; text-align: center; color: var(--wn-gray); background: #ffffff; border-radius: var(--wn-radius);">
          ยังไม่มีข้อมูลสาขาในระบบ
        </div>
      `;
      return;
    }

    branchGrid.innerHTML = branches
      .map((b) => {
        return `
          <div class="wn-branch-card">
            <div>
              <div class="wn-branch-card-title">
                <span>${escapeHtml(b.name)}</span>
                <span class="wn-role-badge">รหัส ${b.branch_id}</span>
              </div>
              <div class="wn-branch-card-address">
                ${escapeHtml(b.address || "ยังไม่ได้ใส่ที่อยู่")}
              </div>
            </div>

            <div>
              <div class="wn-branch-stats">
                <div class="wn-branch-stat-item">
                  <span>พนักงาน</span>
                  <strong>${Number(b.staff_count || 0)} <small>คน</small></strong>
                </div>
                <div class="wn-branch-stat-item">
                  <span>เมนูที่ขาย</span>
                  <strong>${Number(b.menu_count || 0)} <small>รายการ</small></strong>
                </div>
              </div>

              <button type="button" class="wn-btn wn-btn-secondary btn-edit-branch" data-id="${b.branch_id}" style="width: 100%;">
                แก้ไขสาขา
              </button>
            </div>
          </div>
        `;
      })
      .join("");

    branchGrid.querySelectorAll(".btn-edit-branch").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = Number(btn.dataset.id);
        const item = branches.find((b) => b.branch_id === id);
        if (item) openBranchModal(item);
      });
    });
  }

  function openBranchModal(item = null) {
    if (item) {
      branchModalTitle.textContent = `แก้ไขสาขา${item.name}`;
      branchFormId.value = item.branch_id;
      branchFormName.value = item.name || "";
      branchFormAddress.value = item.address || "";
    } else {
      branchModalTitle.textContent = "เพิ่มสาขา";
      branchFormId.value = "";
      branchForm.reset();
    }
    branchModal.classList.remove("hidden");
    branchFormName.focus();
  }

  function closeBranchModal() {
    branchModal.classList.add("hidden");
  }

  btnCloseBranchModal.addEventListener("click", closeBranchModal);
  btnCancelBranchModal.addEventListener("click", closeBranchModal);

  branchForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const id = branchFormId.value;
    const name = branchFormName.value.trim();
    const address = branchFormAddress.value.trim();

    if (!name) {
      Auth.showToast("กรุณาระบุชื่อสาขา", "warning");
      return;
    }

    const payload = { name, address };

    const btnSubmit = document.getElementById("btnSaveBranch");
    btnSubmit.disabled = true;
    btnSubmit.textContent = "กำลังบันทึก...";

    try {
      let res;
      if (id) {
        res = await Auth.api("PUT", `/api/admin/branches/${id}`, payload);
      } else {
        res = await Auth.api("POST", "/api/admin/branches", payload);
      }

      if (res.ok && res.data.success) {
        Auth.showToast(res.data.message || "บันทึกข้อมูลสาขาสำเร็จ", "info");
        closeBranchModal();
        await loadBranches();
      } else {
        Auth.showToast(res.error || "เกิดข้อผิดพลาดในการบันทึก", "error");
      }
    } finally {
      btnSubmit.disabled = false;
      btnSubmit.textContent = "บันทึกสาขา";
    }
  });

  // ==========================================================================
  // Helper Utilities
  // ==========================================================================

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatPhone(phone) {
    if (!phone) return "-";
    const clean = String(phone).replace(/\D/g, "");
    if (clean.length === 10) {
      return `${clean.slice(0, 3)}-${clean.slice(3, 6)}-${clean.slice(6)}`;
    }
    return phone;
  }

  // Keyboard shortcut: Escape to close modals
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeStaffModal();
      closeMemberModal();
      closeBranchModal();
    }
  });

  // Start initialization
  await loadAll();
});
