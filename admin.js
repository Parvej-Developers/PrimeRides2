// === GLOBAL CONCURRENCY CONTROL ===
let currentUserCache = null;
let isStatsLoading = false;
let isBookingsLoading = false;

async function getCachedUser() {
    if (currentUserCache) return currentUserCache;
    const { data: { user }, error } = await window.supabase.auth.getUser();
    if (user) currentUserCache = user;
    return currentUserCache;
}   

function initMobileMenu() {
  const toggle = document.getElementById("menuToggle");
  const sidebar = document.getElementById("sidebar");

  console.log("Initializing mobile menu...");
  console.log("Mobile toggle found:", !!toggle);
  console.log("Sidebar found:", !!sidebar);

  if (!toggle || !sidebar) {
    console.error("Mobile menu elements not found!");
    return;
  }

  toggle.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    sidebar.classList.toggle("open");
  });

  document.addEventListener("click", (e) => {
    if (!sidebar.contains(e.target) && !toggle.contains(e.target)) {
      sidebar.classList.remove("open");
    }
  });
}

function openMobileMenu() {
  const sidebar = document.getElementById("sidebar");
  if (sidebar) sidebar.classList.add("open");
}

function closeMobileMenu() {
  const sidebar = document.getElementById("sidebar");
  if (sidebar) sidebar.classList.remove("open");
}

// === SUPABASE CAR MANAGEMENT ===

// Load cars from Supabase
async function loadCars() {
    console.log('Loading cars from Supabase...');
    const carsContainer = document.getElementById('carsContainer');

    if (!carsContainer) {
        console.error('Cars container not found');
        return;
    }

    // Show loading state
    carsContainer.innerHTML = `
        <div class="loading-state">
            <i class="fas fa-spinner fa-spin"></i>
            <p>Loading cars...</p>
        </div>
    `;

    try {
        const { data: cars, error } = await window.supabase
            .from('cars')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error loading cars:', error);
            carsContainer.innerHTML = `
                <div class="error-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Failed to load cars. Please try again.</p>
                    <button class="btn btn-primary" onclick="loadCars()">Retry</button>
                </div>
            `;
            return;
        }

        console.log('Cars loaded:', cars?.length || 0);
        renderCars(cars || []);
    } catch (error) {
        console.error('Error loading cars:', error);
        carsContainer.innerHTML = `
            <div class="error-state">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Failed to load cars. Please check your connection.</p>
            </div>
        `;
    }
}

