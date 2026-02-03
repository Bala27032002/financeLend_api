const Loan = require('../models/Loan');
const Customer = require('../models/Customer');
const Payment = require('../models/Payment');
const { generateLoanId, calculateInterest } = require('../utils/helpers');

/**
 * @desc    Get all loans
 * @route   GET /api/loans
 * @access  Public
 */
const getAllLoans = async (req, res) => {
    try {
        const { status, interestType, customerId, page = 1, limit = 10 } = req.query;

        const query = {};

        if (status) {
            query.status = status;
        }

        if (interestType) {
            query.interestType = interestType;
        }

        if (customerId) {
            query.customerId = customerId;
        }

        const skip = (page - 1) * limit;

        const loans = await Loan.find(query)
            .populate('customer', 'name phone customerId')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        // Update outstanding amounts for each loan
        const updatedLoans = loans.map(loan => {
            const currentInterest = loan.calculateInterest();
            return {
                ...loan.toObject(),
                currentInterest,
                totalOutstanding: loan.outstandingPrincipal + currentInterest
            };
        });

        const total = await Loan.countDocuments(query);

        res.status(200).json({
            success: true,
            count: loans.length,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / limit),
            data: updatedLoans
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching loans',
            error: error.message
        });
    }
};

/**
 * @desc    Get single loan
 * @route   GET /api/loans/:id
 * @access  Public
 */
const getLoan = async (req, res) => {
    try {
        const loan = await Loan.findById(req.params.id).populate('customer');

        if (!loan) {
            return res.status(404).json({
                success: false,
                message: 'Loan not found'
            });
        }

        // Calculate current interest
        const currentInterest = loan.calculateInterest();

        // Get payment history
        const payments = await Payment.find({ loan: loan._id }).sort({ paymentDate: -1 });

        res.status(200).json({
            success: true,
            data: {
                loan: {
                    ...loan.toObject(),
                    currentInterest,
                    totalOutstanding: loan.outstandingPrincipal + currentInterest
                },
                payments
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching loan',
            error: error.message
        });
    }
};

/**
 * @desc    Create new loan
 * @route   POST /api/loans
 * @access  Public
 */
const createLoan = async (req, res) => {
    try {
        const {
            customerId,
            principalAmount,
            interestType,
            interestRate,
            disbursementDate,
            dueDate,
            notes
        } = req.body;

        // Find customer
        const customer = await Customer.findOne({ customerId });
        if (!customer) {
            return res.status(404).json({
                success: false,
                message: 'Customer not found'
            });
        }

        // Generate loan ID as per image 2 format
        const lastLoan = await Loan.findOne().sort({ createdAt: -1 });
        const sequenceNumber = lastLoan ? lastLoan.sequenceNumber + 1 : 1;

        const customerLoanNumber = customer.totalLoans + 1;
        const loanTypeCode = interestType === 'daily' ? 'D' : 'M';

        const customerIdParts = customer.customerId.split('-');
        const customerNumberRaw = customerIdParts[1] || '1';
        const customerNumber = parseInt(customerNumberRaw, 10) || 1;
        const loanId = generateLoanId(sequenceNumber, customerNumber, customerLoanNumber, loanTypeCode);

        // Create loan
        const loan = await Loan.create({
            loanId,
            sequenceNumber,
            customer: customer._id,
            customerId: customer.customerId,
            customerLoanNumber,
            principalAmount,
            interestType,
            interestRate,
            disbursementDate,
            dueDate,
            outstandingPrincipal: principalAmount,
            loanTypeCode,
            notes
        });

        // Update customer statistics
        customer.totalLoans += 1;
        customer.activeLoans += 1;
        customer.totalAmountBorrowed += principalAmount;
        await customer.save();

        res.status(201).json({
            success: true,
            message: 'Loan created successfully',
            data: loan
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error creating loan',
            error: error.message
        });
    }
};

/**
 * @desc    Update loan
 * @route   PUT /api/loans/:id
 * @access  Public
 */
const updateLoan = async (req, res) => {
    try {
        const loan = await Loan.findById(req.params.id);

        if (!loan) {
            return res.status(404).json({
                success: false,
                message: 'Loan not found'
            });
        }

        const updatedLoan = await Loan.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );

        res.status(200).json({
            success: true,
            message: 'Loan updated successfully',
            data: updatedLoan
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating loan',
            error: error.message
        });
    }
};

/**
 * @desc    Close loan
 * @route   PUT /api/loans/:id/close
 * @access  Public
 */
