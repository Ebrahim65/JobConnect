// Add these to your existing dashboard.js
let notifications = [];
let currentFilter = 'all';

// Initialize notifications
async function initNotifications() {
    await loadNotifications();
    updateUnreadCount();
    setInterval(updateUnreadCount, 60000); // Update count every minute
}

// Load notifications from API
async function loadNotifications() {
    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch(`http://10.2.43.224:8000/notifications/?status=${currentFilter}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Failed to load notifications');
        }

        notifications = await response.json();
        renderNotifications();
    } catch (error) {
        console.error('Error loading notifications:', error);
        showToast('Failed to load notifications', 'error');
    }
}

// Render notifications in the dropdown
function renderNotifications() {
    const notificationList = document.getElementById('notificationList');

    if (notifications.length === 0) {
        notificationList.innerHTML = `
            <div class="empty-notifications">
                <i class="fas fa-bell-slash"></i>
                <p>No notifications found</p>
            </div>
        `;
        return;
    }

    notificationList.innerHTML = '';
    notifications.forEach(notification => {
        const notificationItem = document.createElement('div');
        notificationItem.className = `notification-item ${notification.is_read ? '' : 'unread'}`;
        notificationItem.innerHTML = `
            <div class="notification-message">${notification.message}</div>
            <div class="notification-time">${formatTime(notification.created_at)}</div>
        `;
        notificationItem.onclick = () => handleNotificationClick(notification.notification_id);
        notificationList.appendChild(notificationItem);
    });
}

// Format time for display
function formatTime(timestamp) {
    const now = new Date();
    const date = new Date(timestamp);
    const diffInHours = (now - date) / (1000 * 60 * 60);

    if (diffInHours < 24) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
}

// Toggle notification dropdown
function toggleNotifications() {
    const dropdown = document.querySelector('.notification-dropdown');
    dropdown.classList.toggle('show');

    if (dropdown.classList.contains('show')) {
        loadNotifications();
    }
}

// Filter notifications
function filterNotifications() {
    currentFilter = document.getElementById('notificationFilter').value;
    loadNotifications();
}

// Handle notification click
async function handleNotificationClick(notificationId) {
    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch(`http://10.2.43.224:8000/notifications/${notificationId}/mark-read`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Failed to mark notification as read');
        }

        // Update UI
        const notification = notifications.find(n => n.notification_id === notificationId);
        if (notification) {
            notification.is_read = true;
            renderNotifications();
            updateUnreadCount();
        }
    } catch (error) {
        console.error('Error marking notification as read:', error);
    }
}

// Mark all notifications as read
async function markAllAsRead() {
    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch('http://10.2.43.224:8000/notifications/mark-all-read', {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Failed to mark all notifications as read');
        }

        // Update UI
        notifications.forEach(notification => {
            notification.is_read = true;
        });
        renderNotifications();
        updateUnreadCount();
        showToast('All notifications marked as read', 'success');
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        showToast('Failed to mark all as read', 'error');
    }
}

// View all notifications (redirect to notifications page)
function viewAllNotifications() {
    window.location.href = 'notifications.html';
}

// Update unread count badge
async function updateUnreadCount() {
    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch('http://10.2.43.224:8000/notifications/unread/count', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Failed to get unread count');
        }

        const data = await response.json();
        const unreadCount = document.getElementById('unreadCount');
        unreadCount.textContent = data.count || '0';
        unreadCount.style.display = data.count > 0 ? 'block' : 'none';
    } catch (error) {
        console.error('Error updating unread count:', error);
    }
}

document.addEventListener('DOMContentLoaded', function () {
    loadJobs();
});

verifyTechnicianAuthentication()
    .then(techData => {
        // If we get here, authentication was successful
        initNotifications();
        displayTechnicianInfo(techData);
        //loadDashboardData();
        highlightActiveTab();
    })
    .catch(error => {
        console.error('Authentication failed:', error);
        redirectToLogin();
    });

