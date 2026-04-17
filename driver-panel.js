let currentUser = null;

document.addEventListener('DOMContentLoaded', async function() {
    await checkDriverAccess();
    initializeNavigation();
    loadDriverDashboard();
    await loadCurrentActiveStatus();
});

// Security Check
async function checkDriverAccess() {
    const { data: { user } } = await window.supabase.auth.getUser();
    if (!user) { window.location.href = 'index.html'; return; }

    const { data: profile } = await window.supabase
        .from('users')
        .select('firstname, lastname, is_driver, driver_status')
        .eq('id', user.id)
        .single();

    if (!profile.is_driver || profile.driver_status !== 'approved') {
        alert("Access Denied! Driver only area.");
        window.location.href = 'user.html';
    } else {
        currentUser = user;
        document.getElementById('driverName').textContent = profile.firstname;
    }
}

// 7.3: Load Dashboard & Active Ride
async function loadDriverDashboard() {
    try {
        const { data: rides, error } = await window.supabase
            .from('bookings')
            .select(`
                id,
                driver_status,
                pickup_location,
                pickup_date,
                pickup_time,
                cars (name, image_url, type),
                users:user_id (firstname, lastname, phone, address, city, state, zipcode) 
            `) // Yahan humne user ka pura address mangwaya hai
            .eq('driver_id', currentUser.id)
            .neq('driver_status', 'completed')
            .order('pickup_date', { ascending: true });

        if (error) throw error;

        if (rides && rides.length > 0) {
            renderActiveRide(rides[0]);
            document.getElementById('totalRidesCount').textContent = rides.length;
        } else {
            document.getElementById('activeRideContainer').innerHTML = `<p>No active rides.</p>`;
        }
    } catch (err) {
        console.error("Error:", err.message);
    }
}
// 7.4: Render Active Ride with Workflow Buttons
function renderActiveRide(ride) {
    const container = document.getElementById('activeRideContainer');
    let actionButtons = '';
    
    // Workflow Buttons Logic: Based on current driver_status
    if (ride.driver_status === 'assigned') {
        actionButtons = `
            <div style="display: flex; gap: 10px; margin-top: 1rem;">
                <button onclick="handleResponse('${ride.id}', 'accepted')" class="btn-status btn-accept" style="flex:2;">Accept Trip Request</button>
                <button onclick="handleResponse('${ride.id}', 'rejected')" class="btn-status" style="flex:1; background:#ef4444; color:white;">Reject</button>
            </div>`;
    } else if (ride.driver_status === 'accepted') {
        actionButtons = `<button onclick="updateRideStatus('${ride.id}', 'running')" class="btn-status btn-start">Start Trip with Customer</button>`;
    } else if (ride.driver_status === 'running') {
        actionButtons = `<button onclick="updateRideStatus('${ride.id}', 'completed')" class="btn-status btn-complete">End Trip & Return Car</button>`;
    }

    const user = ride.users;
    // Customer ka actual address unki profile se
    const fullUserAddress = user && user.address 
        ? `${user.address}, ${user.city || ''}, ${user.state || ''}` 
        : 'Address not provided in profile';

    container.innerHTML = `
        <div class="active-ride-card">
            <div class="ride-header">
                <span class="status-badge ${ride.driver_status}">${ride.driver_status.toUpperCase()}</span>
                <strong>Booking ID: #${ride.id.substring(0,8)}</strong>
            </div>
            
            <div class="ride-details-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                <div class="info-box">
                    <small>GAADI (CAR)</small>
                    <p><strong>${ride.cars?.name}</strong></p>
                    <p style="font-size:0.8rem; color:#6b7280;">${ride.cars?.type}</p>
                </div>
                <div class="info-box">
                    <small>CUSTOMER (USER)</small>
                    <p><strong>${user?.firstname || 'Guest'} ${user?.lastname || ''}</strong></p>
                    <p><i class="ri-phone-line"></i> ${user?.phone || 'No phone'}</p>
                </div>
            </div>

            <div class="address-box" style="background:#fff9f0; padding:1.2rem; border-radius:12px; margin-top:15px; border: 1.5px dashed #f59e0b;">
                <small style="color: #b45309; font-weight:800;">
                    <i class="ri-map-pin-user-fill"></i> CUSTOMER PICKUP LOCATION:
                </small>
                <p style="font-size:1rem; margin-top:8px; color: #1e293b; font-weight: 700;">
                    ${fullUserAddress}
                </p>
                <small style="display:block; margin-top:5px; color:#6b7280;">
                    Trip Dates: ${new Date(ride.pickup_date).toLocaleDateString()} to ${new Date(ride.return_date).toLocaleDateString()}
                </small>
            </div>

            <div id="actionButtonWrapper">
                ${actionButtons}
            </div>
        </div>`;
}
// 7.4 Update Logic
// Enhanced updateRideStatus with Auto-Inactive Logic
// Enhanced updateRideStatus with Auto-Active/Inactive Logic
async function updateRideStatus(rideId, newStatus) {
    const { error } = await window.supabase
        .from('bookings')
        .update({ driver_status: newStatus })
        .eq('id', rideId);

    if (error) {
        alert("Error updating status: " + error.message);
        return;
    }

    // 1. Agar trip start hui (running), toh driver ko offline/inactive kar do
    if (newStatus === 'running') {
        await window.supabase
            .from('users')
            .update({ driver_active_status: 'inactive' })
            .eq('id', currentUser.id);
            
        updateStatusUI('inactive', "Status: Inactive (On Trip)");
    } 
    // 2. Agar trip khatam hui (completed), toh driver ko wapas online/active kar do [NEW LOGIC]
    else if (newStatus === 'completed') {
        await window.supabase
            .from('users')
            .update({ driver_active_status: 'active' })
            .eq('id', currentUser.id);
            
        updateStatusUI('active', "Status: Active (Available)");
        
        // Earning calculation trigger
        await calculateEarning(rideId);
    }

    alert(`Status updated to ${newStatus}`);
    loadDriverDashboard();
}

