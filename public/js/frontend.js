/**
 * Cafe POS System - Unified Single Page Application Logic
 * Supports data-v="order", data-v="menu", data-v="report"
 */

// --- Helpers & Utilities ---
const $ = (id) => document.getElementById(id);

const escapeHtml = (str) =>
  String(str).replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[c])
  );

const formatNumber = (num) =>
  Number(num).toLocaleString("th-TH", {
    minimumFractionDigits: num % 1 ? 2 : 0,
    maximumFractionDigits: 2,
  });

const formatMoney = (n) =>
  Number(n).toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const formatDate = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;

function getDrinkEmoji(name) {
  const n = String(name).toLowerCase();
  if (n.includes("ชาไทย") || n.includes("ชานม") || n.includes("ไข่มุก")) return "🧋";
  if (n.includes("ชาเขียว") || n.includes("มัทฉะ") || n.includes("ชา")) return "🍵";
  if (n.includes("ลาเต้") || n.includes("คาปู") || n.includes("ร้อน")) return "☕";
  return "🥤";
}

// --- Global Constants & State ---
const CAT_MAP = { 1: "ชา", 2: "กาแฟ", 3: "นม/โกโก้", 4: "อื่น ๆ" };
const CAT_NAME_TO_ID = { ชา: 1, กาแฟ: 2, "นม/โกโก้": 3, "อื่น ๆ": 4 };

const BRANCHES = [
  { id: 1, name: "สยาม" },
  { id: 2, name: "สีลม" },
];

let MENU = [];
let editId = null;

// POS State
let selectedOrderItem = null;
let currentCustom = {
  size: "M",
  sizeExtra: 0,
  sweet: "50%",
  toppings: [],
  quantity: 1,
};
let cart = [];
let memberDiscount = 0; // 0 or 0.05
let currentMember = null;

// --- API Service ---
const setOffline = () => {
  $("note").style.display = "block";
};

async function api(method, url, body) {
  try {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    return {
      ok: res.ok,
      status: res.status,
      data: await res.json().catch(() => ({})),
    };
  } catch {
    return { offline: true };
  }
}

const isMissing = (res) => res.offline || res.status === 404;
const getErrorMessage = (res) =>
  (res.data && (res.data.message || res.data.error)) ||
  "เซิร์ฟเวอร์ตอบกลับ " + res.status;

function markField(element, errorElement, message, show) {
  errorElement.textContent = show ? message : "";
  element.classList.toggle("invalid", show && !!message);
  element.classList.toggle("valid", show && !message);
  element.setAttribute("aria-invalid", show && !!message);
}

// --- Navigation Tabs (data-v="order" | "menu" | "report") ---
function showView(viewName) {
  const views = ["order", "menu", "report"];
  if (!views.includes(viewName)) viewName = "order";

  views.forEach((x) => {
    const el = $("v-" + x);
    if (el) el.hidden = x !== viewName;
  });

  document.querySelectorAll(".tab[data-v]").forEach((tab) => {
    if (tab.dataset.v === viewName) {
      tab.setAttribute("aria-current", "page");
    } else {
      tab.removeAttribute("aria-current");
    }
  });

  history.replaceState(null, "", "#" + viewName);

  if (viewName === "report") {
    loadReport();
  }
}

document.querySelectorAll(".tab[data-v]").forEach((tab) => {
  tab.onclick = () => showView(tab.dataset.v);
});

$("branch").onchange = async () => {
  localStorage.setItem("cafe_pos_branch", $("branch").value);
  await loadMenu();
  if (!$("v-report").hidden) {
    loadReport();
  }
};

