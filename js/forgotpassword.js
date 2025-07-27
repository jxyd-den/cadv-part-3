// AWS Cognito configuration
const CLIENT_ID = '2js4esbjki7d9hlj82ualimsni';
const REGION = 'us-east-1';
const COGNITO_URL = `https://cognito-idp.us-east-1.amazonaws.com/`;

// Global variables to track the process
let currentEmail = '';
let currentStep = 1; // 1: email, 2: code, 3: password
let verifiedCode = ''; // Store the verified code

// AWS Cognito Forgot Password - Send Code
async function sendResetCode(email) {
    const requestBody = {
        ClientId: CLIENT_ID,
        Username: email
    };

    const response = await fetch(COGNITO_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-amz-json-1.1',
            'X-Amz-Target': 'AWSCognitoIdentityProviderService.ForgotPassword',
        },
        body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
        let errorMessage = 'Failed to send reset code';
        try {
            const errorData = await response.json();
            console.log('AWS Cognito forgot password error:', errorData);

            if (errorData.__type) {
                switch (errorData.__type) {
                    case 'UserNotFoundException':
                        errorMessage = 'No account found with this email address.';
                        break;
                    case 'InvalidParameterException':
                        errorMessage = 'Invalid email address.';
                        break;
                    case 'LimitExceededException':
                        errorMessage = 'Too many password reset attempts. Please wait 15-30 minutes before trying again.';
                        break;
                    case 'TooManyRequestsException':
                        errorMessage = 'Too many requests. Please wait a few minutes and try again.';
                        break;
                    default:
                        errorMessage = errorData.message || errorData.__type || 'Failed to send reset code';
                }
            }
        } catch (parseError) {
            console.error('Error parsing response:', parseError);
            errorMessage = `Failed to send reset code (Status: ${response.status})`;
        }
        throw new Error(errorMessage);
    }

    const data = await response.json();
    return data;
}

// AWS Cognito Confirm Forgot Password - Reset with Code
async function confirmResetPassword(email, code, newPassword) {
    const requestBody = {
        ClientId: CLIENT_ID,
        Username: email,
        ConfirmationCode: code,
        Password: newPassword
    };

    const response = await fetch(COGNITO_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-amz-json-1.1',
            'X-Amz-Target': 'AWSCognitoIdentityProviderService.ConfirmForgotPassword',
        },
        body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
        let errorMessage = 'Failed to reset password';
        try {
            const errorData = await response.json();
            console.log('AWS Cognito confirm forgot password error:', errorData);

            if (errorData.__type) {
                switch (errorData.__type) {
                    case 'CodeMismatchException':
                        errorMessage = 'Invalid verification code. Please check and try again.';
                        break;
                    case 'ExpiredCodeException':
                        errorMessage = 'Verification code has expired. Please request a new one.';
                        break;
                    case 'InvalidPasswordException':
                        errorMessage = 'Password does not meet requirements.';
                        break;
                    case 'UserNotFoundException':
                        errorMessage = 'User not found.';
                        break;
                    case 'InvalidParameterException':
                        errorMessage = 'Invalid parameters provided.';
                        break;
                    case 'LimitExceededException':
                        errorMessage = 'Too many attempts. Please try again later.';
                        break;
                    default:
                        errorMessage = errorData.message || errorData.__type || 'Failed to reset password';
                }
            }
        } catch (parseError) {
            console.error('Error parsing response:', parseError);
            errorMessage = `Failed to reset password (Status: ${response.status})`;
        }
        throw new Error(errorMessage);
    }

    const data = await response.json();
    return data;
}

