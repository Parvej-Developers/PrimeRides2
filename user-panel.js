// =================== Dynamic User Panel JavaScript ===================

// Global variables
let currentSection = 'profile';
let mobileMenuOpen = false;
let currentUser = null;
let userBookings = [];

// Initialize the page
document.addEventListener('DOMContentLoaded', async function () {
    await checkAuthenticationAndRedirect();
    await initializeUserPanel();
    initializeNavigation();
    initializeFilters();
    initializeForm();
    attachEventListeners();
});

// Check if user is authenticated and redirect if not
async function checkAuthenticationAndRedirect() {
    const { data: { user } } = await window.supabase.auth.getUser();
    if (!user) {
        alert('Please sign in to access the user panel');
        window.location.href = 'index.html';
        return;
    }
}
document.addEventListener("DOMContentLoaded", () => {
    const menuBtn = document.getElementById("menuToggle");
    if (menuBtn) {
        menuBtn.addEventListener("click", toggleMobileMenu);
    }
    document.body.style.opacity = "1";
});


// Initialize user panel with dynamic data
async function initializeUserPanel() {
    try {
        // Fresh Auth user check
        const { data: { user } } = await window.supabase.auth.getUser();
        
        // 1. Database se seedha fresh data uthao
        const { data: freshUser, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('id', user.id)
            .single();

        if (userError) throw userError;
        currentUser = freshUser; // Global variable update
        
        userBookings = await getUserBookings();

        // UI populate karein
        populateSidebar();
        populateUserProfile();
        populateUserBookings();
        populateUpdateForm();
        
        // Tracker update karein
        await checkDriverStatus(); 

        // 2. 🔥 SWITCH BUTTON LOGIC
        const switchBtnContainer = document.getElementById('driverSwitchContainer');
        
        // Dono fields check karein: boolean aur status string
        const isApproved = currentUser.is_driver === true || currentUser.driver_status === 'approved';

        if (isApproved && switchBtnContainer) {
            switchBtnContainer.style.display = 'block'; // Display ko block karein
            switchBtnContainer.style.visibility = 'visible';
            console.log("✅ Driver Approved! Switch button showing.");
        } else {
            if(switchBtnContainer) switchBtnContainer.style.display = 'none';
            console.log("❌ Driver NOT Approved. Status:", currentUser.driver_status);
        }

    } catch (error) {
        console.error('Error initializing user panel:', error);
    }
}

// 🔥 Switch Function
function switchToDriver() {
    window.location.href = 'driver-panel.html'; 
}
function switchToDriver() {
    // Session ya LocalStorage me state save karne ki zaroorat nahi hai
    // Seedha driver dashboard page par redirect karein
    window.location.href = 'driver-panel.html'; 
}

// Get current user profile from Supabase

async function getCurrentUserProfile() {
    const { data: { user } } = await window.supabase.auth.getUser();
    if (!user) return null;

    let { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

    if (!data) {
        const { error: insertError } = await supabase
            .from('users')
            .insert([{ id: user.id }]);

        if (insertError) {
            console.error(insertError);
            return null;
        }

        // दुबारा fetch करो
        const { data: newData } = await supabase
            .from('users')
            .select('*')
            .eq('id', user.id)
            .single();

        return newData;
    }

    return data;
}

// Get user bookings from Supabase
async function getUserBookings() {
    const { data: { user } } = await window.supabase.auth.getUser();
    if (!user) return [];
    const { data, error } = await supabase
        .from('bookings')
        .select(`
            *,
            cars ( id, name, type, image_url, rate_per_day )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
    if (error) {
        console.error('Error fetching bookings:', error);
        return [];
    }
    return data || [];
}

// Populate sidebar with user info
function populateSidebar() {
    if (!currentUser) return;

    const userNameElement = document.querySelector('.user-name');
    const profileImg = document.querySelector('.profile-img');

    if (userNameElement) {
        const fullName = `${currentUser?.firstname || ''} ${currentUser.lastname || ''}`.trim();
        userNameElement.textContent = fullName || 'User';
    }

    // 🔥 PROFILE IMAGE FIX
    if (profileImg) {
        if (currentUser?.profile_image) {
            const url = supabase.storage
                .from("user-documents")
                .getPublicUrl(currentUser.profile_image).data.publicUrl + `?t=${Date.now()}`;

            profileImg.innerHTML = `<img src="${url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
        } else {
            profileImg.textContent = currentUser?.firstname?.charAt(0)?.toUpperCase() || 'U';
        }
    }
}

async function populateUserProfile() {
    // Get Auth email and metadata fields
    const { data: { user } } = await window.supabase.auth.getUser();
    if (!user || !currentUser) return;

    // Name and Role
    document.querySelector('.profile-name').textContent =
        `${currentUser?.firstname || ''} ${currentUser.lastname || ''}`.trim() || 'User';
    document.querySelector('.profile-role').textContent =
        currentUser.role || 'User';

    // Set profile fields (adjust null checks to your schema)
    const grid = document.querySelector('.profile-info-grid');
    if (!grid) return;

    // Format address string
    const address = [currentUser.address, currentUser.city, currentUser.state, currentUser.zipcode]
        .filter(Boolean).join(', ').replace(/^,+|,+$/g, '').replace(/,{2,}/g, ', ');

    // Map for each label
    const valueMap = {
        'Email': user.email || '',
        'Phone': currentUser.phone || 'Not provided',
        'Address': address || 'Not provided',
        'Date of Birth': currentUser.dateofbirth || 'Not provided',
        "Driver's License": currentUser.license_number || 'Not provided',
        'Membership': currentUser.premium_member ? 'Premium' : 'Basic',
        'Account Status': currentUser.account_verified ? 'Active' : 'Pending',
        'Joined On': currentUser.created_at ? new Date(currentUser.created_at).toLocaleDateString('en-CA') : 'Unknown'
    };

    // Set all values
    grid.querySelectorAll('div').forEach(div => {
        const label = div.querySelector('label');
        const valueDiv = div.querySelector('.profile-info-value');
        if (label && valueDiv && label.textContent in valueMap) {
            valueDiv.textContent = valueMap[label.textContent];
        }
    });
}


// Populate bookings section
function populateUserBookings() {
    const bookingsContainer = document.querySelector('.bookings-container');
    if (!bookingsContainer) return;

    if (!userBookings || userBookings.length === 0) {
        bookingsContainer.innerHTML = `
            <div class="no-bookings" style="text-align: center; padding: 2rem; background: white; border-radius: 12px;">
                <h3 style="color: #6b7280; margin-bottom: 1rem;">No Bookings Found</h3>
                <p style="color: #9ca3af;">You haven't made any bookings yet.</p>
                <a href="Explore_cars.html" style="display: inline-block; margin-top: 1rem; padding: 0.75rem 1.5rem; background: #2563eb; color: white; text-decoration: none; border-radius: 8px;">
                    Browse Cars
                </a>
            </div>
        `;
        return;
    }

    const bookingsHTML = userBookings.map(booking => createBookingCard(booking)).join('');
    bookingsContainer.innerHTML = bookingsHTML;
}

function createBookingCard(booking) {
    const car = booking.cars || {};
    const statusClass = getStatusClass(booking.booking_status);
    const statusText = booking.booking_status || 'pending';

    return `
    <div class="booking-card" data-status="${normalizeStatus(booking.booking_status)}" onclick="showBookingDetails('${booking.id}')">
        <div class="booking-image">
            <img src="${car.image_url || 'https://via.placeholder.com/300x200'}" alt="${car.name}">
            <div class="status-badge ${statusClass}">${statusText}</div>
        </div>
        <div class="booking-content">
            <div class="booking-header">
                <h3>${car.name || 'Unknown Car'}</h3>
                <span class="booking-price">₹${booking.total_amount}</span>
            </div>
            <div class="booking-details">
                <p><i class="ri-calendar-line"></i> ${booking.pickup_date}</p>
                <p><i class="ri-map-pin-line"></i> ${booking.pickup_location}</p>
            </div>
            <div class="booking-actions">
                <button class="btn btn-primary full-width">View Details</button>
            </div>
        </div>
    </div>
    `;
}
// Status class mapping
function getStatusClass(s) {
    const k = (s || '').toLowerCase();
    const map = {
        pending: 'pending',
        confirmed: 'upcoming',
        pickup_done: 'upcoming',
        return_done: 'upcoming',
        completed: 'completed',
        cancelled: 'cancelled'
    };
    return map[k] || 'pending';
}
// ===============================
// NORMALIZE BOOKING STATUS (ADMIN MATCH)
// ===============================
function normalizeStatus(status) {
    if (!status) return 'pending';

    const s = status.toLowerCase();

    if (s === 'pending') return 'pending';
    if (s === 'confirmed') return 'confirmed';
    if (s === 'pickup_done' || s === 'pickup_successful') return 'pickup_done';
    if (s === 'return_done' || s === 'return_successful') return 'return_done';
    if (s === 'completed' || s === 'complete') return 'completed';
    if (s === 'cancelled' || s === 'canceled') return 'cancelled';

    return 'pending';
}

// Can cancel?
function canCancelBooking(b) {
    const s = b.booking_status?.toLowerCase();
    return ['pending', 'confirmed'].includes(s);
}

// Populate update form with current data
function populateUpdateForm() {

    if (!currentUser) return;

    const form = document.getElementById('updateProfileForm');
    if (!form) return;

    // 🟢 TEXT FIELDS
    form.querySelector('[name="firstName"]').value = currentUser.firstname || "";
    form.querySelector('[name="lastName"]').value = currentUser.lastname || "";
    form.querySelector('[name="phone"]').value = currentUser.phone || "";
    form.querySelector('[name="dateOfBirth"]').value = currentUser.dateofbirth || "";
    form.querySelector('[name="address"]').value = currentUser.address || "";
    form.querySelector('[name="city"]').value = currentUser.city || "";
    form.querySelector('[name="state"]').value = currentUser.state || "";
    form.querySelector('[name="zipCode"]').value = currentUser.zipcode || "";
    form.querySelector('[name="licenseNumber"]').value = currentUser.license_number || "";

    // 🔥 HELPER FUNCTION (CACHE FIX)
    const getImageUrl = (path) => {
        if (!path) return "";
        return supabase.storage
            .from("user-documents")
            .getPublicUrl(path).data.publicUrl + `?t=${Date.now()}`;
    };

    // 🟢 PROFILE IMAGE
    const profilePreview = document.getElementById("profilePreview");
    if (currentUser.profile_image) {
        profilePreview.src = getImageUrl(currentUser.profile_image);
        profilePreview.style.display = "block";
    }

    // 🟢 LICENSE IMAGE
    const licensePreview = document.getElementById("licensePreview");
    if (currentUser.license_image) {
        licensePreview.src = getImageUrl(currentUser.license_image);
        licensePreview.style.display = "block";
    }

    // 🟢 AADHAAR IMAGE
    const aadhaarPreview = document.getElementById("aadhaarPreview");
    if (currentUser.aadhaar_image) {
        aadhaarPreview.src = getImageUrl(currentUser.aadhaar_image);
        aadhaarPreview.style.display = "block";
    }
    console.log("PROFILE IMAGE PATH:", currentUser.profile_image);
    console.log("LICENSE IMAGE PATH:", currentUser.license_image);
    console.log("AADHAAR IMAGE PATH:", currentUser.aadhaar_image);
}
// Navigation
function initializeNavigation() {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', e => {
            e.preventDefault();
            switchSection(link.dataset.section);
            if (mobileMenuOpen) toggleMobileMenu();
        });
    });
}
function switchSection(sec) {
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    document.querySelector(`[data-section="${sec}"]`).classList.add('active');
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(`${sec}-section`).classList.add('active');
    currentSection = sec;
}
function toggleMobileMenu() {
    const sidebar = document.getElementById('sidebar');
    const toggle = document.getElementById('menuToggle');
    mobileMenuOpen = !mobileMenuOpen;
    sidebar.classList.toggle('open', mobileMenuOpen);
    toggle.classList.toggle('active', mobileMenuOpen);
    document.body.classList.toggle('menu-open', mobileMenuOpen);
}

