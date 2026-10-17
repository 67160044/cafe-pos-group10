// public/js/login.js
document.addEventListener("DOMContentLoaded", () => {
  // If already logged in, redirect to the user's specific role page
  if (Auth.getToken() && Auth.getUser()) {
    const user = Auth.getUser();
    window.location.href = Auth.getRoleHomePage(user.role);
    return;
  }

  const form = document.getElementById("loginForm");
  const emailInput = document.getElementById("loginEmail");
  const passwordInput = document.getElementById("loginPassword");
  const errorBox = document.getElementById("loginError");
  const submitBtn = document.getElementById("btnSubmitLogin");

  // Handle Demo Buttons
  document.querySelectorAll(".wn-demo-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      emailInput.value = btn.dataset.email;
      passwordInput.value = btn.dataset.pass;
      errorBox.style.display = "none";
      doLogin(btn.dataset.email, btn.dataset.pass);
    });
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    if (!email || !password) {
      showError("กรุณากรอกทั้งอีเมลและรหัสผ่าน");
      return;
    }

    doLogin(email, password);
  });

  async function doLogin(email, password) {
    submitBtn.disabled = true;
    submitBtn.textContent = "กำลังเข้าสู่ระบบ...";
    errorBox.style.display = "none";

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        showError(data.error || "อีเมลหรือรหัสผ่านไม่ถูกต้อง");
        submitBtn.disabled = false;
        submitBtn.textContent = "เข้าสู่ระบบ (Sign In)";
        return;
      }

      // Success: นำทางไปยังหน้าเฉพาะของบทบาทนั้น ๆ
      Auth.setSession(data.token, data.user);
      window.location.href = Auth.getRoleHomePage(data.user.role);
    } catch (err) {
      showError("ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้");
      submitBtn.disabled = false;
      submitBtn.textContent = "เข้าสู่ระบบ (Sign In)";
    }
  }

  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.style.display = "block";
  }
});