// Helper function to keep UI in sync
function updateStatusUI(status, labelText) {
    const toggle = document.getElementById('activeStatusToggle');
    const label = document.getElementById('statusLabel');
    
    if (toggle) toggle.checked = (status === 'active');
    if (label) label.innerText = labelText;
}



// Navigation Logic
function initializeNavigation() {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const section = link.dataset.section;
            
            // Check if sections and links exist before calling classList
            const targetPage = document.getElementById(`${section}-section`);
            if (targetPage) {
                document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
                targetPage.classList.add('active');
                
                document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
                link.classList.add('active');
            }

            if (section === 'earnings') {
                loadEarningsHistory();
            } else if (section === 'rides') {
                loadMyRidesHistory();
            }
        });
    });
}
async function loadCurrentActiveStatus() {
    try {
        const { data: { user } } = await window.supabase.auth.getUser();
        
        const { data: profile, error } = await window.supabase
            .from('users')
            .select('driver_active_status')
            .eq('id', user.id)
            .single();

        if (error) throw error;

        if (profile && profile.driver_active_status) {
            const isActive = profile.driver_active_status === 'active';
            
            const toggle = document.getElementById('activeStatusToggle');
            const label = document.getElementById('statusLabel');
            
            if (toggle) toggle.checked = isActive;
            if (label) {
                label.innerText = `Status: ${profile.driver_active_status.charAt(0).toUpperCase() + profile.driver_active_status.slice(1)}`;
            }
        }
    } catch (error) {
        console.error("Load Status Error:", error);
    }
}

// 🔥 STEP: Toggle karne par database update karna
async function toggleActiveStatus() {
    const toggle = document.getElementById('activeStatusToggle');
    const label = document.getElementById('statusLabel');
    const newStatus = toggle.checked ? 'active' : 'inactive';

    try {
        const { data: { user } } = await window.supabase.auth.getUser();
        
        const { error } = await window.supabase
            .from('users')
            .update({ driver_active_status: newStatus })
            .eq('id', user.id);

        if (error) throw error;

        label.innerText = `Status: ${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)}`;
        alert(`You are now ${newStatus}`);
        
    } catch (error) {
        console.error("Update Error:", error);
        toggle.checked = !toggle.checked; // Error aane par revert karein
        alert('Status update failed! Check RLS policies.');
    }
}
// Global Status State (to revert if cancelled)
let targetStatus = false;

async function toggleActiveStatus() {
    const toggle = document.getElementById('activeStatusToggle');
    targetStatus = toggle.checked; 
    
    // Toggle ko turant change na karein, pehle confirm karein
    toggle.checked = !targetStatus; 

    const modal = document.getElementById('statusConfirmModal');
    const title = document.getElementById('statusTitle');
    const msg = document.getElementById('statusMessage');
    const icon = document.getElementById('statusIcon');
    const okBtn = document.getElementById('confirmStatusBtn');

    if (targetStatus) {
        title.innerText = "Go Online?";
        msg.innerText = "You will start receiving ride assignments from Admin.";
        icon.innerHTML = `<i class="ri-signal-tower-fill" style="color: #10b981;"></i>`;
        okBtn.style.background = "#10b981";
    } else {
        title.innerText = "Go Offline?";
        msg.innerText = "You won't receive any new rides until you go back online.";
        icon.innerHTML = `<i class="ri-wifi-off-line" style="color: #ef4444;"></i>`;
        okBtn.style.background = "#ef4444";
    }

    modal.style.display = 'flex';
    modal.classList.add('active');

    okBtn.onclick = async () => {
        await executeStatusUpdate(targetStatus ? 'active' : 'inactive');
        modal.style.display = 'none';
    };
}

function cancelStatusChange() {
    document.getElementById('statusConfirmModal').style.display = 'none';
}