// Render cars in the manage cars table
function renderCars(cars) {
    const carsContainer = document.getElementById('carsContainer');

    if (!cars || cars.length === 0) {
        carsContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-car"></i>
                <h3>No cars found</h3>
                <p>Add your first car to get started</p>
                <button class="btn btn-primary" onclick="showPage('addcar', event)">
                    <i class="fas fa-plus"></i>
                    Add Car
                </button>
            </div>
        `;
        return;
    }

    const carsHTML = cars.map(car => {
        const isAvailable = car.status !== 'unavailable';
        const statusClass = isAvailable ? 'available' : 'not-available';
        const statusText = isAvailable ? 'Available' : 'Not Available';
        const toggleIcon = isAvailable ? 'fa-eye' : 'fa-eye-slash';

        return `
            <div class="car-row" data-car-id="${car.id}">
                <div class="car-info">
                    <div class="car-image">
                        ${car.image_url ?
                `<img src="${car.image_url}" alt="${car.name}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;" />` :
                `<i class="fas fa-car"></i>`
            }
                    </div>
                    <div class="car-details">
                        <strong>${car.name || 'Unknown Car'}</strong>
                        <small>${car.type || ''} ‚ ${car.fuel || ''} ‚ ${car.transmission || ''}</small>
                    </div>
                </div>
                <div class="car-price">${car.price || 'N/A'}</div>
                <div class="car-status">
                    <span class="status-badge ${statusClass}">${statusText}</span>
                </div>
                <div class="car-bookings">0 bookings</div>
                <div class="car-actions">
                    <button class="action-btn toggle-status" title="Toggle availability" data-car-id="${car.id}">
                        <i class="fas ${toggleIcon}"></i>
                    </button>
                    <button class="action-btn edit-btn" title="Edit car" data-car-id="${car.id}">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn delete-btn" title="Delete car" data-car-id="${car.id}">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');

    carsContainer.innerHTML = carsHTML;
}

// Toggle car status (available/unavailable)
async function toggleCarStatus(carId) {
    try {
        // Get current car data
        const { data: car, error: fetchError } = await window.supabase
            .from('cars')
            .select('status')
            .eq('id', carId)
            .single();

        if (fetchError) {
            console.error('Error fetching car:', fetchError);
            showNotification('Failed to fetch car status', 'error');
            return;
        }

        // Toggle status
        const currentStatus = car.status || 'available';
        const newStatus = currentStatus === 'available' ? 'unavailable' : 'available';

        // Update in Supabase
        const { error: updateError } = await window.supabase
            .from('cars')
            .update({ status: newStatus })
            .eq('id', carId);

        if (updateError) {
            console.error('Error updating car status:', updateError);
            showNotification('Failed to update car status', 'error');
            return;
        }

        showNotification(`Car status updated to ${newStatus}`, 'success');

        // Update UI immediately
        const carRow = document.querySelector(`[data-car-id="${carId}"]`);
        if (carRow) {
            const statusBadge = carRow.querySelector('.status-badge');
            const toggleBtn = carRow.querySelector('.toggle-status i');

            if (newStatus === 'available') {
                statusBadge.textContent = 'Available';
                statusBadge.className = 'status-badge available';
                toggleBtn.className = 'fas fa-eye';
            } else {
                statusBadge.textContent = 'Not Available';
                statusBadge.className = 'status-badge not-available';
                toggleBtn.className = 'fas fa-eye-slash';
            }

            // Add update animation
            statusBadge.style.animation = 'pulse 0.6s ease-in-out';
            setTimeout(() => {
                statusBadge.style.animation = '';
            }, 600);
        }

        // Update dashboard stats
        loadDashboardStats();
    } catch (error) {
        console.error('Error toggling car status:', error);
        showNotification('Failed to update car status', 'error');
    }
}

// Delete car from Supabase
async function deleteCar(carId) {
    showCustomConfirm({
        title: 'Delete Car?',
        message: 'Are you sure you want to remove this vehicle from the fleet? This cannot be undone.',
        icon: 'fa-trash-alt',
        confirmColor: '#ef4444', // Red for delete
        onConfirm: async () => {
            try {
                const { error } = await window.supabase.from('cars').delete().eq('id', carId);
                if (error) throw error;
                
                showNotification('Car deleted successfully!', 'success');
                const carRow = document.querySelector(`[data-car-id="${carId}"]`);
                if (carRow) {
                    carRow.style.animation = 'slideOut 0.5s forwards';
                    setTimeout(() => carRow.remove(), 500);
                }
                loadDashboardStats();
            } catch (error) {
                showNotification('Failed to delete car', 'error');
            }
        }
    });
}

// Car Actions Event Handler
function initCarActions() {
    document.addEventListener('click', async function (e) {
        const button = e.target.closest('.action-btn');
        if (!button) return;

        const carId = button.getAttribute('data-car-id');
        if (!carId) return;

        if (button.classList.contains('toggle-status')) {
            await toggleCarStatus(carId);
        } else if (button.classList.contains('delete-btn')) {
            await deleteCar(carId);
        } else if (button.classList.contains('edit-btn')) {
            // TODO: Implement edit functionality
            showNotification('Edit functionality coming soon!', 'info');
        }
    });
}

// Add new car to Supabase
async function addCar(carData) {
    try {
        const { data, error } = await window.supabase
            .from('cars')
            .insert([{
                ...carData,
                status: 'available',
                created_at: new Date().toISOString()
            }])
            .select();

        if (error) {
            console.error('Error adding car:', error);
            showNotification('Failed to add car', 'error');
            return false;
        }

        showNotification('Car added successfully!', 'success');

        // Update dashboard stats
        loadDashboardStats();

        return true;
    } catch (error) {
        console.error('Error adding car:', error);
        showNotification('Failed to add car', 'error');
        return false;
    }
}

// Add Car Form Handler
function initAddCarForm() {
    const addCarForm = document.getElementById('addCarForm');
    if (addCarForm) {
       addCarForm.addEventListener('submit', async function (e) {
    e.preventDefault();

    const imageFile = document.getElementById('carImage').files[0];

    if (!imageFile) {
        showNotification('Please select car image', 'error');
        return;
    }

    // 1️⃣ Upload image to Supabase Storage
    const imageUrl = await uploadCarImage(imageFile);

    if (!imageUrl) {
        showNotification('Image upload failed', 'error');
        return;
    }

    // 2️⃣ Prepare car data
    const carData = {
        name: document.getElementById('carName').value.trim(),
        type: document.getElementById('carType').value.trim(),
        price: document.getElementById('carPrice').value.trim(),
        seats: document.getElementById('carSeats').value.trim(),
        fuel: document.getElementById('carFuel').value.trim(),
        transmission: document.getElementById('carTransmission').value.trim(),
        location: document.getElementById('carLocation').value.trim(),
        image_url: imageUrl // ✅ AUTO from storage
    };

    // 3️⃣ Insert into DB
    const success = await addCar(carData);

    if (success) {
        addCarForm.reset();
        setTimeout(() => {
            showPage('managecar');
        }, 500);
    }
});

    }
}
async function uploadCarImage(file) {
    const ext = file.name.split('.').pop();
    const fileName = `cars/${Date.now()}.${ext}`;

    const { error } = await window.supabase
        .storage
        .from('Images')
        .upload(fileName, file);

    if (error) {
        console.error('Image upload error:', error);
        return null;
    }

    const { data } = window.supabase
        .storage
        .from('Images')
        .getPublicUrl(fileName);

    return data.publicUrl;
}
// Helper function to update text content of an element safely
function updateElement(id, value) {
    const el = document.getElementById(id);
    if (el) {
        el.textContent = value;
    }
}   
// Load Dashboard Stats
// ==========================================
// REPLACED: Main Dashboard Stats Loader
// ==========================================
async function loadDashboardStats() {
    if (isStatsLoading) return;
    isStatsLoading = true;
    
    try {
        const { data: cars, error: carsError } = await window.supabase
            .from('cars')
            .select('status');

        const { data: bookings, error: bookingsError } = await window.supabase
            .from('bookings')
            .select('id');

        if (!carsError && !bookingsError) {
            const totalCars = cars?.length || 0;
            const availableCars = cars?.filter(car => car.status !== 'unavailable').length || 0;
            const unavailableCars = totalCars - availableCars;
            const totalBookings = bookings?.length || 0;

            // Yeh lines ab chalengi kyunki updateElement define ho gaya hai
            updateElement('totalCarsCount', totalCars);
            updateElement('availableCarsCount', availableCars);
            updateElement('unavailableCarsCount', unavailableCars);
            updateElement('totalBookingsCount', totalBookings);

            // "Loading..." text ko hatane ke liye
            if(document.getElementById('totalCarsChange')) 
                document.getElementById('totalCarsChange').textContent = `${totalCars} total cars`;
            if(document.getElementById('totalBookingsChange'))
                document.getElementById('totalBookingsChange').textContent = `${totalBookings} total bookings`;
            if(document.getElementById('availableCarsChange'))
                document.getElementById('availableCarsChange').textContent = `${availableCars} ready to rent`;
            if(document.getElementById('unavailableCarsChange'))
                document.getElementById('unavailableCarsChange').textContent = `${unavailableCars} need attention`;
            
            // Animation start karne ke liye
            animateStats();
        }

        await loadRecentBookingsWidget();
        await loadRevenueStats();

    } catch (error) {
        console.error('❌ Error loading dashboard stats:', error);
    } finally {
        isStatsLoading = false;
    }
}       
// ==========================================
// NEW: Load Recent Bookings (Top 4)
// ==========================================
// ==========================================
// UPDATED: Recent Bookings + "View All" Link
// ==========================================
async function loadRecentBookingsWidget() {
    const container = document.querySelector('.recent-bookings');
    if (!container) return;

    // --- NEW: Activate "View All" Link ---
    // Finds the "View All" button inside the same card
    const viewAllBtn = container.closest('.dashboard-card')?.querySelector('.view-all');
    if (viewAllBtn) {
        // Redirects to 'booking' page (Manage Bookings) to see the full list
        // Note: If you specifically wanted the 'Manage Cars' page, change 'booking' to 'managecar' below
        viewAllBtn.onclick = (e) => showPage('booking', e);
    }
    // -------------------------------------

    try {
        // Fetch top 4 most recent bookings
        const { data: bookings, error } = await window.supabase
            .from('bookings')
            .select(`
                id, created_at, total_amount, booking_status, pickup_date,
                cars ( name, image_url )
            `)
            .order('created_at', { ascending: false })
            .limit(4);

        if (error) throw error;

        if (!bookings || bookings.length === 0) {
            container.innerHTML = '<p style="padding:1rem; color:#666;">No recent bookings found.</p>';
            return;
        }

        // Map status to CSS classes
        const getStatusClass = (status) => {
            if (['confirmed', 'pickup_successful'].includes(status)) return 'confirmed';
            if (['complete', 'return_successful'].includes(status)) return 'completed';
            if (status === 'cancelled') return 'cancelled';
            return 'pending';
        };

        const html = bookings.map(b => {
            const carName = b.cars?.name || 'Unknown Car';
            const carImageDisplay = b.cars?.image_url
                ? `<img src="${b.cars.image_url}" style="width:100%; height:100%; object-fit:cover; border-radius:8px;">`
                : `<i class="fas fa-car"></i>`;

            const dateStr = new Date(b.pickup_date).toLocaleDateString();
            const statusClass = getStatusClass(b.booking_status);
            const statusText = b.booking_status.charAt(0).toUpperCase() + b.booking_status.slice(1).replace('_', ' ');

            return `
            <div class="booking-item">
                <div class="booking-car">
                  <div class="car-thumb">
                    ${carImageDisplay}
                  </div>
                  <div class="car-info">
                    <strong>${carName}</strong>
                    <small>${dateStr} • ₹${b.total_amount || 0}</small>
                  </div>
                </div>
                <span class="status-badge ${statusClass}">${statusText}</span>
              </div>
            `;
        }).join('');

        container.innerHTML = html;

    } catch (err) {
        console.error('Error loading recent bookings widget:', err);
        container.innerHTML = '<p style="color:red; padding:1rem;">Failed to load.</p>';
    }
}

// ==========================================
// UPDATED: Monthly Revenue + Last Month Display
// ==========================================
async function loadRevenueStats() {
    try {
        const now = new Date();
        const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();

        // 1. Fetch Current Month Revenue (excluding cancelled)
        const { data: currentMonthData, error: currError } = await window.supabase
            .from('bookings')
            .select('total_amount')
            .gte('created_at', startOfCurrentMonth)
            .neq('booking_status', 'cancelled');

        // 2. Fetch Last Month Revenue (for comparison)
        const { data: lastMonthData, error: lastError } = await window.supabase
            .from('bookings')
            .select('total_amount')
            .gte('created_at', startOfLastMonth)
            .lt('created_at', startOfCurrentMonth)
            .neq('booking_status', 'cancelled');

        if (currError || lastError) throw (currError || lastError);

        // --- Calculations ---
        const sumAmounts = (items) => items.reduce((sum, item) => sum + (Number(item.total_amount) || 0), 0);

        const currentRevenue = sumAmounts(currentMonthData || []);
        const lastRevenue = sumAmounts(lastMonthData || []);

        // Calculate Percentage Change
        let percentChange = 0;
        if (lastRevenue > 0) {
            percentChange = ((currentRevenue - lastRevenue) / lastRevenue) * 100;
        } else if (currentRevenue > 0) {
            percentChange = 100;
        }

        // --- Update UI ---

        // 1. Total Revenue Display (Current Month)
        const revenueAmountEl = document.querySelector('.revenue-amount');
        if (revenueAmountEl) revenueAmountEl.textContent = `₹${currentRevenue.toLocaleString()}`;

        // 2. Percentage Change Display
        const changeEl = document.querySelector('.revenue-change');
        if (changeEl) {
            const isPositive = percentChange >= 0;
            const icon = isPositive ? 'fa-trending-up' : 'fa-trending-down';
            const colorClass = isPositive ? 'positive' : 'negative';

            changeEl.className = `revenue-change ${colorClass}`;
            changeEl.innerHTML = `
                <i class="fas ${icon}"></i>
                ${isPositive ? '+' : ''}${percentChange.toFixed(1)}% from last month
            `;
        }

        // 3. SHOW LAST MONTH REVENUE (At the bottom)
        const breakdownContainer = document.querySelector('.revenue-breakdown');
        if (breakdownContainer) {
            // Ensure it is visible
            breakdownContainer.style.display = 'flex';

            // Inject Last Month Data
            breakdownContainer.innerHTML = `
              <div class="breakdown-item" style="width: 100%;">
                <span class="breakdown-label">Last Month Total</span>
                <span class="breakdown-value">₹${lastRevenue.toLocaleString()}</span>
              </div>
            `;
        }

    } catch (err) {
        console.error('Error calculating revenue:', err);
    }
}
// Search Cars
function initCarSearch() {
    const searchInput = document.getElementById('carSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', function () {
            const searchTerm = this.value.toLowerCase();
            const carRows = document.querySelectorAll('#carsContainer .car-row');

            carRows.forEach(row => {
                const carDetails = row.querySelector('.car-details');
                if (carDetails) {
                    const carName = carDetails.querySelector('strong')?.textContent.toLowerCase() || '';
                    const carInfo = carDetails.querySelector('small')?.textContent.toLowerCase() || '';

                    if (carName.includes(searchTerm) || carInfo.includes(searchTerm)) {
                        row.style.display = 'grid';
                        row.style.animation = 'fadeIn 0.3s ease-in';
                    } else {
                        row.style.display = 'none';
                    }
                }
            });
        });
    }
}

