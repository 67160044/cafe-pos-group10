/**
 * Whatever Cafe POS - Sales Report & Analytics Screen Logic
 */

document.addEventListener("DOMContentLoaded", async () => {
  // กำหนดสิทธิ์: เข้าถึงได้เฉพาะบทบาท Manager เท่านั้น (Admin และ Cashier ไม่มีสิทธิ์เข้าถึงรายงานยอดขาย)
  if (!Auth.requireRolePage(["manager"])) return;
  await Auth.renderNavbar("report");

  const currentUser = Auth.getUser();
  const isAdmin = currentUser?.role === "admin";
  const isManager = currentUser?.role === "manager";

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
      let html = `<option value="all">ทุกสาขา</option>`;
      branches.forEach((b) => {
        html += `<option value="${b.branch_id}">${b.name}</option>`;
      });
      reportBranch.innerHTML = html;
      reportBranch.disabled = false;

      // ค่าเริ่มต้นให้แสดงภาพรวมทุกสาขา
      reportBranch.value = "all";
    } catch (e) {
      reportBranch.innerHTML = `
        <option value="all">ทุกสาขา</option>
        <option value="1">สยาม</option>
        <option value="2">สีลม</option>
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

    const { summary, byBranch, topMenus } = res.data;

    // Render KPIs
    const totalSales = Number(summary?.totalSales || 0);
    const orderCount = Number(summary?.orderCount || 0);
    const avgTicket = orderCount > 0 ? totalSales / orderCount : 0;

    kpiTotalSales.textContent = `฿${totalSales.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    kpiOrderCount.textContent = orderCount.toLocaleString();
    kpiAvgTicket.textContent = `฿${avgTicket.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    // Render Branch Breakdown
    if (!byBranch || byBranch.length === 0) {
      branchTableBody.innerHTML = `
        <tr><td colspan="4" class="wn-empty-row">ไม่มียอดขายในช่วงวันที่นี้ ลองขยายช่วงวันที่ หรือเลือกทุกสาขา</td></tr>
      `;
    } else {
      branchTableBody.innerHTML = byBranch
        .map((b) => {
          const sales = Number(b.sales || 0);
          const percent = totalSales > 0 ? ((sales / totalSales) * 100).toFixed(1) : "0.0";
          return `
            <tr>
              <td class="wn-strong">${b.branchName}</td>
              <td class="text-center">${Number(b.orders || 0)} บิล</td>
              <td class="wn-money">฿${sales.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              <td class="text-right">
                <span class="wn-share">
                  <span class="wn-share-bar"><i style="width: ${percent}%"></i></span>
                  ${percent}%
                </span>
              </td>
            </tr>
          `;
        })
        .join("");
    }

    // Render Top Menus
    if (!topMenus || topMenus.length === 0) {
      topMenusTableBody.innerHTML = `
        <tr><td colspan="4" class="wn-empty-row">ยังไม่มีเมนูที่ขายได้ในช่วงนี้</td></tr>
      `;
    } else {
      topMenusTableBody.innerHTML = topMenus
        .map((m, index) => {
          const rank = `#${index + 1}`;
          const qty = Number(m.quantity || 0);
          const sales = Number(m.sales || 0);
          return `
            <tr>
              <td class="wn-rank ${index < 3 ? "top" : ""}">${index + 1}</td>
              <td class="wn-strong">${m.name}</td>
              <td class="text-right">${qty}</td>
              <td class="wn-money">฿${sales.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
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