// --- Shared Menu Data Loading ---
async function loadMenu() {
  const branchId = $("branch").value || "1";
  const res = await api("GET", `/api/menu?branchId=${branchId}`);

  if (res.ok && Array.isArray(res.data)) {
    MENU = res.data.map((item) => {
      const id = Number(item.id ?? item.menu_id);
      const categoryId = Number(
        item.category_id ?? item.categoryId ?? CAT_NAME_TO_ID[item.category] ?? 1
      );
      const categoryName =
        item.category_name || item.category || CAT_MAP[categoryId] || "อื่น ๆ";

      return {
        id,
        menu_id: id,
        categoryId,
        category: categoryName,
        name: item.name || "",
        price: Number(item.price || 0),
        stock: Number(item.stock_quantity ?? item.stock ?? item.stockQuantity ?? 0),
        active: item.active !== false && item.active !== 0,
      };
    });
  } else {
    setOffline();
  }

  // Render both Order Grid and Manage Menu Table
  renderOrderGrid();
  renderMenuTable();
}

// ==========================================================================
// 1. POS Order Taking Logic (v-order)
// ==========================================================================
function renderOrderGrid() {
  const grid = $("menuGrid");
  if (!grid) return;

  grid.innerHTML = MENU.map((item) => {
    const isOut = item.stock <= 0;
    const isLow = item.stock > 0 && item.stock < 10;
    const isSelected = selectedOrderItem && selectedOrderItem.id === item.id;

    let tagHtml = "";
    if (isOut) {
      tagHtml = `<span class="card-tag out">สินค้าหมด</span>`;
    } else if (isLow) {
      tagHtml = `<span class="card-tag low">Low-stock (${item.stock})</span>`;
    }

    return `
      <div class="menu-card ${isOut ? "out" : ""} ${isSelected ? "selected" : ""}" data-id="${item.id}">
        ${tagHtml}
        <div class="product-icon-wrap">
          <span>${getDrinkEmoji(item.name)}</span>
        </div>
        <div class="product-name">${escapeHtml(item.name)}</div>
        <div class="product-price">${item.price} ฿</div>
      </div>
    `;
  }).join("");

  grid.querySelectorAll(".menu-card").forEach((card) => {
    card.onclick = () => {
      const id = Number(card.dataset.id);
      const item = MENU.find((m) => m.id === id);
      if (!item || item.stock <= 0) return;
      selectOrderItem(item);
    };
  });
}

function selectOrderItem(item) {
  selectedOrderItem = item;
  currentCustom = {
    size: "M",
    sizeExtra: 0,
    sweet: "50%",
    toppings: [],
    quantity: 1,
  };

  renderOrderGrid();
  renderCustomPanel();
}

function renderCustomPanel() {
  const panel = $("customPanel");
  if (!panel) return;

  if (!selectedOrderItem) {
    panel.classList.add("disabled");
    $("customTitle").textContent = "กรุณาเลือกเมนูจากด้านบน";
    $("customPrice").textContent = "- ฿";
    $("btnAddItem").disabled = true;
    return;
  }

  panel.classList.remove("disabled");
  $("customTitle").textContent = `ปรับแต่งรายการ: ${selectedOrderItem.name}`;
  $("btnAddItem").disabled = false;

  document.querySelectorAll("[data-size]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.size === currentCustom.size);
  });
  document.querySelectorAll("[data-sweet]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.sweet === currentCustom.sweet);
  });
  document.querySelectorAll(".topping-chk").forEach((chk) => {
    chk.checked = currentCustom.toppings.some((t) => t.name === chk.value);
  });

  $("qtyInput").value = currentCustom.quantity;
  updateCustomPrice();
}

function updateCustomPrice() {
  if (!selectedOrderItem) return;
  const toppingTotal = currentCustom.toppings.reduce((sum, t) => sum + t.price, 0);
  const singlePrice = selectedOrderItem.price + currentCustom.sizeExtra + toppingTotal;
  const totalPrice = singlePrice * currentCustom.quantity;

  $("customPrice").textContent = `${totalPrice} ฿`;
}

// Customization Option Listeners
document.querySelectorAll("[data-size]").forEach((btn) => {
  btn.onclick = () => {
    currentCustom.size = btn.dataset.size;
    currentCustom.sizeExtra = Number(btn.dataset.extra || 0);
    document.querySelectorAll("[data-size]").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    updateCustomPrice();
  };
});

