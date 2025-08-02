let allNotifications = [];
let currentFilter = 'all';

// Load all notifications
async function loadAllNotifications() {
    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch(`http://10.2.43.224:8000/notifications/?status=${currentFilter}`, {
            headers: {
                'Authorization': `Bearer ${token}`
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

// Render all notifications
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
        const notificationElement = document.createElement('div');
        notificationElement.className = `notification-item ${notification.is_read ? '' : 'unread'}`;
        notificationElement.innerHTML = `
            <div class="notification-content">
                <p class="notification-message">${notification.message}</p>
                <div class="notification-meta">
                    <span class="notification-time">${formatTime(notification.created_at)}</span>
                    ${notification.is_read ? '' : '<span class="unread-badge">Unread</span>'}
                </div>
            </div>
            ${notification.is_read ? '' : '<button class="btn-mark-read" onclick="markNotificationRead(\'' + notification.notification_id + '\', this)"><i class="fas fa-check"></i></button>'}
        `;

        notificationElement.addEventListener('click', () => {
            if (!notification.is_read) {
                markNotificationRead(notification.notification_id);
            }
        });

        container.appendChild(notificationElement);
    });
}

// Format time for display
function formatTime(timestamp) {
    const now = new Date();
    const date = new Date(timestamp);
    const diffInHours = (now - date) / (1000 * 60 * 60);

    if (diffInHours < 24) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 48) {
        return 'Yesterday';
    } else {
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
}

// Mark a notification as read
async function markNotificationRead(notificationId, element = null) {
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

            if (element) {
                const notificationItem = element.closest('.notification-item');
                if (notificationItem) {
                    notificationItem.classList.remove('unread');
                    notificationItem.querySelector('.unread-badge')?.remove();
                    element.remove();
                }
            } else {
                renderAllNotifications();
            }

            updateUnreadCount();
        }
    } catch (error) {
        console.error('Error marking notification as read:', error);
        showToast('Failed to mark notification as read', 'error');
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
        allNotifications.forEach(notification => {
            notification.is_read = true;
        });
        renderAllNotifications();
        updateUnreadCount();
        showToast('All notifications marked as read', 'success');
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        showToast('Failed to mark all as read', 'error');
    }
}

// Filter notifications
function filterAllNotifications() {
    currentFilter = document.getElementById('globalFilter').value;
    loadAllNotifications();
}

// Update unread count badge
async function updateUnreadCount() {
    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch('http://10.2.43.224:8000/notifications/unread/count', {
            headers: {
                'Authorization': `Bearer ${token}`
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

// Show toast message
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

// Initialize page
document.addEventListener('DOMContentLoaded', function () {

    verifyTechnicianAuthentication()
        .then(techData => {
            displayTechnicianInfo(techData);
            loadAllNotifications();
            updateUnreadCount();
            setInterval(updateUnreadCount, 60000);

        })
        .catch(error => {
            console.error('Authentication failed:', error);
            redirectToLogin();
        });
});

function displayTechnicianInfo(techData) {
    if (techData.profile_picture_url) {
        profilePicture.src = techData.profile_picture_url;
    } else {
        profilePicture.src = '/assets/profile-placeholder.png';
    }

    userName.textContent = `${techData.name} ${techData.surname || ''}`;
}
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