// Verify code by attempting reset with a temporary password
async function verifyResetCode(email, code) {
    // Generate a temporary password that meets AWS Cognito requirements
    const tempPassword = 'TempVerify123!@#$';

    const requestBody = {
        ClientId: CLIENT_ID,
        Username: email,
        ConfirmationCode: code,
        Password: tempPassword
    };

    const response = await fetch(COGNITO_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-amz-json-1.1',
            'X-Amz-Target': 'AWSCognitoIdentityProviderService.ConfirmForgotPassword',
        },
        body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
        let errorMessage = 'Invalid verification code';
        try {
            const errorData = await response.json();
            console.log('Code verification error:', errorData);

            if (errorData.__type) {
                switch (errorData.__type) {
                    case 'CodeMismatchException':
                        errorMessage = 'Invalid verification code. Please check and try again.';
                        break;
                    case 'ExpiredCodeException':
                        errorMessage = 'Verification code has expired. Please request a new one.';
                        break;
                    case 'UserNotFoundException':
                        errorMessage = 'User not found.';
                        break;
                    case 'InvalidParameterException':
                        errorMessage = 'Invalid verification code format.';
                        break;
                    case 'LimitExceededException':
                        errorMessage = 'Too many attempts. Please try again later.';
                        break;
                    default:
                        errorMessage = errorData.message || 'Invalid verification code';
                }
            }
        } catch (parseError) {
            console.error('Error parsing response:', parseError);
            errorMessage = 'Failed to verify code';
        }
        throw new Error(errorMessage);
    }

    // If we get here, the code was valid and password was set to tempPassword
    // Now we need to send a new reset code since we consumed the previous one
    try {
        await sendResetCode(email);
        return { codeValid: true };
    } catch (error) {
        // If sending new code fails, still return success since verification worked
        console.warn('Failed to send new reset code after verification:', error);
        return { codeValid: true };
    }
}// Password strength checker
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

    if (!strengthIndicator || !strengthText) return;

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