// Load bookings from Supabase with car and user details
async function loadBookings() {
    if (isBookingsLoading) return; 
    isBookingsLoading = true;

    console.log('Fetching bookings...');
    const bookingsContainer = document.querySelector('.booking-table');
    if (!bookingsContainer) {
        isBookingsLoading = false;
        return;
    }

    let bookingsBody = bookingsContainer.querySelector('.bookings-body') || document.createElement('div');
    if (!bookingsContainer.querySelector('.bookings-body')) {
        bookingsBody.className = 'bookings-body';
        bookingsContainer.appendChild(bookingsBody);
    }

    bookingsBody.innerHTML = `<div style="text-align:center;padding:2rem;"><i class="fas fa-spinner fa-spin"></i><p>Loading...</p></div>`;

    try {
        const { data: bookings, error } = await window.supabase
            .from('bookings')
            .select(`
                *,
                cars (id, name, type, image_url),
                users!bookings_user_id_fkey (id, firstname, lastname, phone)
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;
        renderBookings(bookings || []);
    } catch (error) {
        console.error('Error loading bookings:', error);
        showBookingsError('Connection error.');
    } finally {
        isBookingsLoading = false; // Release lock
    }
}
// 1. Booking Details dikhane ka function
async function showBookingDetails(bookingId) {
    const modal = document.getElementById('bookingDetailsModal');
    const content = document.getElementById('bookingDetailsContent');
    modal.style.display = 'flex';
    content.innerHTML = '<div style="text-align:center; padding:2rem;"><i class="ri-loader-4-line ri-spin" style="font-size:2rem;"></i></div>';

    try {
        const { data: booking, error } = await window.supabase
            .from('bookings')
            .select(`
                *,
                cars (*),
                users!bookings_driver_fkey (firstname, lastname, phone)
            `)
            .eq('id', bookingId)
            .single();

        if (error) throw error;

        // Driver Logic: Agar with_driver true hai tabhi section dikhao
        let driverSection = '';
        if (booking.with_driver) {
            const driverInfo = booking.users; // Jo humne join kiya
            driverSection = `
                <div style="margin-top: 1.5rem; padding: 1rem; background: #f0f7ff; border-radius: 8px; border: 1px dashed #2563eb;">
                    <h4 style="margin-bottom: 0.5rem; color: #1e40af;"><i class="ri-steering-2-line"></i> Driver Information</h4>
                    ${driverInfo ? `
                        <p><strong>Name:</strong> ${driverInfo.firstname} ${driverInfo.lastname}</p>
                        <p><strong>Contact:</strong> ${driverInfo.phone}</p>
                        <p><strong>Status:</strong> <span class="status-badge active">Assigned</span></p>
                    ` : `
                        <p style="color: #6b7280; font-style: italic;">Status: <span class="status-badge verification">Pending Assignment</span></p>
                        <small>Admin will assign a driver shortly.</small>
                    `}
                </div>
            `;
        } else {
            driverSection = `<div style="margin-top: 1rem; color: #6b7280; font-size: 0.9rem;">* Self-drive booking (No driver requested)</div>`;
        }

        content.innerHTML = `
            <div class="details-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div>
                    <p style="color:var(--text-light); font-size:0.8rem; margin-bottom:2px;">CAR DETAILS</p>
                    <p><strong>${booking.cars.name}</strong> (${booking.cars.type})</p>
                </div>
                <div style="text-align: right;">
                    <p style="color:var(--text-light); font-size:0.8rem; margin-bottom:2px;">BOOKING ID</p>
                    <p style="font-family: monospace; font-size:0.8rem;">#${booking.id.slice(0,8)}</p>
                </div>
            </div>

            <hr style="margin: 1rem 0; border: 0; border-top: 1px solid var(--border);">

            <div style="display: flex; justify-content: space-between; margin-bottom: 1rem;">
                <div>
                    <p style="color:var(--text-light); font-size:0.8rem;"><i class="ri-map-pin-line"></i> PICKUP</p>
                    <p><strong>${booking.pickup_location}</strong></p>
                    <p style="font-size:0.85rem;">${booking.pickup_date} at ${booking.pickup_time}</p>
                </div>
                <div style="text-align: right;">
                    <p style="color:var(--text-light); font-size:0.8rem;"><i class="ri-map-pin-user-line"></i> RETURN</p>
                    <p><strong>${booking.return_location}</strong></p>
                    <p style="font-size:0.85rem;">${booking.return_date} at ${booking.return_time}</p>
                </div>
            </div>

            <div style="background: #f9fafb; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                    <span>Total Days:</span> <strong>${booking.total_days} Days</strong>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 1.1rem; color: var(--primary);">
                    <span>Total Amount Paid:</span> <strong>₹${booking.total_amount}</strong>
                </div>
            </div>

            ${driverSection}
        `;
    } catch (err) {
        content.innerHTML = `<p style="color:red; text-align:center;">Error: ${err.message}</p>`;
    }
}

function closeBookingModal() {
    document.getElementById('bookingDetailsModal').style.display = 'none';
}
// 1. Render Bookings with Actions + Driver Button
function renderBookings(bookings) {
    const bookingsBody = document.querySelector('.bookings-body');
    if (!bookingsBody) return;

    bookingsBody.innerHTML = bookings.map(booking => {
        const customerName = booking.users ? `${booking.users.firstname} ${booking.users.lastname}` : 'Unknown';
        const carName = booking.cars?.name || 'Unknown Car';
        const statusInfo = getStatusInfo(booking.booking_status);
        
        let driverCellHTML = '<span style="color:#9ca3af; font-size: 0.85rem;">Self Drive</span>';
        if (booking.with_driver) {
            driverCellHTML = booking.driver_id 
                ? `<div class="status-badge confirmed"><i class="fas fa-user-check"></i> Assigned</div>`
                : `<button class="btn btn-mini btn-verify" onclick="openDriverModal('${booking.id}')" style="background:#f59e0b; border:none; color:white;">
                    <i class="fas fa-user-plus"></i> Assign Driver
                   </button>`;
        }

        return `
            <div class="booking-row">
                <div class="booking-info"><strong>${customerName}</strong><small>${carName}</small></div>
                <div class="booking-details"><small>${new Date(booking.pickup_date).toLocaleDateString()}</small></div>
                <div class="booking-driver">${driverCellHTML}</div>
                <div class="booking-amount">₹${booking.total_amount}</div>
                <div class="booking-status">
                    <span class="status-badge ${statusInfo.class}">${statusInfo.display}</span>
                </div>
                <div class="booking-actions">
                    <select class="admin-dropdown" onchange="updateBookingStatus('${booking.id}', this.value)">
                        <option value="" disabled selected>Update Status</option>
                        <option value="confirmed">Confirm</option>
                        <option value="pickup_successful">Pickup Done</option>
                        <option value="return_successful">Return Done</option>
                        <option value="complete">Completed</option>
                        <option value="cancelled">Cancel</option>
                    </select>
                </div>
            </div>`;
    }).join('');
}
async function openDriverModal(bookingId) {
    const modal = document.getElementById('driverModal');
    const container = document.getElementById('driverListContainer');
    modal.style.display = 'flex';
    container.innerHTML = '<div style="text-align:center;padding:20px;color:#2563eb;"><i class="fas fa-spinner fa-spin"></i> Checking live availability...</div>';

    try {
        const { data: busyBookings } = await window.supabase
            .from('bookings')
            .select('driver_id')
            .not('driver_id', 'is', null)
            .in('driver_status', ['assigned', 'accepted', 'running']);

        const busyDriverIds = busyBookings?.map(b => b.driver_id) || [];

        let query = window.supabase
            .from('users')
            .select('id, firstname, lastname, phone')
            .eq('is_driver', true)
            .eq('driver_status', 'approved')
            .eq('driver_active_status', 'active');

        if (busyDriverIds.length > 0) {
            query = query.not('id', 'in', `(${busyDriverIds.join(',')})`);
        }

        const { data: drivers, error } = await query;

        if (error) throw error;

        if (!drivers || drivers.length === 0) {
            container.innerHTML = '<div style="text-align:center;padding:2rem;"><i class="fas fa-user-slash" style="font-size:2rem;color:#d1d5db;margin-bottom:1rem;"></i><p style="color:#6b7280;">No active drivers available right now.</p></div>';
            return;
        }

        container.innerHTML = drivers.map(d => `
            <div onclick="executeDriverAssignment('${bookingId}', '${d.id}')" class="driver-selection-card">
                <div class="driver-info-text">
                    <strong>${d.firstname} ${d.lastname}</strong>
                    <small><i class="fas fa-phone"></i> ${d.phone || 'No phone'}</small>
                </div>
                <i class="fas fa-plus-circle"></i>
            </div>
        `).join('');

    } catch (err) {
        container.innerHTML = '<p style="color:#ef4444;text-align:center;padding:1rem;">Error loading drivers.</p>';
    }
}
// 3. Execution with Notification
async function executeDriverAssignment(bookingId, driverId) {
    try {
        // 1. Update Booking table
        const { error: bookingError } = await window.supabase
            .from('bookings')
            .update({ 
                driver_id: driverId, 
                driver_status: 'assigned' 
            })
            .eq('id', bookingId);

        if (bookingError) throw bookingError;

        // 2. Update Users table (Driver ko INACTIVE karo taaki wo list mein na dikhe)
        const { error: userError } = await window.supabase
            .from('users')
            .update({ driver_active_status: 'inactive' })
            .eq('id', driverId);

        if (userError) throw userError;

        showNotification("Driver assigned and marked as busy!", "success");
        closeDriverModal();
        loadBookings(); 
    } catch (err) {
        console.error('Assignment Error:', err);
        showNotification("Assignment failed: " + err.message, "error");
    }
} 
// Get status display info
function getStatusInfo(status) {
    const statusMap = {
        'pending': { display: 'Pending', class: 'pending' },
        'confirmed': { display: 'Confirmed', class: 'confirmed' },
        'pickup_successful': { display: 'Pickup Done', class: 'confirmed' }, // Greenish
        'return_successful': { display: 'Return Done', class: 'completed' }, // Blueish
        'complete': { display: 'Completed', class: 'completed' },
        'cancelled': { display: 'Cancelled', class: 'not-available' } // Reddish
    };
    return statusMap[status] || { display: status, class: 'pending' };
}

// Update booking status
// admin.js mein updateBookingStatus ko replace karein
async function updateBookingStatus(bookingId, newStatus) {
    if(!confirm(`Are you sure you want to ${newStatus} this booking?`)) return;

    try {
        // 1. Pehle current booking se driver_id nikaalein
        const { data: booking } = await window.supabase
            .from('bookings')
            .select('driver_id')
            .eq('id', bookingId)
            .single();

        const assignedDriverId = booking?.driver_id;

        // 2. Booking status update karein
        const updateData = { booking_status: newStatus };
        
        if (newStatus === 'cancelled') {
            updateData.driver_id = null;
            updateData.driver_status = null;
        }

        const { error: bookingError } = await window.supabase
            .from('bookings')
            .update(updateData)
            .eq('id', bookingId);

        if (bookingError) throw bookingError;

        // 3. AGAR CANCEL HUA HAI: Driver ko wapas 'active' karein
        if (newStatus === 'cancelled' && assignedDriverId) {
            await window.supabase
                .from('users')
                .update({ driver_active_status: 'active' }) // Driver ab agali booking ke liye dikhega
                .eq('id', assignedDriverId);
        }

        showNotification(`Booking ${newStatus} successfully!`, 'success');
        loadBookings(); // Table refresh
    } catch (err) {
        showNotification("Update failed: " + err.message, 'error');
    }
}
// View booking details
async function viewBookingDetails(bookingId) {
    try {
        const { data: booking, error } = await supabase
            .from('bookings')
            .select(`
                *,
                cars (
                    id,
                    name,
                    type,
                    image_url,
                    price
                ),
                users!bookings_user_id_fkey (
                    id,
                    firstname,
                    lastname,
                    phone,
                    address
                )
            `)
            .eq('id', bookingId)
            .single();

        if (error) {
            console.error('Error fetching booking details:', error);
            alert('Failed to load booking details.');
            return;
        }

        showBookingDetailsModal(booking);

    } catch (error) {
        console.error('Unexpected error:', error);
        alert('Failed to load booking details.');
    }
}

// Show booking details modal
function showBookingDetailsModal(booking) {
    const customerName = booking.users ?
        `${booking.users.firstname || ''} ${booking.users.lastname || ''}`.trim() :
        'Unknown Customer';

    const carName = booking.cars?.name || 'Unknown Car';
    const statusInfo = getStatusInfo(booking.booking_status);

    const modalHTML = `
        <div class="booking-details-modal" onclick="closeBookingModal(event)">
            <div class="modal-content" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3>Booking Details</h3>
                    <button class="close-btn" onclick="closeBookingModal()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="detail-section">
                        <h4>Customer Information</h4>
                        <p><strong>Name:</strong> ${customerName}</p>
                        <p><strong>Phone:</strong> ${booking.users?.phone || 'N/A'}</p>
                        <p><strong>Address:</strong> ${booking.users?.address || 'N/A'}</p>
                    </div>
                    
                    <div class="detail-section">
                        <h4>Vehicle Information</h4>
                        <p><strong>Car:</strong> ${carName}</p>
                        <p><strong>Type:</strong> ${booking.cars?.type || 'N/A'}</p>
                        <p><strong>Daily Rate:</strong> ₹${booking.daily_rate || 'N/A'}</p>
                    </div>
                    
                    <div class="detail-section">
                        <h4>Booking Information</h4>
                        <p><strong>Booking ID:</strong> ${booking.id}</p>
                        <p><strong>Pickup Date:</strong> ${new Date(booking.pickup_date).toLocaleDateString()}</p>
                        <p><strong>Return Date:</strong> ${new Date(booking.return_date).toLocaleDateString()}</p>
                        <p><strong>Total Days:</strong> ${booking.total_days || 'N/A'}</p>
                        <p><strong>Pickup Location:</strong> ${booking.pickup_location || 'N/A'}</p>
                        <p><strong>Return Location:</strong> ${booking.return_location || 'N/A'}</p>
                        <p><strong>Status:</strong> <span class="status-badge ${booking.booking_status}">${statusInfo.display}</span></p>
                    </div>
                    
                    <div class="detail-section">
                        <p><strong>Subtotal:</strong>${booking.subtotal || 'N/A'}</p>
<p><strong>Taxes:</strong> ₹${booking.taxes || 'N/A'}</p>
<p><strong>Total Amount:</strong>₹${booking.total_amount || 'N/A'}</p>

                        <p><strong>Payment Status:</strong> ${booking.payment_status || 'N/A'}</p>
                        <p><strong>Payment Method:</strong> ${booking.payment_method || 'N/A'}</p>
                    </div>
                    
                    ${booking.special_requests ? `
                        <div class="detail-section">
                            <h4>Special Requests</h4>
                            <p>${booking.special_requests}</p>
                        </div>
                    ` : ''}
                </div>
            </div>
        </div>
    `;
if (booking.with_driver) {
    if (booking.driver_id && booking.driver_status !== 'assigned') { // Status 'assigned' nahi hona chahiye
        // Show Full Driver Info
        driverHTML = `... driver details ...`;
    } else if (booking.driver_id && booking.driver_status === 'assigned') {
        // Show Waiting Status
        driverHTML = `<div class="tracking-driver-card pending">
                        <p><i class="ri-time-line"></i> Driver assigned. Waiting for driver to accept...</p>
                      </div>`;
    } else {
        driverHTML = `<div class="tracking-driver-card pending">
                        <p><i class="ri-loader-line ri-spin"></i> Finding a driver for you...</p>
                      </div>`;
    }
}
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// Close booking details modal
function closeBookingModal(event) {
    if (event && event.target !== event.currentTarget) return;
    const modal = document.querySelector('.booking-details-modal');
    if (modal) {
        modal.remove();
    }
}

// Show error message
function showBookingsError(message) {
    const bookingsBody = document.querySelector('.bookings-body');
    if (bookingsBody) {
        bookingsBody.innerHTML = `
            <div class="booking-row error-row">
                <div style="grid-column: 1/-1; text-align: center; padding: 2rem;">
                    <i class="fas fa-exclamation-triangle" style="color: #e74c3c; margin-bottom: 1rem;"></i>
                    <p style="color: #e74c3c;">${message}</p>
                    <button class="btn btn-primary" onclick="loadBookings()" style="margin-top: 1rem;">
                        Try Again
                    </button>
                </div>
            </div>
        `;
    }
}

// Show no bookings message
function showNoBookings() {
    const bookingsBody = document.querySelector('.bookings-body');
    if (bookingsBody) {
        bookingsBody.innerHTML = `
            <div class="booking-row no-data-row">
                <div style="grid-column: 1/-1; text-align: center; padding: 3rem;">
                    <i class="fas fa-calendar-times" style="font-size: 3rem; color: #95a5a6; margin-bottom: 1rem;"></i>
                    <h3 style="color: #7f8c8d; margin-bottom: 0.5rem;">No Bookings Found</h3>
                    <p style="color: #95a5a6;">No customer bookings available yet.</p>
                </div>
            </div>
        `;
    }
}

// Show success message
function showSuccessMessage(message) {
    const successDiv = document.createElement('div');
    successDiv.className = 'success-toast';
    successDiv.innerHTML = `
        <i class="fas fa-check-circle"></i>
        <span>${message}</span>
    `;
    successDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #27ae60;
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-weight: 500;
        animation: slideInRight 0.3s ease;
    `;

    document.body.appendChild(successDiv);

    setTimeout(() => {
        successDiv.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => successDiv.remove(), 300);
    }, 3000);
}
function filterBookings(status = 'all') {
    const bookingRows = document.querySelectorAll('.booking-row:not(.header)');

    bookingRows.forEach(row => {
        const statusBadge = row.querySelector('.status-badge');
        if (!statusBadge) return;

        const rowStatus = statusBadge.classList[1];
        const normalized = {
            pickup_successful: 'pickup',
            return_successful: 'return',
            complete: 'completed'
        }[rowStatus] || rowStatus;

        const matchesFilter = (status === 'all' || normalized === status);

        if (matchesFilter) {
            // Restore correct layout type
            if (window.innerWidth <= 768) {
                row.style.display = 'flex'; // mobile card layout
                row.style.flexDirection = 'column';
            } else {
                row.style.display = 'grid'; // desktop grid layout
            }
        } else {
            row.style.display = 'none';
        }
    });

    // Update active filter button
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === status);
    });
}

