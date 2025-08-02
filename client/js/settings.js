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

document.addEventListener('DOMContentLoaded', function() {
    verifyAuthentication()
        .then(userData => {
            displayUserInfo(userData);
            highlightActiveTab();
            loadProfileData();
            loadFavorites();
            setupEventListeners();
        })
        .catch(error => {
            console.error('Authentication failed:', error);
            redirectToLogin();
        });
});

async function loadProfileData() {
    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch('http://10.2.43.224:8000/clients/me', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) throw new Error('Failed to load profile data');

        const profile = await response.json();
        displayProfileData(profile);
    } catch (error) {
        console.error('Error loading profile:', error);
        showToast('Failed to load profile data', 'error');
    }
}

function displayProfileData(profile) {
    document.getElementById('firstName').value = profile.name || '';
    document.getElementById('lastName').value = profile.surname || '';
    document.getElementById('email').value = profile.email || '';
    document.getElementById('phone').value = profile.phone_number || '';
    document.getElementById('location').value = profile.location_name || '';
    
    if (profile.profile_picture_url) {
        document.getElementById('profilePicture').src = profile.profile_picture_url;
    }
}

async function loadFavorites() {
    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch('http://10.2.43.224:8000/clients/dashboard', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) throw new Error('Failed to load favorites');

        const data = await response.json();
        displayFavorites(data.favorite_technicians || []);
    } catch (error) {
        console.error('Error loading favorites:', error);
        showToast('Failed to load favorite technicians', 'error');
    }
}

function displayFavorites(favorites) {
    const container = document.getElementById('favoritesList');
    container.innerHTML = '';

    if (favorites.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-heart-broken"></i>
                <p>You haven't added any favorite technicians yet</p>
            </div>
        `;
        return;
    }

    favorites.forEach(tech => {
        const techCard = document.createElement('div');
        techCard.className = 'favorite-tech-card';
        techCard.innerHTML = `
            <div class="tech-info">
                <img src="${tech.profile_picture_url || '/assets/profile-placeholder.png'}" 
                     alt="${tech.name}" class="tech-avatar"
                     onerror="this.src='/assets/profile-placeholder.png'">
                <div>
                    <h4>${tech.name} ${tech.surname}</h4>
                    <div class="tech-rating">
                        ${generateStarRating(tech.rating)}
                        <span>${tech.rating?.toFixed(1) || '0.0'}</span>
                    </div>
                </div>
            </div>
            <button class="btn btn-danger" onclick="removeFavorite('${tech.technician_id}')">
                <i class="fas fa-times"></i> Remove
            </button>
        `;
        container.appendChild(techCard);
    });
}

function setupEventListeners() {
    document.getElementById('profileForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const formData = {
            name: document.getElementById('firstName').value.trim(),
            surname: document.getElementById('lastName').value.trim(),
            phone_number: document.getElementById('phone').value.trim(),
            location_name: document.getElementById('location').value.trim()
        };

        try {
            const token = localStorage.getItem('access_token');
            const response = await fetch('http://10.2.43.224:8000/clients/me', {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to update profile');
            }

            const updatedProfile = await response.json();
            displayProfileData(updatedProfile);
            showToast('Profile updated successfully', 'success');
        } catch (error) {
            console.error('Error updating profile:', error);
            showToast(error.message || 'Failed to update profile', 'error');
        }
    });

    document.getElementById('passwordForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (newPassword !== confirmPassword) {
            showToast('New passwords do not match', 'error');
            return;
        }

        try {
            const token = localStorage.getItem('access_token');
            const response = await fetch('http://10.2.43.224:8000/auth/change-password', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    current_password: currentPassword,
                    new_password: newPassword,
                    confirm_password: confirmPassword
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to change password');
            }

            document.getElementById('passwordForm').reset();
            showToast('Password changed successfully', 'success');
        } catch (error) {
            console.error('Error changing password:', error);
            showToast(error.message || 'Failed to change password', 'error');
        }
    });

    document.getElementById('profilePictureUpload').addEventListener('change', async function(e) {
        if (e.target.files.length === 0) return;
        
        const file = e.target.files[0];
        if (!file.type.match('image.*')) {
            showToast('Please select an image file', 'error');
            return;
        }

        try {
            const token = localStorage.getItem('access_token');
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch('http://10.2.43.224:8000/clients/me/upload-picture', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to upload picture');
            }

            const result = await response.json();
            document.getElementById('profilePicture').src = result.url;
            showToast('Profile picture updated successfully', 'success');
        } catch (error) {
            console.error('Error uploading profile picture:', error);
            showToast(error.message || 'Failed to upload picture', 'error');
        }
    });
}

window.removeFavorite = async function(technicianId) {
    if (!confirm('Are you sure you want to remove this technician from your favorites?')) {
        return;
    }

    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch(`http://10.2.43.224:8000/clients/favorites/${technicianId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to remove favorite');
        }

        showToast('Technician removed from favorites', 'success');
        loadFavorites();
    } catch (error) {
        console.error('Error removing favorite:', error);
        showToast('Failed to remove favorite', 'error');
    }
};

function showDeleteConfirmation() {
    document.getElementById('deleteModal').style.display = 'flex';
}

function closeDeleteModal() {
    document.getElementById('deleteModal').style.display = 'none';
}

async function deleteAccount() {
    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch('http://10.2.43.224:8000/clients/me', {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to delete account');
        }

        showToast('Account deleted successfully', 'success');
        localStorage.removeItem('access_token');
        localStorage.removeItem('user_type');
        setTimeout(() => {
            window.location.href = '/';
        }, 1500);
    } catch (error) {
        console.error('Error deleting account:', error);
        showToast(error.message || 'Failed to delete account', 'error');
    }
}

function generateStarRating(rating) {
    const numericRating = Number(rating) || 0;
    const fullStars = Math.floor(numericRating);
    const hasHalfStar = numericRating % 1 >= 0.5;
    let stars = '';

    for (let i = 0; i < 5; i++) {
        if (i < fullStars) {
            stars += '<i class="fas fa-star"></i>';
        } else if (i === fullStars && hasHalfStar) {
            stars += '<i class="fas fa-star-half-alt"></i>';
        } else {
            stars += '<i class="far fa-star"></i>';
        }
    }

    return stars;
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;
    toast.innerHTML = `
        <div class="toast-message">${message}</div>
        <button class="toast-close">&times;</button>
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 300);
    }, 5000);

    toast.querySelector('.toast-close').onclick = () => toast.remove();
}