document.querySelectorAll("[data-sweet]").forEach((btn) => {
  btn.onclick = () => {
    currentCustom.sweet = btn.dataset.sweet;
    document.querySelectorAll("[data-sweet]").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
  };
});

document.querySelectorAll(".topping-chk").forEach((chk) => {
  chk.onchange = () => {
    currentCustom.toppings = [...document.querySelectorAll(".topping-chk:checked")].map((c) => ({
      name: c.value,
      price: Number(c.dataset.price),
    }));
    updateCustomPrice();
  };
});

$("qtyMinus").onclick = () => {
  if (currentCustom.quantity > 1) {
    currentCustom.quantity--;
    $("qtyInput").value = currentCustom.quantity;
    updateCustomPrice();
  }
};

$("qtyPlus").onclick = () => {
  const maxStock = selectedOrderItem ? selectedOrderItem.stock : 99;
  if (currentCustom.quantity < maxStock) {
    currentCustom.quantity++;
    $("qtyInput").value = currentCustom.quantity;
    updateCustomPrice();
  } else {
    alert(`สต็อกคงเหลือสำหรับสินค้านี้มีเพียง ${maxStock} แก้ว`);
  }
};

// Add to Cart
$("btnAddItem").onclick = () => {
  if (!selectedOrderItem) return;

  const toppingExtra = currentCustom.toppings.reduce((sum, t) => sum + t.price, 0);
  const unitPrice = selectedOrderItem.price + currentCustom.sizeExtra + toppingExtra;

  cart.push({
    id: Date.now() + Math.random(),
    menuId: selectedOrderItem.id,
    name: selectedOrderItem.name,
    size: currentCustom.size,
    sweet: currentCustom.sweet,
    toppings: [...currentCustom.toppings],
    quantity: currentCustom.quantity,
    unitPrice,
    totalPrice: unitPrice * currentCustom.quantity,
  });

  renderCart();
};

function renderCart() {
  const container = $("cartItems");
  const checkoutBtn = $("btnCheckout");

  if (cart.length === 0) {
    container.innerHTML = `<div class="cart-empty">ไม่มีรายการในตะกร้า</div>`;
    checkoutBtn.disabled = true;
    updateCartTotals();
    return;
  }

  checkoutBtn.disabled = false;
  container.innerHTML = cart
    .map((item, index) => {
      const toppingText =
        item.toppings.length > 0
          ? `, ท็อปปิ้ง: ${item.toppings.map((t) => t.name).join("+")}`
          : "";
      const meta = `แก้วไซส์ ${item.size}, หวาน ${item.sweet}${toppingText}`;

      return `
      <div class="cart-item">
        <div class="cart-item-info">
          <div class="cart-item-name">${escapeHtml(item.name)} x ${item.quantity}</div>
          <div class="cart-item-meta">${escapeHtml(meta)}</div>
        </div>
        <div class="cart-item-price">
          <div class="cost">${formatMoney(item.totalPrice)} ฿</div>
          <button class="remove" onclick="removeCartItem(${index})" title="ลบรายการ">✕</button>
        </div>
      </div>
    `;
    })
    .join("");

  updateCartTotals();
}

window.removeCartItem = (index) => {
  cart.splice(index, 1);
  renderCart();
};

$("clearCartBtn").onclick = () => {
  if (cart.length === 0) return;
  if (confirm("คุณต้องการล้างรายการทั้งหมดในตะกร้าใช่หรือไม่?")) {
    cart = [];
    renderCart();
  }
};

function updateCartTotals() {
  const subtotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);
  const discountAmount = subtotal * memberDiscount;
  const taxable = Math.max(0, subtotal - discountAmount);
  const vatAmount = taxable * 0.07;
  const netTotal = taxable + vatAmount;

  $("subtotalVal").textContent = `${formatMoney(subtotal)} ฿`;
  $("discountVal").textContent = `-${formatMoney(discountAmount)} ฿`;
  $("vatVal").textContent = `${formatMoney(vatAmount)} ฿`;
  $("netTotalVal").textContent = `${formatMoney(netTotal)} ฿`;
}