// Initialize filter buttons
function initBookingFilters() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const filter = btn.dataset.filter;
            filterBookings(filter);
        });
    });
}

// Add this to the showPage function for booking page
function loadBookingPage() {
    loadBookings();
    initBookingFilters();
}
function showPage(pageId, event) {
    if (event) event.preventDefault();

    // Hide pages
    document.querySelectorAll('.page').forEach(page => {
        page.style.display = 'none';
        page.style.opacity = '0';
    });

    // Show selected
    const selectedPage = document.getElementById(pageId);
    if (selectedPage) {
        selectedPage.style.display = 'block';
        setTimeout(() => { selectedPage.style.opacity = '1'; }, 50);
    }

    // Update Nav
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));

    // LOAD DATA (Fix duplicate call logic)
    if (pageId === 'managecar') {
        loadCars();
    } else if (pageId === 'dashboard') {
        loadDashboardStats();
    } else if (pageId === 'booking') {
        // ONLY call loadBookingPage, which will internally call loadBookings
        loadBookingPage(); 
    }// showPage function ke andar is naye case ko add karein
else if (pageId === 'manage-drivers') {
    loadDriverRequests();
}

    if (window.innerWidth <= 968) closeMobileMenu();
}
// Notification System
function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }

    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas ${getNotificationIcon(type)}"></i>
            <span>${message}</span>
            <button class="notification-close">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;

    // Add to document
    document.body.appendChild(notification);

    // Show notification
    setTimeout(() => {
        notification.classList.add('show');
    }, 100);

    // Auto-remove after 5 seconds
    setTimeout(() => {
        removeNotification(notification);
    }, 5000);

    // Close button functionality
    notification.querySelector('.notification-close').addEventListener('click', () => {
        removeNotification(notification);
    });
}