// Authentication verification for technicians
async function verifyTechnicianAuthentication() {
    const token = localStorage.getItem('access_token');
    const userType = localStorage.getItem('user_type');

    // Basic checks first
    if (!token || userType !== 'technician') {
        throw new Error('No valid authentication tokens found');
    }

    try {
        // Verify with backend
        const response = await fetch('http://10.2.43.224:8000/technicians/me', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        // Clear invalid tokens
        localStorage.removeItem('access_token');
        localStorage.removeItem('user_type');
        throw error;
    }
}

function redirectToLogin() {
    // Clear any remaining tokens
    localStorage.removeItem('access_token');
    localStorage.removeItem('user_type');
    window.location.href = '/index.html';
}

function highlightActiveTab() {
    // Get current page path
    const currentPath = window.location.pathname;

    // Remove active class from all tabs
    document.querySelectorAll('.sidebar-nav li').forEach(li => {
        li.classList.remove('active');
    });

    // Find matching tab and add active class
    document.querySelectorAll('.sidebar-nav a').forEach(a => {
        if (a.getAttribute('href') === currentPath) {
            a.parentElement.classList.add('active');
        }
    });
}

function displayTechnicianInfo(techData) {
    if (techData.profile_picture_url) {
        profilePicture.src = techData.profile_picture_url;
    } else {
        profilePicture.src = '/assets/profile-placeholder.png';
    }

    userName.textContent = `${techData.name} ${techData.surname || ''}`;
}

async function loadJobs(statusFilter = 'all') {
    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch(`http://10.2.43.224:8000/technicians/jobs?status=${statusFilter}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Failed to load jobs');
        }

        const jobs = await response.json();
        displayJobs(jobs);
    } catch (error) {
        console.error('Error loading jobs:', error);
        showError('Failed to load jobs. Please try again later.');
    }
}

function displayJobs(jobs) {
    const jobsList = document.getElementById('jobsList');

    if (jobs.length === 0) {
        jobsList.innerHTML = `
            <tr>
                <td colspan="6" class="empty-jobs">
                    <i class="fas fa-briefcase"></i>
                    <span>No jobs found</span>
                </td>
            </tr>
        `;
        return;
    }

    jobsList.innerHTML = '';
    jobs.forEach(job => {

        // Safely handle the price display
        let priceDisplay = 'N/A';
        if (typeof job.price === 'number') {
            priceDisplay = `R${job.price.toFixed(2)}`;
        } else if (job.price !== null && job.price !== undefined) {
            const numericPrice = Number(job.price);
            if (!isNaN(numericPrice)) {
                priceDisplay = `R${numericPrice.toFixed(2)}`;
            }
        }

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${job.client_name || 'N/A'} ${job.client_surname || ''}</td>
            <td>${job.service_type || 'N/A'}</td>
            <td>${formatDateTime(job.start_date)}</td>
            <td>${priceDisplay}</td>
            <td><span class="status-badge status-${job.status}">${formatJobStatus(job.status)}</span></td>
            <td>
                <button class="action-btn btn-primary" onclick="viewJobDetails('${job.booking_id}')">
                    <i class="fas fa-eye"></i> View
                </button>
                ${job.status === 'pending' ? `
                <button class="action-btn btn-success" onclick="makeOffer('${job.booking_id}')">
                    <i class="fas fa-handshake"></i> Offer
                </button>
                <button class="action-btn btn-danger" onclick="rejectJob('${job.booking_id}')">
                    <i class="fas fa-times"></i> Reject
                </button>
                ` : ''}
                ${job.status === 'accepted' ? `
                <button class="action-btn btn-success" onclick="startJob('${job.booking_id}')">
                    <i class="fas fa-play"></i> Start
                </button>
                ` : ''}
                ${job.status === 'in_progress' ? `
                <button class="action-btn btn-success" onclick="completeJob('${job.booking_id}')">
                    <i class="fas fa-check"></i> Complete
                </button>
                ` : ''}
                <button class="action-btn btn-whatsapp" onclick="chatOnWhatsApp('${job.client_phone || ''}', '${job.service_type}')">
                    <i class="fab fa-whatsapp"></i> Chat
                </button>
            </td>
        `;
        jobsList.appendChild(row);
    });
}

function filterJobs() {
    const statusFilter = document.getElementById('statusFilter').value;
    loadJobs(statusFilter);
}