function filterBookings(filter) {
    document.querySelectorAll('.booking-card').forEach(card => {
        const status = card.dataset.status;
        if (filter === 'all' || status === filter) {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });
}


// Form init & update
function initializeFilters() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            filterBookings(btn.dataset.filter);
        });
    });
}

async function updateProfile() {

    const btn = document.querySelector('button[type="submit"]');
    const original = btn.innerHTML;
    btn.textContent = 'Updating...';
    btn.disabled = true;

    const form = document.getElementById('updateProfileForm');
    const data = new FormData(form);

    const { data: { user } } = await supabase.auth.getUser();

    try {
        // FILES
        const licenseFile = document.getElementById("licenseImage")?.files[0];
        const aadhaarFile = document.getElementById("aadhaarImage")?.files[0];

        let licensePath = currentUser?.license_image || "";
        let aadhaarPath = currentUser?.aadhaar_image || "";

        if (licenseFile) {
            const path = `${user.id}/license.jpg`;

            await deleteOldFile(currentUser?.license_image);

            const { error } = await supabase.storage
                .from("user-documents")
                .upload(path, licenseFile, { upsert: true });

            if (error) throw error;

            licensePath = path;
        }

        if (aadhaarFile) {
            const path = `${user.id}/aadhaar.jpg`;

            await deleteOldFile(currentUser?.aadhaar_image);

            const { error } = await supabase.storage
                .from("user-documents")
                .upload(path, aadhaarFile, { upsert: true });

            if (error) throw error;

            aadhaarPath = path;
        }

        const profileFile = document.getElementById("profileImage")?.files[0];
        let profilePath = currentUser?.profile_image || "";

        if (profileFile) {
            const path = `${user.id}/profile.jpg`;

            await deleteOldFile(currentUser?.profile_image);

            const { error } = await supabase.storage
                .from("user-documents")
                .upload(path, profileFile, { upsert: true });

            if (error) throw error;

            profilePath = path;
        }
        const { error } = await supabase
            .from('users')
            .update({
                firstname: data.get('firstName'),
                lastname: data.get('lastName'),
                phone: data.get('phone'),
                dateofbirth: data.get('dateOfBirth'),
                address: data.get('address'),
                city: data.get('city'),
                state: data.get('state'),
                zipcode: data.get('zipCode'),
                license_number: data.get('licenseNumber'),
                license_image: licensePath,
                aadhaar_image: aadhaarPath,
                profile_image: profilePath   // 🔥 ADD THIS LINE
            })
            .eq('id', user.id);

        if (error) throw error;

        // 🔥 IMPORTANT FIX
        const { data: updatedUser } = await supabase
            .from('users')
            .select('*')
            .eq('id', user.id)
            .single();

        currentUser = updatedUser;

        populateUserProfile();
        populateSidebar();
        populateUpdateForm();
        showNotification('Profile updated successfully!', 'success');

    } catch (err) {
        console.error(err);
        showNotification(err.message, 'error');
    }

    btn.innerHTML = original;
    btn.disabled = false;

}
function resetForm() {
    showConfirmModal({
        title: "Discard Changes?",
        message: "Are you sure you want to clear the form? All unsaved changes will be lost.",
        icon: "ri-refresh-line",
        btnColor: "var(--danger)",
        onConfirm: () => {
            populateUpdateForm();
            showNotification('Form reset successfully', 'info');
        }
    });
}
function initializeForm() {
    const form = document.getElementById("updateProfileForm");

    if (!form) return; // 🔥 important

    form.addEventListener("submit", function (e) {
        e.preventDefault();
        updateProfile();
    });
}
// DELETE OLD FILE FIRST
async function deleteOldFile(path) {
    if (!path) return;
    await supabase.storage.from("user-documents").remove([path]);
}
function setupImagePreview(inputId, previewId) {
    const input = document.getElementById(inputId);
    const preview = document.getElementById(previewId);

    if (!input || !preview) return;

    input.addEventListener("change", () => {
        const file = input.files[0];
        if (file) {
            preview.src = URL.createObjectURL(file);
            preview.style.display = "block";
        }
    });
}

