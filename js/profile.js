document.addEventListener('DOMContentLoaded', () => {
    const API_BASE_URL = 'https://3tdkq5ig1m.execute-api.us-east-1.amazonaws.com/profile';
    const S3_BUCKET_URL = 's3://cadv-part3-2402279j/profile-pictures/';

    // DOM Elements
    const loadingContainer = document.getElementById('loadingContainer');
    const profileForm = document.getElementById('profileForm');
    const profileImage = document.getElementById('profileImage');
    const profilePlaceholder = document.getElementById('profilePlaceholder');
    const profilePictureInput = document.getElementById('profilePictureInput');
    const uploadBtn = document.getElementById('uploadBtn');
    const removeBtn = document.getElementById('removeBtn');
    const profileDataForm = document.getElementById('profileDataForm');
    const usernameInput = document.getElementById('username');
    const fullNameInput = document.getElementById('fullName');
    const userBioInput = document.getElementById('userBio');
    const cancelBtn = document.getElementById('cancelBtn');
    const saveBtn = document.getElementById('saveBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const messageContainer = document.getElementById('messageContainer');

    // State
    let currentUser = null;
    let selectedImageFile = null;
    let originalFormData = {};

    // Initialize
    init();

    async function init() {
        console.log('=== Profile Page Initialization ===');

        // Check authentication using Cognito
        const userId = getCurrentUserId();
        console.log('Current user ID:', userId);

        if (!userId) {
            console.log('No user ID found, redirecting to login');
            window.location.href = 'login.html';
            return;
        }

        // Load user profile from Cognito data
        loadUserProfileFromCognito();
        setupEventListeners();
    }

    function getCurrentUserId() {
        console.log('=== getCurrentUserId() called ===');

        // Extract Cognito user ID from authentication data
        const userAuthData = sessionStorage.getItem('userAuth');
        if (userAuthData) {
            try {
                const authData = JSON.parse(userAuthData);
                console.log('Found userAuth data');

                if (authData.AuthenticationResult) {
                    const authResult = authData.AuthenticationResult;

                    // Try to get user ID from AccessToken (JWT)
                    if (authResult.AccessToken) {
                        try {
                            const tokenParts = authResult.AccessToken.split('.');
                            if (tokenParts.length === 3) {
                                const payload = JSON.parse(atob(tokenParts[1]));
                                console.log('Decoded AccessToken payload:', payload);

                                // Cognito stores user ID in 'username' or 'sub' field
                                const cognitoUserId = payload.username || payload.sub || payload['cognito:username'];
                                if (cognitoUserId) {
                                    console.log('Found Cognito userId from AccessToken:', cognitoUserId);
                                    return cognitoUserId;
                                }
                            }
                        } catch (jwtError) {
                            console.error('Error decoding AccessToken:', jwtError);
                        }
                    }

                    // Fallback to IdToken
                    if (authResult.IdToken) {
                        try {
                            const tokenParts = authResult.IdToken.split('.');
                            if (tokenParts.length === 3) {
                                const payload = JSON.parse(atob(tokenParts[1]));
                                console.log('Decoded IdToken payload:', payload);

                                const cognitoUserId = payload['cognito:username'] || payload.username || payload.sub;
                                if (cognitoUserId) {
                                    console.log('Found Cognito userId from IdToken:', cognitoUserId);
                                    return cognitoUserId;
                                }
                            }
                        } catch (jwtError) {
                            console.error('Error decoding IdToken:', jwtError);
                        }
                    }
                }
            } catch (error) {
                console.error('Error parsing userAuth data:', error);
            }
        } else {
            console.log('No userAuth data found in sessionStorage');
        }

        console.log('No valid Cognito userId found');
        return null;
    }

    async function loadUserProfileFromCognito() {
        console.log('=== Loading user profile from Cognito ===');

        try {
            showLoading(true);

            // Get user profile from sessionStorage (set by homepage.js)
            let userProfile = null;
            const userProfileData = sessionStorage.getItem('userProfile');

            if (userProfileData) {
                try {
                    userProfile = JSON.parse(userProfileData);
                    console.log('Found userProfile in sessionStorage:', userProfile);
                } catch (error) {
                    console.error('Error parsing userProfile from sessionStorage:', error);
                }
            }

            // Fallback: extract profile from auth token
            if (!userProfile) {
                console.log('No userProfile in sessionStorage, extracting from token');
                userProfile = getUserProfileFromToken();
            }

            if (userProfile) {
                console.log('Using profile data:', userProfile);

                // Try to load existing profile data from database
                try {
                    const existingProfileData = await loadExistingProfileData(userProfile.userId);
                    if (existingProfileData) {
                        // Merge Cognito data with database data
                        userProfile = {
                            ...userProfile,
                            ...existingProfileData,
                            // Keep Cognito data for these fields
                            email: userProfile.email,
                            emailVerified: userProfile.emailVerified,
                            userId: userProfile.userId
                        };
                        console.log('Merged profile data with database:', userProfile);
                    }
                } catch (dbError) {
                    console.log('No existing profile data in database (this is normal for new users):', dbError.message);
                }

                currentUser = userProfile;
                displayUserProfile(userProfile);
                populateForm(userProfile);
            } else {
                console.error('No profile data available');
                showMessage('No profile data available', 'error');
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 2000);
            }

        } catch (error) {
            console.error('Error loading user profile:', error);
            showMessage('Failed to load profile. Please try again.', 'error');
        } finally {
            showLoading(false);
        }
    }

    // Convert file to base64 string
    function fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                // Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
                const base64String = reader.result.split(',')[1];
                resolve(base64String);
            };
            reader.onerror = (error) => {
                console.error('Error reading file:', error);
                reject(error);
            };
            reader.readAsDataURL(file);
        });
    }

    // Load profile picture from URL
    function loadProfilePicture(imageUrl) {
        if (imageUrl) {
            profileImage.src = imageUrl;
            profileImage.style.display = 'block';
            profilePlaceholder.style.display = 'none';
            removeBtn.style.display = 'inline-flex';
        } else {
            profileImage.style.display = 'none';
            profilePlaceholder.style.display = 'flex';
            removeBtn.style.display = 'none';
        }
    }

    // Get user profile from Cognito JWT token
    function getUserProfileFromToken() {
        const userAuthData = sessionStorage.getItem('userAuth');
        if (userAuthData) {
            try {
                const authData = JSON.parse(userAuthData);
                if (authData.AuthenticationResult.IdToken) {
                    const tokenParts = authData.AuthenticationResult.IdToken.split('.');
                    if (tokenParts.length === 3) {
                        const payload = JSON.parse(atob(tokenParts[1]));
                        console.log('Extracted profile from token:', payload);

                        let fullName = '';
                        if (payload.name) {
                            fullName = payload.name;
                        } else if (payload.given_name || payload.family_name) {
                            const firstName = payload.given_name || '';
                            const lastName = payload.family_name || '';
                            fullName = `${firstName} ${lastName}`.trim();
                        }

                        // If still empty or contains 'undefined', use email as fallback
                        if (!fullName || fullName.includes('undefined')) {
                            fullName = payload.email?.split('@')[0] || 'User';
                        }

                        return {
                            userId: payload['cognito:username'] || payload.username || payload.sub,
                            email: payload.email,
                            emailVerified: payload.email_verified || false,
                            fullName: fullName,
                            firstName: payload.given_name || '',
                            lastName: payload.family_name || '',
                            phone: payload.phone_number || '',
                            phoneVerified: payload.phone_number_verified || false,
                            username: payload['cognito:username'] || payload.username || payload.email?.split('@')[0] || 'user'
                        };
                    }
                }
            } catch (error) {
                console.error('Error extracting profile from token:', error);
            }
        }
        return null;
    }

    // Display user profile information
    function displayUserProfile(profile) {
        console.log('=== Displaying user profile ===', profile);

        // Update profile page elements if they exist
        const userEmailEl = document.getElementById('userEmail');
        const userFullNameEl = document.getElementById('userFullName');
        const userFirstNameEl = document.getElementById('userFirstName');
        const userLastNameEl = document.getElementById('userLastName');
        const userPhoneEl = document.getElementById('userPhone');
        const emailStatusEl = document.getElementById('emailVerificationStatus');

        if (userEmailEl) userEmailEl.textContent = profile.email || 'Not provided';
        if (userFullNameEl) userFullNameEl.textContent = profile.fullName || 'Not provided';
        if (userFirstNameEl) userFirstNameEl.value = profile.firstName || '';
        if (userLastNameEl) userLastNameEl.value = profile.lastName || '';
        if (userPhoneEl) userPhoneEl.value = profile.phone || '';

        // Show verification status
        if (emailStatusEl) {
            emailStatusEl.textContent = profile.emailVerified ? 'âœ“ Verified' : 'âš  Not Verified';
            emailStatusEl.className = profile.emailVerified ? 'verified' : 'not-verified';
        }
    }

    // Populate form with user data
    function populateForm(userData) {
        console.log('=== Populating form ===', userData);

        if (usernameInput) usernameInput.value = userData.username || userData.email?.split('@')[0] || '';
        if (fullNameInput) fullNameInput.value = userData.fullName || '';
        if (userBioInput) userBioInput.value = userData.bio || '';

        // Load existing profile picture if available
        if (userData.profilePicture) {
            loadProfilePicture(userData.profilePicture);
        }

        // Store original data for comparison
        originalFormData = {
            username: userData.username || userData.email?.split('@')[0] || '',
            fullName: userData.fullName || '',
            bio: userData.bio || '',
            profilePicture: userData.profilePicture || ''
        };
    }

    // Get authentication token from Cognito
    function getAuthToken() {
        const userAuthData = sessionStorage.getItem('userAuth');
        if (userAuthData) {
            try {
                const authData = JSON.parse(userAuthData);
                return authData.AuthenticationResult?.AccessToken;
            } catch (error) {
                console.error('Error getting auth token:', error);
            }
        }
        return null;
    }

    // Setup event listeners
    function setupEventListeners() {
        // Profile picture upload
        if (uploadBtn) {
            uploadBtn.addEventListener('click', () => {
                profilePictureInput.click();
            });
        }

        if (profilePictureInput) {
            profilePictureInput.addEventListener('change', handleImageSelection);
        }

        if (removeBtn) {
            removeBtn.addEventListener('click', removeProfilePicture);
        }

        // Form submission
        if (profileDataForm) {
            profileDataForm.addEventListener('submit', handleFormSubmit);
        }

        if (cancelBtn) {
            cancelBtn.addEventListener('click', handleCancel);
        }

        // Logout
        if (logoutBtn) {
            logoutBtn.addEventListener('click', handleLogout);
        }
    }

    // Handle logout - updated for Cognito
    function handleLogout() {
        if (confirm('Are you sure you want to logout?')) {
            // Clear Cognito authentication data
            sessionStorage.removeItem('userAuth');
            sessionStorage.removeItem('userProfile');
            sessionStorage.removeItem('userSession');
            localStorage.removeItem('rememberUser');
            localStorage.removeItem('currentUser');

            console.log('User logged out, redirecting to login');
            window.location.href = 'login.html';
        }
    }

    // Handle image selection
    function handleImageSelection(event) {
        const file = event.target.files[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            showMessage('Please select a valid image file.', 'error');
            return;
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            showMessage('Image size must be less than 5MB.', 'error');
            return;
        }

        selectedImageFile = file;

        // Preview image
        const reader = new FileReader();
        reader.onload = (e) => {
            profileImage.src = e.target.result;
            profileImage.style.display = 'block';
            profilePlaceholder.style.display = 'none';
            removeBtn.style.display = 'inline-flex';
        };
        reader.readAsDataURL(file);

        showMessage('Image selected. Click "Save Changes" to upload.', 'success');
    }

    // Remove profile picture
    function removeProfilePicture() {
        profileImage.style.display = 'none';
        profilePlaceholder.style.display = 'flex';
        removeBtn.style.display = 'none';
        selectedImageFile = null;
        profilePictureInput.value = '';

        showMessage('Profile picture removed. Click "Save Changes" to confirm.', 'success');
    }

    // Handle form submission
    async function handleFormSubmit(event) {
        event.preventDefault();
        console.log('=== Form submitted ===');

        try {
            saveBtn.disabled = true;
            saveBtn.innerHTML = `
                <div class="loading-spinner" style="width: 16px; height: 16px; margin-right: 0.5rem;"></div>
                Saving...
            `;

            const userId = getCurrentUserId();
            console.log('Saving profile for user:', userId);

            let profilePictureUrl = originalFormData.profilePicture;

            // Upload image to S3 if new image selected
            if (selectedImageFile) {
                console.log('Uploading new profile picture...');
                profilePictureUrl = await uploadImageToS3(selectedImageFile, userId);
                console.log('Profile picture uploaded:', profilePictureUrl);
            } else if (profileImage.style.display === 'none') {
                // User removed the image
                profilePictureUrl = null;
                console.log('Profile picture removed');
            }

            // Prepare user data
            const userData = {
                userId: userId,
                username: usernameInput.value.trim(),
                fullName: fullNameInput.value.trim(),
                bio: userBioInput.value.trim(),
                profilePicture: profilePictureUrl
            };

            console.log('Saving user data:', userData);

            // Save to database
            await saveUserProfile(userData);

            // Update original data
            originalFormData = {
                username: userData.username,
                fullName: userData.fullName,
                bio: userData.bio,
                profilePicture: userData.profilePicture
            };

            selectedImageFile = null;
            console.log('Profile saved successfully, preparing redirect...');
            showMessage('Profile updated successfully! Redirecting to homepage...', 'success');

            // Redirect to homepage after successful save
            setTimeout(() => {
                console.log('Executing redirect to homepage.html after save');
                window.location.href = 'homepage.html';
            }, 2000);

        } catch (error) {
            console.error('Error saving profile:', error);
            showMessage(`Failed to save profile: ${error.message}`, 'error');
        } finally {
            saveBtn.disabled = false;
            saveBtn.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" stroke="currentColor" stroke-width="2"/>
                    <polyline points="17,21 17,13 7,13 7,21" stroke="currentColor" stroke-width="2"/>
                    <polyline points="7,3 7,8 15,8" stroke="currentColor" stroke-width="2"/>
                </svg>
                Save Changes
            `;
        }
    }

    async function uploadImageToS3(imageFile, userId) {
        try {
            // Convert image to base64
            const base64Image = await fileToBase64(imageFile);

            // Generate unique filename
            const timestamp = Date.now();
            const fileExtension = imageFile.name.split('.').pop().toLowerCase();
            const fileName = `profile_${userId}_${timestamp}.${fileExtension}`;

            const uploadUrl = `${API_BASE_URL}/upload-profile-picture`;
            console.log('Upload URL:', uploadUrl);

            // Upload to S3 via API Gateway
            const response = await fetch(uploadUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getAuthToken()}`
                },
                body: JSON.stringify({
                    userId: userId, // Include userId in body
                    fileName: fileName,
                    fileContent: base64Image,
                    contentType: imageFile.type
                })
            });

            console.log('Upload response status:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Upload error response:', errorText);
                throw new Error(`Upload failed! status: ${response.status} - ${errorText}`);
            }

            const result = await response.json();
            console.log('Upload result:', result);
            return result.imageUrl;

        } catch (error) {
            console.error('Error uploading image:', error);
            throw new Error('Failed to upload profile picture');
        }
    }

    async function saveUserProfile(userData) {
        try {
            // First attempt to save the profile
            const saveUrl = `${API_BASE_URL}/${userData.userId}`;
            console.log('Save URL:', saveUrl);

            let response = await fetch(saveUrl, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getAuthToken()}`
                },
                body: JSON.stringify(userData)
            });

            console.log('Save response status:', response.status);

            // If user not found (404), create the MySQL user record first
            if (response.status === 404) {
                console.log('User not found in database, creating MySQL user record...');

                try {
                    // Create MySQL user record
                    await createMySQLUserRecord({
                        userId: userData.userId,
                        email: currentUser?.email || 'unknown@example.com',
                        username: userData.username,
                        fullName: userData.fullName
                    });

                    console.log('MySQL user record created, retrying profile save...');

                    // Retry the profile save after creating user record
                    response = await fetch(saveUrl, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${getAuthToken()}`
                        },
                        body: JSON.stringify(userData)
                    });

                    console.log('Retry save response status:', response.status);

                } catch (createError) {
                    console.error('Failed to create MySQL user record:', createError);
                    throw new Error('Failed to create user profile in database');
                }
            }

            // Check if the save was successful
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Save error response:', errorText);
                throw new Error(`Save failed! status: ${response.status} - ${errorText}`);
            }

            const result = await response.json();
            console.log('Save result:', result);
            return result;

        } catch (error) {
            console.error('Error saving user profile:', error);
            throw new Error('Failed to save profile to database');
        }
    }

    // Create MySQL user record
    async function createMySQLUserRecord(userData) {
        try {
            console.log('Creating MySQL user record for:', userData.userId);

            const createUserUrl = `${API_BASE_URL}/create-user`;
            console.log('Create user URL:', createUserUrl);

            const response = await fetch(createUserUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getAuthToken()}`
                },
                body: JSON.stringify({
                    cognitoUserId: userData.userId,
                    email: userData.email,
                    username: userData.username,
                    fullName: userData.fullName || ''
                })
            });

            console.log('Create user response status:', response.status);

            if (response.status === 409) {
                // User already exists - this is fine
                const result = await response.json();
                console.log('User already exists in database:', result.existingUser);
                return result.existingUser;
            }

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Create user error response:', errorText);
                throw new Error(`Failed to create user: ${response.status} - ${errorText}`);
            }

            const result = await response.json();
            console.log('User created successfully:', result);
            return result;

        } catch (error) {
            console.error('Error creating MySQL user record:', error);
            throw error;
        }
    }

    async function handleFormSubmit(event) {
        event.preventDefault();
        console.log('=== Form submitted ===');

        try {
            saveBtn.disabled = true;
            saveBtn.innerHTML = `
                <div class="loading-spinner" style="width: 16px; height: 16px; margin-right: 0.5rem;"></div>
                Saving...
            `;

            const userId = getCurrentUserId();
            console.log('Saving profile for user:', userId);

            let profilePictureUrl = originalFormData.profilePicture;

            // Upload image to S3 if new image selected
            if (selectedImageFile) {
                console.log('Uploading new profile picture...');
                profilePictureUrl = await uploadImageToS3(selectedImageFile, userId);
                console.log('Profile picture uploaded:', profilePictureUrl);
            } else if (profileImage.style.display === 'none') {
                // User removed the image
                profilePictureUrl = null;
                console.log('Profile picture removed');
            }

            // Prepare user data
            const userData = {
                userId: userId,
                username: usernameInput.value.trim(),
                fullName: fullNameInput.value.trim(),
                bio: userBioInput.value.trim(),
                profilePicture: profilePictureUrl
            };

            console.log('Saving user data:', userData);

            // Save to database
            await saveUserProfile(userData);

            // Update original data
            originalFormData = {
                username: userData.username,
                fullName: userData.fullName,
                bio: userData.bio,
                profilePicture: userData.profilePicture
            };

            selectedImageFile = null;
            console.log('Profile saved successfully, preparing redirect...');
            showMessage('Profile updated successfully! Redirecting to homepage...', 'success');

            // Redirect to homepage after successful save
            setTimeout(() => {
                console.log('Executing redirect to homepage.html after save');
                window.location.href = 'homepage.html';
            }, 2000);

        } catch (error) {
            console.error('Error saving profile:', error);
            showMessage(`Failed to save profile: ${error.message}`, 'error');
        } finally {
            saveBtn.disabled = false;
            saveBtn.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" stroke="currentColor" stroke-width="2"/>
                    <polyline points="17,21 17,13 7,13 7,21" stroke="currentColor" stroke-width="2"/>
                    <polyline points="7,3 7,8 15,8" stroke="currentColor" stroke-width="2"/>
                </svg>
                Save Changes
            `;
        }
    }

    //Load existing profile data from database
    async function loadExistingProfileData(userId) {
        try {
            const response = await fetch(`${API_BASE_URL}/${userId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getAuthToken()}`
                }
            });

            if (response.ok) {
                const profileData = await response.json();
                console.log('Loaded existing profile data:', profileData);

                // Map database fields to our format
                const mappedData = {
                    username: profileData.username,
                    fullName: profileData.name,
                    bio: profileData.user_bio,
                    profilePicture: profileData.profile_image
                };

                // Debug the profile picture URL
                console.log('Profile picture URL from database:', mappedData.profilePicture);

                return mappedData;
            } else if (response.status === 404) {
                console.log('No existing profile data found (new user)');
                return null;
            } else {
                throw new Error(`Failed to load profile: ${response.status}`);
            }
        } catch (error) {
            console.error('Error loading existing profile data:', error);
            throw error;
        }
    }

    //Handle cancel with redirect to homepage
    function handleCancel() {
        console.log('=== Cancel button clicked ===');

        // Check if there are unsaved changes
        const hasChanges =
            usernameInput.value.trim() !== originalFormData.username ||
            fullNameInput.value.trim() !== originalFormData.fullName ||
            userBioInput.value.trim() !== originalFormData.bio ||
            selectedImageFile !== null;

        if (hasChanges) {
            const confirmCancel = confirm(
                'You have unsaved changes. Are you sure you want to cancel and return to the homepage?'
            );

            if (!confirmCancel) {
                console.log('User chose to stay on profile page');
                return; // User chose to stay
            }
        }

        // Reset form to original values
        populateForm(originalFormData);

        // Reset image
        if (originalFormData.profilePicture) {
            loadProfilePicture(originalFormData.profilePicture);
        } else {
            removeProfilePicture();
        }

        selectedImageFile = null;
        profilePictureInput.value = '';

        console.log('Redirecting to homepage...');
        showMessage('Changes cancelled. Redirecting to homepage...', 'success');

        // Redirect to homepage after a short delay
        setTimeout(() => {
            console.log('Executing redirect to homepage.html');
            window.location.href = 'homepage.html';
        }, 1500);
    }

    // Show loading state
    function showLoading(show) {
        if (loadingContainer && profileForm) {
            if (show) {
                loadingContainer.style.display = 'flex';
                profileForm.style.display = 'none';
            } else {
                loadingContainer.style.display = 'none';
                profileForm.style.display = 'block';
            }
        }
    }

    // Show message
    function showMessage(text, type = 'success') {
        if (!messageContainer) return;

        const message = document.createElement('div');
        message.className = `message ${type}`;

        const icon = type === 'success'
            ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                 <path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="2"/>
                 <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
               </svg>`
            : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                 <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                 <line x1="15" y1="9" x2="9" y2="15" stroke="currentColor" stroke-width="2"/>
                 <line x1="9" y1="9" x2="15" y2="15" stroke="currentColor" stroke-width="2"/>
               </svg>`;

        message.innerHTML = `${icon}<span>${text}</span>`;
        messageContainer.appendChild(message);

        // Show message
        setTimeout(() => message.classList.add('show'), 100);

        // Remove message after 5 seconds
        setTimeout(() => {
            message.classList.remove('show');
            setTimeout(() => {
                if (messageContainer.contains(message)) {
                    messageContainer.removeChild(message);
                }
            }, 300);
        }, 5000);
    }
});