function toggleButtonLoading(button, isLoading) {
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

function showStep(step) {
    // Hide all forms
    document.getElementById('emailForm').style.display = 'none';
    document.getElementById('codeForm').style.display = 'none';
    document.getElementById('passwordForm').style.display = 'none';

    // Update header description
    const headerDescription = document.getElementById('headerDescription');

    switch (step) {
        case 1:
            document.getElementById('emailForm').style.display = 'block';
            headerDescription.textContent = 'Enter your email to receive a reset code';
            break;
        case 2:
            document.getElementById('codeForm').style.display = 'block';
            headerDescription.textContent = 'Enter the verification code sent to your email';
            break;
        case 3:
            document.getElementById('passwordForm').style.display = 'block';
            headerDescription.textContent = 'Create your new password';
            break;
    }

    currentStep = step;
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

// Main form handling
document.addEventListener('DOMContentLoaded', function () {
    const emailForm = document.getElementById('emailForm');
    const codeForm = document.getElementById('codeForm');
    const passwordForm = document.getElementById('passwordForm');
    const resendCodeBtn = document.getElementById('resendCodeBtn');

    // Step 1: Email form submission
    emailForm.addEventListener('submit', async function (e) {
        e.preventDefault();

        const email = document.getElementById('email').value.trim();

        if (!email) {
            showMessage('Please enter your email address', 'error');
            return;
        }

        if (!isValidEmail(email)) {
            showMessage('Please enter a valid email address', 'error');
            return;
        }

        const submitBtn = this.querySelector('.forgot-btn');

        try {
            toggleButtonLoading(submitBtn, true);

            await sendResetCode(email);
            currentEmail = email;

            showMessage('Verification code sent to your email!', 'success');
            showStep(2);

        } catch (error) {
            console.error('Send code error:', error);

            // Special handling for rate limit errors
            if (error.message.includes('Too many') || error.message.includes('LimitExceeded')) {
                showMessage(error.message + ' You can try using a different email address or wait before retrying.', 'error');

                // Disable the button for a longer period for rate limit errors
                setTimeout(() => {
                    if (submitBtn && !submitBtn.disabled) {
                        submitBtn.disabled = false;
                    }
                }, 60000); // 1 minute cooldown
            } else {
                showMessage(error.message || 'Failed to send reset code. Please try again.', 'error');
            }
        } finally {
            toggleButtonLoading(submitBtn, false);
        }
    });

    // Step 2: Code verification
    codeForm.addEventListener('submit', async function (e) {
        e.preventDefault();

        const code = document.getElementById('verificationCode').value.trim();

        if (!code) {
            showMessage('Please enter the verification code', 'error');
            return;
        }

        if (code.length !== 6 || !/^\d{6}$/.test(code)) {
            showMessage('Please enter a valid 6-digit code', 'error');
            return;
        }

        const submitBtn = this.querySelector('.forgot-btn');

        try {
            toggleButtonLoading(submitBtn, true);

            // Verify the code with AWS Cognito
            await verifyResetCode(currentEmail, code);

            // Store the verified code for the final step
            verifiedCode = code;

            showMessage('Code verified! Please set your new password.', 'success');
            showStep(3);

        } catch (error) {
            console.error('Code verification error:', error);
            showMessage(error.message || 'Invalid verification code. Please try again.', 'error');
        } finally {
            toggleButtonLoading(submitBtn, false);
        }
    });

    // Step 3: Password reset
    passwordForm.addEventListener('submit', async function (e) {
        e.preventDefault();

        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmNewPassword').value;

        if (!newPassword || !confirmPassword) {
            showMessage('Please fill in all password fields', 'error');
            return;
        }

        if (!isValidPassword(newPassword)) {
            showMessage('Password does not meet all requirements', 'error');
            return;
        }

        if (newPassword !== confirmPassword) {
            showMessage('Passwords do not match', 'error');
            return;
        }

        if (!verifiedCode) {
            showMessage('No verified code found. Please start over.', 'error');
            showStep(1);
            return;
        }

        const submitBtn = this.querySelector('.forgot-btn');

        try {
            toggleButtonLoading(submitBtn, true);

            await confirmResetPassword(currentEmail, verifiedCode, newPassword);

            showMessage('Password reset successful! Redirecting to login...', 'success');

            // Redirect to login page after success
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);

        } catch (error) {
            console.error('Password reset error:', error);

            // Check if it's a code-related error
            if (error.message.includes('CodeMismatchException') || error.message.includes('Invalid verification code')) {
                showMessage('Invalid verification code. Please check the code and try again.', 'error');
                setTimeout(() => {
                    verifiedCode = ''; // Clear the stored code
                    showStep(2); // Go back to code verification step
                }, 1500);
            } else if (error.message.includes('ExpiredCodeException') || error.message.includes('expired')) {
                showMessage('Verification code has expired. Please request a new code.', 'error');
                setTimeout(() => {
                    verifiedCode = ''; // Clear the stored code
                    showStep(1); // Go back to email step to get a new code
                }, 2000);
            } else {
                showMessage(error.message || 'Failed to reset password. Please try again.', 'error');
            }
        } finally {
            toggleButtonLoading(submitBtn, false);
        }
    });

    // Resend code functionality
    resendCodeBtn.addEventListener('click', async function () {
        if (!currentEmail) {
            showMessage('Please start over from the beginning', 'error');
            showStep(1);
            return;
        }

        try {
            toggleButtonLoading(this, true);

            // Clear any previously verified code since we're getting a new one
            verifiedCode = '';

            await sendResetCode(currentEmail);
            showMessage('New verification code sent to your email!', 'success');

        } catch (error) {
            console.error('Resend code error:', error);

            // Special handling for rate limit errors
            if (error.message.includes('Too many') || error.message.includes('LimitExceeded')) {
                showMessage(error.message + ' Please wait before requesting another code.', 'error');

                // Disable the resend button for a longer period
                this.disabled = true;
                this.textContent = 'Please wait...';
                setTimeout(() => {
                    this.disabled = false;
                    this.querySelector('.btn-text').textContent = 'Resend Code';
                }, 60000); // 1 minute cooldown
            } else {
                showMessage(error.message || 'Failed to resend code. Please try again.', 'error');
            }
        } finally {
            toggleButtonLoading(this, false);
        }
    });

    // Real-time password validation for new password form
    const newPasswordInput = document.getElementById('newPassword');
    const confirmNewPasswordInput = document.getElementById('confirmNewPassword');

    if (newPasswordInput) {
        newPasswordInput.addEventListener('input', function () {
            updatePasswordStrength(this.value);

            // Also check confirm password match if it has value
            if (confirmNewPasswordInput && confirmNewPasswordInput.value) {
                checkPasswordMatch();
            }
        });
    }

    // Confirm password validation
    function checkPasswordMatch() {
        const password = newPasswordInput.value;
        const confirmPassword = confirmNewPasswordInput.value;

        if (confirmPassword) {
            if (password !== confirmPassword) {
                confirmNewPasswordInput.style.borderColor = '#ef4444';
                confirmNewPasswordInput.style.boxShadow = '0 0 0 3px rgba(239, 68, 68, 0.1)';
            } else {
                confirmNewPasswordInput.style.borderColor = '#10b981';
                confirmNewPasswordInput.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.1)';
            }
        } else {
            confirmNewPasswordInput.style.borderColor = '#e2e8f0';
            confirmNewPasswordInput.style.boxShadow = 'inset 0 2px 4px rgba(0, 0, 0, 0.02)';
        }
    }

    if (confirmNewPasswordInput) {
        confirmNewPasswordInput.addEventListener('input', checkPasswordMatch);
    }

    // Email validation
    const emailInput = document.getElementById('email');
    if (emailInput) {
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
    }
});