function getNotificationIcon(type) {
    switch (type) {
        case 'success': return 'fa-check-circle';
        case 'error': return 'fa-exclamation-circle';
        case 'warning': return 'fa-exclamation-triangle';
        default: return 'fa-info-circle';
    }
}

function removeNotification(notification) {
    notification.classList.remove('show');
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 300);
}

// Stats Animation
function animateStats() {
    const statNumbers = document.querySelectorAll('.stat-number');
    statNumbers.forEach(stat => {
        const finalValue = parseInt(stat.textContent) || 0;
        if (finalValue === 0) return; // Agar 0 hai toh animation skip karein
        
        const duration = 1000; // 1 second animation
        const frameRate = 1000 / 60; // 60 FPS
        const totalFrames = Math.round(duration / frameRate);
        let currentFrame = 0;

        const timer = setInterval(() => {
            currentFrame++;
            const progress = currentFrame / totalFrames;
            const currentValue = Math.round(finalValue * progress);
            
            stat.textContent = currentValue;

            if (currentFrame === totalFrames) {
                stat.textContent = finalValue;
                clearInterval(timer);
            }
        }, frameRate);
    });
}

// Keyboard Navigation
function initKeyboardNavigation() {
    document.addEventListener('keydown', function (e) {
        // Quick navigation shortcuts
        if (e.ctrlKey || e.metaKey) {
            switch (e.key) {
                case '1':
                    e.preventDefault();
                    showPage('dashboard');
                    break;
                case '2':
                    e.preventDefault();
                    showPage('addcar');
                    break;
                case '3':
                    e.preventDefault();
                    showPage('managecar');
                    break;
                case '4':
                    e.preventDefault();
                    showPage('booking');
                    break;
            }
        }

        // Escape key to close mobile menu
        if (e.key === 'Escape') {
            const sidebar = document.getElementById('sidebar');
            if (sidebar && sidebar.classList.contains('open')) {
                closeMobileMenu();
            }
        }
    });
}

