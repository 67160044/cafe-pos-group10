/**
 * Whatever Cafe POS - Order / Cashier Screen Logic
 */

document.addEventListener("DOMContentLoaded", async () => {
  // กำหนดสิทธิ์: ดูได้เฉพาะบทบาท Cashier เท่านั้น
  if (!Auth.requireRolePage("cashier")) return;
  await Auth.renderNavbar("order");

  // State
  let menuList = [];
  let cart = [];
  let memberDiscountRate = 0; // 0 or 0.05
  let currentMember = null; // { memberId, name, phone, points, discountRate }
  let selectedProduct = null;
  let customState = {
    size: "M",
    sizeExtra: 0,
    sweet: "50%",
    toppings: [],
    quantity: 1,
  };
  let lastCompletedOrder = null;

  // DOM Elements
  const productGrid = document.getElementById("productGrid");
  const menuSearch = document.getElementById("menuSearch");
  const categoryPills = document.getElementById("categoryPills");
  const cartItems = document.getElementById("cartItems");
  const btnClearCart = document.getElementById("btnClearCart");
  const memberPhone = document.getElementById("memberPhone");
  const btnSearchMember = document.getElementById("btnSearchMember");
  const btnClearMember = document.getElementById("btnClearMember");
  const memberBadge = document.getElementById("memberBadge");
  const memberStatus = document.getElementById("memberStatus");

  const subtotalText = document.getElementById("subtotalText");
  const discountText = document.getElementById("discountText");
  const vatText = document.getElementById("vatText");
  const netTotalText = document.getElementById("netTotalText");

  // 2 Action Boxes (Top: Register Member, Bottom: Main Pay Button)
  const btnOpenRegisterMember = document.getElementById("btnOpenRegisterMember");
  const btnPayMain = document.getElementById("btnPayMain");

  // Modals
  const customModal = document.getElementById("customModal");
  const customDrinkTitle = document.getElementById("customDrinkTitle");
  const customDrinkPrice = document.getElementById("customDrinkPrice");
  const customQtyVal = document.getElementById("customQtyVal");
  const customFinalTotal = document.getElementById("customFinalTotal");
  const btnAddToCart = document.getElementById("btnAddToCart");

  // Payment Choice Modal (เลือกระหว่าง QR กับ เงินสด)
  const paymentChoiceModal = document.getElementById("paymentChoiceModal");
  const choiceDueAmountText = document.getElementById("choiceDueAmountText");
  const btnClosePaymentChoice = document.getElementById("btnClosePaymentChoice");
  const btnCancelPaymentChoice = document.getElementById("btnCancelPaymentChoice");
  const btnSelectQR = document.getElementById("btnSelectQR");
  const btnSelectCash = document.getElementById("btnSelectCash");

  // Register Member Modal (สมัครสมาชิก Cafe Club)
  const registerMemberModal = document.getElementById("registerMemberModal");
  const btnCloseRegisterMember = document.getElementById("btnCloseRegisterMember");
  const btnCancelRegisterMember = document.getElementById("btnCancelRegisterMember");
  const formRegisterMember = document.getElementById("formRegisterMember");
  const regMemberPhone = document.getElementById("regMemberPhone");
  const regMemberName = document.getElementById("regMemberName");
  const regMemberMsg = document.getElementById("regMemberMsg");
  const btnCheckExistingMember = document.getElementById("btnCheckExistingMember");

  // Cash Modal
  const cashModal = document.getElementById("cashModal");
  const cashModalDueText = document.getElementById("cashModalDueText");
  const cashReceivedInput = document.getElementById("cashReceivedInput");
  const cashChangeText = document.getElementById("cashChangeText");
  const btnConfirmCash = document.getElementById("btnConfirmCash");

  // QR Modal
  const qrModal = document.getElementById("qrModal");
  const qrTotalText = document.getElementById("qrTotalText");
  const btnConfirmQR = document.getElementById("btnConfirmQR");

  const receiptModal = document.getElementById("receiptModal");

  function getDrinkEmoji(name) {
    const n = String(name).toLowerCase();
    if (n.includes("ชาไทย") || n.includes("ชานม") || n.includes("ไข่มุก")) return "🧋";
    if (n.includes("ชาเขียว") || n.includes("มัทฉะ") || n.includes("ชา")) return "🍵";
    if (n.includes("ลาเต้") || n.includes("คาปู") || n.includes("อเมริกาโน่") || n.includes("เอสเปรสโซ่") || n.includes("กาแฟ")) return "☕";
    if (n.includes("โกโก้") || n.includes("นม") || n.includes("ช็อกโกแลต")) return "🥛";
    return "🥤";
  }

  // --- Load Menu Items ---
  async function loadMenu() {
    const branchId = Auth.getBranchId();
    productGrid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--wn-gray);">
        กำลังโหลดรายการเมนู...
      </div>
    `;

    const res = await Auth.api("GET", `/api/menu?branchId=${branchId}`);
    if (!res.ok) {
      productGrid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--wn-danger);">
          ไม่สามารถโหลดข้อมูลเมนูได้: ${res.error || "เกิดข้อผิดพลาด"}
        </div>
      `;
      return;
    }

    menuList = res.data || [];
    renderMenuGrid();
  }

  function getActiveCategory() {
    const activePill = categoryPills.querySelector(".wn-cat-pill.active");
    return activePill ? activePill.dataset.cat : "all";
  }

  function renderMenuGrid() {
    const cat = getActiveCategory();
    const query = menuSearch.value.trim().toLowerCase();

    const filtered = menuList.filter((item) => {
      const matchCat = cat === "all" || String(item.categoryId) === String(cat);
      const matchQuery = !query || item.name.toLowerCase().includes(query);
      return matchCat && matchQuery;
    });

    if (filtered.length === 0) {
      productGrid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--wn-gray);">
          ไม่พบรายการเมนูที่ค้นหา
        </div>
      `;
      return;
    }

    productGrid.innerHTML = filtered
      .map((item) => {
        const stock = Number(item.stockQuantity || 0);
        const isOutOfStock = stock <= 0;
        let stockBadge = `<span class="wn-stock-badge in-stock">สต็อก ${stock}</span>`;
        if (isOutOfStock) {
          stockBadge = `<span class="wn-stock-badge out-of-stock">หมด</span>`;
        } else if (stock < 10) {
          stockBadge = `<span class="wn-stock-badge low-stock">เหลือ ${stock}</span>`;
        }

        const inCartQty = cart
          .filter((c) => c.menuId === item.menuId)
          .reduce((sum, c) => sum + c.quantity, 0);
        const qtyBadge = inCartQty > 0 ? `<span class="wn-card-qty-badge">${inCartQty}</span>` : "";

        return `
          <div class="wn-product-card ${isOutOfStock ? "out-of-stock" : ""}" data-id="${item.menuId}">
            ${qtyBadge}
            <div class="wn-product-thumb">
              <span class="wn-product-icon">${getDrinkEmoji(item.name)}</span>
            </div>
            <div class="wn-product-body">
              <div class="wn-product-name" title="${item.name}">${item.name}</div>
              <div class="wn-product-bottom-row">
                <span class="wn-product-price">฿${Number(item.price).toFixed(2)}</span>
                ${stockBadge}
              </div>
            </div>
          </div>
        `;
      })
      .join("");

    // Attach card clicks
    productGrid.querySelectorAll(".wn-product-card").forEach((card) => {
      card.addEventListener("click", () => {
        const id = Number(card.dataset.id);
        const item = menuList.find((m) => m.menuId === id);
        if (!item || Number(item.stockQuantity) <= 0) return;
        openCustomizer(item);
      });
    });
  }

  // --- Category and Search Listeners ---
  categoryPills.querySelectorAll(".wn-cat-pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      categoryPills.querySelectorAll(".wn-cat-pill").forEach((p) => p.classList.remove("active"));
      pill.classList.add("active");
      renderMenuGrid();
    });
  });

  menuSearch.addEventListener("input", () => {
    renderMenuGrid();
  });

  // Branch Changed
  window.addEventListener("branchChanged", () => {
    cart = [];
    renderCart();
    loadMenu();
    Auth.showToast("เปลี่ยนสาขาเรียบร้อยแล้ว", "info");
  });

  // --- Customizer Modal ---
  function openCustomizer(product) {
    selectedProduct = product;
    customState = {
      size: "M",
      sizeExtra: 0,
      sweet: "50%",
      toppings: [],
      quantity: 1,
    };

    customDrinkTitle.textContent = product.name;
    customDrinkPrice.textContent = `ราคาเริ่มต้น ฿${Number(product.price).toFixed(2)}`;
    customQtyVal.value = 1;

    // Reset size chips
    document.querySelectorAll("#sizeChips .wn-chip").forEach((chip) => {
      chip.classList.toggle("active", chip.dataset.size === "M");
    });

    // Reset sweet chips
    document.querySelectorAll("#sweetChips .wn-chip").forEach((chip) => {
      chip.classList.toggle("active", chip.dataset.sweet === "50%");
    });

    // Reset toppings
    document.querySelectorAll(".topping-check").forEach((chk) => {
      chk.checked = false;
    });

    updateCustomTotal();
    customModal.classList.remove("hidden");
  }

  function updateCustomTotal() {
    if (!selectedProduct) return;
    const basePrice = Number(selectedProduct.price);
    const toppingsExtra = customState.toppings.reduce((sum, t) => sum + t.price, 0);
    const unitPrice = basePrice + customState.sizeExtra + toppingsExtra;
    const total = unitPrice * customState.quantity;
    customFinalTotal.textContent = `฿${total.toFixed(2)}`;
  }

  // Size Chips
  document.querySelectorAll("#sizeChips .wn-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      document.querySelectorAll("#sizeChips .wn-chip").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      customState.size = chip.dataset.size;
      customState.sizeExtra = Number(chip.dataset.extra);
      updateCustomTotal();
    });
  });

  // Sweet Chips
  document.querySelectorAll("#sweetChips .wn-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      document.querySelectorAll("#sweetChips .wn-chip").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      customState.sweet = chip.dataset.sweet;
    });
  });

  // Topping checkboxes
  document.querySelectorAll(".topping-check").forEach((chk) => {
    chk.addEventListener("change", () => {
      customState.toppings = Array.from(document.querySelectorAll(".topping-check:checked")).map((c) => ({
        name: c.value,
        price: Number(c.dataset.price),
      }));
      updateCustomTotal();
    });
  });

  // Stepper
  document.getElementById("customQtyMinus").addEventListener("click", () => {
    if (customState.quantity > 1) {
      customState.quantity--;
      customQtyVal.value = customState.quantity;
      updateCustomTotal();
    }
  });

  document.getElementById("customQtyPlus").addEventListener("click", () => {
    const maxStock = Number(selectedProduct.stockQuantity || 999);
    if (customState.quantity < maxStock) {
      customState.quantity++;
      customQtyVal.value = customState.quantity;
      updateCustomTotal();
    } else {
      Auth.showToast(`สต็อกมีเพียง ${maxStock} ชิ้น`, "warning");
    }
  });

  function closeCustomModal() {
    customModal.classList.add("hidden");
    selectedProduct = null;
  }

  document.getElementById("btnCloseCustom").addEventListener("click", closeCustomModal);
  document.getElementById("btnCancelCustom").addEventListener("click", closeCustomModal);

  // Add To Cart
  btnAddToCart.addEventListener("click", () => {
    if (!selectedProduct) return;
    const basePrice = Number(selectedProduct.price);
    const toppingsExtra = customState.toppings.reduce((sum, t) => sum + t.price, 0);
    const unitPrice = basePrice + customState.sizeExtra + toppingsExtra;

    const toppingNames = customState.toppings.map((t) => t.name).join(", ");
    const descParts = [`แก้ว ${customState.size}`, `หวาน ${customState.sweet}`];
    if (toppingNames) descParts.push(`+${toppingNames}`);
    const customizationDesc = descParts.join(" • ");

    // Check if duplicate item exists in cart
    const existingIndex = cart.findIndex(
      (item) => item.menuId === selectedProduct.menuId && item.desc === customizationDesc
    );

    if (existingIndex > -1) {
      const newQty = cart[existingIndex].quantity + customState.quantity;
      if (newQty > Number(selectedProduct.stockQuantity)) {
        Auth.showToast(`จำนวนเกินสต็อกคงเหลือ (${selectedProduct.stockQuantity})`, "warning");
        return;
      }
      cart[existingIndex].quantity = newQty;
      cart[existingIndex].lineTotal = cart[existingIndex].quantity * unitPrice;
    } else {
      cart.push({
        menuId: selectedProduct.menuId,
        name: selectedProduct.name,
        desc: customizationDesc,
        unitPrice,
        quantity: customState.quantity,
        lineTotal: customState.quantity * unitPrice,
        maxStock: Number(selectedProduct.stockQuantity),
      });
    }

    const addedName = selectedProduct.name;
    closeCustomModal();
    renderCart();
    Auth.showToast(`เพิ่ม "${addedName}" ลงในบิลแล้ว`, "info");
  });

  // --- Cart Calculations & Rendering ---
  function calculateBill() {
    const subtotal = cart.reduce((sum, item) => sum + item.lineTotal, 0);
    const discount = subtotal * memberDiscountRate;
    const afterDiscount = subtotal - discount;
    const vat = afterDiscount * 0.07;
    const netTotal = afterDiscount + vat;
    return { subtotal, discount, vat, netTotal };
  }

  function renderCart() {
    const { subtotal, discount, vat, netTotal } = calculateBill();

    subtotalText.textContent = `฿${subtotal.toFixed(2)}`;
    discountText.textContent = `-฿${discount.toFixed(2)}`;
    vatText.textContent = `฿${vat.toFixed(2)}`;
    netTotalText.textContent = `฿${netTotal.toFixed(2)}`;

    const hasItems = cart.length > 0;
    if (btnPayMain) {
      btnPayMain.disabled = !hasItems;
    }

    const btnPayTotalText = document.getElementById("btnPayTotalText");
    if (btnPayTotalText) {
      btnPayTotalText.textContent = hasItems ? `${netTotal.toFixed(2)} ฿` : "0.00 ฿";
    }

    if (btnOpenRegisterMember) {
      if (currentMember) {
        btnOpenRegisterMember.className = "wn-btn-member-action active";
        btnOpenRegisterMember.innerHTML = `✓ สมาชิก: <strong>${currentMember.name}</strong> (ลด 5%)`;
        btnOpenRegisterMember.title = "คลิกเพื่อดูหรือยกเลิกสิทธิ์สมาชิก";
      } else {
        btnOpenRegisterMember.className = "wn-btn-member-action";
        btnOpenRegisterMember.innerHTML = `⭐ สมัครสมาชิก Cafe Club (รับส่วนลด 5%)`;
        btnOpenRegisterMember.title = "คลิกเพื่อสมัครสมาชิกใหม่ หรือระบุเบอร์สมาชิกลด 5%";
      }
    }

    if (!hasItems) {
      cartItems.innerHTML = `
        <div class="wn-cart-empty">
          <span style="font-size: 36px;">🛒</span>
          <span>ยังไม่มีรายการสินค้าในบิล</span>
          <small style="color: var(--wn-gray-light);">แตะเลือกเมนูเครื่องดื่มจากฝั่งซ้ายเพื่อสั่งซื้อ</small>
        </div>
      `;
      return;
    }

    cartItems.innerHTML = cart
      .map(
        (item, index) => `
        <div class="wn-cart-item">
          <div class="wn-cart-item-top">
            <div>
              <div class="wn-cart-item-title">${item.name}</div>
              <div class="wn-cart-item-desc">${item.desc}</div>
            </div>
            <div class="wn-cart-item-price">฿${item.lineTotal.toFixed(2)}</div>
          </div>
          <div class="wn-cart-item-bottom">
            <div class="wn-qty-stepper">
              <button type="button" class="wn-qty-btn btn-cart-minus" data-idx="${index}">-</button>
              <input type="text" class="wn-qty-val" value="${item.quantity}" readonly>
              <button type="button" class="wn-qty-btn btn-cart-plus" data-idx="${index}">+</button>
            </div>
            <button type="button" class="wn-btn-del-item btn-cart-del" data-idx="${index}" title="ลบรายการ">&times;</button>
          </div>
        </div>
      `
      )
      .join("");

    // Stepper listeners
    cartItems.querySelectorAll(".btn-cart-minus").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.idx);
        if (cart[idx].quantity > 1) {
          cart[idx].quantity--;
          cart[idx].lineTotal = cart[idx].quantity * cart[idx].unitPrice;
        } else {
          cart.splice(idx, 1);
        }
        renderCart();
      });
    });

    cartItems.querySelectorAll(".btn-cart-plus").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.idx);
        if (cart[idx].quantity < cart[idx].maxStock) {
          cart[idx].quantity++;
          cart[idx].lineTotal = cart[idx].quantity * cart[idx].unitPrice;
          renderCart();
        } else {
          Auth.showToast(`สต็อกมีเพียง ${cart[idx].maxStock} ชิ้น`, "warning");
        }
      });
    });

    cartItems.querySelectorAll(".btn-cart-del").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.idx);
        cart.splice(idx, 1);
        renderCart();
      });
    });

    // Update real-world POS card badges on product tiles
    updateCardBadges();
  }

  function updateCardBadges() {
    productGrid.querySelectorAll(".wn-product-card").forEach((card) => {
      const id = Number(card.dataset.id);
      const inCartQty = cart
        .filter((c) => c.menuId === id)
        .reduce((sum, c) => sum + c.quantity, 0);
      let badge = card.querySelector(".wn-card-qty-badge");
      if (inCartQty > 0) {
        if (!badge) {
          badge = document.createElement("span");
          badge.className = "wn-card-qty-badge";
          card.prepend(badge);
        }
        badge.textContent = inCartQty;
      } else if (badge) {
        badge.remove();
      }
    });
  }

  // Clear Cart with UI Confirmation Modal
  btnClearCart.addEventListener("click", async () => {
    if (cart.length === 0) return;
    const confirmed = await Auth.confirmClearBill();
    if (confirmed) {
      cart = [];
      clearMember();
      renderCart();
      Auth.showToast("ล้างรายการในบิลเรียบร้อยแล้ว", "info");
    }
  });

  // Member Search & Verification against MySQL Database
  async function checkMemberPhone() {
    const phone = memberPhone.value.trim();
    if (!/^\d{10}$/.test(phone)) {
      memberStatus.style.display = "block";
      memberStatus.className = "wn-member-status error";
      memberStatus.innerHTML = "❌ กรุณากรอกหมายเลขโทรศัพท์ 10 หลักให้ถูกต้อง";
      currentMember = null;
      memberDiscountRate = 0;
      btnClearMember.style.display = "none";
      if (memberBadge) memberBadge.style.display = "none";
      renderCart();
      return;
    }

    btnSearchMember.disabled = true;
    btnSearchMember.innerHTML = "⏳ ตรวจสอบ...";

    try {
      const res = await Auth.api("GET", `/api/members/check/${encodeURIComponent(phone)}`);
      if (res.ok && res.data && res.data.success) {
        currentMember = res.data.member;
        memberDiscountRate = currentMember.discountRate || 0.05;
        memberStatus.style.display = "block";
        memberStatus.className = "wn-member-status success";
        memberStatus.innerHTML = `
          <div style="font-weight: 600; color: #15803d;">✓ ยืนยันสมาชิก Cafe Club เรียบร้อย</div>
          <div style="margin-top: 2px;">👤 ${currentMember.name}</div>
          <div style="font-size: 11.5px; color: #475569; margin-top: 3px;">
            <span>⭐ แต้มสะสม: <strong>${currentMember.points}</strong> แต้ม</span> | 
            <span style="color: #15803d; font-weight: 600;">🏷️ ส่วนลด ${(memberDiscountRate * 100).toFixed(0)}%</span>
          </div>
        `;
        btnClearMember.style.display = "inline-flex";
        if (memberBadge) memberBadge.style.display = "inline-block";
        memberPhone.readOnly = true;
        renderCart();
        Auth.showToast(`ยืนยันสมาชิก Cafe Club (${currentMember.name}) สำเร็จ`, "info");
      } else {
        currentMember = null;
        memberDiscountRate = 0;
        memberStatus.style.display = "block";
        memberStatus.className = "wn-member-status error";
        memberStatus.innerHTML = `❌ ${res.error || "ไม่พบข้อมูลสมาชิกในระบบ Cafe Club"}`;
        btnClearMember.style.display = "none";
        if (memberBadge) memberBadge.style.display = "none";
        memberPhone.readOnly = false;
        renderCart();
        Auth.showToast("ไม่พบข้อมูลสมาชิกในฐานข้อมูล Cafe Club", "warning");
      }
    } catch (err) {
      memberStatus.style.display = "block";
      memberStatus.className = "wn-member-status error";
      memberStatus.textContent = "❌ ไม่สามารถเชื่อมต่อระบบตรวจสอบสมาชิกได้";
      currentMember = null;
      memberDiscountRate = 0;
      renderCart();
    } finally {
      btnSearchMember.disabled = false;
      btnSearchMember.innerHTML = "🔍 ตรวจสอบ";
    }
  }

  function clearMember() {
    currentMember = null;
    memberDiscountRate = 0;
    memberPhone.value = "";
    memberPhone.readOnly = false;
    memberStatus.style.display = "none";
    memberStatus.innerHTML = "";
    btnClearMember.style.display = "none";
    if (memberBadge) memberBadge.style.display = "none";
    renderCart();
  }

  btnSearchMember.addEventListener("click", checkMemberPhone);
  memberPhone.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      checkMemberPhone();
    }
  });

  btnClearMember.addEventListener("click", async () => {
    if (currentMember) {
      const ok = await Auth.confirmModal({
        title: "ยืนยันยกเลิกสิทธิ์สมาชิก",
        message: `คุณต้องการยกเลิกการใช้สิทธิ์ของ "${currentMember.name}" ในบิลนี้หรือไม่?`,
        icon: "🏷️",
        confirmText: "ยกเลิกสิทธิ์",
        cancelText: "ปิด",
        type: "warning",
      });
      if (!ok) return;
    }
    clearMember();
    Auth.showToast("ยกเลิกสิทธิ์ส่วนลดสมาชิกเรียบร้อย", "info");
  });

  // Helper to apply member data
  function applyMemberData(member) {
    if (!member) return;
    currentMember = member;
    memberDiscountRate = Number(member.discountRate || member.discount_rate || 0.05);
    memberPhone.value = member.phone || "";
    memberPhone.readOnly = true;

    if (memberBadge) memberBadge.style.display = "inline-block";
    memberStatus.style.display = "block";
    memberStatus.className = "wn-member-status success";
    memberStatus.innerHTML = `
      <div style="font-weight: 600; color: #15803d;">✓ ยืนยันสมาชิก Cafe Club เรียบร้อย</div>
      <div style="margin-top: 2px;">👤 ${currentMember.name}</div>
      <div style="font-size: 11.5px; color: #475569; margin-top: 3px;">
        <span>⭐ แต้มสะสม: <strong>${currentMember.points || 0}</strong> แต้ม</span> | 
        <span style="color: #15803d; font-weight: 600;">🏷️ ส่วนลด ${(memberDiscountRate * 100).toFixed(0)}%</span>
      </div>
    `;
    btnClearMember.style.display = "inline-flex";

    renderCart();
  }

  // --- Register Member Modal & Box Actions ---
  btnOpenRegisterMember.addEventListener("click", async () => {
    if (currentMember) {
      const choice = await Auth.confirmModal({
        title: "สิทธิ์สมาชิก Cafe Club",
        message: `บิลนี้กำลังใช้สิทธิ์ของ "${currentMember.name}" (${currentMember.phone}) ส่วนลด 5%\nคุณต้องการยกเลิกการใช้สิทธิ์สมาชิกในบิลนี้หรือไม่?`,
        icon: "⭐",
        confirmText: "ยกเลิกสิทธิ์",
        cancelText: "ปิด",
        type: "warning",
      });
      if (choice) {
        clearMember();
        Auth.showToast("ยกเลิกสิทธิ์ส่วนลดสมาชิกเรียบร้อย", "info");
      }
      return;
    }

    // Open register modal
    regMemberPhone.value = memberPhone.value.trim() || "";
    regMemberName.value = "";
    regMemberMsg.style.display = "none";
    registerMemberModal.classList.remove("hidden");
    if (regMemberPhone.value) {
      regMemberName.focus();
    } else {
      regMemberPhone.focus();
    }
  });

  function closeRegisterMember() {
    registerMemberModal.classList.add("hidden");
  }

  btnCloseRegisterMember.addEventListener("click", closeRegisterMember);
  btnCancelRegisterMember.addEventListener("click", closeRegisterMember);

  // Form Submit: Register New Member
  formRegisterMember.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = regMemberName.value.trim();
    const phone = regMemberPhone.value.trim();

    if (!phone || !/^\d{10}$/.test(phone)) {
      regMemberMsg.style.display = "block";
      regMemberMsg.className = "wn-member-status error";
      regMemberMsg.textContent = "❌ กรุณากรอกหมายเลขโทรศัพท์ 10 หลัก";
      return;
    }

    if (!name) {
      regMemberMsg.style.display = "block";
      regMemberMsg.className = "wn-member-status error";
      regMemberMsg.textContent = "❌ กรุณากรอกชื่อ-นามสกุลของสมาชิก";
      return;
    }

    regMemberMsg.style.display = "block";
    regMemberMsg.className = "wn-member-status";
    regMemberMsg.textContent = "⏳ กำลังบันทึกข้อมูลสมาชิก...";

    try {
      const res = await Auth.api("POST", "/api/members/register", { name, phone });
      const memberData = (res.data && res.data.member) || res.member;

      if (!res.ok) {
        if (memberData) {
          applyMemberData(memberData);
          closeRegisterMember();
          Auth.showToast(`พบสมาชิกเดิม: คุณ ${memberData.name} (ใช้สิทธิ์ลด 5% ทันที)`, "info");
          return;
        }
        regMemberMsg.className = "wn-member-status error";
        regMemberMsg.textContent = `❌ ${res.error || (res.data && res.data.error) || "สมัครสมาชิกไม่สำเร็จ"}`;
        return;
      }

      if (memberData) {
        applyMemberData(memberData);
        closeRegisterMember();
        Auth.showToast(`สมัครสมาชิก Cafe Club สำเร็จ (คุณ ${memberData.name} ลด 5%)`, "info");
      } else {
        closeRegisterMember();
        Auth.showToast("บันทึกข้อมูลสมาชิกเรียบร้อย", "info");
      }
    } catch (err) {
      console.error("Register Member Exception:", err);
      regMemberMsg.className = "wn-member-status error";
      regMemberMsg.textContent = "เกิดข้อผิดพลาดในการประมวลผลข้อมูลสมาชิก";
    }
  });

  // Check Existing Member from Modal
  btnCheckExistingMember.addEventListener("click", async () => {
    const phone = regMemberPhone.value.trim();
    if (!phone || !/^\d{10}$/.test(phone)) {
      regMemberMsg.style.display = "block";
      regMemberMsg.className = "wn-member-status error";
      regMemberMsg.textContent = "กรุณากรอกหมายเลขโทรศัพท์ 10 หลักเพื่อค้นหา";
      return;
    }

    regMemberMsg.style.display = "block";
    regMemberMsg.className = "wn-member-status";
    regMemberMsg.textContent = "กำลังค้นหาข้อมูลสมาชิก...";

    try {
      const res = await Auth.api("GET", `/api/members/check/${encodeURIComponent(phone)}`);
      const memberData = (res.data && res.data.member) || res.member;

      if (!res.ok || !memberData) {
        regMemberMsg.className = "wn-member-status error";
        regMemberMsg.textContent = res.error || (res.data && res.data.error) || "ไม่พบข้อมูลสมาชิกในระบบ Cafe Club";
        return;
      }

      applyMemberData(memberData);
      closeRegisterMember();
      Auth.showToast(`พบสมาชิก Cafe Club (${memberData.name}) ส่วนลด 5%`, "info");
    } catch (err) {
      console.error("Check Member Exception:", err);
      regMemberMsg.className = "wn-member-status error";
      regMemberMsg.textContent = "เกิดข้อผิดพลาดในการค้นหาข้อมูลสมาชิก";
    }
  });

  // --- Payment Choice Modal Logic (UI เลือกระหว่าง QR กับ เงินสด) ---
  btnPayMain.addEventListener("click", () => {
    if (cart.length === 0) return;
    const { netTotal } = calculateBill();
    choiceDueAmountText.textContent = `฿${netTotal.toFixed(2)}`;
    paymentChoiceModal.classList.remove("hidden");
  });

  function closePaymentChoice() {
    paymentChoiceModal.classList.add("hidden");
  }

  btnClosePaymentChoice.addEventListener("click", closePaymentChoice);
  btnCancelPaymentChoice.addEventListener("click", closePaymentChoice);

  // Choice 1: QR PromptPay
  btnSelectQR.addEventListener("click", () => {
    closePaymentChoice();
    const { netTotal } = calculateBill();
    qrTotalText.textContent = `฿${netTotal.toFixed(2)}`;
    qrModal.classList.remove("hidden");
  });

  // Choice 2: Cash
  btnSelectCash.addEventListener("click", () => {
    closePaymentChoice();
    const { netTotal } = calculateBill();
    cashModalDueText.textContent = `฿${netTotal.toFixed(2)}`;
    cashReceivedInput.value = "";
    cashChangeText.textContent = "0.00 ฿";
    btnConfirmCash.disabled = true;
    cashModal.classList.remove("hidden");
    cashReceivedInput.focus();
  });

  // --- Payment Handling ---
  async function submitOrder(paymentMethod) {
    const user = Auth.getUser();
    const branchId = Auth.getBranchId();

    const orderPayload = {
      branchId,
      employeeId: user.employeeId || 1,
      userId: user.userId || user.employeeId || 1,
      memberId: currentMember ? currentMember.memberId : null,
      paymentMethod,
      items: cart.map((c) => ({
        menuId: c.menuId,
        quantity: c.quantity,
        notes: c.desc || "",
      })),
    };

    const res = await Auth.api("POST", "/api/orders", orderPayload);
    if (!res.ok) {
      Auth.showToast(res.error || "บันทึกออเดอร์ไม่สำเร็จ", "error");
      return null;
    }

    return res.data;
  }

  // --- Cash Modal Logic ---
  function updateCashChange() {
    const { netTotal } = calculateBill();
    const received = parseFloat(cashReceivedInput.value) || 0;
    const change = received - netTotal;

    if (change >= 0) {
      cashChangeText.textContent = `฿${change.toFixed(2)}`;
      cashChangeText.style.color = "#16a34a";
      btnConfirmCash.disabled = false;
    } else {
      cashChangeText.textContent = "ยังไม่พอยอดชำระ";
      cashChangeText.style.color = "var(--wn-danger)";
      btnConfirmCash.disabled = true;
    }
  }

  cashReceivedInput.addEventListener("input", updateCashChange);

  document.querySelectorAll(".cash-preset").forEach((btn) => {
    btn.addEventListener("click", () => {
      const { netTotal } = calculateBill();
      const val = btn.dataset.val;
      if (val === "exact") {
        cashReceivedInput.value = Math.ceil(netTotal);
      } else {
        cashReceivedInput.value = val;
      }
      updateCashChange();
    });
  });

  document.getElementById("btnCloseCash").addEventListener("click", () => cashModal.classList.add("hidden"));
  document.getElementById("btnCancelCash").addEventListener("click", () => cashModal.classList.add("hidden"));

  btnConfirmCash.addEventListener("click", async () => {
    btnConfirmCash.disabled = true;
    btnConfirmCash.textContent = "กำลังบันทึก...";

    const res = await submitOrder("cash");
    btnConfirmCash.textContent = "บันทึกการชำระเงิน & ออกใบเสร็จ";
    if (res) {
      cashModal.classList.add("hidden");
      openReceiptModal(res.orderId, "เงินสด (Cash)");
    }
  });

  // --- QR Modal Logic ---
  document.getElementById("btnCloseQR").addEventListener("click", () => qrModal.classList.add("hidden"));
  document.getElementById("btnCancelQR").addEventListener("click", () => qrModal.classList.add("hidden"));

  btnConfirmQR.addEventListener("click", async () => {
    btnConfirmQR.disabled = true;
    btnConfirmQR.textContent = "กำลังบันทึก...";

    const res = await submitOrder("promptpay");
    btnConfirmQR.textContent = "รับชำระเงินเรียบร้อย & ออกใบเสร็จ";
    if (res) {
      qrModal.classList.add("hidden");
      openReceiptModal(res.orderId, "QR PromptPay");
    }
  });

  // --- Receipt Modal ---
  function openReceiptModal(orderId, payMethod) {
    const user = Auth.getUser();
    const branchName =
      document.getElementById("wnNavBranch")?.selectedOptions[0]?.text ||
      user.branchName ||
      "สาขาสยาม";
    const { subtotal, discount, vat, netTotal } = calculateBill();

    document.getElementById("recBranchName").textContent = branchName.replace("📍 ", "");
    document.getElementById("recOrderId").textContent = `#${String(orderId).padStart(5, "0")}`;
    document.getElementById("recDateTime").textContent = new Date().toLocaleString("th-TH");
    document.getElementById("recCashierName").textContent = user.name;
    document.getElementById("recPaymentMethod").textContent = payMethod;

    document.getElementById("recItemsList").innerHTML = cart
      .map(
        (item) => `
        <div class="wn-receipt-item-row">
          <div>
            <div>${item.name} x${item.quantity}</div>
            <small style="color: var(--wn-gray);">${item.desc}</small>
          </div>
          <div>฿${item.lineTotal.toFixed(2)}</div>
        </div>
      `
      )
      .join("");

    document.getElementById("recSubtotal").textContent = `฿${subtotal.toFixed(2)}`;
    document.getElementById("recDiscount").textContent = `-฿${discount.toFixed(2)}`;
    document.getElementById("recVat").textContent = `฿${vat.toFixed(2)}`;
    document.getElementById("recNetTotal").textContent = `฿${netTotal.toFixed(2)}`;

    // Member row on receipt
    const recMemberRow = document.getElementById("recMemberRow");
    const recMemberName = document.getElementById("recMemberName");
    if (recMemberRow && recMemberName) {
      if (currentMember) {
        recMemberRow.style.display = "block";
        recMemberName.textContent = `${currentMember.name} (${currentMember.phone})`;
      } else {
        recMemberRow.style.display = "none";
      }
    }

    receiptModal.classList.remove("hidden");

    // Clear cart and member, reload stock
    cart = [];
    clearMember();
    renderCart();
    loadMenu();
  }

  document.getElementById("btnPrintSlip").addEventListener("click", () => {
    window.print();
  });

  document.getElementById("btnNewOrder").addEventListener("click", () => {
    receiptModal.classList.add("hidden");
    Auth.showToast("พร้อมรับออเดอร์ถัดไป", "info");
  });

  // Initial Load
  loadMenu();
});
