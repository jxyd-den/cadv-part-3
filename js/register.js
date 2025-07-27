// AWS Cognito Registration Function
async function registerUser(email, password) {
    const CLIENT_ID = '2js4esbjki7d9hlj82ualimsni';
    const REGION = 'us-east-1';
    const url = `https://cognito-idp.us-east-1.amazonaws.com/`;

    const requestBody = {
        ClientId: CLIENT_ID,
        Username: email,
        Password: password,
        UserAttributes: [
            {
                Name: 'email',
                Value: email
            }
        ],
        MessageAction: 'SUPPRESS'
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-amz-json-1.1',
            'X-Amz-Target': 'AWSCognitoIdentityProviderService.SignUp',
        },
        body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
        let errorMessage = 'Registration failed';
        try {
            const errorData = await response.json();
            console.log('Full AWS Cognito error response:', errorData);
            console.log('Request body that was sent:', requestBody);

            // Handle specific AWS Cognito error messages
            if (errorData.__type) {
                switch (errorData.__type) {
                    case 'UsernameExistsException':
                        errorMessage = 'An account with this email already exists. Please try signing in.';
                        break;
                    case 'InvalidParameterException':
                        errorMessage = 'Invalid registration parameters. Please check your input.';
                        break;
                    case 'InvalidPasswordException':
                        errorMessage = 'Password does not meet requirements.';
                        break;
                    case 'UserLambdaValidationException':
                        errorMessage = 'Registration validation failed.';
                        break;
                    case 'TooManyRequestsException':
                        errorMessage = 'Too many requests. Please try again later.';
                        break;
                    case 'LimitExceededException':
                        errorMessage = 'Registration limit exceeded. Please try again later.';
                        break;
                    default:
                        errorMessage = errorData.message || errorData.__type || 'Registration failed';
                }
            } else {
                errorMessage = errorData.message || errorData.error || 'Registration failed';
            }
        } catch (parseError) {
            console.error('Error parsing response:', parseError);
            errorMessage = `Registration failed (Status: ${response.status})`;
        }
        throw new Error(errorMessage);
    }

    const data = await response.json();
    return data; // Contains UserSub and other registration details
}

// Password strength checker
function checkPasswordStrength(password) {
    let strength = 0;

    // Length check
    if (password.length >= 8) {
        strength += 20;
        document.getElementById('req-length').classList.add('met');
    } else {
        document.getElementById('req-length').classList.remove('met');
    }

    // Uppercase check
    if (/[A-Z]/.test(password)) {
        strength += 20;
        document.getElementById('req-uppercase').classList.add('met');
    } else {
        document.getElementById('req-uppercase').classList.remove('met');
    }

    // Lowercase check
    if (/[a-z]/.test(password)) {
        strength += 20;
        document.getElementById('req-lowercase').classList.add('met');
    } else {
        document.getElementById('req-lowercase').classList.remove('met');
    }

    // Number check
    if (/[0-9]/.test(password)) {
        strength += 20;
        document.getElementById('req-number').classList.add('met');
    } else {
        document.getElementById('req-number').classList.remove('met');
    }

    // Special character check
    if (/[^A-Za-z0-9]/.test(password)) {
        strength += 20;
        document.getElementById('req-special').classList.add('met');
    } else {
        document.getElementById('req-special').classList.remove('met');
    }

    return { strength };
}

// Update password strength indicator
function updatePasswordStrength(password) {
    const { strength } = checkPasswordStrength(password);
    const strengthIndicator = document.getElementById('strengthIndicator');
    const strengthText = document.getElementById('strengthText');

    strengthIndicator.style.width = strength + '%';

    if (strength === 0) {
        strengthIndicator.style.background = '#e2e8f0';
        strengthText.textContent = 'Enter a password';
        strengthText.style.color = '#64748b';
    } else if (strength <= 40) {
        strengthIndicator.style.background = '#ef4444';
        strengthText.textContent = 'Weak password';
        strengthText.style.color = '#ef4444';
    } else if (strength <= 80) {
        strengthIndicator.style.background = '#f59e0b';
        strengthText.textContent = 'Fair password';
        strengthText.style.color = '#f59e0b';
    } else {
        strengthIndicator.style.background = '#10b981';
        strengthText.textContent = 'Strong password';
        strengthText.style.color = '#10b981';
    }
}

// Toggle password visibility
function togglePassword(fieldId) {
    const field = document.getElementById(fieldId);
    const eyeIcon = document.getElementById(fieldId + '-eye');

    if (field.type === 'password') {
        field.type = 'text';
        eyeIcon.innerHTML = `
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        `;
    } else {
        field.type = 'password';
        eyeIcon.innerHTML = `
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        `;
    }
}

// UI Helper Functions
function showMessage(message, type = 'error') {
    const messageContainer = document.getElementById('messageContainer');
    const messageContent = document.getElementById('messageContent');

    messageContent.textContent = message;
    messageContainer.className = `message-container ${type}`;
    messageContainer.style.display = 'block';

    // Auto-hide after 5 seconds
    setTimeout(() => {
        messageContainer.style.display = 'none';
    }, 5000);
}

function toggleButtonLoading(isLoading) {
    const button = document.querySelector('.register-btn');
    const btnText = button.querySelector('.btn-text');
    const btnSpinner = button.querySelector('.btn-spinner');

    if (isLoading) {
        button.disabled = true;
        btnText.style.display = 'none';
        btnSpinner.style.display = 'inline';
        button.style.cursor = 'not-allowed';
    } else {
        button.disabled = false;
        btnText.style.display = 'inline';
        btnSpinner.style.display = 'none';
        button.style.cursor = 'pointer';
    }
}

