/**
 * Utility functions for the Finance Lending Application
 */

/**
 * Generate unique Loan ID based on the format from image 2
 * Format: 00-100 (sequence) - CUS NO - LOAN NO - LOAN TYPE
 * Example: "00-100-001-01-D" or "00-150-002-03-M"
 */
const generateLoanId = (sequenceNumber, customerNumber, customerLoanNumber, loanType) => {
    const seq = String(sequenceNumber).padStart(3, '0');
    const cusNum = String(customerNumber).padStart(3, '0');
    const loanNum = String(customerLoanNumber).padStart(2, '0');
    const type = loanType.toUpperCase();

    return `00-${seq}-${cusNum}-${loanNum}-${type}`;
};

/**
 * Generate unique Customer ID
 * Format: CUS-XXXXX
 */
const generateCustomerId = (sequenceNumber) => {
    const seq = String(sequenceNumber).padStart(5, '0');
    return `CUS-${seq}`;
};

/**
 * Generate unique Payment ID
 * Format: PAY-YYYYMMDD-XXXXX
 */
const generatePaymentId = (sequenceNumber) => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const seq = String(sequenceNumber).padStart(5, '0');

    return `PAY-${year}${month}${day}-${seq}`;
};

/**
 * Calculate interest based on principal, rate, and time period
 */
const calculateInterest = (principal, rate, startDate, endDate, type) => {
    if (!principal || !rate || !startDate || !endDate) return 0;

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (end <= start) return 0;

    const timeDiff = end - start;

    if (type === 'daily') {
        const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
        return (principal * rate * days) / 100;
    } else if (type === 'monthly') {
        const months = timeDiff / (1000 * 60 * 60 * 24 * 30);
        return (principal * rate * months) / 100;
    }

    return 0;
};

/**
 * Calculate number of days between two dates
 */
const calculateDaysBetween = (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const timeDiff = end - start;
    return Math.floor(timeDiff / (1000 * 60 * 60 * 24));
};

/**
 * Calculate number of months between two dates
 */
const calculateMonthsBetween = (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const timeDiff = end - start;
    return timeDiff / (1000 * 60 * 60 * 24 * 30);
};

/**
 * Format currency for display
 */
const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
};

/**
 * Format date for display
 */
const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
};

/**
 * Validate phone number (Indian format)
 */
const validatePhone = (phone) => {
    const phoneRegex = /^[6-9]\d{9}$/;
    return phoneRegex.test(phone);
};

/**
 * Validate PAN number (Indian format)
 */
const validatePAN = (pan) => {
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    return panRegex.test(pan);
};

/**
 * Validate Aadhar number (Indian format)
 */
const validateAadhar = (aadhar) => {
    const aadharRegex = /^\d{12}$/;
    return aadharRegex.test(aadhar);
};

/**
 * Calculate profit/loss for a loan
 */
const calculateProfitLoss = (totalInterestEarned, outstandingPrincipal, status) => {
    if (status === 'written-off' || status === 'defaulted') {
        return totalInterestEarned - outstandingPrincipal;
    }
    return totalInterestEarned;
};

/**
 * Get loan status color for UI
 */
const getLoanStatusColor = (status) => {
    const colors = {
        'active': '#10b981',
        'closed': '#6b7280',
        'defaulted': '#ef4444',
        'written-off': '#dc2626'
    };
    return colors[status] || '#6b7280';
};

module.exports = {
    generateLoanId,
    generateCustomerId,
    generatePaymentId,
    calculateInterest,
    calculateDaysBetween,
    calculateMonthsBetween,
    formatCurrency,
    formatDate,
    validatePhone,
    validatePAN,
    validateAadhar,
    calculateProfitLoss,
    getLoanStatusColor
};
