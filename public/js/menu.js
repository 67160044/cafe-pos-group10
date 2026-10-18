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
        <td colspan="7" class="wn-empty-row">
          กำลังโหลดข้อมูลเมนู...
        </td>
      </tr>
    `;

    const res = await Auth.api("GET", `/api/menu?branchId=${branchId}`);
    if (!res.ok) {
      menuTableBody.innerHTML = `
        <tr>
          <td colspan="7" class="wn-empty-row error">
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
    const inStock = menuList.filter((m) => Number(m.stockQuantity) >= 10).length;
    const lowStock = menuList.filter((m) => Number(m.stockQuantity) > 0 && Number(m.stockQuantity) < 10).length;
    const outOfStock = menuList.filter((m) => Number(m.stockQuantity) <= 0).length;

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
      const matchCat = cat === "all" || String(item.categoryId) === String(cat);
      const stock = Number(item.stockQuantity || 0);

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
          <td colspan="7" class="wn-empty-row">
            ไม่พบรายการเมนูที่ตรงกับเงื่อนไข
          </td>
        </tr>
      `;
      return;
    }

    menuTableBody.innerHTML = filtered
      .map((item) => {
        const stock = Number(item.stockQuantity || 0);
        let statusBadge = `<span class="wn-stock-badge in-stock">พร้อมขาย</span>`;
        if (stock <= 0) {
          statusBadge = `<span class="wn-stock-badge out-of-stock">สินค้าหมด</span>`;
        } else if (stock < 10) {
          statusBadge = `<span class="wn-stock-badge low-stock">ใกล้หมด</span>`;
        }

        const catName = item.categoryName || CAT_MAP[item.categoryId] || "อื่น ๆ";

        return `
          <tr>
            <td class="wn-id">${item.menuId}</td>
            <td class="wn-strong">${item.name}</td>
            <td><span class="wn-cat-tag cat-${item.categoryId}">${catName}</span></td>
            <td class="wn-money">฿${Number(item.price).toFixed(2)}</td>
            <td class="text-right">${stock}</td>
            <td>${statusBadge}</td>
            <td class="text-right">
              <div class="wn-row-actions">
                <button type="button" class="wn-btn wn-btn-secondary wn-btn-sm btn-edit-menu" data-id="${item.menuId}">แก้ไข</button>
                <button type="button" class="wn-btn wn-btn-outline-danger wn-btn-sm btn-del-menu" data-id="${item.menuId}">ลบ</button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");

    // Edit Listeners
    menuTableBody.querySelectorAll(".btn-edit-menu").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = Number(btn.dataset.id);
        const item = menuList.find((m) => m.menuId === id);
        if (!item) return;
        openEditModal(item);
      });
    });

    // Delete Listeners
    menuTableBody.querySelectorAll(".btn-del-menu").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = Number(btn.dataset.id);
        const item = menuList.find((m) => m.menuId === id);
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
    formMenuId.value = item.menuId;
    menuModalTitle.textContent = `แก้ไขเมนู: ${item.name}`;
    formName.value = item.name;
    formCategory.value = item.categoryId;
    formPrice.value = Number(item.price);
    formStock.value = Number(item.stockQuantity);
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
    btnSaveMenu.textContent = "บันทึกเมนู";

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
    const res = await Auth.api("DELETE", `/api/menu/${item.menuId}?branchId=${branchId}`);
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
