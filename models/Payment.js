const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    paymentId: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    loan: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Loan',
        required: true
    },
    loanId: {
        type: String,
        required: true
    },
    customer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
        required: true
    },
    customerId: {
        type: String,
        required: true
    },

    // Payment Details
    amount: {
        type: Number,
        required: [true, 'Payment amount is required'],
        min: [0, 'Payment amount cannot be negative']
    },
    principalPaid: {
        type: Number,
        default: 0
    },
    interestPaid: {
        type: Number,
        default: 0
    },

    // Payment Information
    paymentDate: {
        type: Date,
        required: [true, 'Payment date is required'],
        default: Date.now
    },
    paymentMethod: {
        type: String,
        enum: ['cash', 'bank_transfer', 'upi', 'cheque', 'other'],
        default: 'cash'
    },
    transactionReference: {
        type: String,
        trim: true
    },

    // Status
    status: {
        type: String,
        enum: ['completed', 'pending', 'failed', 'reversed'],
        default: 'completed'
    },

    // Outstanding after this payment
    outstandingPrincipalAfter: {
        type: Number,
        default: 0
    },
    outstandingInterestAfter: {
        type: Number,
        default: 0
    },

    // Notes
    notes: {
        type: String,
        trim: true
    },

    // Metadata
    receivedBy: {
        type: String,
        trim: true
    },

    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Indexes
// paymentId is already indexed due to unique: true constraint
paymentSchema.index({ loan: 1 });
paymentSchema.index({ loanId: 1 });
paymentSchema.index({ customer: 1 });
paymentSchema.index({ customerId: 1 });
paymentSchema.index({ paymentDate: 1 });
paymentSchema.index({ status: 1 });

module.exports = mongoose.model('Payment', paymentSchema);
