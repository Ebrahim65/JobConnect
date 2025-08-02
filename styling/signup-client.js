document.addEventListener('DOMContentLoaded', function() {
    const signupForm = document.getElementById('signupForm');
    const togglePassword = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');
    const submitBtn = document.getElementById('submitBtn');
    const locationInput = document.getElementById('location');
    const locationSuggestions = document.getElementById('locationSuggestions');
    const latitudeInput = document.getElementById('latitude');
    const longitudeInput = document.getElementById('longitude');
    
    // Toggle password visibility
    if (togglePassword) {
        togglePassword.addEventListener('click', function() {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            this.classList.toggle('fa-eye-slash');
        });
    }
    
    // Location autocomplete functionality using Nominatim (OpenStreetMap)
    if (locationInput) {
        let debounceTimer;
        let activeSuggestionIndex = -1;
        let currentRequest = null;
        
        locationInput.addEventListener('input', function(e) {
            clearTimeout(debounceTimer);
            
            // Abort any pending request
            if (currentRequest) {
                currentRequest.abort();
            }
            
            const query = e.target.value.trim();
            
            if (query.length < 3) {
                locationSuggestions.style.display = 'none';
                return;
            }
            
            debounceTimer = setTimeout(() => {
                fetchLocationSuggestions(query);
            }, 500); // Increased debounce time for Nominatim's rate limits
        });
        
        locationInput.addEventListener('keydown', function(e) {
            const items = locationSuggestions.querySelectorAll('.location-suggestion-item');
            
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                activeSuggestionIndex = Math.min(activeSuggestionIndex + 1, items.length - 1);
                updateActiveSuggestion(items);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                activeSuggestionIndex = Math.max(activeSuggestionIndex - 1, -1);
                updateActiveSuggestion(items);
            } else if (e.key === 'Enter' && activeSuggestionIndex >= 0) {
                e.preventDefault();
                items[activeSuggestionIndex].click();
            }
        });
        
        locationInput.addEventListener('focus', function() {
            if (locationInput.value.trim().length >= 3 && locationSuggestions.innerHTML) {
                locationSuggestions.style.display = 'block';
            }
        });
        
        document.addEventListener('click', function(e) {
            if (!locationInput.contains(e.target) && !locationSuggestions.contains(e.target)) {
                locationSuggestions.style.display = 'none';
            }
        });
    }
    
    function fetchLocationSuggestions(query) {
        locationSuggestions.innerHTML = '<div class="location-loading">Searching locations...</div>';
        locationSuggestions.style.display = 'block';
        activeSuggestionIndex = -1;
        
        // Using Nominatim (OpenStreetMap) API
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=5`;
        
        // Create new AbortController for this request
        const controller = new AbortController();
        currentRequest = controller;
        
        fetch(url, {
            signal: controller.signal,
            headers: {
                'Accept-Language': 'en-US,en;q=0.9' // Request English results
            }
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                currentRequest = null;
                if (data && data.length > 0) {
                    renderLocationSuggestions(data);
                } else {
                    locationSuggestions.innerHTML = '<div class="location-loading">No locations found</div>';
                }
            })
            .catch(error => {
                if (error.name !== 'AbortError') {
                    console.error('Error fetching location suggestions:', error);
                    locationSuggestions.innerHTML = '<div class="location-loading">Error loading suggestions</div>';
                }
            });
    }
    
    function renderLocationSuggestions(results) {
        locationSuggestions.innerHTML = '';
        
        results.forEach((result, index) => {
            const item = document.createElement('div');
            item.className = 'location-suggestion-item';
            
            // Format the display address
            const address = result.address;
            let displayText = '';
            
            if (address.road) displayText += address.road + ', ';
            if (address.neighbourhood) displayText += address.neighbourhood + ', ';
            if (address.city) displayText += address.city + ', ';
            if (address.state) displayText += address.state + ', ';
            if (address.country) displayText += address.country;
            
            // Fallback to display_name if address components are missing
            if (!displayText.trim()) {
                displayText = result.display_name.split(',').slice(0, 3).join(', ');
            }
            
            item.textContent = displayText;
            item.dataset.lat = result.lat;
            item.dataset.lon = result.lon;
            item.dataset.address = displayText;
            
            item.addEventListener('click', function() {
                locationInput.value = this.dataset.address;
                latitudeInput.value = this.dataset.lat;
                longitudeInput.value = this.dataset.lon;
                locationSuggestions.style.display = 'none';
            });
            
            item.addEventListener('mouseover', function() {
                activeSuggestionIndex = index;
                updateActiveSuggestion(locationSuggestions.querySelectorAll('.location-suggestion-item'));
            });
            
            locationSuggestions.appendChild(item);
        });
    }
    
    function updateActiveSuggestion(items) {
        items.forEach((item, index) => {
            item.classList.toggle('active', index === activeSuggestionIndex);
            
            if (index === activeSuggestionIndex) {
                item.scrollIntoView({ block: 'nearest' });
            }
        });
    }
    
    // Form submission
    if (signupForm) {
        signupForm.addEventListener('submit', async function(e) {
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
                showToast('Please select a valid location from the suggestions', 'error');
                return;
            }
            
            // Get form data
            const formData = {
                name: document.getElementById('firstName').value.trim(),
                surname: document.getElementById('lastName').value.trim(),
                email: document.getElementById('email').value.trim(),
                phone_number: document.getElementById('phone').value.trim(),
                location_name: document.getElementById('location').value.trim(),
                latitude: parseFloat(latitudeInput.value),
                longitude: parseFloat(longitudeInput.value),
                password: password
            };

            // Show loading state
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating Account...';

            try {
                const response = await fetch('http://10.2.43.224:8000/auth/register/client', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(formData)
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.detail || 'Registration failed');
                }

                showToast('Account created successfully! Login to continue...', 'success');
                
                // Redirect to login after 2 seconds
                setTimeout(() => {
                    window.location.href = '/index.html';
                }, 2000);
                
            } catch (error) {
                console.error('Registration error:', error);
                showToast(error.message || 'Registration failed. Please try again.', 'error');
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