async function viewJobDetails(bookingId) {
    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch(`http://10.2.43.224:8000/technicians/bookings/${bookingId}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Failed to load job details');
        }

        const job = await response.json();
        showJobModal(job);
    } catch (error) {
        console.error('Error loading job details:', error);
        showError('Failed to load job details. Please try again.');
    }
}

function showJobModal(job) {
    const modal = document.getElementById('jobModal');
    const modalContent = document.getElementById('modalContent');

    modalContent.innerHTML = `
        <div class="job-details">
            <p><strong>Client:</strong> ${job.client_name} ${job.client_surname || ''}</p>
            <p><strong>Phone:</strong> ${job.client_phone || 'N/A'}</p>
            <p><strong>Service:</strong> ${job.service_type}</p>
            <p><strong>Status:</strong> <span class="status-badge status-${job.status}">${formatJobStatus(job.status)}</span></p>
            <p><strong>Price:</strong> ${job.price ? `R${job.price.toFixed(2)}` : 'Not set'}</p>
            <p><strong>Description:</strong> ${job.description || 'No description provided'}</p>
            <p><strong>Scheduled:</strong> ${formatDateTime(job.start_date)}</p>
            <p><strong>Created:</strong> ${formatDateTime(job.created_at)}</p>
            
            ${(job.status === 'in_progress' || job.status === 'completed') ? `
            <div class="location-section">
                <h3>Location Details</h3>
                <p><strong>Address:</strong> ${job.client_address}, ${job.client_city}, ${job.client_province} ${job.client_postal_code}</p>
                <div class="map-container">
                    <iframe 
                        width="100%" 
                        height="300" 
                        frameborder="0" 
                        scrolling="no" 
                        marginheight="0" 
                        marginwidth="0" 
                        src="https://maps.google.com/maps?q=${job.client_latitude},${job.client_longitude}&z=15&output=embed">
                    </iframe>
                </div>
            </div>
            ` : ''}
        </div>
        <div class="job-actions">
            ${job.status === 'pending' ? `
            <button class="btn btn-success" onclick="makeOffer('${job.booking_id}')">
                <i class="fas fa-handshake"></i> Make Offer
            </button>
            <button class="btn btn-danger" onclick="rejectJob('${job.booking_id}')">
                <i class="fas fa-times"></i> Reject Job
            </button>
            ` : ''}
            ${job.status === 'accepted' ? `
            <button class="btn btn-primary" onclick="startJob('${job.booking_id}')">
                <i class="fas fa-play"></i> Start Job
            </button>
            ` : ''}
            ${job.status === 'in_progress' ? `
            <button class="btn btn-success" onclick="completeJob('${job.booking_id}')">
                <i class="fas fa-check"></i> Complete Job
            </button>
            ` : ''}
            <button class="btn btn-secondary" onclick="closeModal()">
                <i class="fas fa-times"></i> Close
            </button>
        </div>
    `;

    modal.style.display = 'block';
}

function closeModal() {
    document.getElementById('jobModal').style.display = 'none';
}

async function makeOffer(bookingId) {
    const offerAmount = prompt('Enter your price offer (R):');
    if (!offerAmount || isNaN(offerAmount)) {
        showError('Please enter a valid amount');
        return;
    }

    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch(`http://10.2.43.224:8000/technicians/bookings/${bookingId}/offer`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ price: parseFloat(offerAmount) })
        });

        if (!response.ok) {
            throw new Error('Failed to make offer');
        }

        showToast('Offer submitted successfully', 'success');
        loadJobs();
        closeModal();
    } catch (error) {
        console.error('Error making offer:', error);
        showError('Failed to make offer. Please try again.');
    }
}

async function rejectJob(bookingId) {
    if (!confirm('Are you sure you want to reject this job?')) {
        return;
    }

    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch(`http://10.2.43.224:8000/technicians/bookings/${bookingId}/reject`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Failed to reject job');
        }

        showToast('Job rejected successfully', 'success');
        loadJobs();
        closeModal();
    } catch (error) {
        console.error('Error rejecting job:', error);
        showError('Failed to reject job. Please try again.');
    }
}

async function startJob(bookingId) {
    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch(`http://10.2.43.224:8000/bookings/${bookingId}/start`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to start job');
        }

        showToast('Job started successfully!', 'success');
        loadJobs();
        closeModal();
    } catch (error) {
        console.error('Error starting job:', error);
        showToast(error.message || 'Failed to start job', 'error');
    }
}

async function completeJob(bookingId) {
    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch(`http://10.2.43.224:8000/bookings/${bookingId}/complete`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to complete job');
        }

        showToast('Job completed successfully!', 'success');
        loadJobs();
        closeModal();
    } catch (error) {
        console.error('Error completing job:', error);
        showToast(error.message || 'Failed to complete job', 'error');
    }
}

