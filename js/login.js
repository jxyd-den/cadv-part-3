// AWS Cognito Configuration
const COGNITO_CONFIG = {
    CLIENT_ID: '2js4esbjki7d9hlj82ualimsni',
    REGION: 'us-east-1',
    USER_POOL_ID: 'us-east-1_F861kBcqK',
    ENDPOINT: 'https://cognito-idp.us-east-1.amazonaws.com/'
};

// Main login function with improved error handling
async function loginUser(email, password) {
    console.log('Attempting login for:', email);

    const requestBody = {
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: COGNITO_CONFIG.CLIENT_ID,
        AuthParameters: {
            USERNAME: email,
            PASSWORD: password
        }
    };

    console.log('Request body:', { ...requestBody, AuthParameters: { ...requestBody.AuthParameters, PASSWORD: '***' } });

    try {
        const response = await fetch(COGNITO_CONFIG.ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-amz-json-1.1',
                'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth',
            },
            body: JSON.stringify(requestBody),
        });

        console.log('Response status:', response.status);
        console.log('Response headers:', [...response.headers.entries()]);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Error response:', errorText);

            let errorData;
            try {
                errorData = JSON.parse(errorText);
            } catch (parseError) {
                console.error('Failed to parse error response:', parseError);
                throw new Error(`Login failed (Status: ${response.status})`);
            }

            // Handle specific AWS Cognito errors
            let errorMessage = 'Login failed';
            if (errorData.__type) {
                switch (errorData.__type) {
                    case 'NotAuthorizedException':
                        errorMessage = 'Incorrect username or password';
                        break;
                    case 'UserNotConfirmedException':
                        errorMessage = 'User account not confirmed. Please check your email for confirmation link.';
                        break;
                    case 'UserNotFoundException':
                        errorMessage = 'User does not exist';
                        break;
                    case 'TooManyRequestsException':
                        errorMessage = 'Too many requests. Please try again later.';
                        break;
                    case 'InvalidParameterException':
                        errorMessage = 'Invalid request parameters';
                        break;
                    case 'ResourceNotFoundException':
                        errorMessage = 'Authentication service not found. Please contact support.';
                        break;
                    default:
                        errorMessage = errorData.message || errorData.__type || 'Login failed';
                }
            } else {
                errorMessage = errorData.message || errorData.error || 'Login failed';
            }

            throw new Error(errorMessage);
        }

        const data = await response.json();
        console.log('Login successful:', { ...data, AuthenticationResult: { ...data.AuthenticationResult, AccessToken: '***', IdToken: '***' } });
        return data;

    } catch (error) {
        if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
            throw new Error('Network error. Please check your connection and try again.');
        }
        throw error;
    }
}

// Enhanced user data storage
function storeUserData(cognitoResult, email) {
    try {
        // Store authentication data in sessionStorage
        sessionStorage.setItem('userAuth', JSON.stringify(cognitoResult));
        sessionStorage.setItem('userSession', 'true');

        // Extract user ID from the token for better user identification
        const userId = extractUserIdFromToken(cognitoResult);

        // Store user data in localStorage for persistence
        const userData = {
            userId: userId,
            email: email,
            cognitoId: userId,
            loginTime: new Date().toISOString()
        };

        localStorage.setItem('currentUser', JSON.stringify(userData));
        console.log('User data stored successfully');

    } catch (error) {
        console.error('Error storing user data:', error);
    }
}

// Extract user ID from Cognito token
function extractUserIdFromToken(cognitoResult) {
    try {
        const accessToken = cognitoResult.AuthenticationResult.AccessToken;
        const tokenParts = accessToken.split('.');
        const payload = JSON.parse(atob(tokenParts[1]));
        return payload.sub || payload.username;
    } catch (error) {
        console.error('Error extracting user ID:', error);
        return 'unknown_user_' + Date.now();
    }
}

