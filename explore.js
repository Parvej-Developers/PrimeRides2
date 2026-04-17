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

// ===================== CAR LISTING (SUPABASE-DRIVEN) =====================

// Core elements
const cardGrid = document.querySelector(".card-grid");
const searchInput = document.getElementById("searchInput");

// Store all cars for filtering
let allCars = [];

/**
 * Format daily price into INR currency string.
 */
function formatPrice(value) {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "number") {
    return `₹${value.toLocaleString("en-IN")}/day`;
  }
  return `${value}`;
}

/**
 * Return inline style for badge based on availability.
 * Keeps design same as your CSS; only adds red tone for unavailable cars.
 */
function badgeInlineStyleFor(status) {
  return status === "available" ? "" : ' style="background:#fee2e2;color:#991b1b"';
}

/**
 * Return badge text based on availability.
 */
function badgeTextFor(status) {
  return status === "available" ? "Available Now" : "Unavailable";
}

/**
 * Fetch cars from Supabase and render them.
 * Does not filter by status; badge only reflects current status.
 */
async function loadCars() {
  if (!cardGrid) return;

  if (!window.supabase) {
    console.error("Supabase not initialized");
    return;
  }

  const { data: cars, error } = await window.supabase
    .from("cars")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error loading cars:", error);
    cardGrid.innerHTML = "<p>Failed to load cars</p>";
    return;
  }

  allCars = cars || [];
  renderCars(allCars);
}

/**
 * Render a list of cars into the grid.
 * Layout is unchanged; only the status badge is dynamic.
 */
function renderCars(list) {
  if (!cardGrid) return;

  cardGrid.innerHTML = "";

  if (list.length === 0) {
    cardGrid.innerHTML = "<p style='grid-column: 1/-1; text-align: center; padding: 40px; color: #64748b;'>No cars found matching your filters.</p>";
    return;
  }

  list.forEach((car) => {
    const status = (car.status || "available").toLowerCase();
    const priceText =
      car.rate_per_day != null ? formatPrice(car.rate_per_day) : car.price || "";

    const card = document.createElement("div");
    card.classList.add("card");
    card.setAttribute("data-car-id", car.id);

    // Navigate to car details page on click
    card.addEventListener("click", () => {
      window.location.href = `y.html?id=${car.id}`;
    });

    card.innerHTML = `
      <div class="card-image">
        <span class="badge"${badgeInlineStyleFor(status)}>${badgeTextFor(
      status
    )}</span>
        <img src="${car.image_url}" alt="${car.name}" />
        <span class="price">${priceText}</span>
      </div>
      <div class="card-content">
        <h3>${car.name}</h3>
        <p>${car.type}</p>
        <ul class="features">
          <li><img src="icons/users_icon.svg" alt="Seats" /> ${car.seats}</li>
          <li><img src="icons/fuel_icon.svg" alt="Fuel" /> ${car.fuel}</li>
          <li><img src="icons/car_icon.svg" alt="Transmission" /> ${
            car.transmission
          }</li>
          <li><img src="icons/location_icon.svg" alt="Location" /> ${
            car.location
          }</li>
        </ul>
      </div>
    `;

    cardGrid.appendChild(card);
  });
}

/**
 * Subscribe to realtime status updates and update only the status badge.
 */
function initRealtimeStatus() {
  if (!window.supabase) return;

  try {
    window.supabase
      .channel("cars-status")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "cars",
          columns: ["status"],
        },
        (payload) => {
          const { id, status } = payload.new || {};
          if (!id) return;

          const card = document.querySelector(`.card[data-car-id="${id}"]`);
          if (!card) return;

          const badge = card.querySelector(".badge");
          if (!badge) return;

          const normalizedStatus = (status || "available").toLowerCase();
          badge.textContent = badgeTextFor(normalizedStatus);

          if (normalizedStatus === "available") {
            badge.removeAttribute("style");
          } else {
            badge.setAttribute("style", "background:#fee2e2;color:#991b1b");
          }
        }
      )
      .subscribe();
  } catch (error) {
    // Non-blocking: just log the issue if realtime fails
    console.warn("Realtime status updates unavailable:", error);
  }
}

/**
 * Attach search handler to filter cars by name.
 * Status is still fetched so badge remains accurate.
 */
