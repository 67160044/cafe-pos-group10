/**
 * Whatever Cafe POS - Barista Kitchen Display System (KDS) Logic
 * ตรงตาม wk03-requirements (FR-03, FR-04, FR-08, NFR-01) และ wk04-user-stories (US-03, US-04)
 */

document.addEventListener("DOMContentLoaded", async () => {
  // 1. ตรวจสอบสิทธิ์ Barista (และอนุญาตให้ Manager ตรวจสอบคิวได้)
  if (!Auth.requireRolePage(["barista", "manager"])) {
    return;
  }

  // 2. เรนเดอร์ Navbar ของบาริสต้า
  await Auth.renderNavbar("barista");

  // State
  let orders = [];
  let currentFilter = "active";
  let soundEnabled = true;
  let previousOrderIds = new Set();
  let isFirstLoad = true;

  // DOM Elements
  const kdsOrderGrid = document.getElementById("kdsOrderGrid");
  const kdsFilterPills = document.getElementById("kdsFilterPills");
  const kdsFilteredText = document.getElementById("kdsFilteredText");

  const kpiPendingCount = document.getElementById("kpiPendingCount");
  const kpiPreparingCount = document.getElementById("kpiPreparingCount");
  const kpiReadyCount = document.getElementById("kpiReadyCount");
  const kpiCompletedCount = document.getElementById("kpiCompletedCount");

  const badgeActiveCount = document.getElementById("badgeActiveCount");
  const badgePending = document.getElementById("badgePending");
  const badgePreparing = document.getElementById("badgePreparing");
  const badgeReady = document.getElementById("badgeReady");
  const badgeCompleted = document.getElementById("badgeCompleted");
  const badgeAll = document.getElementById("badgeAll");

  const btnSoundToggle = document.getElementById("btnSoundToggle");
  const soundStateText = document.getElementById("soundStateText");
  const btnManualRefresh = document.getElementById("btnManualRefresh");

  // Audio Chime Generator using Web Audio API
  function playNewOrderSound() {
    if (!soundEnabled) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const now = ctx.currentTime;

      // Tone 1: High note
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(587.33, now); // D5
      gain1.gain.setValueAtTime(0.15, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.35);

      // Tone 2: Higher note
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(880.0, now + 0.15); // A5
      gain2.gain.setValueAtTime(0.18, now + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.15);
      osc2.stop(now + 0.6);
    } catch (e) {
      // AudioContext might be blocked before first user gesture
    }
  }

  btnSoundToggle.addEventListener("click", () => {
    soundEnabled = !soundEnabled;
    soundStateText.textContent = soundEnabled ? "เปิด" : "ปิด";
    soundStateText.style.color = soundEnabled ? "#16a34a" : "var(--wn-danger)";
    if (soundEnabled) {
      playNewOrderSound();
      Auth.showToast("เปิดเสียงแจ้งเตือนออเดอร์ใหม่เรียบร้อย", "info");
    } else {
      Auth.showToast("ปิดเสียงแจ้งเตือนออเดอร์", "warning");
    }
  });

  // ==========================================================================
  // Fetch Orders Queue
  // ==========================================================================

  async function fetchQueue() {
    try {
      const res = await Auth.api("GET", "/api/orders/queue");
      if (res.ok && res.data.success) {
        const newOrders = res.data.queue || [];

        // ตรวจสอบว่ามีออเดอร์ใหม่เข้ามาหรือไม่ (สำหรับส่งเสียงเตือนบาริสต้า)
        if (!isFirstLoad) {
          const incomingOrders = newOrders.filter(
            (o) => !previousOrderIds.has(o.order_id) && o.status === "pending"
          );
          if (incomingOrders.length > 0) {
            playNewOrderSound();
            Auth.showToast(`🔔 มีออเดอร์ใหม่ ${incomingOrders.length} รายการเข้ามาที่บาร์!`, "info");
          }
        }

        orders = newOrders;
        previousOrderIds = new Set(orders.map((o) => o.order_id));
        isFirstLoad = false;

        updateKPIs();
        renderOrders();
      }
    } catch (err) {
      console.error("Fetch Barista Queue Error:", err);
    }
  }

  btnManualRefresh.addEventListener("click", async () => {
    btnManualRefresh.disabled = true;
    btnManualRefresh.textContent = "⏳ กำลังโหลด...";
    await fetchQueue();
    btnManualRefresh.disabled = false;
    btnManualRefresh.textContent = "🔄 รีเฟรช";
  });

  // ==========================================================================
  // KPI & Metric Updates
  // ==========================================================================

  function updateKPIs() {
    let pending = 0;
    let preparing = 0;
    let ready = 0;
    let completed = 0;

    orders.forEach((o) => {
      if (o.status === "pending") pending++;
      else if (o.status === "preparing") preparing++;
      else if (o.status === "ready") ready++;
      else if (o.status === "completed") completed++;
    });

    const activeCount = pending + preparing;

    kpiPendingCount.textContent = pending;
    kpiPreparingCount.textContent = preparing;
    kpiReadyCount.textContent = ready;
    kpiCompletedCount.textContent = completed;

    badgeActiveCount.textContent = activeCount;
    badgePending.textContent = pending;
    badgePreparing.textContent = preparing;
    badgeReady.textContent = ready;
    badgeCompleted.textContent = completed;
    badgeAll.textContent = orders.length;
  }

  // ==========================================================================
  // Filter Tabs
  // ==========================================================================

  kdsFilterPills.querySelectorAll(".wn-kds-pill").forEach((btn) => {
    btn.addEventListener("click", () => {
      kdsFilterPills.querySelectorAll(".wn-kds-pill").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentFilter = btn.dataset.filter;
      renderOrders();
    });
  });

  // ==========================================================================
  // Render Orders Grid
  // ==========================================================================

  function renderOrders() {
    let filtered = orders;

    if (currentFilter === "active") {
      filtered = orders.filter((o) => o.status === "pending" || o.status === "preparing");
    } else if (currentFilter !== "all") {
      filtered = orders.filter((o) => o.status === currentFilter);
    }

    kdsFilteredText.textContent = filtered.length;

    if (filtered.length === 0) {
      kdsOrderGrid.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 60px 20px; text-align: center; background: #ffffff; border-radius: var(--wn-radius); border: 1px dashed var(--wn-border);">
          <h3 style="font-size: 16px; color: var(--wn-dark); margin-bottom: 4px;">ไม่มีรายการออเดอร์ในหมวดนี้</h3>
          <p style="color: var(--wn-gray); font-size: 12.5px;">บาร์เครื่องดื่มพร้อมรับออเดอร์ใหม่จากแคชเชียร์หน้าร้าน</p>
        </div>
      `;
      return;
    }

    kdsOrderGrid.innerHTML = filtered
      .map((order) => {
        const orderIdFormatted = `#${String(order.order_id).padStart(5, "0")}`;
        const timeElapsed = getElapsedTime(order.created_at);
        const isUrgent = order.status === "pending" && timeElapsed.minutes >= 5;

        let statusBadge = "";
        let actionButtons = "";

        if (order.status === "pending") {
          statusBadge = '<span class="wn-role-badge" style="background:#fef3c7; color:#92400e;">รอคิวชง</span>';
          actionButtons = `
            <button type="button" class="wn-kds-btn wn-kds-btn-start btn-status-action" data-id="${order.order_id}" data-status="preparing">
              เริ่มปรุง
            </button>
          `;
        } else if (order.status === "preparing") {
          statusBadge = '<span class="wn-role-badge" style="background:#e0f2fe; color:#0369a1;">กำลังปรุง</span>';
          actionButtons = `
            <button type="button" class="wn-kds-btn wn-kds-btn-ready btn-status-action" data-id="${order.order_id}" data-status="ready">
              พร้อมเสิร์ฟ
            </button>
          `;
        } else if (order.status === "ready") {
          statusBadge = '<span class="wn-role-badge cashier" style="background:#dcfce7; color:#15803d;">พร้อมเสิร์ฟ</span>';
          actionButtons = `
            <button type="button" class="wn-kds-btn wn-kds-btn-complete btn-status-action" data-id="${order.order_id}" data-status="completed">
              ส่งมอบแล้ว (เสร็จสิ้น)
            </button>
          `;
        } else if (order.status === "completed") {
          statusBadge = '<span class="wn-role-badge" style="background:#f1f5f9; color:#64748b;">เสร็จสิ้น</span>';
          actionButtons = `
            <div style="font-size: 12px; color: var(--wn-gray); text-align: center; width: 100%; padding: 4px;">
              เสิร์ฟเรียบร้อยแล้ว
            </div>
          `;
        }

        const itemsHtml = (order.items || [])
          .map((item) => {
            const notesBadge = item.notes
              ? `<div class="wn-kds-item-notes">หมายเหตุ: ${escapeHtml(item.notes)}</div>`
              : "";

            return `
              <div class="wn-kds-item-row">
                <div class="wn-kds-item-qty">x${item.quantity}</div>
                <div class="wn-kds-item-info">
                  <div class="wn-kds-item-name">${escapeHtml(item.menu_name || "เครื่องดื่ม")}</div>
                  ${notesBadge}
                </div>
              </div>
            `;
          })
          .join("");

        const memberTag = order.member_name
          ? `<span style="color: #166534; font-weight: 500;">สมาชิก: ${escapeHtml(order.member_name)}</span>`
          : `<span>แคชเชียร์: ${escapeHtml(order.cashier_name || "หน้าร้าน")}</span>`;

        return `
          <div class="wn-kds-card status-${order.status}">
            <div class="wn-kds-card-header">
              <div class="wn-kds-order-num">${orderIdFormatted}</div>
              <div style="display: flex; gap: 8px; align-items: center;">
                <div class="wn-kds-timer ${isUrgent ? "urgent" : ""}">
                  ${timeElapsed.text}
                </div>
                ${statusBadge}
              </div>
            </div>

            <div class="wn-kds-card-meta">
              ${memberTag}
              <span>${formatPayMethod(order.payment_method)}</span>
            </div>

            <div class="wn-kds-items">
              ${itemsHtml}
            </div>

            <div class="wn-kds-card-footer">
              ${actionButtons}
            </div>
          </div>
        `;
      })
      .join("");

    // Attach Action Handlers
    kdsOrderGrid.querySelectorAll(".btn-status-action").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const orderId = Number(btn.dataset.id);
        const nextStatus = btn.dataset.status;
        await updateStatus(orderId, nextStatus, btn);
      });
    });
  }

  async function updateStatus(orderId, nextStatus, btnElement) {
    btnElement.disabled = true;
    btnElement.textContent = "กำลังอัปเดต...";

    try {
      const res = await Auth.api("PATCH", `/api/orders/${orderId}/status`, { status: nextStatus });
      if (res.ok && res.data.success) {
        Auth.showToast(res.data.message || "อัปเดตสถานะสำเร็จ", "info");

        // Optimistic UI update in memory
        const target = orders.find((o) => o.order_id === orderId);
        if (target) {
          target.status = nextStatus;
          updateKPIs();
          renderOrders();
        }

        // Fresh sync
        await fetchQueue();
      } else {
        Auth.showToast(res.error || "ไม่สามารถอัปเดตสถานะได้", "error");
        btnElement.disabled = false;
      }
    } catch (err) {
      console.error("Update Status Exception:", err);
      Auth.showToast("เกิดข้อผิดพลาดในการเชื่อมต่อ", "error");
      btnElement.disabled = false;
    }
  }

  // ==========================================================================
  // Helper Utilities
  // ==========================================================================

  function getElapsedTime(dateStr) {
    if (!dateStr) return { text: "เมื่อสักครู่", minutes: 0 };
    const safeDateStr = String(dateStr).includes(" ") && !String(dateStr).includes("T")
      ? String(dateStr).replace(" ", "T")
      : dateStr;
    const orderTime = new Date(safeDateStr);
    if (isNaN(orderTime.getTime())) return { text: "เมื่อสักครู่", minutes: 0 };
    const now = new Date();
    const diffMs = now - orderTime;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins <= 0) return { text: "เพิ่งสั่ง", minutes: 0 };
    if (diffMins < 60) return { text: `${diffMins} นาทีที่แล้ว`, minutes: diffMins };
    const diffHours = Math.floor(diffMins / 60);
    return { text: `${diffHours} ชม. ที่แล้ว`, minutes: diffMins };
  }

  function formatPayMethod(method) {
    if (method === "promptpay" || method === "qr") return "QR PromptPay";
    if (method === "cash") return "เงินสด";
    return method || "ชำระแล้ว";
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Initial fetch
  await fetchQueue();

  // Auto-polling every 3.5 seconds for instant real-time sync (NFR-01: < 2 วินาที)
  setInterval(() => {
    fetchQueue();
  }, 3500);

  // Re-calculate timers every 30 seconds
  setInterval(() => {
    renderOrders();
  }, 30000);
});
