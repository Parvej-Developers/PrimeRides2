// =================== auth.js ===================
function el(id) {
  return document.getElementById(id);
}

// ========== Custom Notification System ==========
function showNotification(message, type = 'success') {
  // Remove any existing notification
  const existingNotification = document.querySelector('.custom-notification');
  if (existingNotification) {
    existingNotification.remove();
  }

  // Create notification element
  const notification = document.createElement('div');
  notification.className = `custom-notification ${type}`;

  // Add icon based on type
  const icon = type === 'success' 
    ? '<i class="ri-checkbox-circle-fill"></i>' 
    : '<i class="ri-error-warning-fill"></i>';

  notification.innerHTML = `
    ${icon}
    <span>${message}</span>
    <button class="notification-close" onclick="this.parentElement.remove()">
      <i class="ri-close-line"></i>
    </button>
  `;

  // Add to body
  document.body.appendChild(notification);

  // Trigger animation
  setTimeout(() => notification.classList.add('show'), 10);

  // Auto remove after 4 seconds
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 300);
  }, 4000);
}

// Open modal function
function openModal(type) {
  const overlay = document.getElementById("overlay");
  const modal = document.getElementById("modal");
  modal.innerHTML = ""; // Clear previous content

  if (type === "signup") {
    modal.innerHTML = `
      <h2>Sign Up</h2>
      <div class="form-group">
        <input type="text" name="full_name" placeholder="Full Name" required />
      </div>
      <div class="form-group">
        <input type="email" name="email" placeholder="Your email" required />
      </div>
      <div class="form-group">
        <input type="password" name="password" placeholder="Password" required />
      </div>
      <button class="submit-btn">Sign Up</button>
      <p class="toggle-text">Already have an account? <span onclick="openModal('signin')">Sign In</span></p>
    `;
  } else {
    modal.innerHTML = `
      <h2>Sign In</h2>
      <div class="form-group">
        <input type="email" name="email" placeholder="Your email" required />
      </div>
      <div class="form-group">
        <input type="password" name="password" placeholder="Password" required />
      </div>
      <button class="submit-btn">Sign In</button>
      <p class="toggle-text">Don't have an account? <span onclick="openModal('signup')">Sign Up</span></p>
    `;
  }

  overlay.classList.add("active");
}

// Close modal on overlay click
const overlayEl = el("overlay");
if (overlayEl) {
  overlayEl.addEventListener("click", (e) => {
    if (e.target.id === "overlay") e.target.classList.remove("active");
  });
}

// ---------------- Submit Signup / Signin ----------------
document.addEventListener("click", async (e) => {
  if (!e.target.classList.contains("submit-btn")) return;

  const modal = document.getElementById("modal");
  const formType = e.target.textContent.includes("Up") ? "signup" : "signin";

  // Always read inputs from the visible modal, not the whole document
  const email = modal.querySelector('input[name="email"], input[placeholder="Your email"]')?.value?.trim() || "";
  const password = modal.querySelector('input[name="password"], input[placeholder="Password"]')?.value?.trim() || "";

  // Extra fields only for signup (safe if not present)
  const fullName = modal.querySelector('input[name="full_name"]')?.value?.trim();

  if (formType === "signin") {
    if (!email || !password) {
      showNotification("Please fill all fields!", "error");
      return;
    }

   const { error } = await window.supabase.auth.signInWithPassword({
  email,
  password
});

    if (error) {
      showNotification(error.message, "error");
      return;
    }

    document.getElementById("overlay").classList.remove("active");
    await loadUserRole();
    showNotification("Sign in successful! Welcome back.", "success");
    return;
  }

  // signup
  if (!fullName || !email || !password) {
    showNotification("Please fill all fields!", "error");
    return;
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, display_name: fullName }
    }
  });

  if (error) {
    showNotification(error.message, "error");
    return;
  }

  const user = data.user;
  if (user) await supabase.from("users").insert([{ id: user.id, role: "user" }]);

  showNotification("Signup successful! You can now sign in.", "success");
  document.getElementById("overlay").classList.remove("active");
});