// Member Search
$("btnSearchMember").onclick = () => {
  const phone = $("memberPhone").value.trim();
  const statusEl = $("memberStatus");

  if (phone.length === 10 && /^\d+$/.test(phone)) {
    memberDiscount = 0.05;
    currentMember = { phone, name: "คุณสมศรี (สมาชิก Gold)" };
    statusEl.className = "member-status found";
    statusEl.textContent = `✓ สมาชิก: ${currentMember.name} (รับส่วนลด 5%)`;
  } else {
    memberDiscount = 0;
    currentMember = null;
    statusEl.className = "member-status notfound";
    statusEl.textContent = "✕ ไม่พบข้อมูลสมาชิก (กรอกเบอร์ 10 หลัก)";
  }
  updateCartTotals();
};

// Submit Order (POST /api/orders)
$("btnCheckout").onclick = async () => {
  if (cart.length === 0) return;

  const branchId = Number($("branch").value || 1);
  const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked').value;

  const payload = {
    branchId,
    employeeId: 1,
    paymentMethod,
    items: cart.map((item) => ({
      menuId: item.menuId,
      quantity: item.quantity,
    })),
  };

  const btn = $("btnCheckout");
  const statusEl = $("checkoutStatus");
  statusEl.textContent = "";
  btn.disabled = true;
  btn.textContent = "กำลังบันทึกออเดอร์...";

  const res = await api("POST", "/api/orders", payload);
  btn.disabled = cart.length === 0;
  btn.textContent = "ยืนยันการชำระเงิน / ออกใบเสร็จ";

  if (!res.ok || !res.data?.orderId) {
    statusEl.className = "status bad";
    statusEl.textContent = isMissing(res)
      ? "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองอีกครั้ง"
      : `บันทึกออเดอร์ไม่สำเร็จ: ${getErrorMessage(res)} กรุณาลองอีกครั้ง`;
    return;
  }

  statusEl.className = "status";
  statusEl.textContent = "";
  showReceiptModal(res.data.orderId, paymentMethod);
};

function showReceiptModal(orderId, paymentMethod) {
  const branchName = $("branch").selectedOptions[0]?.text || "สาขา: สยาม";
  const now = new Date();
  const dateStr = now.toLocaleDateString("th-TH") + " " + now.toLocaleTimeString("th-TH");

  $("recBranch").textContent = branchName;
  $("recOrderId").textContent = `ใบเสร็จรับเงิน #${String(orderId).padStart(5, "0")}`;
  $("recDateTime").textContent = dateStr;
  $("recPayMethod").textContent =
    paymentMethod === "cash" ? "เงินสด (Cash)" : "QR PromptPay";

  $("recItems").innerHTML = cart
    .map(
      (item) => `
    <div class="receipt-item">
      <span>${escapeHtml(item.name)} (${item.size}) x${item.quantity}</span>
      <span>${formatMoney(item.totalPrice)} ฿</span>
    </div>
  `
    )
    .join("");

  $("recNetTotal").textContent = $("netTotalVal").textContent;
  $("receiptModal").hidden = false;
}

$("btnCloseReceipt").onclick = async () => {
  $("receiptModal").hidden = true;
  cart = [];
  selectedOrderItem = null;
  renderCart();
  renderCustomPanel();
  await loadMenu(); // อัปเดตสต็อกล่าสุดทั้งตารางและกริดทันที!
};

$("btnPrintReceipt").onclick = () => {
  window.print();
};