// Initialize all functionality when DOM is loaded
document.addEventListener('DOMContentLoaded', async function () {
    console.log('Admin Dashboard Start...');

    if (!window.supabase) return;

    // 1. Init UI components (Sync)
    initMobileMenu();
    initCarActions();
    initAddCarForm();
    initCarSearch();
    initBookingFilters();

    // 2. Initial Auth & Name (Wait for it)
    await setAdminDisplayNameFromSupabase();

    // 3. Initial Dashboard Load
    setTimeout(() => {
        loadDashboardStats();
    }, 300); // 300ms gap to let auth finish
});
// Add CSS for notifications and loading states
const additionalCSS = `
.notification {
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 9999;
    min-width: 300px;
    max-width: 500px;
    opacity: 0;
    transform: translateX(100%);
    transition: all 0.3s ease-in-out;
}

.notification.show {
    opacity: 1;
    transform: translateX(0);
}

.notification-content {
    display: flex;
    align-items: center;
    padding: 1rem 1.5rem;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    font-weight: 500;
}

.notification-success .notification-content {
    background: #d1fae5;
    color: #065f46;
    border-left: 4px solid #10b981;
}

.notification-error .notification-content {
    background: #fee2e2;
    color: #991b1b;
    border-left: 4px solid #ef4444;
}

.notification-warning .notification-content {
    background: #fef3c7;
    color: #92400e;
    border-left: 4px solid #f59e0b;
}

.notification-info .notification-content {
    background: #dbeafe;
    color: #1e40af;
    border-left: 4px solid #2563eb;
}

.notification i:first-child {
    margin-right: 0.75rem;
    font-size: 1.125rem;
}

.notification span {
    flex: 1;
}

.notification-close {
    background: none;
    border: none;
    color: currentColor;
    cursor: pointer;
    padding: 0.25rem;
    margin-left: 0.75rem;
    opacity: 0.7;
    transition: opacity 0.2s ease;
}

.notification-close:hover {
    opacity: 1;
}

.loading-state, .error-state, .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem;
    text-align: center;
    color: var(--gray-600);
}

.loading-state i {
    font-size: 2rem;
    margin-bottom: 1rem;
    color: var(--primary-blue);
}

.error-state i, .empty-state i {
    font-size: 3rem;
    margin-bottom: 1rem;
    color: var(--gray-400);
}

.error-state h3, .empty-state h3 {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--gray-700);
    margin-bottom: 0.5rem;
}

@keyframes pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.05); }
}

@keyframes slideOut {
    0% {
        opacity: 1;
        transform: translateX(0);
    }
    100% {
        opacity: 0;
        transform: translateX(-100%);
    }
}

@keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}

@media (max-width: 480px) {
    .notification {
        left: 20px;
        right: 20px;
        min-width: auto;
    }
}
`;