// Booking actions
// user-panel.js (Line 597 ke aas paas)
function viewBookingDetails(bookingId) {
    const booking = userBookings.find(b => b.id === bookingId);

    if (!booking) {
        showNotification("Booking not found", "error");
        return;
    }

    // Is line ko badal kar showBookingDetails kar dein
    showBookingDetails(bookingId); 
}

function closeBookingModal() {
    const modal = document.getElementById('bookingDetailsModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto'; // Scroll wapas on karne ke liye
    }
}

async function cancelBooking(bookingId) {
    // Bina confirmation modal ke seedha update
    try {
        const { error } = await supabase
            .from('bookings')
            .update({ booking_status: 'cancelled' })
            .eq('id', bookingId);

        if (error) throw error;

        userBookings = await getUserBookings();
        populateUserBookings();
        closeBookingModal(); // Details modal band karein
        showNotification("Booking Cancelled!", "success");
    } catch (error) {
        showNotification("Error: " + error.message, "error");
    }
}       

// Download Invoice Function with jsPDF
async function downloadInvoice(bookingId) {
    const booking = userBookings.find(b => b.id === bookingId);
    if (!booking) {
        showNotification('Booking not found', 'error');
        return;
    }

    try {
        // Create new jsPDF instance
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        // Set font
        doc.setFont("helvetica");

        // Colors
        const primaryColor = [37, 99, 235];
        const darkColor = [44, 62, 80];
        const lightGray = [149, 165, 166];

        // Page dimensions
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 20;
        let yPosition = margin;

        // Helper function to format currency properly
        function formatCurrency(amount) {
            return 'Rs. ' + Number(amount).toLocaleString('en-IN');
        }

        // Header - Company Name
        doc.setFillColor(...primaryColor);
        doc.rect(0, 0, pageWidth, 40, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(24);
        doc.text('PrimeRides', pageWidth / 2, 20, { align: 'center' });
        doc.setFontSize(12);
        doc.text('Premium Car Rental Services', pageWidth / 2, 30, { align: 'center' });

        yPosition = 50;

        // Invoice Details
        doc.setTextColor(...darkColor);
        doc.setFontSize(10);
        doc.text('Invoice Date: ' + new Date().toLocaleDateString('en-IN'), margin, yPosition);
        doc.text('Booking ID: ' + booking.id.substring(0, 13), pageWidth - margin, yPosition, { align: 'right' });

        yPosition += 15;

        // Customer Information Section
        doc.setFontSize(14);
        doc.setTextColor(...primaryColor);
        doc.text('Customer Information', margin, yPosition);

        yPosition += 8;
        doc.setDrawColor(...lightGray);
        doc.line(margin, yPosition, pageWidth - margin, yPosition);

        yPosition += 10;
        doc.setFontSize(10);
        doc.setTextColor(...darkColor);

        const customerName = currentUser.firstname + ' ' + currentUser.lastname || 'Customer';
        doc.text('Name: ' + customerName, margin, yPosition);
        yPosition += 7;

        const { data: { user } } = await window.supabase.auth.getUser();
        if (user && user.email) {
            doc.text('Email: ' + user.email, margin, yPosition);
            yPosition += 7;
        }

        if (currentUser.phone) {
            doc.text('Phone: ' + currentUser.phone, margin, yPosition);
            yPosition += 7;
        }

        yPosition += 8;

        // Booking Details Section
        doc.setFontSize(14);
        doc.setTextColor(...primaryColor);
        doc.text('Booking Details', margin, yPosition);

        yPosition += 8;
        doc.setDrawColor(...lightGray);
        doc.line(margin, yPosition, pageWidth - margin, yPosition);

        yPosition += 10;
        doc.setFontSize(10);
        doc.setTextColor(...darkColor);

        // Vehicle Information
        const carName = booking.cars?.name || 'Car';
        const carType = booking.cars?.type || '';
        doc.setFont("helvetica", "bold");
        doc.text('Vehicle:', margin, yPosition);
        doc.setFont("helvetica", "normal");
        doc.text(carName + ' ' + carType, margin + 45, yPosition);
        yPosition += 7;

        // Status
        doc.setFont("helvetica", "bold");
        doc.text('Status:', margin, yPosition);
        doc.setFont("helvetica", "normal");
        doc.text(booking.booking_status || 'N/A', margin + 45, yPosition);
        yPosition += 10;

        // Pickup and Return Combined (same as correct invoice)
        const pickupDate = formatDate(booking.pickup_date);
        const pickupTime = formatTime(booking.pickup_time);
        const returnDate = formatDate(booking.return_date);
        const returnTime = formatTime(booking.return_time);

        doc.setFont("helvetica", "bold");
        doc.text('Pickup:', margin, yPosition);
        doc.setFont("helvetica", "normal");
        doc.text(`${pickupDate} at ${pickupTime}`, margin + 45, yPosition);
        yPosition += 7;

        doc.setFont("helvetica", "bold");
        doc.text('Pickup Location:', margin, yPosition);
        doc.setFont("helvetica", "normal");
        const pickupLoc = booking.pickup_location || 'N/A';
        const splitPickup = doc.splitTextToSize(pickupLoc, pageWidth - margin - 50);
        doc.text(splitPickup, margin + 45, yPosition);
        yPosition += (splitPickup.length * 7);

        doc.setFont("helvetica", "bold");
        doc.text('Return:', margin, yPosition);
        doc.setFont("helvetica", "normal");
        doc.text(`${returnDate} at ${returnTime}`, margin + 45, yPosition);
        yPosition += 7;

        doc.setFont("helvetica", "bold");
        doc.text('Return Location:', margin, yPosition);
        doc.setFont("helvetica", "normal");
        const returnLoc = booking.return_location || 'N/A';
        const splitReturn = doc.splitTextToSize(returnLoc, pageWidth - margin - 50);
        doc.text(splitReturn, margin + 45, yPosition);
        yPosition += (splitReturn.length * 7);

        // Total Days
        doc.setFont("helvetica", "bold");
        doc.text('Total Days:', margin, yPosition);
        doc.setFont("helvetica", "normal");
        doc.text(String(booking.total_days || 0), margin + 45, yPosition);
        yPosition += 10;

        // Special Requests (if any)
        if (booking.special_requests) {
            doc.setFont("helvetica", "bold");
            doc.text('Special Requests:', margin, yPosition);
            doc.setFont("helvetica", "normal");
            const splitText = doc.splitTextToSize(booking.special_requests, pageWidth - margin * 2 - 50);
            doc.text(splitText, margin + 45, yPosition);
            yPosition += (splitText.length * 7) + 5;
        }

        yPosition += 5;

        // Payment Details Section
        doc.setFontSize(14);
        doc.setTextColor(...primaryColor);
        doc.text('Payment Details', margin, yPosition);

        yPosition += 8;
        doc.setDrawColor(...lightGray);
        doc.line(margin, yPosition, pageWidth - margin, yPosition);

        yPosition += 10;
        doc.setFontSize(10);
        doc.setTextColor(...darkColor);

        // Cost Breakdown
        const dailyRate = Number(booking.daily_rate) || 0;
        const subtotal = Number(booking.subtotal) || 0;
        const taxes = Number(booking.taxes) || 0;
        const securityDeposit = Number(booking.security_deposit) || 0;
        const totalAmount = Number(booking.total_amount) || 0;

        doc.setFont("helvetica", "normal");
        doc.text('Daily Rate:', margin, yPosition);
        doc.text(formatCurrency(dailyRate), pageWidth - margin, yPosition, { align: 'right' });
        yPosition += 7;

        doc.text('Subtotal (' + booking.total_days + ' days):', margin, yPosition);
        doc.text(formatCurrency(subtotal), pageWidth - margin, yPosition, { align: 'right' });
        yPosition += 7;

        doc.text('Taxes & Fees:', margin, yPosition);
        doc.text(formatCurrency(taxes), pageWidth - margin, yPosition, { align: 'right' });
        yPosition += 7;

        doc.text('Security Deposit:', margin, yPosition);
        doc.text(formatCurrency(securityDeposit), pageWidth - margin, yPosition, { align: 'right' });
        yPosition += 10;

        // ✅ FIXED SECTION (same as correct invoice layout)
        doc.setDrawColor(...darkColor);
        doc.line(margin, yPosition, pageWidth - margin, yPosition);
        yPosition += 10;

        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text('Total Amount:', margin, yPosition);
        doc.text(formatCurrency(totalAmount), pageWidth - margin, yPosition, { align: 'right' });
        yPosition += 12;

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text('Payment Status:', margin, yPosition);
        doc.setFont("helvetica", "bold");
        doc.text(booking.payment_status || 'N/A', margin + 45, yPosition);
        yPosition += 7;

        doc.setFont("helvetica", "normal");
        doc.text('Payment Method:', margin, yPosition);
        doc.setFont("helvetica", "bold");
        doc.text(booking.payment_method || 'N/A', margin + 45, yPosition);
        yPosition += 15;

        // Footer (fixed position below Payment Method)
        const footerY = pageHeight - 25; // moved lower for spacing
        doc.setDrawColor(...lightGray);
        doc.line(margin, footerY, pageWidth - margin, footerY);

        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...lightGray);
        doc.text('Thank you for choosing our car rental service!', pageWidth / 2, footerY + 10, { align: 'center' });
        doc.text('For support, contact us at support@carrental.com', pageWidth / 2, footerY + 17, { align: 'center' });

        // Save PDF
        const fileName = 'Invoice_' + booking.id.substring(0, 8) + '_' + new Date().getTime() + '.pdf';
        doc.save(fileName);

        showNotification('Invoice downloaded successfully!', 'success');

    } catch (error) {
        console.error('Error generating invoice:', error);
        showNotification('Error generating invoice. Please try again.', 'error');
    }
}