async function cancelJob(bookingId) {
    // Create a modal for cancellation reason
    const modal = document.getElementById('jobModal');
    const modalContent = document.getElementById('modalContent');

    modalContent.innerHTML = `
        <h3>Cancel Booking</h3>
        <p>Please provide a reason for cancellation:</p>
        <textarea id="cancelReason" rows="4" style="width: 100%; padding: 8px; margin-bottom: 15px;" 
                  placeholder="Enter cancellation reason..."></textarea>
        <div class="job-actions">
            <button class="btn btn-danger" onclick="submitCancellation('${bookingId}')">
                <i class="fas fa-ban"></i> Confirm Cancellation
            </button>
            <button class="btn btn-secondary" onclick="closeModal()">
                <i class="fas fa-times"></i> Cancel
            </button>
        </div>
    `;

    modal.style.display = 'flex'; // Use flex to center
}

async function submitCancellation(bookingId) {
    const reason = document.getElementById('cancelReason').value.trim();

    if (!reason) {
        showToast('Please provide a cancellation reason', 'error');
        return;
    }

    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch(`http://10.2.43.224:8000/technicians/bookings/${bookingId}/cancel`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ reason: reason })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to cancel job');
        }

        showToast('Job cancelled successfully', 'success');
        loadJobs();
        closeModal();
    } catch (error) {
        console.error('Error cancelling job:', error);
        showToast(error.message, 'error');
    }
}

function chatOnWhatsApp(phoneNumber, serviceType) {
    if (!phoneNumber) {
        showError('Client phone number not available');
        return;
    }

    // Remove any non-digit characters
    const cleanedPhone = phoneNumber.replace(/\D/g, '');
    const message = `Hi, this is regarding your ${serviceType} booking on JobConnect`;
    const whatsappUrl = `https://wa.me/${cleanedPhone}?text=${encodeURIComponent(message)}`;

    window.open(whatsappUrl, '_blank');
}