// Database Update Logic
async function executeStatusUpdate(newStatus) {
    try {
        const { data: { user } } = await window.supabase.auth.getUser();
        
        const { error } = await window.supabase
            .from('users')
            .update({ driver_active_status: newStatus })
            .eq('id', user.id);

        if (error) throw error;

        // Success: UI Update
        const toggle = document.getElementById('activeStatusToggle');
        const label = document.getElementById('statusLabel');
        
        toggle.checked = (newStatus === 'active');
        label.innerText = `Status: ${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)}`;
        
        // Custom notification instead of alert
        console.log(`Driver is now ${newStatus}`);

    } catch (error) {
        console.error("Update Error:", error);
        alert('Failed to update status. Check your connection.');
    }
}async function loadEarningsHistory() {
    const { data: rides, error } = await window.supabase
        .from('bookings')
        .select('id, pickup_date, total_amount, driver_earning')
        .eq('driver_id', currentUser.id)
        .eq('driver_status', 'completed');

    if (error) {
        console.error("Error fetching earnings:", error);
        return;
    }

    // Calculate Total Balance (Fixed ₹500 per ride)
    const totalBalance = rides.length * 500;
    document.getElementById('totalWalletBalance').textContent = `₹${totalBalance}`;
    document.getElementById('todayEarning').textContent = `₹${totalBalance}`; // Updates dashboard mini-card

    // Render Table HTML
    let tableHtml = `
        <div class="earnings-row header">
            <div>Date</div>
            <div>Trip ID</div>
            <div>Earning</div>
        </div>`;

    if (rides.length === 0) {
        tableHtml += `<div class="earnings-row"><div style="grid-column: span 3; text-align:center;">No completed earnings yet.</div></div>`;
    } else {
        rides.forEach(ride => {
            tableHtml += `
                <div class="earnings-row">
                    <div>${new Date(ride.pickup_date).toLocaleDateString()}</div>
                    <div>#${ride.id.substring(0, 6)}</div>
                    <div style="color: var(--driver-success); font-weight: 700;">+₹500</div>
                </div>`;
        });
    }

    document.getElementById('earningsTableContainer').innerHTML = tableHtml;
}// Updated for Flat ₹500 Earning
async function calculateEarning(rideId) {
    // Set fixed earning amount
    const earning = 500; 

    const { error } = await window.supabase
        .from('bookings')
        .update({ 
            driver_earning: earning, 
            booking_status: 'complete',
            driver_payment_status: 'pending' // Tracks if admin has paid the driver yet
        })
        .eq('id', rideId);

    if (error) {
        console.error("Earning update failed:", error.message);
    }
}async function loadMyRidesHistory() {
    const ridesList = document.getElementById('driverRidesList');
    
    const { data: rides, error } = await window.supabase
        .from('bookings')
        .select(`*, cars(name, image_url)`)
        .eq('driver_id', currentUser.id)
        .order('pickup_date', { ascending: false });

    if (error) {
        ridesList.innerHTML = `<p>Error loading rides: ${error.message}</p>`;
        return;
    }

    if (!rides || rides.length === 0) {
        ridesList.innerHTML = `<p style="text-align:center; padding: 2rem;">You haven't completed any rides yet.</p>`;
        return;
    }

    let ridesHtml = '';
    rides.forEach(ride => {
        const statusClass = ride.driver_status; // CSS classes like .accepted, .completed
        ridesHtml += `
            <div class="active-ride-card" style="margin-bottom: 1rem;">
                <div class="ride-header">
                    <span class="status-badge ${statusClass}">${ride.driver_status.toUpperCase()}</span>
                    <small>${new Date(ride.pickup_date).toLocaleDateString()}</small>
                </div>
                <div class="ride-body">
                    <div class="ride-img"><img src="${ride.cars.image_url}"></div>
                    <div class="ride-info">
                        <h4 style="margin:0">${ride.cars.name}</h4>
                        <p style="font-size: 0.8rem; margin: 5px 0;"><i class="ri-map-pin-line"></i> ${ride.pickup_location}</p>
                        <p style="font-size: 0.8rem; font-weight: bold;">Earning: ₹${ride.driver_earning || 0}</p>
                    </div>
                </div>
            </div>
        `;
    });

    ridesList.innerHTML = ridesHtml;
}// Driver Response Logic (Accept/Reject)
async function handleResponse(rideId, decision) {
    try {
        if (decision === 'rejected') {
            // 1. Booking se driver hatayein
            const { error: bError } = await window.supabase
                .from('bookings')
                .update({ 
                    driver_id: null, 
                    driver_status: null 
                })
                .eq('id', rideId);

            if (bError) throw bError;

            // 2. Driver ko wapas 'active' karein taaki admin ko list mein dikhe
            await window.supabase
                .from('users')
                .update({ driver_active_status: 'active' })
                .eq('id', currentUser.id);

            alert("Request Rejected successfully.");
        } else {
            // Accepted logic: Status update karein
            const { error: aError } = await window.supabase
                .from('bookings')
                .update({ driver_status: 'accepted' })
                .eq('id', rideId);
            
            if (aError) throw aError;
            
            alert("Request Accepted! Get ready for the trip.");
        }
        
        // UI refresh karein taaki action buttons change ho jayein
        loadDriverDashboard();
        
    } catch (err) {
        console.error("Error handling response:", err.message);
        alert("Operation failed: " + err.message);
    }
}