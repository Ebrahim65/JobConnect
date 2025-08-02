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

    verifyTechnicianAuthentication()
        .then(techData => {
            // If we get here, authentication was successful
            //initNotifications();
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

    initializeCalendar();
    loadSchedules();

    // Form submission handler
    document.getElementById('scheduleForm').addEventListener('submit', function (e) {
        e.preventDefault();
        saveSchedule();
    });

    // Delete button handler
    document.getElementById('deleteBtn').addEventListener('click', function () {
        const scheduleId = document.getElementById('scheduleId').value;
        if (scheduleId) {
            deleteSchedule(scheduleId);
        }
    });

    // View controls
    document.getElementById('dayView').addEventListener('click', () => changeView('day'));
    document.getElementById('weekView').addEventListener('click', () => changeView('week'));
    document.getElementById('monthView').addEventListener('click', () => changeView('month'));
});

let calendar;
let schedules = [];

function initializeCalendar() {
    const calendarEl = document.getElementById('scheduleCalendar');

    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
        },
        events: [],
        eventClick: function (info) {
            showEditScheduleModal(info.event);
        },
        dateClick: function (info) {
            showAddScheduleModal(info.dateStr);
        },
        eventColor: '#38a169',
        eventTimeFormat: {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        }
    });

    calendar.render();
}

async function loadSchedules() {
    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch('http://10.2.43.224:8000/schedule/', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Failed to load schedules');
        }

        schedules = await response.json();
        updateCalendar();
    } catch (error) {
        console.error('Error loading schedules:', error);
        showError('Failed to load schedules. Please try again later.');
    }
}

function updateCalendar() {
    // Clear existing events
    calendar.getEvents().forEach(event => event.remove());

    // Add new events
    schedules.forEach(schedule => {
        calendar.addEvent({
            id: schedule.schedule_id,
            title: 'Available',
            start: schedule.start_time,
            end: schedule.end_time,
            extendedProps: {
                specific_date: schedule.specific_date,
                day_of_week: schedule.day_of_week
            }
        });
    });
}

function showAddScheduleModal(dateStr = '') {
    const modal = document.getElementById('scheduleModal');
    const form = document.getElementById('scheduleForm');

    document.getElementById('modalTitle').textContent = 'Add Schedule';
    document.getElementById('scheduleId').value = '';
    document.getElementById('deleteBtn').style.display = 'none';
    form.reset();

    if (dateStr) {
        document.getElementById('scheduleDate').value = dateStr;
    }

    modal.style.display = 'block';
}

function showEditScheduleModal(event) {
    const modal = document.getElementById('scheduleModal');
    const form = document.getElementById('scheduleForm');

    document.getElementById('modalTitle').textContent = 'Edit Schedule';
    document.getElementById('scheduleId').value = event.id;
    document.getElementById('deleteBtn').style.display = 'block';

    // Convert to local timezone
    const start = new Date(event.start);
    const end = new Date(event.end);

    // Adjust for timezone offset
    const localStart = new Date(start.getTime() + start.getTimezoneOffset() * 60000);
    const localEnd = new Date(end.getTime() + end.getTimezoneOffset() * 60000);

    document.getElementById('scheduleDate').value = localStart.toISOString().split('T')[0];
    document.getElementById('startTime').value = localStart.toTimeString().substring(0, 5);
    document.getElementById('endTime').value = localEnd.toTimeString().substring(0, 5);

    // Check if recurring (has day_of_week)
    const isRecurring = event.extendedProps.day_of_week !== undefined;
    document.getElementById('recurring').checked = isRecurring;

    modal.style.display = 'block';
}

function closeScheduleModal() {
    document.getElementById('scheduleModal').style.display = 'none';
}

async function saveSchedule() {
    try {
        const token = localStorage.getItem('access_token');
        const form = document.getElementById('scheduleForm');
        const scheduleId = document.getElementById('scheduleId').value;
        const isRecurring = document.getElementById('recurring').checked;

        const date = document.getElementById('scheduleDate').value;
        const startTime = document.getElementById('startTime').value;
        const endTime = document.getElementById('endTime').value;

        // Create date objects in local timezone
        const localStart = new Date(`${date}T${startTime}`);
        const localEnd = new Date(`${date}T${endTime}`);

        if (localEnd <= localStart) {
            showError('End time must be after start time');
            return;
        }

        // Convert to UTC but keep the same wall-clock time
        const utcStart = new Date(localStart.getTime() - localStart.getTimezoneOffset() * 60000);
        const utcEnd = new Date(localEnd.getTime() - localEnd.getTimezoneOffset() * 60000);

        // Format as ISO strings without timezone (YYYY-MM-DDTHH:MM:SS)
        const formatForDB = (dateObj) => {
            return dateObj.toISOString().slice(0, 19).replace('T', ' ');
        };

        const scheduleData = {
            start_time: formatForDB(utcStart),
            end_time: formatForDB(utcEnd),
            specific_date: isRecurring ? null : date,
            day_of_week: isRecurring ? localStart.getDay() : null
        };

        let response;
        if (scheduleId) {
            // Update existing schedule
            response = await fetch(`http://10.2.43.224:8000/schedule/${scheduleId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(scheduleData)
            });
        } else {
            // Create new schedule
            response = await fetch('http://10.2.43.224:8000/schedule/', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(scheduleData)
            });
        }

        if (!response.ok) {
            throw new Error('Failed to save schedule');
        }

        showToast('Schedule saved successfully', 'success');
        closeScheduleModal();
        loadSchedules();
    } catch (error) {
        console.error('Error saving schedule:', error);
        showError('Failed to save schedule. Please try again.');
    }
}

async function deleteSchedule(scheduleId) {
    if (!confirm('Are you sure you want to delete this schedule?')) {
        return;
    }

    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch(`http://10.2.43.224:8000/schedule/${scheduleId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Failed to delete schedule');
        }

        showToast('Schedule deleted successfully', 'success');
        closeScheduleModal();
        loadSchedules();
    } catch (error) {
        console.error('Error deleting schedule:', error);
        showError('Failed to delete schedule. Please try again.');
    }
}

function changeView(view) {
    const dayBtn = document.getElementById('dayView');
    const weekBtn = document.getElementById('weekView');
    const monthBtn = document.getElementById('monthView');

    // Update button states
    dayBtn.classList.remove('active');
    weekBtn.classList.remove('active');
    monthBtn.classList.remove('active');

    switch (view) {
        case 'day':
            calendar.changeView('timeGridDay');
            dayBtn.classList.add('active');
            break;
        case 'week':
            calendar.changeView('timeGridWeek');
            weekBtn.classList.add('active');
            break;
        case 'month':
            calendar.changeView('dayGridMonth');
            monthBtn.classList.add('active');
            break;
    }
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
    const errorDisplay = document.getElementById('error-display') || errorDisplay();
    errorDisplay.textContent = message;
    errorDisplay.style.display = 'block';

    setTimeout(() => {
        errorDisplay.style.display = 'none';
    }, 5000);
}