// ==========================================================================
// 2. Menu Management Logic (v-menu)
// ==========================================================================
function renderMenuTable() {
  const query = $("q").value.trim().toLowerCase();
  const currentCategory = $("catF").value;

  const categories = [...new Set(MENU.map((m) => m.category))];
  $("catF").innerHTML =
    `<option value="">ทุกหมวด</option>` +
    categories
      .map(
        (cat) =>
          `<option${cat === currentCategory ? " selected" : ""}>${escapeHtml(
            cat
          )}</option>`
      )
      .join("");

  const selectedCategory = $("catF").value;
  const list = MENU.filter(
    (item) =>
      (!selectedCategory || item.category === selectedCategory) &&
      (!query || item.name.toLowerCase().includes(query))
  );

  $("mbody").innerHTML = list
    .map(
      (m) => `<tr>
    <td>${escapeHtml(m.name)}</td>
    <td>${escapeHtml(m.category || "")}</td>
    <td class="n">${formatNumber(m.price)}</td>
    <td class="n">${formatNumber(m.stock)} ${
        m.stock < 10 ? '<span class="badge low">ใกล้หมด</span>' : ""
      }</td>
    <td><span class="badge${m.active ? "" : " off"}">${
        m.active ? "ขายอยู่" : "ซ่อน"
      }</span></td>
    <td>
      <button class="lk" data-e="${m.id}">แก้ไข</button>
      <button class="lk" style="color:var(--bad);margin-left:6px" data-d="${
        m.id
      }">ลบ</button>
    </td>
  </tr>`
    )
    .join("");

  $("mempty").textContent = list.length
    ? ""
    : "ไม่พบเมนูที่ตรงกับเงื่อนไข ลองเปลี่ยนคำค้นหรือหมวด";

  document
    .querySelectorAll("[data-e]")
    .forEach((btn) => (btn.onclick = () => startEdit(Number(btn.dataset.e))));
  document
    .querySelectorAll("[data-d]")
    .forEach((btn) => (btn.onclick = () => deleteMenu(Number(btn.dataset.d))));
}

function validateMenuForm(showAllErrors) {
  const nameInput = $("mn");
  const categorySelect = $("mc");
  const priceInput = $("mp");
  const stockInput = $("ms");
  const errorElements = $("mform").querySelectorAll(".err");

  const price = Number(priceInput.value);
  const stock = Number(stockInput.value);
  const isDuplicate = MENU.some(
    (m) => m.name.trim() === nameInput.value.trim() && m.id !== editId
  );

  const errName = !nameInput.value.trim()
    ? "กรุณาระบุชื่อเมนู"
    : isDuplicate
    ? "มีเมนูชื่อนี้แล้ว"
    : "";
  const errCategory = categorySelect.value ? "" : "กรุณาเลือกหมวด";
  const errPrice =
    priceInput.value === ""
      ? "กรุณาระบุราคา"
      : price <= 0
      ? "ราคาต้องมากกว่า 0"
      : price > 999
      ? "ราคาต้องไม่เกิน 999"
      : "";
  const errStock =
    stockInput.value === ""
      ? "กรุณาระบุสต็อก"
      : !Number.isInteger(stock)
      ? "สต็อกต้องเป็นเลขจำนวนเต็ม"
      : stock < 0
      ? "สต็อกต้องไม่ติดลบ"
      : "";

  markField(nameInput, errorElements[0], errName, showAllErrors || !!nameInput.dataset.touched);
  markField(
    categorySelect,
    errorElements[1],
    errCategory,
    showAllErrors || !!categorySelect.dataset.touched
  );
  markField(priceInput, errorElements[2], errPrice, showAllErrors || !!priceInput.dataset.touched);
  markField(stockInput, errorElements[3], errStock, true);

  const isValid = !errName && !errCategory && !errPrice && !errStock;
  $("msave").disabled = !isValid;
  $("mhint").textContent = isValid ? "" : "กรอกข้อมูลให้ครบและถูกต้องก่อนบันทึก";
  return isValid;
}