// Inject additional CSS
const styleSheet = document.createElement('style');
styleSheet.textContent = additionalCSS;
document.head.appendChild(styleSheet);
// Set Admin Name from Supabase Auth -> Users -> display name
async function setAdminDisplayNameFromSupabase() {
    const el = document.getElementById('adminDisplayName');
    if (!el) return;

    try {
        const user = await getCachedUser(); // Use cache instead of direct call
        if (!user) {
            el.textContent = 'Administrator';
            return;
        }

        let displayName = user.user_metadata?.display_name || user.email || 'Administrator';
        el.textContent = displayName;
    } catch (e) {
        console.warn('Name set failed:', e);
    }
}
// Init on load and keep in sync with auth changes
document.addEventListener('DOMContentLoaded', () => {
    setAdminDisplayNameFromSupabase();

    if (window.supabase?.auth?.onAuthStateChange) {
        window.supabase.auth.onAuthStateChange(() => {
            setAdminDisplayNameFromSupabase();
        });
    }
});

// ===============================
// PRICE FORMAT HELPER (FIX NaN)
// ===============================
function formatPrice(value) {
    if (!value) return '0';
    return Number(
        String(value).replace(/[^0-9]/g, '')
    ).toLocaleString();
}
// ===============================
// EXPORT DASHBOARD AS PDF (FINAL)
// ===============================
async function exportDashboardPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');

    /* =====================
       COLORS (Tailwind Blue-600)
       #2563eb → rgb(37, 99, 235)
    ===================== */
    const PRIMARY = [37, 99, 235];
    const DARK = [30, 30, 30];

    /* =====================
       FETCH LIVE DATA
    ===================== */
    const { data: cars } = await window.supabase
        .from('cars')
        .select('*');

    const { data: bookings } = await window.supabase
        .from('bookings')
        .select('total_amount, created_at')
        .neq('booking_status', 'cancelled');

    /* =====================
       CALCULATIONS
    ===================== */
    const totalCars = cars.length;
    const availableCars = cars.filter(c => c.status !== 'unavailable').length;
    const unavailableCars = totalCars - availableCars;
    const totalBookings = bookings.length;

    const currentMonth = new Date().getMonth();
    const monthlyRevenue = bookings
        .filter(b => new Date(b.created_at).getMonth() === currentMonth)
        .reduce((sum, b) => sum + Number(b.total_amount || 0), 0);

    /* =====================
       HEADER BAR
    ===================== */
    doc.setFillColor(...PRIMARY);
    doc.rect(0, 0, 210, 22, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.text('ADMIN DASHBOARD REPORT', 14, 14);

    doc.setFontSize(9);
    // doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 150, 14);
const generatedAt = new Date().toLocaleString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
});

