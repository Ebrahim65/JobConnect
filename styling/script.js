document.addEventListener('DOMContentLoaded', function () {
    // Configuration
    const API_BASE_URL = 'http://10.2.43.224:8000'; // Update with your backend URL

    // Get all elements
    const modal = document.getElementById('signupModal');
    const headerSignupBtn = document.getElementById('headerSignup');
    const heroSignupBtn = document.getElementById('heroSignup');
    const headSignupTBtn = document.getElementById('headSignupT');
    const headSignupCBtn = document.getElementById('headSignupC');
    const closeModals = document.querySelectorAll('.close-modal');
    const clientCard = document.getElementById('clientCard');
    const technicianCard = document.getElementById('technicianCard');
    const loginModal = document.getElementById('loginModal');
    const loginButtons = document.querySelectorAll('.btn-login');
    const loginForm = document.getElementById('loginForm');
    const togglePassword = document.getElementById('togglePassword');
    const loginPassword = document.getElementById('loginPassword');
    const loginError = document.getElementById('loginError');
    const signupLink = document.querySelector('.signup-link');
    const loginLink = document.querySelector('.login-link');
    const loginSubmitBtn = document.querySelector('.btn-login-submit');
    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    

    // Create mobile menu
    const mobileMenu = document.createElement('div');
    mobileMenu.className = 'mobile-menu';
    mobileMenu.innerHTML = `
        <ul class="nav-list">
            <li><a href="#">Find Work</a></li>
            <li><a href="#">Find Technicians</a></li>
            <li><a href="#">Why JobConnect</a></li>
            <li><a href="#">Resources</a></li>
        </ul>
        <ul class="auth-buttons">
            <li><a href="#" class="btn-login">Log In</a></li>
            <li><a href="#" class="btn-signup">Sign Up</a></li>
        </ul>
    `;
    document.body.appendChild(mobileMenu);

    // Toggle mobile menu
    mobileMenuBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        mobileMenu.classList.toggle('active');
    });


    // Close mobile menu when clicking outside
    document.addEventListener('click', function (e) {
        if (!mobileMenu.contains(e.target) && e.target !== mobileMenuBtn) {
            mobileMenu.classList.remove('active');
        }
    });

    // Modal functions
    function openModal() {
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }

    function closeAllModals() {
        modal.style.display = 'none';
        loginModal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }

    // Event listeners for opening modal
    if (headerSignupBtn) {
        headerSignupBtn.addEventListener('click', function (e) {
            e.preventDefault();
            openModal();
        });
    }

    if (heroSignupBtn) {
        heroSignupBtn.addEventListener('click', function (e) {
            e.preventDefault();
            openModal();
        });
    }

    if (headSignupTBtn) {
        headSignupTBtn.addEventListener('click', function (e) {
            e.preventDefault();
            openModal();
        });
    }

    if (headSignupCBtn) {
        headSignupCBtn.addEventListener('click', function (e) {
            e.preventDefault();
            openModal();
        });
    }

    // Switch to login modal
    if (loginLink) {
        loginLink.addEventListener('click', function (e) {
            e.preventDefault();
            closeAllModals();
            openLoginModal();
        });
    }

    // Event listeners for closing modal (fixed to work with all modals)
    closeModals.forEach(closeBtn => {
        closeBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            closeAllModals();
        });
    });

    // Close modal when clicking outside
    window.addEventListener('click', function (e) {
        if (e.target === modal || e.target === loginModal) {
            closeAllModals();
        }
    });

    // User type selection
    if (clientCard) {
        clientCard.addEventListener('click', function () {
            window.location.href = '/signup-client.html';
        });
    }

    if (technicianCard) {
        technicianCard.addEventListener('click', function () {
            window.location.href = '/signup-technician.html';
        });
    }

    // Toggle password visibility
    if (togglePassword) {
        togglePassword.addEventListener('click', function () {
            const type = loginPassword.getAttribute('type') === 'password' ? 'text' : 'password';
            loginPassword.setAttribute('type', type);
            this.classList.toggle('fa-eye-slash');
        });
    }

    // Open login modal
    function openLoginModal() {
        loginModal.style.display = 'block';
        document.body.style.overflow = 'hidden';
        loginError.textContent = '';
    }

    // Login button event listeners
    loginButtons.forEach(btn => {
        btn.addEventListener('click', function (e) {
            e.preventDefault();
            closeAllModals();
            openLoginModal();
        });
    });

    // Switch to signup modal
    if (signupLink) {
        signupLink.addEventListener('click', function (e) {
            e.preventDefault();
            closeAllModals();
            openModal();
        });
    }

    // Login form submission
    if (loginForm) {
        loginForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            const email = loginForm.email.value.trim();
            const password = loginForm.password.value;
            const rememberMe = loginForm.rememberMe.checked;

            // Show loading state
            loginSubmitBtn.disabled = true;
            loginSubmitBtn.classList.add('loading');
            loginError.textContent = '';

            try {
                const response = await fetch(`${API_BASE_URL}/auth/token`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Accept': 'application/json'
                    },
                    body: new URLSearchParams({
                        username: email,
                        password: password,
                        grant_type: 'password'
                    }),
                    credentials: 'include'
                });

                if (!response) {
                    throw new Error('No response from server');
                }

                const contentType = response.headers.get('content-type');
                if (!contentType || !contentType.includes('application/json')) {
                    const text = await response.text();
                    console.error("Non-JSON response:", text);
                    throw new Error('Server returned unexpected response');
                }

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.detail || 'Login failed. Please try again.');
                }

                // Store the token and user type
                localStorage.setItem('access_token', data.access_token);
                localStorage.setItem('user_type', data.user_type);

                // If "Remember me" is checked, store the email
                if (rememberMe) {
                    localStorage.setItem('remember_me', 'true');
                    localStorage.setItem('remembered_email', email);
                } else {
                    localStorage.removeItem('remember_me');
                    localStorage.removeItem('remembered_email');
                }

                // Verify user status before redirecting
                await verifyAndRedirect(data.user_type, data.access_token);

            } catch (error) {
                console.error('Login error:', error);
                loginError.textContent = error.message || 'Login failed. Please try again.';
                loginForm.password.value = '';
            } finally {
                loginSubmitBtn.disabled = false;
                loginSubmitBtn.classList.remove('loading');
            }
        });
    }

    // Verify user status and redirect
    async function verifyAndRedirect(userType, token) {
        try {
            const verifyResponse = await fetch(`${API_BASE_URL}/${userType}s/me`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                credentials: 'include'
            });

            if (!verifyResponse.ok) {
                throw new Error('Failed to verify user status');
            }

            const userData = await verifyResponse.json();
            loginError.textContent = '';
            closeAllModals();

            switch (userType) {
                case 'client':
                    window.location.href = '/client/dashboard.html';
                    break;
                case 'technician':
                    window.location.href = '/technician/dashboard.html';
                    break;
                case 'admin':
                    window.location.href = '/admin/dashboard.html';
                    break;
                default:
                    window.location.href = '/index.html';
            }
        } catch (error) {
            console.error('Verification error:', error);
            throw new Error('Failed to verify your account status');
        }
    }

    // Check for "remember me" on page load
    if (localStorage.getItem('remember_me') === 'true') {
        const emailInput = document.getElementById('loginEmail');
        if (emailInput) {
            emailInput.value = localStorage.getItem('remembered_email') || '';
        }
        const rememberCheckbox = document.getElementById('rememberMe');
        if (rememberCheckbox) {
            rememberCheckbox.checked = true;
        }
    }

    // Load and display stats data
    async function loadStatsData() {
        try {
            // Fetch top rated technicians
            const [topRated, mostLiked] = await Promise.all([
                fetch(`${API_BASE_URL}/public/top-rated`).then(res => res.json()),
                fetch(`${API_BASE_URL}/public/most-liked`).then(res => res.json())
            ]);

            displayTechnicians(topRated, 'topRatedTechnicians');
            displayTechnicians(mostLiked, 'mostLikedTechnicians');
        } catch (error) {
            console.error('Error loading stats:', error);
            document.querySelectorAll('.technicians-list').forEach(el => {
                el.innerHTML = '<p class="error-message">Failed to load data. Please try again later.</p>';
            });
        }
    }

    // Display technicians in the UI
    function displayTechnicians(technicians, elementId) {
        const container = document.getElementById(elementId);
        if (!container) return;

        container.innerHTML = '';

        if (technicians.length === 0) {
            container.innerHTML = '<p>No technicians found</p>';
            return;
        }

        technicians.forEach(tech => {
            const initials = `${tech.name?.charAt(0) || ''}${tech.surname?.charAt(0) || ''}`;
            const ratingStars = elementId === 'topRatedTechnicians'
                ? `<div class="technician-rating">
                      <div class="stars">
                        ${'<i class="fas fa-star"></i>'.repeat(Math.floor(tech.avg_rating || 0))}
                        ${tech.avg_rating % 1 ? '<i class="fas fa-star-half-alt"></i>' : ''}
                      </div>
                      <span>${tech.avg_rating ? tech.avg_rating.toFixed(1) : 'N/A'}</span>
                   </div>`
                : `<div class="technician-rating">
                      <i class="fas fa-heart" style="color: #ff6b6b;"></i>
                      <span>${tech.favorites_count || 0} likes</span>
                   </div>`;

            const review = tech.top_review ? `<p class="technician-review">"${tech.top_review}"</p>` : '';

            const techElement = document.createElement('div');
            techElement.className = 'technician-item';
            techElement.innerHTML = `
                <div class="technician-avatar">${initials}</div>
                <div class="technician-info">
                    <div class="technician-name">${tech.name || ''} ${tech.surname || ''}</div>
                    ${ratingStars}
                    ${review}
                </div>
            `;
            container.appendChild(techElement);
        });
    }

    // Load stats when page loads
    loadStatsData();
});