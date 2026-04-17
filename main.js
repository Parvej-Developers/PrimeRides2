

// ===================== MOBILE NAVIGATION TOGGLE =====================

const menuBtn = document.getElementById("menu-btn");
const navLinks = document.getElementById("nav-links");
const menuBtnIcon = menuBtn ? menuBtn.querySelector("i") : null;

if (menuBtn && navLinks && menuBtnIcon) {
  // Open/close mobile menu
  menuBtn.addEventListener("click", () => {
    navLinks.classList.toggle("open");

    const isOpen = navLinks.classList.contains("open");
    menuBtnIcon.setAttribute("class", isOpen ? "ri-close-line" : "ri-menu-line");
  });

  // Close menu when any nav link is clicked
  navLinks.addEventListener("click", () => {
    navLinks.classList.remove("open");
    menuBtnIcon.setAttribute("class", "ri-menu-line");
  });
}

// ===================== SCROLL REVEAL ANIMATIONS =====================

const scrollRevealOptions = {
  distance: "50px",
  origin: "bottom",
  duration: 1000,
};

// Only run if ScrollReveal is loaded on the page
if (typeof ScrollReveal === "function") {
  const sr = ScrollReveal();

  // Header section
  sr.reveal(".header__image img", {
    ...scrollRevealOptions,
    origin: "right",
  });

  sr.reveal(".header__content h1", {
    ...scrollRevealOptions,
    delay: 500,
  });

  sr.reveal(".header__content p", {
    ...scrollRevealOptions,
    delay: 1000,
  });

  sr.reveal(".header__links", {
    ...scrollRevealOptions,
    delay: 1500,
  });

  // Steps section
  sr.reveal(".steps__card", {
    ...scrollRevealOptions,
    interval: 500,
  });

  // Service section
  sr.reveal(".service__image img", {
    ...scrollRevealOptions,
    origin: "left",
  });

  sr.reveal(".service__content .section__subheader", {
    ...scrollRevealOptions,
    delay: 500,
  });

  sr.reveal(".service__content .section__header", {
    ...scrollRevealOptions,
    delay: 1000,
  });

  sr.reveal(".service__list li", {
    ...scrollRevealOptions,
    delay: 1500,
    interval: 500,
  });

  // Experience section
  sr.reveal(".experience__card", {
    duration: 1000,
    interval: 500,
  });

  // Download / app section
  sr.reveal(".download__image img", {
    ...scrollRevealOptions,
    origin: "right",
  });

  sr.reveal(".download__content .section__header", {
    ...scrollRevealOptions,
    delay: 500,
  });

  sr.reveal(".download__content p", {
    ...scrollRevealOptions,
    delay: 1000,
  });

  sr.reveal(".download__links", {
    ...scrollRevealOptions,
    delay: 1500,
  });
}