// Validation functions
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function isValidPassword(password) {
    const { strength } = checkPasswordStrength(password);
    return strength === 100;
}

async function handleRegistration(userData) {
    try {
        // Step 1: Register with AWS Cognito
        const cognitoResult = await registerWithCognito(userData);
        console.log('Cognito registration successful:', cognitoResult);

        // Step 2: Create user in MySQL database
        const mysqlUser = await createMySQLUser(userData, cognitoResult);
        console.log('MySQL user created:', mysqlUser);

        // Step 3: Store the MySQL user ID for future use
        sessionStorage.setItem('userId', mysqlUser.userId);
        localStorage.setItem('currentUser', JSON.stringify({
            userId: mysqlUser.userId,
            cognitoId: cognitoResult.UserSub,
            email: userData.email,
            username: userData.username
        }));

        // Show success message and redirect
        showMessage('Registration successful! Please verify your email.', 'success');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 2000);

    } catch (error) {
        console.error('Registration error:', error);
        showMessage('Registration failed: ' + error.message, 'error');
    }
}

// Function to create user in MySQL database
async function createMySQLUser(userData, cognitoResult) {
    try {
        const response = await fetch('YOUR_API_ENDPOINT/users', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${cognitoResult.AccessToken}` // if needed
            },
            body: JSON.stringify({
                cognitoUserId: cognitoResult.UserSub,
                email: userData.email,
                username: userData.username,
                fullName: userData.fullName,
                // Add any other fields your MySQL table requires
            })
        });

        if (!response.ok) {
            throw new Error(`Failed to create MySQL user: ${response.status}`);
        }

        const mysqlUser = await response.json();
        return mysqlUser;
    } catch (error) {
        console.error('Error creating MySQL user:', error);
        throw error;
    }
}

async function createMySQLUserForCognito(cognitoUserData) {
    try {
        const response = await fetch(`${API_BASE_URL}/create-user`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAuthToken()}`
            },
            body: JSON.stringify({
                cognitoUserId: cognitoUserData.UserSub,
                email: cognitoUserData.email,
                username: cognitoUserData.username,
                fullName: cognitoUserData.fullName || ''
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('MySQL user creation failed:', errorText);
            throw new Error(`Failed to create MySQL user: ${response.status}`);
        }

        const result = await response.json();
        console.log('MySQL user created:', result);
        return result;

    } catch (error) {
        console.error('Error creating MySQL user:', error);
        throw error;
    }
}

// Form Submission Handler
document.addEventListener('DOMContentLoaded', function () {
    const registerForm = document.getElementById('registerForm');

    registerForm.addEventListener('submit', async function (e) {
        e.preventDefault(); // Prevent default form submission

        // Get form data
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const termsAccepted = document.getElementById('terms').checked;

        // Basic validation
        if (!email || !password || !confirmPassword) {
            showMessage('Please fill in all fields', 'error');
            return;
        }

        if (!isValidEmail(email)) {
            showMessage('Please enter a valid email address', 'error');
            return;
        }

        if (!isValidPassword(password)) {
            showMessage('Password does not meet all requirements', 'error');
            return;
        }

        if (password !== confirmPassword) {
            showMessage('Passwords do not match', 'error');
            return;
        }

        if (!termsAccepted) {
            showMessage('Please accept the Terms & Conditions to continue', 'error');
            return;
        }

        try {
            // Show loading state
            toggleButtonLoading(true);

            // Register user with AWS Cognito
            const result = await registerUser(email, password);

            // Clear form
            registerForm.reset();

            // Reset password strength indicator
            updatePasswordStrength('');

            // Show success message
            showMessage('Account created successfully! You can now sign in with your credentials.', 'success');

            // Redirect to login page after success
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);

        } catch (error) {
            // Handle registration error
            console.error('Registration error:', error);
            showMessage(error.message || 'Registration failed. Please try again.', 'error');
        } finally {
            // Hide loading state
            toggleButtonLoading(false);
        }
    });

    // Real-time validation feedback
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirmPassword');

    // Email validation
    emailInput.addEventListener('input', function () {
        const email = this.value.trim();
        if (email) {
            if (!isValidEmail(email)) {
                this.style.borderColor = '#ef4444';
                this.style.boxShadow = '0 0 0 3px rgba(239, 68, 68, 0.1)';
            } else {
                this.style.borderColor = '#10b981';
                this.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.1)';
            }
        } else {
            this.style.borderColor = '#e2e8f0';
            this.style.boxShadow = 'inset 0 2px 4px rgba(0, 0, 0, 0.02)';
        }
    });

    // Password strength checking
    passwordInput.addEventListener('input', function () {
        updatePasswordStrength(this.value);

        // Also check confirm password match if it has value
        if (confirmPasswordInput.value) {
            checkPasswordMatch();
        }
    });

    // Confirm password validation
    function checkPasswordMatch() {
        const password = passwordInput.value;
        const confirmPassword = confirmPasswordInput.value;

        if (confirmPassword) {
            if (password !== confirmPassword) {
                confirmPasswordInput.style.borderColor = '#ef4444';
                confirmPasswordInput.style.boxShadow = '0 0 0 3px rgba(239, 68, 68, 0.1)';
            } else {
                confirmPasswordInput.style.borderColor = '#10b981';
                confirmPasswordInput.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.1)';
            }
        } else {
            confirmPasswordInput.style.borderColor = '#e2e8f0';
            confirmPasswordInput.style.boxShadow = 'inset 0 2px 4px rgba(0, 0, 0, 0.02)';
        }
    }

    confirmPasswordInput.addEventListener('input', checkPasswordMatch);
});