const closeLoan = async (req, res) => {
    try {
        const loan = await Loan.findById(req.params.id);

        if (!loan) {
            return res.status(404).json({
                success: false,
                message: 'Loan not found'
            });
        }

        if (loan.status === 'closed') {
            return res.status(400).json({
                success: false,
                message: 'Loan is already closed'
            });
        }

        // Check if loan is fully paid
        if (loan.outstandingPrincipal > 0) {
            return res.status(400).json({
                success: false,
                message: 'Cannot close loan with outstanding principal'
            });
        }

        loan.status = 'closed';
        loan.closedDate = new Date();
        await loan.save();

        // Update customer statistics
        const customer = await Customer.findById(loan.customer);
        if (customer) {
            customer.activeLoans = Math.max(0, customer.activeLoans - 1);
            await customer.save();
        }

        res.status(200).json({
            success: true,
            message: 'Loan closed successfully',
            data: loan
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error closing loan',
            error: error.message
        });
    }
};

/**
 * @desc    Get loan statistics
 * @route   GET /api/loans/stats/overview
 * @access  Public
 */
const getLoanStats = async (req, res) => {
    try {
        const totalLoans = await Loan.countDocuments();
        const activeLoans = await Loan.countDocuments({ status: 'active' });
        const closedLoans = await Loan.countDocuments({ status: 'closed' });
        const defaultedLoans = await Loan.countDocuments({ status: 'defaulted' });

        // Calculate total amounts
        const allLoans = await Loan.find();

        let totalPrincipalDisbursed = 0;
        let totalOutstandingPrincipal = 0;
        let totalInterestEarned = 0;
        let totalOutstandingInterest = 0;
        let totalProfit = 0;
        let totalLoss = 0;

        allLoans.forEach(loan => {
            totalPrincipalDisbursed += loan.principalAmount;
            totalOutstandingPrincipal += loan.outstandingPrincipal;
            totalInterestEarned += loan.totalInterestEarned;

            const currentInterest = loan.calculateInterest();
            totalOutstandingInterest += currentInterest;

            if (loan.profitLoss >= 0) {
                totalProfit += loan.profitLoss;
            } else {
                totalLoss += Math.abs(loan.profitLoss);
            }
        });

        // Daily and Monthly loan counts
        const dailyLoans = await Loan.countDocuments({ interestType: 'daily', status: 'active' });
        const monthlyLoans = await Loan.countDocuments({ interestType: 'monthly', status: 'active' });

        res.status(200).json({
            success: true,
            data: {
                totalLoans,
                activeLoans,
                closedLoans,
                defaultedLoans,
                dailyLoans,
                monthlyLoans,
                totalPrincipalDisbursed,
                totalOutstandingPrincipal,
                totalInterestEarned,
                totalOutstandingInterest,
                totalProfit,
                totalLoss,
                netProfitLoss: totalProfit - totalLoss
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching loan statistics',
            error: error.message
        });
    }
};

/**
 * @desc    Calculate loan details for a specific date
 * @route   POST /api/loans/:id/calculate
 * @access  Public
 */
const calculateLoanDetails = async (req, res) => {
    try {
        const { asOfDate } = req.body;
        const loan = await Loan.findById(req.params.id);

        if (!loan) {
            return res.status(404).json({
                success: false,
                message: 'Loan not found'
            });
        }

        const calculationDate = asOfDate ? new Date(asOfDate) : new Date();
        const interest = loan.calculateInterest(calculationDate);

        const daysSinceDisbursement = Math.floor(
            (calculationDate - loan.disbursementDate) / (1000 * 60 * 60 * 24)
        );

        res.status(200).json({
            success: true,
            data: {
                loanId: loan.loanId,
                principalAmount: loan.principalAmount,
                outstandingPrincipal: loan.outstandingPrincipal,
                interestRate: loan.interestRate,
                interestType: loan.interestType,
                disbursementDate: loan.disbursementDate,
                calculationDate,
                daysSinceDisbursement,
                calculatedInterest: interest,
                totalOutstanding: loan.outstandingPrincipal + interest,
                totalPaid: loan.totalAmountPaid,
                totalInterestEarned: loan.totalInterestEarned
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error calculating loan details',
            error: error.message
        });
    }
};

module.exports = {
    getAllLoans,
    getLoan,
    createLoan,
    updateLoan,
    closeLoan,
    getLoanStats,
    calculateLoanDetails
};