function resetForm() {
  editId = null;
  $("mform").reset();
  $("mtitle").textContent = "เพิ่มเมนูใหม่";
  $("mcancel").hidden = true;

  ["mn", "mc", "mp", "ms"].forEach((id) => {
    delete $(id).dataset.touched;
    $(id).classList.remove("valid", "invalid");
  });

  $("mform").querySelectorAll(".err").forEach((el) => (el.textContent = ""));
  validateMenuForm(false);
}

function startEdit(id) {
  const item = MENU.find((x) => x.id === id);
  if (!item) return;

  editId = id;
  $("mn").value = item.name;
  $("mc").value = String(item.categoryId || CAT_NAME_TO_ID[item.category] || "1");
  $("mp").value = item.price;
  $("ms").value = item.stock;
  $("ma").checked = item.active;

  $("mtitle").textContent = "แก้ไขเมนู";
  $("mcancel").hidden = false;
  $("mstatus").className = "status";
  validateMenuForm(true);
  $("mn").focus();
}

async function deleteMenu(id) {
  const item = MENU.find((x) => x.id === id);
  if (!item || !confirm(`คุณต้องการลบเมนู "${item.name}" ใช่หรือไม่?`)) return;

  const branchId = $("branch").value || "1";
  const statusEl = $("mstatus");
  const res = await api("DELETE", `/api/menu/${id}?branchId=${branchId}`);

  if (!res.ok && !isMissing(res)) {
    statusEl.className = "status bad";
    statusEl.textContent = `ลบไม่สำเร็จ: ${getErrorMessage(res)} กรุณาลองอีกครั้ง`;
    return;
  }

  if (isMissing(res)) setOffline();
  statusEl.className = "status ok";
  statusEl.textContent = `ลบเมนู "${item.name}" เรียบร้อยแล้ว`;
  await loadMenu();
}

// Event Listeners for Menu Form
["mn", "mc", "mp", "ms"].forEach((id) => {
  $(id).addEventListener("input", () => validateMenuForm(false));
  $(id).addEventListener("blur", () => {
    $(id).dataset.touched = "1";
    validateMenuForm(false);
  });
});
$("mc").addEventListener("change", () => {
  $("mc").dataset.touched = "1";
  validateMenuForm(false);
});

$("mcancel").onclick = resetForm;
$("q").oninput = renderMenuTable;
$("catF").onchange = renderMenuTable;

$("mform").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!validateMenuForm(true)) return;

  const branchId = Number($("branch").value || 1);
  const categoryId = Number($("mc").value) || 1;
  const name = $("mn").value.trim();
  const price = Number($("mp").value);
  const stockQuantity = Number($("ms").value);
  const active = $("ma").checked;

  const payload = {
    branchId,
    categoryId,
    name,
    price,
    stockQuantity,
    active,
  };

  const statusEl = $("mstatus");
  const res = editId
    ? await api("PUT", "/api/menu/" + editId, payload)
    : await api("POST", "/api/menu", payload);

  if (!res.ok && !isMissing(res)) {
    statusEl.className = "status bad";
    statusEl.textContent = `บันทึกไม่สำเร็จ: ${getErrorMessage(res)} กรุณาลองอีกครั้ง`;
    return;
  }

  if (isMissing(res)) setOffline();

  statusEl.className = "status ok";
  statusEl.textContent = `บันทึกเมนู "${name}" แล้ว`;
  resetForm();
  await loadMenu();
});

