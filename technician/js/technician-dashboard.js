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
    window.location.href = '/notifications.html';
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
    // DOM Elements
    const profilePicture = document.getElementById('profilePicture');
    const userName = document.getElementById('userName');
    const pendingRequests = document.getElementById('pendingRequests');
    const acceptedBookings = document.getElementById('acceptedBookings');
    const completedBookings = document.getElementById('completedBookings');
    const totalEarnings = document.getElementById('totalEarnings');
    const recentBookingsTable = document.getElementById('recentBookings');
    const recentReviews = document.getElementById('recentReviews');

    // First verify authentication before doing anything else
    verifyTechnicianAuthentication()
        .then(techData => {
            // If we get here, authentication was successful
            initNotifications();
            displayTechnicianInfo(techData);
            loadDashboardData();
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

    async function loadDashboardData() {
        try {
            const token = localStorage.getItem('access_token');

            // Load dashboard stats
            const dashboardResponse = await fetch('http://10.2.43.224:8000/technicians/dashboard', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                credentials: 'include'
            });

            if (!dashboardResponse.ok) {
                throw new Error('Failed to load dashboard data');
            }

            const dashboardData = await dashboardResponse.json();
            setInterval(dashboardData.total_earnings, 5000)
            updateDashboardStats(dashboardData);


            // Load recent bookings
            if (dashboardData.recent_bookings?.length > 0) {
                displayRecentBookings(dashboardData.recent_bookings);
            } else {
                showEmptyJobsState();
            }

            // Load technician income
            /*const incomeResponse = await fetch('http://10.2.43.224:8000/technicians/me/income', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (incomeResponse.ok) {
                const incomeData = await incomeResponse.json();
                totalEarnings.textContent = `R${incomeData.total_income.toFixed(2)}`;
            }*/

        } catch (error) {
            console.error('Error loading dashboard data:', error);
            showError('Failed to load dashboard data. Please try again later.');
        }
    }

    function updateDashboardStats(data) {
        pendingRequests.textContent = data.pending_requests || '0';
        acceptedBookings.textContent = data.accepted_bookings || '0';
        completedBookings.textContent = data.completed_bookings || '0';

        // Safely handle total earnings display
        let earningsDisplay = 'R0.00';
        if (typeof data.total_earnings === 'number') {
            earningsDisplay = `R${data.total_earnings.toFixed(2)}`;
        } else if (data.total_earnings !== null && data.total_earnings !== undefined) {
            const numericEarnings = Number(data.total_earnings);
            if (!isNaN(numericEarnings)) {
                earningsDisplay = `R${numericEarnings.toFixed(2)}`;
            }
        }
        totalEarnings.textContent = earningsDisplay;
    }

    function displayRecentBookings(bookings) {
        recentBookingsTable.innerHTML = '';

        bookings.forEach(booking => {
            // Safely handle the price display
            let priceDisplay = 'N/A';
            if (typeof booking.price === 'number') {
                priceDisplay = `R${booking.price.toFixed(2)}`;
            } else if (booking.price !== null && booking.price !== undefined) {
                const numericPrice = Number(booking.price);
                if (!isNaN(numericPrice)) {
                    priceDisplay = `R${numericPrice.toFixed(2)}`;
                }
            }

            const row = document.createElement('tr');
            row.innerHTML = `
            <td>${booking.client_name || 'N/A'} ${booking.client_surname || ''}</td>
            <td>${booking.service_type || 'N/A'}</td>
            <td>${formatDateTime(booking.start_date)}</td>
            <td>${priceDisplay}</td>
            <td><span class="status-badge status-${booking.status}">${formatBookingStatus(booking.status)}</span></td>
            <td>
                <button class="action-btn btn-primary" onclick="viewBookingDetails('${booking.booking_id}')">
                    <i class="fas fa-eye"></i> View
                </button>
                ${booking.status === 'pending' ? `
                <button class="action-btn btn-success" onclick="makeBookingOffer('${booking.booking_id}')">
                    <i class="fas fa-handshake"></i> Offer
                </button>
                <button class="action-btn btn-danger" onclick="rejectBooking('${booking.booking_id}')">
                    <i class="fas fa-times"></i> Reject
                </button>
                ` : ''}
                ${booking.status === 'accepted' ? `
                <button class="action-btn btn-success" onclick="startBooking('${booking.booking_id}')">
                    <i class="fas fa-play"></i> Start
                </button>
                ` : ''}
                ${booking.status === 'in_progress' ? `
                <button class="action-btn btn-success" onclick="completeBooking('${booking.booking_id}')">
                    <i class="fas fa-check"></i> Complete
                </button>
                ` : ''}
            </td>
        `;
            recentBookingsTable.appendChild(row);
        });
    }

    function formatDateTime(dateTimeString) {
        if (!dateTimeString) return 'N/A';
        const options = {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        };
        return new Date(dateTimeString).toLocaleDateString('en-US', options);
    }

    function formatBookingStatus(status) {
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

    function showEmptyJobsState() {
        recentBookingsTable.innerHTML = `
            <tr>
                <td colspan="6" class="empty-jobs">
                    <i class="fas fa-briefcase"></i>
                    <span>No recent bookings found</span>
                </td>
            </tr>
        `;
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

    function showError(message) {
        // Implement a proper error display mechanism
        const errorDisplay = document.getElementById('error-display') || createErrorDisplay();
        errorDisplay.textContent = message;
        errorDisplay.style.display = 'block';

        setTimeout(() => {
            errorDisplay.style.display = 'none';
        }, 5000);
    }

    function createErrorDisplay() {
        const div = document.createElement('div');
        div.id = 'error-display';
        div.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px;
            background-color: #ff4444;
            color: white;
            border-radius: 5px;
            display: none;
            z-index: 1000;
        `;
        document.body.appendChild(div);
        return div;
    }

    // Global functions
    window.viewBookingDetails = async function (bookingId) {
        try {
            const token = localStorage.getItem('access_token');
            const response = await fetch(`http://10.2.43.224:8000/bookings/${bookingId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to load booking details');
            }

            const booking = await response.json();

            // Create a modal to show booking details
            const modal = document.createElement('div');
            modal.className = 'booking-modal';
            modal.innerHTML = `
            <div class="modal-content">
                <span class="close-btn" onclick="this.parentElement.parentElement.remove()">&times;</span>
                <h3>Booking Details</h3>
                <div class="booking-info">
                    <p><strong>Client:</strong> ${booking.client_name} ${booking.client_surname}</p>
                    <p><strong>Service:</strong> ${booking.service_type}</p>
                    <p><strong>Status:</strong> <span class="status-badge status-${booking.status}">${formatBookingStatus(booking.status)}</span></p>
                    ${booking.price ? `<p><strong>Price:</strong> R${booking.price.toFixed(2)}</p>` : ''}
                    <p><strong>Description:</strong> ${booking.description}</p>
                    <p><strong>Created:</strong> ${formatDateTime(booking.created_at)}</p>
                    ${booking.start_date ? `<p><strong>Scheduled:</strong> ${formatDateTime(booking.start_date)}</p>` : ''}
                    ${booking.client_address ? `
                        <p><strong>Address:</strong> ${booking.client_address}</p>
                        <p><strong>Location:</strong> ${booking.client_city}, ${booking.client_province} ${booking.client_postal_code}</p>
                    ` : ''}
                </div>
                <div class="modal-actions">
                    ${booking.status === 'pending' ? `
                    <button class="btn btn-success" onclick="makeBookingOffer('${booking.booking_id}')">
                        <i class="fas fa-handshake"></i> Make Offer
                    </button>
                    <button class="btn btn-danger" onclick="rejectBooking('${booking.booking_id}')">
                        <i class="fas fa-times"></i> Reject
                    </button>
                    ` : ''}
                    ${booking.status === 'accepted' ? `
                    <button class="btn btn-success" onclick="startBooking('${booking.booking_id}')">
                        <i class="fas fa-play"></i> Start Job
                    </button>
                    ` : ''}
                    ${booking.status === 'in_progress' ? `
                    <button class="btn btn-success" onclick="completeBooking('${booking.booking_id}')">
                        <i class="fas fa-check-circle"></i> Complete Job
                    </button>
                    ` : ''}
                </div>
            </div>
        `;
            document.body.appendChild(modal);
        } catch (error) {
            console.error('Error viewing booking:', error);
            showError('Failed to load booking details. Please try again.');
        }
    };

    window.makeBookingOffer = async function (bookingId) {
        const offerAmount = prompt('Enter your price offer for this booking (R):');
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
                throw new Error('Failed to make booking offer');
            }

            showToast('Booking offer submitted successfully', 'success');
            loadDashboardData(); // Refresh the dashboard
        } catch (error) {
            console.error('Error making booking offer:', error);
            showError('Failed to make booking offer. Please try again.');
        }
    };

    window.rejectBooking = async function (bookingId) {
        if (!confirm('Are you sure you want to reject this booking?')) {
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
                throw new Error('Failed to reject booking');
            }

            showToast('Booking rejected successfully', 'success');
            loadDashboardData(); // Refresh the dashboard
        } catch (error) {
            console.error('Error rejecting booking:', error);
            showError('Failed to reject booking. Please try again.');
        } finally {
            loadDashboardData();
        }
    };

    window.updateBookingStatus = async function (bookingId, newStatus) {
        try {
            const token = localStorage.getItem('access_token');
            const response = await fetch(`http://10.2.43.224:8000/bookings/${bookingId}/status`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ status: newStatus })
            });

            if (!response.ok) {
                throw new Error('Failed to update booking status');
            }

            showToast(`Booking status updated to ${formatBookingStatus(newStatus)}`, 'success');
            loadDashboardData(); // Refresh the dashboard
        } catch (error) {
            console.error('Error updating booking status:', error);
            showError('Failed to update booking status. Please try again.');
        }
    };

    // New function to handle starting a booking
    window.startBooking = async function (bookingId) {
        if (!confirm('Are you ready to start this job?')) {
            return;
        }

        try {
            const token = localStorage.getItem('access_token');
            const response = await fetch(`http://10.2.43.224:8000/bookings/${bookingId}/start`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to start booking');
            }

            showToast('Booking started successfully', 'success');
            loadDashboardData(); // Refresh the dashboard
        } catch (error) {
            console.error('Error starting booking:', error);
            showError(error.message || 'Failed to start booking. Please try again.');
        }
    };

    // New function to handle completing a booking
    window.completeBooking = async function (bookingId) {
        if (!confirm('Have you completed all work for this job?')) {
            return;
        }

        try {
            const token = localStorage.getItem('access_token');
            const response = await fetch(`http://10.2.43.224:8000/bookings/${bookingId}/complete`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to complete booking');
            }

            showToast('Booking marked as completed', 'success');
            loadDashboardData(); // Refresh the dashboard
        } catch (error) {
            console.error('Error completing booking:', error);
            showError(error.message || 'Failed to complete booking. Please try again.');
        }
    };

});