// Utilities
function formatDate(d) {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}
function formatTime(t) {
    if (!t) return '';
    return new Date(`1970-01-01T${t}`).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#2563eb'};
        color: white;
        border-radius: 8px;
        z-index: 9999;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        animation: slideInRight 0.3s ease;
    `;
    notification.textContent = message;

    document.body.appendChild(notification);

    // Remove after 5 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 5000);
}
// Click outside to close mobile menu
function attachEventListeners() {
    const toggle = document.getElementById('menuToggle');
    toggle?.addEventListener('click', e => {
        e.stopPropagation();
        toggleMobileMenu();
    });
    document.addEventListener('click', e => {
        if (mobileMenuOpen && !e.target.closest('#sidebar') && !e.target.closest('#menuToggle')) {
            toggleMobileMenu();
        }
    });
}
async function showBookingDetails(bookingId) {
    const modal = document.getElementById('bookingDetailsModal');
    const content = document.getElementById('bookingDetailsContent');
    
    modal.style.display = 'flex';
    content.innerHTML = '<div style="text-align:center; padding:3rem;"><i class="ri-loader-4-line ri-spin" style="font-size:2rem; color:var(--primary);"></i></div>';

    try {
        const { data: booking, error } = await window.supabase
            .from('bookings')
            .select(`
                *,
                cars (*),
                driver:users!bookings_driver_fkey (firstname, lastname, phone, profile_image)
            `)
            .eq('id', bookingId)
            .single();

        if (error) throw error;

        const isCancelled = booking.booking_status === 'cancelled';
        const isCancellable = booking.booking_status === 'confirmed' && !booking.driver_id;

        // --- DYNAMIC TRACKING HTML ---
        let trackingHTML = '';

        if (isCancelled) {
            // Agar cancel ho gaya hai toh ye UI dikhao
            trackingHTML = `
                <div class="vertical-tracking-container">
                    <div class="track-item step-done">
                        <div class="track-icon"><i class="ri-checkbox-circle-fill"></i></div>
                        <div class="track-text">
                            <h4>Booking Confirmed</h4>
                            <p>Request was received on ${new Date(booking.created_at).toLocaleDateString()}</p>
                        </div>
                    </div>
                    <div class="track-item" style="border-left: 2px solid #ef4444; margin-left: 15px; padding-left: 20px;">
                        <div class="track-icon" style="background:#ef4444; border-color:#ef4444; color:white; margin-left: -37px;">
                            <i class="ri-close-circle-fill"></i>
                        </div>
                        <div class="track-text">
                            <h4 style="color: #ef4444;">Booking Cancelled</h4>
                            <p>This booking has been cancelled and is no longer active.</p>
                        </div>
                    </div>
                </div>`;
        } else {
            // Normal tracking logic
            const statuses = ['confirmed', 'pickup_successful', 'return_successful', 'complete'];
            const currentStatus = booking.booking_status;
            const currentIndex = statuses.indexOf(currentStatus);

            const getStepClass = (stepIndex) => {
                if (currentIndex >= stepIndex) return 'step-done';
                if (currentIndex === stepIndex - 1) return 'step-current';
                return 'step-upcoming';
            };

            trackingHTML = `
                <div class="vertical-tracking-container">
                    <div class="track-item ${getStepClass(0)}">
                        <div class="track-icon"><i class="ri-checkbox-circle-fill"></i></div>
                        <div class="track-text">
                            <h4>Booking Confirmed</h4>
                            <p>Your ride has been scheduled for ${booking.pickup_date}</p>
                        </div>
                    </div>
                    <div class="track-item ${getStepClass(1)}">
                        <div class="track-icon"><i class="ri-car-fill"></i></div>
                        <div class="track-text">
                            <h4>Car Picked Up</h4>
                            <p>${booking.pickup_location}</p>
                        </div>
                    </div>
                    <div class="track-item ${getStepClass(2)}">
                        <div class="track-icon"><i class="ri-map-pin-range-fill"></i></div>
                        <div class="track-text">
                            <h4>Return Initiated</h4>
                            <p>Destination: ${booking.return_location}</p>
                        </div>
                    </div>
                    <div class="track-item ${getStepClass(3)}">
                        <div class="track-icon"><i class="ri-flag-2-fill"></i></div>
                        <div class="track-text">
                            <h4>Ride Completed</h4>
                            <p>Hope you had a great journey!</p>
                        </div>
                    </div>
                </div>`;
        }

        // --- DRIVER INFO HTML ---
        let driverHTML = '';
        if (booking.with_driver && !isCancelled) {
            if (booking.driver_id && booking.driver) {
                const driverImg = booking.driver.profile_image 
                    ? supabase.storage.from("user-documents").getPublicUrl(booking.driver.profile_image).data.publicUrl 
                    : 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png';

                driverHTML = `
                    <div class="tracking-driver-card">
                        <div class="driver-header">
                            <img src="${driverImg}" class="driver-img-mini">
                            <div class="driver-meta">
                                <h4>${booking.driver.firstname} ${booking.driver.lastname}</h4>
                                <p>Your Professional Driver</p>
                            </div>
                            <a href="tel:${booking.driver.phone}" class="call-btn"><i class="ri-phone-fill"></i></a>
                        </div>
                    </div>`;
            } else {
                driverHTML = `
                    <div class="tracking-driver-card pending">
                        <p><i class="ri-time-line"></i> Waiting for Admin to assign a driver...</p>
                    </div>`;
            }
        }

        content.innerHTML = `
            <div class="tracking-main-header">
                <div class="car-brief">
                    <img src="${booking.cars?.image_url}" class="car-img-thumb">
                    <div>
                        <h3>${booking.cars?.name}</h3>
                        <p>ID: #${booking.id.slice(0,8).toUpperCase()}</p>
                    </div>
                </div>
                <div class="price-brief">
                    <span>Total Paid</span>
                    <h3>₹${booking.total_amount}</h3>
                </div>
            </div>

            ${trackingHTML}

            ${driverHTML}

            <div class="modal-footer-actions" style="display: flex; flex-direction: column; gap: 10px; width: 100%; margin-top:20px;">
                <button class="btn-invoice" onclick="downloadInvoice('${booking.id}')">
                    <i class="ri-download-2-line"></i> Download Receipt
                </button>
                
                ${isCancellable ? `
                    <button class="btn-cancel-booking" onclick="cancelBooking('${booking.id}')">
                        <i class="ri-close-circle-line"></i> Cancel Booking
                    </button>
                ` : ''}
            </div>
        `;
    } catch (err) {
        content.innerHTML = `<div class="error-msg">Error: ${err.message}</div>`;
    }
}



document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("updateProfileForm");
    if (form) {
        form.addEventListener("submit", function (e) {
            e.preventDefault();
            updateProfile();
        });
    }
});



function previewImage(input, previewId) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        document.getElementById(previewId).src = e.target.result;
    };
    reader.readAsDataURL(file);
}

// listeners
document.getElementById("profileImage")?.addEventListener("change", function () {
    previewImage(this, "profilePreview");
});

document.getElementById("licenseImage")?.addEventListener("change", function () {
    previewImage(this, "licensePreview");
});

document.getElementById("aadhaarImage")?.addEventListener("change", function () {
    previewImage(this, "aadhaarPreview");
});

function showConfirmModal({ title, message, icon, btnColor, onConfirm }) {
    const modal = document.getElementById("confirmModal");
    const okBtn = document.getElementById("confirmOkBtn");
    const iconDiv = document.getElementById("confirmIcon");

    // UI Updates
    document.getElementById("confirmTitle").innerText = title;
    document.getElementById("confirmMessage").innerText = message;
    
    iconDiv.innerHTML = `<i class="${icon || 'ri-error-warning-line'}"></i>`;
    iconDiv.style.color = btnColor || 'var(--warning)';
    
    okBtn.style.background = btnColor || 'var(--primary)';
    okBtn.style.borderColor = btnColor || 'var(--primary)';

    // Show Modal
    modal.style.display = 'flex'; 
    modal.classList.add("active");

    // --- FIX: Stacking order for PrimeRides ---
    // Agar Booking Details modal open hai, toh confirm modal ko uske upar laane ke liye
    modal.style.zIndex = "10000"; 

    // Use a clean click handler
    okBtn.onclick = (e) => {
        e.preventDefault();
        if (typeof onConfirm === 'function') {
            onConfirm();
        }
        closeConfirmModal();
    };
}

function closeConfirmModal() {
    const modal = document.getElementById("confirmModal");
    modal?.classList.remove("active");
    modal.style.display = 'none';

    // Restore the scale of the details modal
    const detailsModal = document.querySelector('#bookingDetailsModal .modal-box');
    if (detailsModal) detailsModal.style.transform = 'scale(1)';
}// STEP 2.4 & 2.6 - Check Status & Populate Section
async function checkDriverStatus() {
    const container = document.getElementById('driverContainer');

    // Check if request exists in driver_requests table
    const { data: request, error } = await supabase
        .from('driver_requests')
        .select('*')
        .eq('user_id', currentUser.id)
        .maybeSingle();

    if (request) {
        renderTrackingUI(request.status);
    }
}

// STEP 2.6 - Render Status Tracker (E-commerce style)
function renderTrackingUI(status) {
    const container = document.getElementById('driverContainer');
    const steps = ['pending', 'verification', 'approved', 'rejected'];
    const statusIndex = steps.indexOf(status);

    // Progress bar percentage
    const progressClass = `progress-${(statusIndex + 1) * 25}`;

    container.innerHTML = `
        <div class="tracking-wrapper">
            <h3>Application Status: <span style="color:var(--primary)">${status.toUpperCase()}</span></h3>
            <div class="tracking-steps ${progressClass}">
                <div class="step-item ${statusIndex >= 0 ? 'active' : ''}">
                    <div class="step-icon"><i class="ri-check-line"></i></div>
                    <div class="step-label">Applied</div>
                </div>
                <div class="step-item ${statusIndex >= 1 ? 'active' : ''}">
                    <div class="step-icon"><i class="ri-search-eye-line"></i></div>
                    <div class="step-label">Verification</div>
                </div>
                <div class="step-item ${statusIndex >= 2 ? 'active' : ''}">
                    <div class="step-icon"><i class="ri-medal-line"></i></div>
                    <div class="step-label">Approved</div>
                </div>
            </div>
            <p style="margin-top:20px; color:#666;">
                ${status === 'pending' ? 'Hooray! We have received your application. Our team will review it shortly.' :
            status === 'verification' ? 'We are currently verifying your license and documents.' :
                status === 'approved' ? 'Congratulations! You are now a verified driver.' :
                    'Sorry, your application was rejected. Please contact support.'}
            </p>
        </div>
    `;
}

// STEP 2.4 & 2.5 - Handle Apply Button Click
async function handleDriverApplication() {
    // 1. Profile Completion Check
    const requiredFields = {
        firstname: currentUser.firstname,
        lastname: currentUser.lastname,
        phone: currentUser.phone,
        address: currentUser.address,
        license_number: currentUser.license_number,
        license_image: currentUser.license_image,
        aadhaar_image: currentUser.aadhaar_image
    };

    const missingFields = Object.keys(requiredFields).filter(key => !requiredFields[key]);

    if (missingFields.length > 0) {
        alert("Please complete your profile first! Missing: " + missingFields.join(", "));
        switchSection('update'); // Redirect to update profile
        return;
    }

    const btn = document.getElementById('applyDriverBtn');
    btn.disabled = true;
    btn.innerText = "Applying...";

    try {
        // 2. Insert into driver_requests
        const { error: reqError } = await supabase
            .from('driver_requests')
            .insert([{ user_id: currentUser.id, status: 'pending' }]);

        if (reqError) throw reqError;

        // 3. Update User table
        await supabase
            .from('users')
            .update({ driver_requested: true, driver_status: 'pending' })
            .eq('id', currentUser.id);

        showNotification("Application submitted successfully!", "success");
        renderTrackingUI('pending');

    } catch (error) {
        console.error(error);
        showNotification("Error: " + error.message, "error");
        btn.disabled = false;
        btn.innerText = "Apply for Driver";
    }
} async function handleDriverApplication() {
    // Phase 2.4: Profile Check Logic
    const reqFields = {
        name: currentUser.firstname,
        phone: currentUser.phone,
        address: currentUser.address,
        license: currentUser.license_number,
        aadhaar: currentUser.aadhaar_image // Aadhaar check
    };

    const missing = Object.entries(reqFields)
        .filter(([key, value]) => !value || value === "")
        .map(([key]) => key);

    if (missing.length > 0) {
        alert("❌ Missing: " + missing.join(", ") + "\n\nKripya Profile Update form bhariye!");
        switchSection('update');
        return;
    }

    const btn = document.getElementById('applyDriverBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="ri-loader-4-line rotate"></i> Applying...';

    try {
        // STEP 2.5: Driver Request Insert
        const { error: insertError } = await supabase
            .from('driver_requests')
            .insert([
                {
                    user_id: currentUser.id,
                    status: 'pending'
                }
            ]);

        if (insertError) throw insertError;

        // STEP 2.6: Users Table Update (Persistence ke liye zaroori hai)
        const { error: userUpdateError } = await supabase
            .from('users')
            .update({
                driver_requested: true,
                driver_status: 'pending'
            })
            .eq('id', currentUser.id);

        if (userUpdateError) throw userUpdateError;

        showNotification("Application successful!", "success");

        // Data update hone ke baad local user object update karein aur UI refresh karein
        currentUser.driver_requested = true;
        currentUser.driver_status = 'pending';
        renderTrackingUI('pending');

    } catch (error) {
        console.error("Apply Error:", error);
        alert("Database update failed: " + error.message);
        btn.disabled = false;
        btn.innerText = "Apply for Driver";
    }
} async function checkDriverStatus() {
    const container = document.getElementById('driverContainer');
    if (!container) return;

    // Database se latest status check karein
    const { data: request, error } = await supabase
        .from('driver_requests')
        .select('status')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (request) {
        // Agar request milti hai to status dikhao
        renderTrackingUI(request.status);
    } else {
        // Agar nahi milti to Apply Button dikhao
        renderApplyButton();
    }
} function renderTrackingUI(status) {
    const container = document.getElementById('driverContainer');

    // Status ke basis par progress width set karein
    let progressWidth = "20%";
    if (status === 'verification') progressWidth = "50%";
    if (status === 'approved') progressWidth = "100%";
    if (status === 'rejected') progressWidth = "100%";

    container.innerHTML = `
        <div class="driver-tracking-container">
            <h3>Application Tracking</h3>
            <p>Your request is currently being processed</p>
            
            <div class="driver-progress">
                <div class="progress-line">
                    <div id="progressFill" style="width: ${progressWidth}; background: ${status === 'rejected' ? '#ef4444' : '#10b981'}"></div>
                </div>
                <div class="progress-steps">
                    <div class="step active">
                        <i class="ri-file-list-3-line"></i>
                        <span>Pending</span>
                    </div>
                    <div class="step ${status !== 'pending' ? 'active' : ''}">
                        <i class="ri-shield-check-line"></i>
                        <span>Verification</span>
                    </div>
                    <div class="step ${status === 'approved' ? 'active' : ''} ${status === 'rejected' ? 'rejected' : ''}">
                        <i class="${status === 'rejected' ? 'ri-close-circle-line' : 'ri-checkbox-circle-line'}"></i>
                        <span>${status === 'rejected' ? 'Rejected' : 'Approved'}</span>
                    </div>
                </div>
            </div>

            <div class="status-info-card">
                <p>Current Status: <strong>${status.toUpperCase()}</strong></p>
                <small>Updated on: ${new Date().toLocaleDateString()}</small>
            </div>
        </div>
    `;
}   