// ==========================================================================
// 3. Sales Report Logic (v-report)
// ==========================================================================
function demoReport(from, to, branchId, topFilter) {
  const days = Math.max(1, Math.round((new Date(to) - new Date(from)) / 864e5) + 1);
  const makeBranchData = (b) => {
    const orders = Math.round(days * (42 + ((b.id * 9) % 13)));
    return {
      branch_id: b.id,
      branch_name: b.name,
      orders,
      sales: orders * (118 + b.id * 6),
    };
  };

  let byBranch = BRANCHES.map(makeBranchData);
  if (branchId) {
    byBranch = byBranch.filter((b) => b.branch_id === branchId);
  }

  const totalOrders = byBranch.reduce((sum, b) => sum + b.orders, 0);
  const totalSales = byBranch.reduce((sum, b) => sum + b.sales, 0);
  const k =
    topFilter === "day"
      ? 1 / Math.max(days, 1)
      : topFilter === "week"
      ? Math.min(7, days) / Math.max(days, 1)
      : 1;

  const baseMenus = [
    ["ชานมไข่มุก", 0.32, 55],
    ["ลาเต้เย็น", 0.24, 55],
    ["อเมริกาโน่เย็น", 0.2, 45],
    ["ชาเขียวนม", 0.15, 50],
  ];

  return {
    summary: { total_sales: totalSales, order_count: totalOrders },
    by_branch: byBranch,
    top_menus: baseMenus.map(([name, share, price]) => {
      const quantity = Math.round(totalOrders * 1.4 * share * k);
      return { name, quantity, sales: quantity * price };
    }),
  };
}

async function loadReport() {
  const from = $("from").value;
  const to = $("to").value;
  const errEl = $("rerr");
  const branchId = $("branch").value;
  const top = $("top").value;

  if (!from || !to) {
    errEl.textContent = "กรุณาเลือกช่วงวันที่ให้ครบ";
    return;
  }
  if (from > to) {
    errEl.textContent = "วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด";
    return;
  }
  errEl.textContent = "";

  const queryParams = new URLSearchParams({
    from,
    to,
    top: top || "all",
  });
  if (branchId) {
    queryParams.append("branchId", branchId);
  }

  const res = await api("GET", `/api/reports/sales?${queryParams.toString()}`);

  let report;
  if (res.ok && res.data && res.data.summary) {
    report = res.data;
    $("note").style.display = "none";
  } else {
    setOffline();
    $("note").textContent =
      "ไม่สามารถเชื่อมต่อ Report API หรือเกิดข้อผิดพลาด (แสดงข้อมูลสถิติตัวอย่าง)";
    report = demoReport(
      from,
      to,
      branchId ? Number(branchId) : 0,
      top
    );
  }

  $("k1").textContent = formatNumber(report.summary.total_sales);
  $("k2").textContent = formatNumber(report.summary.order_count);

  $("rb").innerHTML =
    report.by_branch
      .map(
        (x) =>
          `<tr><td>${escapeHtml(x.branch_name)}</td><td class="n">${formatNumber(
            x.orders
          )}</td><td class="n">${formatNumber(x.sales)}</td></tr>`
      )
      .join("") || `<tr><td colspan="3">ไม่มีข้อมูลในช่วงนี้</td></tr>`;

  $("rt").innerHTML =
    report.top_menus
      .map(
        (x) =>
          `<tr><td>${escapeHtml(x.name)}</td><td class="n">${formatNumber(
            x.quantity
          )}</td><td class="n">${formatNumber(x.sales)}</td></tr>`
      )
      .join("") || `<tr><td colspan="3">ไม่มีข้อมูลในช่วงนี้</td></tr>`;
}

$("rform").addEventListener("submit", (e) => {
  e.preventDefault();
  loadReport();
});
$("print").onclick = () => window.print();

// ==========================================================================
// 4. Application Initialization
// ==========================================================================
(async function init() {
  const savedBranch = localStorage.getItem("cafe_pos_branch") || "1";
  $("branch").innerHTML = BRANCHES.map(
    (x) => `<option value="${x.id}" ${x.id == savedBranch ? "selected" : ""}>สาขา: ${escapeHtml(x.name)}</option>`
  ).join("");

  await loadMenu();

  const today = new Date();
  const weekAgo = new Date();
  weekAgo.setDate(today.getDate() - 6);

  $("to").value = formatDate(today);
  $("from").value = formatDate(weekAgo);

  validateMenuForm(false);

  // Check URL hash to switch initial view (#order, #menu, #report)
  const initialHash = location.hash.replace("#", "") || "order";
  showView(initialHash);
})();
