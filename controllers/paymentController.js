const Payment = require('../models/Payment');
const Loan = require('../models/Loan');
const Customer = require('../models/Customer');
const { generatePaymentId } = require('../utils/helpers');

/**
 * @desc    Get all payments
 * @route   GET /api/payments
 * @access  Public
 */
const getAllPayments = async (req, res) => {
    try {
        const { loanId, customerId, status, page = 1, limit = 10 } = req.query;

        const query = {};

        if (loanId) {
            query.loanId = loanId;
        }

        if (customerId) {
            query.customerId = customerId;
        }

        if (status) {
            query.status = status;
        }

        const skip = (page - 1) * limit;

        const payments = await Payment.find(query)
            .populate('customer', 'name phone customerId')
            .populate('loan', 'loanId principalAmount interestType')
            .sort({ paymentDate: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Payment.countDocuments(query);

        res.status(200).json({
            success: true,
            count: payments.length,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / limit),
            data: payments
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching payments',
            error: error.message
        });
    }
};

/**
 * @desc    Get single payment
 * @route   GET /api/payments/:id
 * @access  Public
 */
const getPayment = async (req, res) => {
    try {
        const payment = await Payment.findById(req.params.id)
            .populate('customer')
            .populate('loan');

        if (!payment) {
            return res.status(404).json({
                success: false,
                message: 'Payment not found'
            });
        }

        res.status(200).json({
            success: true,
            data: payment
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching payment',
            error: error.message
        });
    }
};

/**
 * @desc    Create new payment
 * @route   POST /api/payments
 * @access  Public
 */
const createPayment = async (req, res) => {
    try {
        const {
            loanId,
            amount,
            paymentDate,
            paymentMethod,
            transactionReference,
            notes,
            receivedBy
        } = req.body;

        // Find loan
        const loan = await Loan.findOne({ loanId }).populate('customer');
        if (!loan) {
            return res.status(404).json({
                success: false,
                message: 'Loan not found'
            });
        }

        if (loan.status === 'closed') {
            return res.status(400).json({
                success: false,
                message: 'Cannot add payment to a closed loan'
            });
        }

        // Calculate current interest
        const currentInterest = loan.calculateInterest(new Date(paymentDate));
        const totalOutstandingInterest = currentInterest - loan.totalInterestEarned;

        // Allocate payment: Interest first, then principal
        let remainingAmount = amount;
        let interestPaid = 0;
        let principalPaid = 0;

        // Pay interest first
        if (totalOutstandingInterest > 0) {
            interestPaid = Math.min(remainingAmount, totalOutstandingInterest);
            remainingAmount -= interestPaid;
        }

        // Pay principal
        if (remainingAmount > 0) {
            principalPaid = Math.min(remainingAmount, loan.outstandingPrincipal);
        }

        // Generate payment ID
        const paymentsToday = await Payment.countDocuments({
            paymentDate: {
                $gte: new Date(new Date(paymentDate).setHours(0, 0, 0, 0)),
                $lt: new Date(new Date(paymentDate).setHours(23, 59, 59, 999))
            }
        });
        const paymentId = generatePaymentId(paymentsToday + 1);

        // Create payment
        const payment = await Payment.create({
            paymentId,
            loan: loan._id,
            loanId: loan.loanId,
            customer: loan.customer._id,
            customerId: loan.customerId,
            amount,
            principalPaid,
            interestPaid,
            paymentDate,
            paymentMethod,
            transactionReference,
            notes,
            receivedBy,
            outstandingPrincipalAfter: loan.outstandingPrincipal - principalPaid,
            outstandingInterestAfter: totalOutstandingInterest - interestPaid
        });

        // Update loan
        loan.totalAmountPaid += amount;
        loan.totalInterestEarned += interestPaid;
        loan.outstandingPrincipal -= principalPaid;
        loan.totalPayments += 1;
        loan.lastPaymentDate = paymentDate;
        loan.updateOutstanding();

        // Check if loan is fully paid
        if (loan.outstandingPrincipal <= 0 && loan.outstandingInterest <= 0) {
            loan.status = 'closed';
            loan.closedDate = new Date(paymentDate);

            // Update customer active loans
            const customer = await Customer.findById(loan.customer._id);
            if (customer) {
                customer.activeLoans = Math.max(0, customer.activeLoans - 1);
                customer.totalAmountRepaid += amount;
                await customer.save();
            }
        }

        await loan.save();

        // Update customer total repaid
        const customer = await Customer.findById(loan.customer._id);
        if (customer && loan.status !== 'closed') {
            customer.totalAmountRepaid += amount;
            await customer.save();
        }

        res.status(201).json({
            success: true,
            message: 'Payment recorded successfully',
            data: {
                payment,
                loan: {
                    loanId: loan.loanId,
                    outstandingPrincipal: loan.outstandingPrincipal,
                    outstandingInterest: loan.outstandingInterest,
                    status: loan.status
                }
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error creating payment',
            error: error.message
        });
    }
};

/**
 * @desc    Update payment
 * @route   PUT /api/payments/:id
 * @access  Public
 */
const updatePayment = async (req, res) => {
    try {
        const payment = await Payment.findById(req.params.id);

        if (!payment) {
            return res.status(404).json({
                success: false,
                message: 'Payment not found'
            });
        }

        const updatedPayment = await Payment.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );

        res.status(200).json({
            success: true,
            message: 'Payment updated successfully',
            data: updatedPayment
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating payment',
            error: error.message
        });
    }
};

/**
 * @desc    Delete payment
 * @route   DELETE /api/payments/:id
 * @access  Public
 */
const deletePayment = async (req, res) => {
    try {
        const payment = await Payment.findById(req.params.id);

        if (!payment) {
            return res.status(404).json({
                success: false,
                message: 'Payment not found'
            });
        }

        // Reverse the payment effects on loan
        const loan = await Loan.findById(payment.loan);
        if (loan) {
            loan.totalAmountPaid -= payment.amount;
            loan.totalInterestEarned -= payment.interestPaid;
            loan.outstandingPrincipal += payment.principalPaid;
            loan.totalPayments = Math.max(0, loan.totalPayments - 1);

            if (loan.status === 'closed') {
                loan.status = 'active';
                loan.closedDate = null;

                // Update customer active loans
                const customer = await Customer.findById(loan.customer);
                if (customer) {
                    customer.activeLoans += 1;
                    await customer.save();
                }
            }

            await loan.save();
        }

        await payment.deleteOne();

        res.status(200).json({
            success: true,
            message: 'Payment deleted successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error deleting payment',
            error: error.message
        });
    }
};

/**
 * @desc    Get payment statistics
 * @route   GET /api/payments/stats/overview
 * @access  Public
 */
const getPaymentStats = async (req, res) => {
    try {
        const totalPayments = await Payment.countDocuments();
        const completedPayments = await Payment.countDocuments({ status: 'completed' });
        const pendingPayments = await Payment.countDocuments({ status: 'pending' });

        const allPayments = await Payment.find({ status: 'completed' });

        let totalAmountReceived = 0;
        let totalPrincipalReceived = 0;
        let totalInterestReceived = 0;

        allPayments.forEach(payment => {
            totalAmountReceived += payment.amount;
            totalPrincipalReceived += payment.principalPaid;
            totalInterestReceived += payment.interestPaid;
        });

        // Get today's payments
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayPayments = await Payment.find({
            paymentDate: { $gte: today },
            status: 'completed'
        });

        let todayAmount = 0;
        todayPayments.forEach(payment => {
            todayAmount += payment.amount;
        });

        res.status(200).json({
            success: true,
            data: {
                totalPayments,
                completedPayments,
                pendingPayments,
                totalAmountReceived,
                totalPrincipalReceived,
                totalInterestReceived,
                todayPayments: todayPayments.length,
                todayAmount
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching payment statistics',
            error: error.message
        });
    }
};

module.exports = {
    getAllPayments,
    getPayment,
    createPayment,
    updatePayment,
    deletePayment,
    getPaymentStats
};
