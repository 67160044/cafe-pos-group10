/**
 * Whatever Cafe POS - Menu & Stock Management Screen Logic
 */

document.addEventListener("DOMContentLoaded", async () => {
  // กำหนดสิทธิ์: ดูได้เฉพาะบทบาท Manager เท่านั้น
  if (!Auth.requireRolePage("manager")) return;
  await Auth.renderNavbar("menu");

  let menuList = [];

  const menuTableBody = document.getElementById("menuTableBody");
  const menuSearch = document.getElementById("menuSearch");
  const catFilter = document.getElementById("catFilter");
  const stockFilter = document.getElementById("stockFilter");
  const itemCountText = document.getElementById("itemCountText");

  // KPI Elements
  const kpiTotalMenus = document.getElementById("kpiTotalMenus");
  const kpiInStock = document.getElementById("kpiInStock");
  const kpiLowStock = document.getElementById("kpiLowStock");
  const kpiOutOfStock = document.getElementById("kpiOutOfStock");

  // Modal Elements
  const menuFormModal = document.getElementById("menuFormModal");
  const menuForm = document.getElementById("menuForm");
  const menuModalTitle = document.getElementById("menuModalTitle");
  const formMenuId = document.getElementById("formMenuId");
  const formName = document.getElementById("formName");
  const formCategory = document.getElementById("formCategory");
  const formPrice = document.getElementById("formPrice");
  const formStock = document.getElementById("formStock");
  const btnSaveMenu = document.getElementById("btnSaveMenu");

  function getDrinkEmoji(name) {
    const n = String(name).toLowerCase();
    if (n.includes("ชาไทย") || n.includes("ชานม") || n.includes("ไข่มุก")) return "🧋";
    if (n.includes("ชาเขียว") || n.includes("มัทฉะ") || n.includes("ชา")) return "🍵";
    if (n.includes("ลาเต้") || n.includes("คาปู") || n.includes("อเมริกาโน่") || n.includes("เอสเปรสโซ่") || n.includes("กาแฟ")) return "☕";
    if (n.includes("โกโก้") || n.includes("นม") || n.includes("ช็อกโกแลต")) return "🥛";
    return "🥤";
  }

  const CAT_MAP = {
    1: "ชา",
    2: "กาแฟ",
    3: "นม/โกโก้",
    4: "อื่น ๆ",
  };

  async function loadMenu() {
    const branchId = Auth.getBranchId();
    menuTableBody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center" style="padding: 40px; color: var(--wn-gray);">
          กำลังโหลดข้อมูลเมนู...
        </td>
      </tr>
    `;

    const res = await Auth.api("GET", `/api/menu?branchId=${branchId}`);
    if (!res.ok) {
      menuTableBody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center" style="padding: 40px; color: var(--wn-danger);">
            ไม่สามารถโหลดข้อมูลได้: ${res.error || "เกิดข้อผิดพลาด"}
          </td>
        </tr>
      `;
      return;
    }

    menuList = res.data || [];
    updateKPIs();
    renderTable();
  }

  function updateKPIs() {
    const total = menuList.length;
    const inStock = menuList.filter((m) => Number(m.stock_quantity) >= 10).length;
    const lowStock = menuList.filter((m) => Number(m.stock_quantity) > 0 && Number(m.stock_quantity) < 10).length;
    const outOfStock = menuList.filter((m) => Number(m.stock_quantity) <= 0).length;

    kpiTotalMenus.textContent = total;
    kpiInStock.textContent = inStock;
    kpiLowStock.textContent = lowStock;
    kpiOutOfStock.textContent = outOfStock;
  }

  function renderTable() {
    const query = menuSearch.value.trim().toLowerCase();
    const cat = catFilter.value;
    const stockStatus = stockFilter.value;

    const filtered = menuList.filter((item) => {
      const matchQuery = !query || item.name.toLowerCase().includes(query);
      const matchCat = cat === "all" || String(item.category_id) === String(cat);
      const stock = Number(item.stock_quantity || 0);

      let matchStock = true;
      if (stockStatus === "low") {
        matchStock = stock > 0 && stock < 10;
      } else if (stockStatus === "out") {
        matchStock = stock <= 0;
      }

      return matchQuery && matchCat && matchStock;
    });

    itemCountText.textContent = filtered.length;

    if (filtered.length === 0) {
      menuTableBody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center" style="padding: 40px; color: var(--wn-gray);">
            ไม่พบรายการเมนูที่ตรงกับเงื่อนไข
          </td>
        </tr>
      `;
      return;
    }

    menuTableBody.innerHTML = filtered
      .map((item) => {
        const stock = Number(item.stock_quantity || 0);
        let statusBadge = `<span class="wn-stock-badge in-stock">พร้อมขาย</span>`;
        if (stock <= 0) {
          statusBadge = `<span class="wn-stock-badge out-of-stock">สินค้าหมด</span>`;
        } else if (stock < 10) {
          statusBadge = `<span class="wn-stock-badge low-stock">ใกล้หมด</span>`;
        }

        const catName = item.category_name || CAT_MAP[item.category_id] || "อื่น ๆ";

        return `
          <tr>
            <td style="font-weight: 600; color: var(--wn-gray);">#${item.menu_id}</td>
            <td>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 20px;">${getDrinkEmoji(item.name)}</span>
                <span style="font-weight: 600;">${item.name}</span>
              </div>
            </td>
            <td><span style="background: #f1f5f9; padding: 3px 8px; border-radius: 4px; font-size: 12px;">${catName}</span></td>
            <td class="text-right" style="font-weight: 700; color: var(--wn-green);">฿${Number(item.price).toFixed(2)}</td>
            <td class="text-center" style="font-weight: 600;">${stock} แก้ว</td>
            <td>${statusBadge}</td>
            <td class="text-right">
              <button type="button" class="wn-btn wn-btn-secondary btn-edit-menu" data-id="${item.menu_id}" style="padding: 4px 10px; font-size: 12px;">
                ✏️ แก้ไข
              </button>
              <button type="button" class="wn-btn wn-btn-outline-danger btn-del-menu" data-id="${item.menu_id}" style="padding: 4px 8px; font-size: 12px;">
                🗑️
              </button>
            </td>
          </tr>
        `;
      })
      .join("");

    // Edit Listeners
    menuTableBody.querySelectorAll(".btn-edit-menu").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = Number(btn.dataset.id);
        const item = menuList.find((m) => m.menu_id === id);
        if (!item) return;
        openEditModal(item);
      });
    });

    // Delete Listeners
    menuTableBody.querySelectorAll(".btn-del-menu").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = Number(btn.dataset.id);
        const item = menuList.find((m) => m.menu_id === id);
        if (!item) return;
        deleteMenu(item);
      });
    });
  }

  // Filter Listeners
  menuSearch.addEventListener("input", renderTable);
  catFilter.addEventListener("change", renderTable);
  stockFilter.addEventListener("change", renderTable);

  window.addEventListener("branchChanged", () => {
    loadMenu();
    Auth.showToast("เปลี่ยนสาขาเรียบร้อยแล้ว", "info");
  });

  // Modal Handlers
  function openAddModal() {
    formMenuId.value = "";
    menuModalTitle.textContent = "เพิ่มเมนูใหม่";
    formName.value = "";
    formCategory.value = "2";
    formPrice.value = "";
    formStock.value = "20";
    menuFormModal.classList.remove("hidden");
    formName.focus();
  }

  function openEditModal(item) {
    formMenuId.value = item.menu_id;
    menuModalTitle.textContent = `แก้ไขเมนู: ${item.name}`;
    formName.value = item.name;
    formCategory.value = item.category_id;
    formPrice.value = Number(item.price);
    formStock.value = Number(item.stock_quantity);
    menuFormModal.classList.remove("hidden");
    formName.focus();
  }

  function closeModal() {
    menuFormModal.classList.add("hidden");
  }

  document.getElementById("btnOpenAddMenu").addEventListener("click", openAddModal);
  document.getElementById("btnCloseMenuModal").addEventListener("click", closeModal);
  document.getElementById("btnCancelMenuModal").addEventListener("click", closeModal);

  // Submit Menu Form (Add / Edit)
  menuForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const branchId = Auth.getBranchId();
    const id = formMenuId.value ? Number(formMenuId.value) : null;
    const name = formName.value.trim();
    const categoryId = Number(formCategory.value);
    const price = parseFloat(formPrice.value);
    const stockQuantity = parseInt(formStock.value, 10);

    if (!name || isNaN(price) || price <= 0 || isNaN(stockQuantity) || stockQuantity < 0) {
      Auth.showToast("กรุณากรอกข้อมูลให้ครบถ้วนและถูกต้อง", "warning");
      return;
    }

    btnSaveMenu.disabled = true;
    btnSaveMenu.textContent = "กำลังบันทึก...";

    let res;
    if (id) {
      // Edit
      res = await Auth.api("PUT", `/api/menu/${id}`, {
        branchId,
        categoryId,
        name,
        price,
        stockQuantity,
      });
    } else {
      // Create
      res = await Auth.api("POST", "/api/menu", {
        branchId,
        categoryId,
        name,
        price,
        stockQuantity,
      });
    }

    btnSaveMenu.disabled = false;
    btnSaveMenu.textContent = "บันทึกข้อมูล";

    if (!res.ok) {
      Auth.showToast(res.error || "เกิดข้อผิดพลาดในการบันทึก", "error");
      return;
    }

    closeModal();
    Auth.showToast(id ? "แก้ไขเมนูสำเร็จ" : "เพิ่มเมนูใหม่สำเร็จ", "info");
    loadMenu();
  });

  // Delete Menu with UI Confirmation Modal
  async function deleteMenu(item) {
    const confirmed = await Auth.confirmDeleteMenu(item.name);
    if (!confirmed) {
      return;
    }

    const branchId = Auth.getBranchId();
    const res = await Auth.api("DELETE", `/api/menu/${item.menu_id}?branchId=${branchId}`);
    if (!res.ok) {
      Auth.showToast(res.error || "ไม่สามารถลบเมนูได้", "error");
      return;
    }

    Auth.showToast(`ลบเมนู "${item.name}" เรียบร้อยแล้ว`, "info");
    loadMenu();
  }

  // Initial Load
  loadMenu();
});