// ---------------- Logout ----------------
async function logout() {
  await supabase.auth.signOut();
  localStorage.clear();
  renderAuthButtons();
  showNotification("Logged out successfully!", "success");
}

// ---------------- Load user role ----------------
async function loadUserRole() {
  const { data: { user } } = await window.supabase.auth.getUser();
  if (!user) {
    renderAuthButtons();
    return;
  }

  const { data, error } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = data?.role || "user";
  localStorage.setItem("loggedIn", "true");
  localStorage.setItem("role", role);
  renderAuthButtons();
}

// ---------------- Render Auth Buttons ----------------
function renderAuthButtons() {
  const navLinks = document.getElementById("nav-links"); // Mobile
  const navBtns = document.querySelector(".nav__btns"); // Desktop

  if (!navLinks || !navBtns) return;

  // Remove old auth buttons
  navLinks.querySelectorAll(".auth-nav-btn").forEach(el => el.remove());
  navBtns.querySelectorAll(".auth-nav-btn").forEach(el => el.remove());

  const loggedIn = localStorage.getItem("loggedIn");
  const role = localStorage.getItem("role");

  if (loggedIn) {
    // --- MOBILE version ---
    const mobileRoleBtn = document.createElement("li");
    mobileRoleBtn.className = "auth-nav-btn nav__links__btn";
    mobileRoleBtn.innerHTML =
      role === "admin"
        ? `<a href="admin.html">Admin Dashboard</a>`
        : `<a href="user.html">User Panel</a>`;

    const mobileLogoutBtn = document.createElement("li");
    mobileLogoutBtn.className = "auth-nav-btn nav__links__btn";
    mobileLogoutBtn.innerHTML = `<a href="#">Logout</a>`;
    mobileLogoutBtn.querySelector("a").addEventListener("click", logout);

    navLinks.append(mobileRoleBtn, mobileLogoutBtn);

    // --- DESKTOP version ---
    const desktopRoleBtn = document.createElement("button");
    desktopRoleBtn.className = "auth-nav-btn btn btn__primary";
    desktopRoleBtn.innerText = role === "admin" ? "Admin Dashboard" : "User Panel";
    desktopRoleBtn.onclick = () => {
      window.location.href = role === "admin" ? "admin.html" : "user.html";
    };

    const desktopLogoutBtn = document.createElement("button");
    desktopLogoutBtn.className = "auth-nav-btn btn btn__secondary";
    desktopLogoutBtn.innerText = "Logout";
    desktopLogoutBtn.onclick = logout;

    navBtns.append(desktopRoleBtn, desktopLogoutBtn);
  } else {
    // --- USER LOGGED OUT: Show Sign In / Sign Up buttons ---
    // Mobile
    const signupLi = document.createElement("li");
    signupLi.className = "auth-nav-btn nav__links__btn";
    signupLi.innerHTML = `<a href="#" onclick="openModal('signup')">Sign Up</a>`;

    const signinLi = document.createElement("li");
    signinLi.className = "auth-nav-btn nav__links__btn";
    signinLi.innerHTML = `<a href="#" onclick="openModal('signin')">Sign In</a>`;

    navLinks.append(signupLi, signinLi);

    // Desktop
    const signupBtn = document.createElement("button");
    signupBtn.className = "auth-nav-btn btn btn__primary";
    signupBtn.innerText = "Sign Up";
    signupBtn.onclick = () => openModal("signup");

    const signinBtn = document.createElement("button");
    signinBtn.className = "auth-nav-btn btn btn__secondary";
    signinBtn.innerText = "Sign In";
    signinBtn.onclick = () => openModal("signin");

    navBtns.append(signupBtn, signinBtn);
  }
}

// ---------------- Auto-run on page load ----------------
document.addEventListener("DOMContentLoaded", async () => {
  if (!window.supabase) return;

  const navLinks = document.getElementById("nav-links");
  const navBtns = document.querySelector(".nav__btns");

  // admin.html me auth UI hi nahi hota
  if (!navLinks && !navBtns) return;

  const { data } = await window.supabase.auth.getSession();
  if (data.session) {
    await loadUserRole();
  } else {
    renderAuthButtons();
  }
});