doc.text(`Generated on: ${generatedAt}`, 120, 14);

    /* =====================
       DASHBOARD SUMMARY
    ===================== */
    let y = 38;
    doc.setTextColor(...DARK);
    doc.setFontSize(14);
    doc.text('Dashboard Summary', 14, y);

    doc.setFontSize(11);
    y += 10;
    doc.text(`Total Cars: ${totalCars}`, 14, y);
    doc.text(`Available Cars: ${availableCars}`, 80, y);

    y += 8;
    doc.text(`Unavailable Cars: ${unavailableCars}`, 14, y);
    doc.text(`Total Bookings: ${totalBookings}`, 80, y);

    /* =====================
       MONTHLY REVENUE BOX
    ===================== */
    y += 18;
    doc.setFillColor(241, 245, 249);
    doc.rect(14, y - 8, 180, 18, 'F');

    doc.setFontSize(13);
    doc.text('Monthly Revenue', 16, y);

    doc.setFontSize(12);
    doc.text(`Rs. ${monthlyRevenue.toLocaleString()}`, 150, y);

    /* =====================
       CARS TABLE
    ===================== */
    y += 16;

  const tableData = cars.map(car => [
    car.name || '-',
    car.type || '-',
    car.fuel || '-',
    car.transmission || '-',
    `Rs. ${formatPrice(car.price)}`,   // 👈 ONLY PRICE
    car.status === 'unavailable' ? 'Unavailable' : 'Available'
]);

    doc.autoTable({
        startY: y,
        head: [['Name', 'Type', 'Fuel', 'Transmission', 'Price / Day', 'Status']],
        body: tableData,
        theme: 'grid',
        styles: {
            fontSize: 10,
            cellPadding: 4,
            textColor: DARK
        },
        headStyles: {
            fillColor: PRIMARY,
            textColor: [255, 255, 255],
            fontStyle: 'bold'
        },
        columnStyles: {
            4: { halign: 'right' },
            5: { halign: 'center' }
        },
        didParseCell: function (data) {
            if (data.section === 'body' && data.column.index === 5) {
                if (data.cell.text[0] === 'Available') {
                    data.cell.styles.textColor = [22, 163, 74]; // green
                } else {
                    data.cell.styles.textColor = [220, 38, 38]; // red
                }
            }
        }
    });

    /* =====================
       SAVE FILE
    ===================== */
    const d = new Date();
    doc.save(`dashboard_report_${d.getFullYear()}_${d.getMonth() + 1}.pdf`);
}
document.addEventListener('DOMContentLoaded', () => {
    const exportBtn = document.getElementById('exportPdfBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportDashboardPDF);
    }
});
let isDriversLoading = false;
// STEP 3.3: Data Fetch (Join driver_requests + users)
// Load and Render Driver Requests
async function loadDriverRequests() {
    if (isDriversLoading) return;
    isDriversLoading = true;

    const container = document.getElementById('driverRequestsContainer');
    container.innerHTML = `<div style="text-align:center;padding:3rem;"><i class="fas fa-spinner fa-spin"></i> Fetching requests...</div>`;

    try {
        const { data, error } = await window.supabase
            .from('driver_requests')
            .select(`
                *,
                users!driver_requests_user_fkey (
                    id, firstname, lastname, phone, 
                    license_number, license_image, aadhaar_image
                )
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;
        renderDriverRequests(data || []);
    } catch (err) {
        console.error('Error:', err);
        container.innerHTML = `<div class="error-row">Failed to load driver data.</div>`;
    } finally {
        isDriversLoading = false;
    }
}

// STEP 3.3: Updated Render Logic with Dropdown & Document Pills
function renderDriverRequests(requests) {
    const container = document.getElementById('driverRequestsContainer');
    
    if (!requests || requests.length === 0) {
        container.innerHTML = `<div style="padding:3rem;text-align:center;color:#666;">No pending driver applications.</div>`;
        return;
    }

    container.innerHTML = requests.map(req => {
        const user = req.users;
        const fullName = `${user.firstname || 'User'} ${user.lastname || ''}`;
        const getUrl = (path) => path ? window.supabase.storage.from('user-documents').getPublicUrl(path).data.publicUrl : '#';

        return `
            <div class="booking-row">
                <div class="booking-info">
                    <div class="customer-info">
                        <strong>${fullName}</strong>
                        <small><i class="fas fa-phone" style="font-size:10px; transform: scaleX(1);"></i> ${user.phone || 'N/A'}</small>
                        <small style="font-size:10px; color:#999;">UID: ${user.id.substring(0,8)}</small>
                    </div>
                </div>

                <div class="booking-details">
                    <div class="doc-card-container">
                        <small>License: <b>${user.license_number || 'N/A'}</b></small>
                        <div class="doc-badge-group">
                            <button onclick="viewImage('${getUrl(user.license_image)}', 'Driver License')" class="doc-pill">
                                <i class="fas fa-id-card"></i> License
                            </button>
                            <button onclick="viewImage('${getUrl(user.aadhaar_image)}', 'Aadhaar Card')" class="doc-pill">
                                <i class="fas fa-address-card"></i> Aadhaar
                            </button>
                        </div>
                    </div>
                </div>

                <div class="booking-duration">
                    <span class="date-pill">${new Date(req.created_at).toLocaleDateString('en-IN')}</span>
                </div>

                <div class="booking-status">
                    <span class="status-badge ${req.status}">
                        ${req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                    </span>
                </div>

                <div class="booking-actions" style="display: flex; justify-content: flex-end;">
                    <select class="action-select admin-dropdown" onchange="updateDriverRequest('${req.id}', '${user.id}', this.value)">
                        <option value="" disabled selected>Update Status</option>
                        <option value="verification" ${req.status === 'verification' ? 'selected' : ''}>Verification</option>
                        <option value="approved" ${req.status === 'approved' ? 'selected' : ''}>Approve</option>
                        <option value="rejected" ${req.status === 'rejected' ? 'selected' : ''}>Reject</option>
                    </select>
                </div>
            </div>
        `;
    }).join('');
}

// === NEW: Image View Function ===
function viewImage(url, title) {
    if (!url || url.includes('#')) {
        alert("Image not found!");
        return;
    }
    const modal = document.getElementById("imageModal");
    const modalImg = document.getElementById("imgPreview");
    const captionText = document.getElementById("caption");
    
    modal.style.display = "flex";
    modalImg.src = url;
    captionText.innerHTML = title;
}

function closeImageModal() {
    document.getElementById("imageModal").style.display = "none";
}

// STEP 3.5: Logic for Approve/Reject/Verification
async function updateDriverRequest(requestId, userId, newStatus) {
    if (!newStatus) return;

    let config = {
        title: `Confirm ${newStatus.toUpperCase()}?`,
        message: `Are you sure you want to update this driver application to ${newStatus}?`,
        icon: 'fa-user-check',
        confirmColor: '#2563eb', // Default Blue
        onConfirm: async () => {
            try {
                const { error } = await window.supabase
                    .from('driver_requests')
                    .update({ status: newStatus })
                    .eq('id', requestId);

                if (error) throw error;
                showNotification(`Status changed to ${newStatus}`, 'success');
                await loadDriverRequests();
            } catch (err) {
                showNotification('Update failed', 'error');
            }
        }
    };

    // Color customization based on status
    if (newStatus === 'approved') config.confirmColor = '#10b981'; // Green
    if (newStatus === 'rejected') {
        config.confirmColor = '#ef4444'; // Red
        config.icon = 'fa-user-times';
    }
    if (newStatus === 'verification') config.confirmColor = '#f59e0b'; // Orange

    showCustomConfirm(config);
}
// Function to show custom confirm card
function showCustomConfirm({ title, message, icon, confirmColor, onConfirm }) {
    const modal = document.getElementById('customConfirmModal');
    const okBtn = document.getElementById('confirmBtnOk');
    
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMessage').textContent = message;
    document.getElementById('confirmIcon').innerHTML = `<i class="fas ${icon || 'fa-exclamation-circle'}" style="color: ${confirmColor || '#f59e0b'}"></i>`;
    
    okBtn.style.background = confirmColor || '#2563eb';
    okBtn.style.borderColor = confirmColor || '#2563eb';
    
    modal.style.display = 'flex';
    
    // Set click handler
    okBtn.onclick = () => {
        onConfirm();
        closeCustomConfirm();
    };
}

function closeCustomConfirm() {
    document.getElementById('customConfirmModal').style.display = 'none';
}

function closeDriverModal() {
    const modal = document.getElementById('driverModal');
    if (modal) {
        modal.style.display = 'none';
        // Reset container content so old list doesn't flash next time
        document.getElementById('driverListContainer').innerHTML = ''; 
    }
} 
async function executeDriverAssignment(bookingId, driverId) {
    try {
        // FINAL CHECK: Kya ye driver abhi abhi kisi aur ne toh assign nahi kar diya?
        const { data: isBusy } = await window.supabase
            .from('bookings')
            .select('id')
            .eq('driver_id', driverId)
            .in('driver_status', ['assigned', 'accepted', 'running'])
            .maybeSingle();

        if (isBusy) {
            showNotification("This driver was just assigned to another booking!", "error");
            openDriverModal(bookingId); // Refresh list
            return;
        }

        // Step A: Booking table update
        const { error: bookingError } = await window.supabase
            .from('bookings')
            .update({ 
                driver_id: driverId, 
                driver_status: 'assigned' 
            })
            .eq('id', bookingId);

        if (bookingError) throw bookingError;

        // Step B: Set driver status to inactive
        await window.supabase
            .from('users')
            .update({ driver_active_status: 'inactive' })
            .eq('id', driverId);

        showNotification("Driver assigned successfully!", "success");
        closeDriverModal();
        loadBookings(); 
    } catch (err) {
        showNotification("Assignment failed: " + err.message, "error");
    }
}