// UI Helper Functions
function showMessage(message, type = 'error') {
    const messageContainer = document.getElementById('messageContainer');
    const messageContent = document.getElementById('messageContent');

    if (messageContainer && messageContent) {
        messageContent.textContent = message;
        messageContainer.className = `message-container ${type}`;
        messageContainer.style.display = 'block';

        // Auto-hide after 5 seconds
        setTimeout(() => {
            messageContainer.style.display = 'none';
        }, 5000);
    } else {
        // Fallback to alert if message container doesn't exist
        alert(message);
    }
}

function toggleButtonLoading(isLoading) {
    const button = document.querySelector('.login-btn');
    if (!button) return;

    const btnText = button.querySelector('.btn-text');
    const btnSpinner = button.querySelector('.btn-spinner');

    if (isLoading) {
        button.disabled = true;
        if (btnText) btnText.style.display = 'none';
        if (btnSpinner) btnSpinner.style.display = 'inline';
        button.style.cursor = 'not-allowed';
    } else {
        button.disabled = false;
        if (btnText) btnText.style.display = 'inline';
        if (btnSpinner) btnSpinner.style.display = 'none';
        button.style.cursor = 'pointer';
    }
}

// Enhanced form validation
function validateLoginForm(email, password) {
    if (!email || !password) {
        throw new Error('Please fill in all fields');
    }

    if (!isValidEmail(email)) {
        throw new Error('Please enter a valid email address');
    }

    if (password.length < 6) {
        throw new Error('Password must be at least 6 characters long');
    }

    return true;
}

// Email validation helper
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Form Submission Handler
document.addEventListener('DOMContentLoaded', function () {
    const loginForm = document.getElementById('loginForm');
    if (!loginForm) {
        console.error('Login form not found');
        return;
    }

    loginForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        console.log('Login form submitted');

        // Get form data
        const emailInput = document.getElementById('email');
        const passwordInput = document.getElementById('password');
        const rememberInput = document.getElementById('remember');

        if (!emailInput || !passwordInput) {
            showMessage('Form fields not found', 'error');
            return;
        }

        const email = emailInput.value.trim();
        const password = passwordInput.value;
        const rememberMe = rememberInput ? rememberInput.checked : false;

        try {
            // Validate form data
            validateLoginForm(email, password);

            // Show loading state
            toggleButtonLoading(true);
            showMessage('Logging in...', 'info');

            // Attempt login
            const result = await loginUser(email, password);

            // Store user data
            storeUserData(result, email);

            // Handle remember me
            if (rememberMe) {
                localStorage.setItem('rememberUser', email);
            } else {
                localStorage.removeItem('rememberUser');
            }

            // Show success message
            showMessage('Login successful! Redirecting...', 'success');

            // Redirect after successful login
            setTimeout(() => {
                window.location.href = "homepage.html";
            }, 1500);

        } catch (error) {
            console.error('Login error:', error);
            showMessage(error.message || 'Login failed. Please try again.', 'error');
        } finally {
            toggleButtonLoading(false);
        }
    });

    // Auto-fill email if user was remembered
    const rememberedEmail = localStorage.getItem('rememberUser');
    if (rememberedEmail) {
        const emailInput = document.getElementById('email');
        const rememberInput = document.getElementById('remember');

        if (emailInput) emailInput.value = rememberedEmail;
        if (rememberInput) rememberInput.checked = true;
    }
});

// Add debugging function to test Cognito connectivity
async function testCognitoConnection() {
    console.log('Testing Cognito connection...');
    try {
        const response = await fetch(COGNITO_CONFIG.ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-amz-json-1.1',
                'X-Amz-Target': 'AWSCognitoIdentityProviderService.GetUser',
            },
            body: JSON.stringify({
                AccessToken: 'test'
            }),
        });
        console.log('Cognito endpoint reachable, status:', response.status);
        return true;
    } catch (error) {
        console.error('Cognito connection test failed:', error);
        return false;
    }
}

// Make functions globally available for debugging
window.testCognitoConnection = testCognitoConnection;
window.loginUser = loginUser;