function initSearch() {
  if (!searchInput) return;

  searchInput.addEventListener("input", async (event) => {
    const query = event.target.value.toLowerCase();

    if (!window.supabase) return;

    const { data: filtered, error } = await window.supabase
      .from("cars")
      .select(
        "id,name,type,price,seats,fuel,transmission,location,image_url,status,rate_per_day"
      )
      .ilike("name", `%${query}%`)
      .order("created_at", { ascending: false });

    if (!error) {
      allCars = filtered || [];
      renderCars(allCars);
    }
  });
}

// ===================== FILTER SYSTEM =====================

const filterIcon = document.getElementById("filter");
const filterPanel = document.getElementById("filterPanel");
const applyFiltersBtn = document.getElementById("applyFilters");
const resetFiltersBtn = document.getElementById("resetFilters");

// Toggle filter panel
if (filterIcon && filterPanel) {
  filterIcon.addEventListener("click", (e) => {
    e.stopPropagation();
    filterPanel.classList.toggle("active");
  });

  // Close filter when clicking outside
  document.addEventListener("click", (e) => {
    if (!filterPanel.contains(e.target) && !filterIcon.contains(e.target)) {
      filterPanel.classList.remove("active");
    }
  });

  // Prevent closing when clicking inside filter panel
  filterPanel.addEventListener("click", (e) => {
    e.stopPropagation();
  });
}

// Apply filters
if (applyFiltersBtn) {
  applyFiltersBtn.addEventListener("click", () => {
    applyFilters();
    filterPanel.classList.remove("active");
  });
}

// Reset filters
if (resetFiltersBtn) {
  resetFiltersBtn.addEventListener("click", () => {
    resetFilters();
  });
}

/**
 * Apply all selected filters
 */
function applyFilters() {
  const priceRange = document.getElementById("priceRange").value;
  const availableOnly = document.getElementById("availableOnly").checked;
  const fuelType = document.getElementById("fuelType").value;
  const transmission = document.getElementById("transmission").value;
  const seats = document.getElementById("seats").value;

  let filtered = [...allCars];

  // Price filter
  if (priceRange !== "all") {
    const [min, max] = priceRange.split("-").map(Number);
    filtered = filtered.filter((car) => {
      const price = car.rate_per_day || 0;
      if (max) {
        return price >= min && price <= max;
      } else {
        return price >= min;
      }
    });
  }

  // Available only filter
  if (availableOnly) {
    filtered = filtered.filter(
      (car) => (car.status || "available").toLowerCase() === "available"
    );
  }

  // Fuel type filter
  if (fuelType !== "all") {
    filtered = filtered.filter(
      (car) => car.fuel && car.fuel.toLowerCase() === fuelType.toLowerCase()
    );
  }

  // Transmission filter
  if (transmission !== "all") {
    filtered = filtered.filter(
      (car) => car.transmission && car.transmission.toLowerCase() === transmission.toLowerCase()
    );
  }

  // Seats filter
  if (seats !== "all") {
    filtered = filtered.filter((car) => {
      const carSeats = parseInt(car.seats);
      return carSeats === parseInt(seats);
    });
  }

  renderCars(filtered);
  updateActiveFiltersCount();
}

/**
 * Reset all filters to default
 */
function resetFilters() {
  document.getElementById("priceRange").value = "all";
  document.getElementById("availableOnly").checked = false;
  document.getElementById("fuelType").value = "all";
  document.getElementById("transmission").value = "all";
  document.getElementById("seats").value = "all";

  renderCars(allCars);
  updateActiveFiltersCount();
  filterPanel.classList.remove("active");
}

/**
 * Update the active filters count badge
 */
function updateActiveFiltersCount() {
  let count = 0;

  if (document.getElementById("priceRange").value !== "all") count++;
  if (document.getElementById("availableOnly").checked) count++;
  if (document.getElementById("fuelType").value !== "all") count++;
  if (document.getElementById("transmission").value !== "all") count++;
  if (document.getElementById("seats").value !== "all") count++;

  const badge = document.querySelector(".filter-badge");
  if (badge) {
    if (count > 0) {
      badge.textContent = count;
      badge.style.display = "flex";
    } else {
      badge.style.display = "none";
    }
  }
}

// ===================== INITIALIZE PAGE =====================

loadCars();
initRealtimeStatus();
initSearch();