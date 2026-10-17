/**
 * Whatever Cafe POS - Sales Report & Analytics Screen Logic
 */

document.addEventListener("DOMContentLoaded", async () => {
  // กำหนดสิทธิ์: เข้าถึงได้เฉพาะบทบาท Manager เท่านั้น (Admin และ Cashier ไม่มีสิทธิ์เข้าถึงรายงานยอดขาย)
  if (!Auth.requireRolePage(["manager"])) return;
  await Auth.renderNavbar("report");

  const currentUser = Auth.getUser();

  const reportFrom = document.getElementById("reportFrom");
  const reportTo = document.getElementById("reportTo");
  const reportBranch = document.getElementById("reportBranch");
  const reportTopFilter = document.getElementById("reportTopFilter");
  const reportFilterForm = document.getElementById("reportFilterForm");
  const btnPrintReport = document.getElementById("btnPrintReport");

  // KPI Elements
  const kpiTotalSales = document.getElementById("kpiTotalSales");
  const kpiOrderCount = document.getElementById("kpiOrderCount");
  const kpiAvgTicket = document.getElementById("kpiAvgTicket");

  // Tables
  const branchTableBody = document.getElementById("branchTableBody");
  const topMenusTableBody = document.getElementById("topMenusTableBody");

  // กำหนดค่าและสิทธิ์ของ Dropdown สาขา:
  // - Cashier: เข้าหน้านี้ไม่ได้
  // - Admin (HQ) & Manager: สามารถดู report ได้ของทุกสาขา และเลือกดูเฉพาะสาขาได้
  async function setupBranchSelector() {
    try {
      const res = await fetch("/api/branches");
      const branches = res.ok ? await res.json() : [];
      let html = `<option value="all">ทุกสาขา (ภาพรวมสำนักงานใหญ่)</option>`;
      branches.forEach((b) => {
        html += `<option value="${b.branch_id}">${b.name}</option>`;
      });
      reportBranch.innerHTML = html;
      reportBranch.disabled = false;

      // ค่าเริ่มต้นให้แสดงภาพรวมทุกสาขา
      reportBranch.value = "all";
    } catch (e) {
      reportBranch.innerHTML = `
        <option value="all">ทุกสาขา (ภาพรวม)</option>
        <option value="1">สาขาสยาม</option>
        <option value="2">สาขาสีลม</option>
      `;
    }
  }

  await setupBranchSelector();

  // สำหรับ Manager หากเปลี่ยนสาขาใน Top Navbar ให้ซิงค์การค้นหา
  window.addEventListener("branchChanged", (e) => {
    if (isManager && reportBranch) {
      reportBranch.value = String(e.detail.branchId);
      loadReport();
    }
  });

  reportBranch.addEventListener("change", () => {
    loadReport();
  });

  function getDrinkEmoji(name) {
    const n = String(name).toLowerCase();
    if (n.includes("ชาไทย") || n.includes("ชานม") || n.includes("ไข่มุก")) return "🧋";
    if (n.includes("ชาเขียว") || n.includes("มัทฉะ") || n.includes("ชา")) return "🍵";
    if (n.includes("ลาเต้") || n.includes("คาปู") || n.includes("อเมริกาโน่") || n.includes("เอสเปรสโซ่") || n.includes("กาแฟ")) return "☕";
    if (n.includes("โกโก้") || n.includes("นม") || n.includes("ช็อกโกแลต")) return "🥛";
    return "🥤";
  }

  function formatYMD(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  // Set default dates: 7 days ago until today
  function setDatePreset(preset) {
    const today = new Date();
    const toStr = formatYMD(today);
    let fromDate = new Date();

    if (preset === "today") {
      fromDate = today;
    } else if (preset === "week") {
      fromDate.setDate(today.getDate() - 6);
    } else if (preset === "month") {
      fromDate = new Date(today.getFullYear(), today.getMonth(), 1);
    }

    reportFrom.value = formatYMD(fromDate);
    reportTo.value = toStr;

    document.querySelectorAll(".date-preset").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.preset === preset);
      btn.classList.toggle("wn-btn-primary", btn.dataset.preset === preset);
      btn.classList.toggle("wn-btn-secondary", btn.dataset.preset !== preset);
    });
  }

  document.querySelectorAll(".date-preset").forEach((btn) => {
    btn.addEventListener("click", () => {
      setDatePreset(btn.dataset.preset);
      loadReport();
    });
  });

  reportFilterForm.addEventListener("submit", (e) => {
    e.preventDefault();
    loadReport();
  });

  reportFrom.addEventListener("change", loadReport);
  reportTo.addEventListener("change", loadReport);
  reportTopFilter.addEventListener("change", loadReport);

  btnPrintReport.addEventListener("click", () => {
    window.print();
  });

  async function loadReport() {
    const from = reportFrom.value;
    const to = reportTo.value;
    const top = reportTopFilter.value;
    let branchVal = reportBranch.value;

    // ถ้าเป็น admin ให้ส่ง branchId ของตนเองเสมอ
    if (isAdmin) {
      branchVal = String(currentUser.branchId || 1);
    }

    if (!from || !to) {
      Auth.showToast("กรุณาระบุช่วงวันที่ให้ครบถ้วน", "warning");
      return;
    }

    if (from > to) {
      Auth.showToast("วันที่เริ่มต้นต้องไม่มากกว่าวันที่สิ้นสุด", "warning");
      return;
    }

    let url = `/api/reports/sales?from=${from}&to=${to}&top=${top}`;
    if (branchVal && branchVal !== "all") {
      url += `&branchId=${branchVal}`;
    }

    kpiTotalSales.textContent = "กำลังคำนวณ...";
    kpiOrderCount.textContent = "-";
    kpiAvgTicket.textContent = "-";

    const res = await Auth.api("GET", url);
    if (!res.ok) {
      Auth.showToast(res.error || "ไม่สามารถโหลดข้อมูลรายงานได้", "error");
      return;
    }

    const { summary, by_branch, top_menus } = res.data;

    // Render KPIs
    const totalSales = Number(summary?.total_sales || 0);
    const orderCount = Number(summary?.order_count || 0);
    const avgTicket = orderCount > 0 ? totalSales / orderCount : 0;

    kpiTotalSales.textContent = `฿${totalSales.toLocaleString("th-TH", { minimumFractionDigits: 2 })}`;
    kpiOrderCount.textContent = `${orderCount.toLocaleString()} บิล`;
    kpiAvgTicket.textContent = `฿${avgTicket.toLocaleString("th-TH", { minimumFractionDigits: 2 })}`;

    // Render Branch Breakdown
    if (!by_branch || by_branch.length === 0) {
      branchTableBody.innerHTML = `
        <tr><td colspan="4" class="text-center" style="padding: 24px; color: var(--wn-gray);">ไม่มีข้อมูลยอดขายในสาขาที่เลือก</td></tr>
      `;
    } else {
      branchTableBody.innerHTML = by_branch
        .map((b) => {
          const sales = Number(b.sales || 0);
          const percent = totalSales > 0 ? ((sales / totalSales) * 100).toFixed(1) : "0.0";
          return `
            <tr>
              <td style="font-weight: 600;">${b.branch_name}</td>
              <td class="text-center">${Number(b.orders || 0)} บิล</td>
              <td class="text-right" style="font-weight: 700; color: var(--wn-green);">฿${sales.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td>
              <td class="text-right">
                <span style="background: var(--wn-green-light); color: var(--wn-green-dark); padding: 2px 8px; border-radius: 4px; font-size: 11.5px; font-weight: 600;">
                  ${percent}%
                </span>
              </td>
            </tr>
          `;
        })
        .join("");
    }

    // Render Top Menus
    if (!top_menus || top_menus.length === 0) {
      topMenusTableBody.innerHTML = `
        <tr><td colspan="4" class="text-center" style="padding: 24px; color: var(--wn-gray);">ไม่มีข้อมูลเมนูขายดีในช่วงเวลานี้</td></tr>
      `;
    } else {
      topMenusTableBody.innerHTML = top_menus
        .map((m, index) => {
          const rank = `#${index + 1}`;
          const qty = Number(m.quantity || 0);
          const sales = Number(m.sales || 0);
          return `
            <tr>
              <td style="font-size: 14px; font-weight: 700; color: var(--wn-gray);">${rank}</td>
              <td>
                <div style="font-weight: 600; color: var(--wn-dark);">${m.name}</div>
              </td>
              <td class="text-center" style="font-weight: 600;">${qty} แก้ว</td>
              <td class="text-right" style="font-weight: 700; color: var(--wn-green);">฿${sales.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td>
            </tr>
          `;
        })
        .join("");
    }
  }

  // Initialize with week preset
  setDatePreset("week");
  loadReport();
});