function formatDateTime(dateString) {
    if (!dateString) return 'Not scheduled';
    const options = {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    return new Date(dateString).toLocaleDateString('en-US', options);
}

function formatJobStatus(status) {
    const statusMap = {
        'pending': 'Pending',
        'offered': 'Offered',
        'accepted': 'Accepted',
        'in_progress': 'In Progress',
        'completed': 'Completed',
        'cancelled': 'Cancelled',
        'rejected': 'Rejected'
    };
    return statusMap[status?.toLowerCase()] || status;
}

function showToast(message, type = 'info') {
    // Create toast container if it doesn't exist
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 1000;
            display: flex;
            flex-direction: column;
            gap: 10px;
        `;
        document.body.appendChild(toastContainer);
    }

    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.style.cssText = `
        padding: 12px 20px;
        border-radius: 4px;
        color: white;
        display: flex;
        align-items: center;
        gap: 10px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        animation: slideIn 0.3s ease-out;
    `;

    // Set background color based on type
    const typeColors = {
        success: '#4CAF50',
        error: '#F44336',
        info: '#2196F3',
        warning: '#FF9800'
    };
    toast.style.backgroundColor = typeColors[type] || typeColors.info;

    // Add icon based on type
    const typeIcons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        info: 'fa-info-circle',
        warning: 'fa-exclamation-triangle'
    };
    toast.innerHTML = `
        <i class="fas ${typeIcons[type] || typeIcons.info}"></i>
        <span>${message}</span>
    `;

    // Add to container
    toastContainer.appendChild(toast);

    // Auto-remove after delay
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s ease-out';
        setTimeout(() => toast.remove(), 300);
    }, 3000);

    // Add click to dismiss
    toast.onclick = () => {
        toast.style.animation = 'fadeOut 0.3s ease-out';
        setTimeout(() => toast.remove(), 300);
    };
}

// Add these CSS animations to your stylesheet
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes fadeOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);

function showError(message) {
    // Implement a proper error display mechanism
    const errorDisplay = document.getElementById('error-display') || errorDisplay();
    errorDisplay.textContent = message;
    errorDisplay.style.display = 'block';

    setTimeout(() => {
        errorDisplay.style.display = 'none';
    }, 5000);
}

//For stats
// Distance Stats Functions
async function showDistanceStats() {
    try {
        const token = localStorage.getItem('access_token');
        const statsContainer = document.getElementById('distanceStatsContainer');

        statsContainer.innerHTML = `...loading...`;

        const response = await fetch('http://10.2.43.224:8000/technicians/me/distance-stats', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Failed to load stats');
        }

        const data = await response.json();

        // The API returns the stats directly, not nested in a "stats" property
        renderDistanceStats(data);

    } catch (error) {
        console.error('Error:', error);
        statsContainer.innerHTML = `...error message...`;
    }
}

function renderDistanceStats(data) {
    const statsContainer = document.getElementById('distanceStatsContainer');

    // Check if data exists and has required properties
    if (!data || typeof data.total_distance_km === 'undefined') {
        statsContainer.innerHTML = `
            <div class="error-stats">
                <i class="fas fa-exclamation-circle"></i>
                <span>Invalid data received from server</span>
            </div>
        `;
        return;
    }

    // Safely handle bookings data
    const bookings = data.bookings || [];
    const hasBookings = bookings.length > 0;

    statsContainer.innerHTML = `
        <div class="stats-grid">
            <div class="stat-card">
                <h3>Total Distance Traveled</h3>
                <div class="stat-value">${data.total_distance_km?.toFixed(2) || '0.00'}</div>
                <div class="stat-unit">kilometers</div>
            </div>
            <div class="stat-card">
                <h3>Completed Bookings</h3>
                <div class="stat-value">${data.completed_bookings_count || 0}</div>
                <div class="stat-unit">jobs</div>
            </div>
            <div class="stat-card">
                <h3>Average Distance</h3>
                <div class="stat-value">${data.average_distance_per_booking_km?.toFixed(2) || '0.00'}</div>
                <div class="stat-unit">km per job</div>
            </div>
        </div>
        
        ${hasBookings ? `
        <h3>Recent Bookings with Distance</h3>
        <table class="bookings-table">
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Service</th>
                    <th>Distance</th>
                    <th>Location</th>
                </tr>
            </thead>
            <tbody>
                ${bookings.slice(0, 5).map(booking => `
                    <tr>
                        <td>${booking.booking_date ? new Date(booking.booking_date).toLocaleDateString() : 'N/A'}</td>
                        <td>${booking.service_type || 'N/A'}</td>
                        <td><span class="distance-badge">${booking.distance_from_technician_km?.toFixed(2) || '0.00'} km</span></td>
                        <td>
                            ${booking.client_address || ''}, ${booking.client_city || ''}<br>
                            ${booking.client_province || ''} ${booking.client_postal_code || ''}
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        ` : `
        
        `}
        
        ${hasBookings ? `
        <div class="stats-footer" style="margin-top: 20px; text-align: center;">
            <button class="btn btn-primary" onclick="showAllDistanceBookings()">
                <i class="fas fa-list"></i> View All Bookings with Distance
            </button>
        </div>
        ` : ''}
    `;
}

async function generateDistanceReport(format) {
    try {
        const token = localStorage.getItem('access_token');
        let endpoint, filename;

        if (format === 'pdf') {
            endpoint = 'http://10.2.43.224:8000/technicians/me/print-stats/pdf';
            filename = `distance_report_${new Date().toISOString().split('T')[0]}.pdf`;
        } else {
            endpoint = 'http://10.2.43.224:8000/technicians/me/print-stats';
            filename = `distance_report_${new Date().toISOString().split('T')[0]}.html`;
        }

        showToast(`Generating ${format.toUpperCase()} report...`, 'info');

        const response = await fetch(endpoint, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || `Failed to generate ${format} report`);
        }

        if (format === 'pdf') {
            // For PDF, create a download link
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } else {
            // For HTML, open in new tab
            const html = await response.text();
            const newWindow = window.open('', '_blank');
            newWindow.document.write(html);
            newWindow.document.close();
        }

        showToast(`${format.toUpperCase()} report generated successfully`, 'success');
    } catch (error) {
        console.error(`Error generating ${format} report:`, error);
        showToast(error.message || `Failed to generate ${format} report`, 'error');
    }
}

function showAllDistanceBookings() {
    // Implement this if you want to show all bookings in a modal or new page
    showToast('Showing all bookings with distance information', 'info');
    // You could implement a modal or redirect to a dedicated page
}