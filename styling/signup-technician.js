document.addEventListener('DOMContentLoaded', function () {
    const signupForm = document.getElementById('signupForm');
    const togglePassword = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');
    const submitBtn = document.getElementById('submitBtn');
    const locationInput = document.getElementById('location');
    const latitudeInput = document.getElementById('latitude');
    const longitudeInput = document.getElementById('longitude');

    // Initialize map
    let map;
    let marker;

    function initMap() {
        // Default to a central location (can be adjusted)
        const defaultLocation = [0, 0];

        map = L.map('map').setView(defaultLocation, 2);

        // Add tile layer (OpenStreetMap)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);

        // Add geocoder control
        const geocoder = L.Control.geocoder({
            defaultMarkGeocode: false,
            position: 'topright'
        }).addTo(map);

        geocoder.on('markgeocode', function (e) {
            const { center, name } = e.geocode;
            locationInput.value = name;
            updateMapMarker(center.lat, center.lng);
        });

        // Add click event to map
        map.on('click', function (e) {
            updateMapMarker(e.latlng.lat, e.latlng.lng);

            // Reverse geocode to get address
            fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${e.latlng.lat}&lon=${e.latlng.lng}`)
                .then(response => response.json())
                .then(data => {
                    if (data.display_name) {
                        locationInput.value = data.display_name;
                    }
                })
                .catch(error => {
                    console.error('Geocoding error:', error);
                });
        });

        // Try to get user's current location
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                function (position) {
                    const { latitude, longitude } = position.coords;
                    updateMapMarker(latitude, longitude);
                    map.setView([latitude, longitude], 12);
                },
                function (error) {
                    console.error('Geolocation error:', error);
                }
            );
        }
    }

    function updateMapMarker(lat, lng) {
        // Remove existing marker if any
        if (marker) {
            map.removeLayer(marker);
        }

        // Add new marker
        marker = L.marker([lat, lng]).addTo(map);

        // Update hidden inputs
        latitudeInput.value = lat;
        longitudeInput.value = lng;
    }

    // Initialize the map
    initMap();

    // Toggle password visibility
    if (togglePassword) {
        togglePassword.addEventListener('click', function () {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            this.classList.toggle('fa-eye-slash');
        });
    }

    // Form submission
    if (signupForm) {
        signupForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            // Validate passwords match
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirmPassword').value;

            if (password !== confirmPassword) {
                showToast('Passwords do not match', 'error');
                return;
            }

            // Validate location is set
            if (!latitudeInput.value || !longitudeInput.value) {
                showToast('Please select your service location on the map', 'error');
                return;
            }

            // Get selected services
            const servicesSelect = document.getElementById('services');
            const selectedServices = Array.from(servicesSelect.selectedOptions)
                .map(option => option.value);

            // Prepare form data
            const formData = {
                name: document.getElementById('firstName').value.trim(),
                surname: document.getElementById('lastName').value.trim(),
                email: document.getElementById('email').value.trim(),
                phone_number: document.getElementById('phone').value.trim(),
                location_name: document.getElementById('location').value.trim(),
                latitude: parseFloat(latitudeInput.value),
                longitude: parseFloat(longitudeInput.value),
                service_types: selectedServices,
                password: password
            };

            // Add experience if provided
            const experience = document.getElementById('experience').value;
            if (experience) {
                formData.experience_years = parseFloat(experience);
            }

            // Show loading state
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating Account...';

            try {
                const response = await fetch('http://10.2.43.224:8000/auth/register/technician', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(formData)
                });

                const data = await response.json();

                if (!response.ok) {
                    // Handle validation errors
                    if (data.detail) {
                        let errorMsg = Array.isArray(data.detail)
                            ? data.detail.map(err => err.msg).join(', ')
                            : data.detail;
                        throw new Error(errorMsg);
                    }
                    throw new Error('Registration failed');
                }

                showToast('Account created successfully! Please wait. Redirecting to login...', 'success');

                // Redirect to login after 2 seconds
                setTimeout(() => {
                    window.location.href = '/index.html';
                }, 2000);

            } catch (error) {
                console.error('Registration error:', error);
                showToast(error.message || 'Registration failed. Please try again.', 'error');
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-user-plus"></i> Create Account';
            }
        });
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
});