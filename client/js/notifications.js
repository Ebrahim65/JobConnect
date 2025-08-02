let allNotifications = [];
let currentFilter = 'all';
let notifications = [];

async function verifyAuthentication() {
    const token = localStorage.getItem('access_token');
    const userType = localStorage.getItem('user_type');

    if (!token || userType !== 'client') {
        throw new Error('No valid authentication tokens found');
    }

    try {
        const response = await fetch('http://10.2.43.224:8000/clients/me', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('user_type');
        throw error;
    }
}

function displayUserInfo(userData) {
    const profilePicture = document.getElementById('profilePicture');
    const userName = document.getElementById('userName');

    if (userData.profile_picture_url) {
        profilePicture.src = userData.profile_picture_url;
    } else {
        profilePicture.src = '/assets/profile-placeholder.png';
    }
    userName.textContent = `${userData.name} ${userData.surname}`;
}

function redirectToLogin() {
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

document.addEventListener('DOMContentLoaded', function () {

    verifyAuthentication()
        .then(userData => {
            // Get user location
            displayUserInfo(userData);
            highlightActiveTab();
            
        })
        .catch(error => {
            console.error('Authentication failed:', error);
            redirectToLogin();
        });

    loadAllNotifications();
});

async function loadAllNotifications() {
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

        allNotifications = await response.json();
        renderAllNotifications();
    } catch (error) {
        console.error('Error loading notifications:', error);
        showToast('Failed to load notifications', 'error');
    }
}

function renderAllNotifications() {
    const container = document.getElementById('allNotifications');

    if (allNotifications.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-bell-slash"></i>
                <p>No notifications found</p>
            </div>
        `;
        return;
    }

    container.innerHTML = '';
    allNotifications.forEach(notification => {
        const notificationItem = document.createElement('div');
        notificationItem.className = `notification-item ${notification.is_read ? '' : 'unread'}`;
        notificationItem.innerHTML = `
            <div class="notification-content">
                <div class="notification-message">${notification.message}</div>
                <div class="notification-time">${formatFullDate(notification.created_at)}</div>
            </div>
            ${notification.is_read ? '' : `
            <button class="btn-mark-read" onclick="markNotificationAsRead('${notification.notification_id}', this)">
                Mark as Read
            </button>
            `}
        `;
        container.appendChild(notificationItem);
    });
}

function formatFullDate(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString([], {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function filterAllNotifications() {
    currentFilter = document.getElementById('globalFilter').value;
    loadAllNotifications();
}

async function markNotificationAsRead(notificationId, button) {
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
        const notification = allNotifications.find(n => n.notification_id === notificationId);
        if (notification) {
            notification.is_read = true;
            button.remove();
            notificationItem.classList.remove('unread');
        }
    } catch (error) {
        console.error('Error marking notification as read:', error);
        showToast('Failed to mark as read', 'error');
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
        renderAllNotifications();
        //updateUnreadCount();
        showToast('All notifications marked as read', 'success');
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        showToast('Failed to mark all as read', 'error');
    }
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;
    toast.innerHTML = `
        <div class="toast-message">${message}</div>
        <button class="toast-close">&times;</button>
    `;

    document.body.appendChild(toast);

    // Auto-remove after 5 seconds
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 300);
    }, 5000);

    // Manual close
    toast.querySelector('.toast-close').onclick = () => toast.remove();
}