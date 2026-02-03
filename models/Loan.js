const mongoose = require('mongoose');

const loanSchema = new mongoose.Schema({
    // Unique Loan ID as per image 2: 00-100 (sequence) - CUS NO - LOAN NO - LOAN TYPE
    loanId: {
        type: String,
        required: true,
        unique: true,
        trim: true
        // Format: "00-100-001-01-D" (sequence-cusNo-loanNo-loanType)
    },
    sequenceNumber: {
        type: Number,
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
    customerLoanNumber: {
        type: Number,
        required: true,
        default: 1
    },

    // Loan Details
    principalAmount: {
        type: Number,
        required: [true, 'Principal amount is required'],
        min: [0, 'Principal amount cannot be negative']
    },
    interestType: {
        type: String,
        enum: ['daily', 'monthly'],
        required: [true, 'Interest type is required']
    },
    interestRate: {
        type: Number,
        required: [true, 'Interest rate is required'],
        min: [0, 'Interest rate cannot be negative']
    },

    // Dates
    disbursementDate: {
        type: Date,
        required: [true, 'Disbursement date is required']
    },
    dueDate: {
        type: Date,
        required: [true, 'Due date is required']
    },
    closedDate: {
        type: Date
    },

    // Calculated Fields
    totalInterestEarned: {
        type: Number,
        default: 0
    },
    totalAmountPaid: {
        type: Number,
        default: 0
    },
    outstandingPrincipal: {
        type: Number,
        default: 0
    },
    outstandingInterest: {
        type: Number,
        default: 0
    },

    // Status
    status: {
        type: String,
        enum: ['active', 'closed', 'defaulted', 'written-off'],
        default: 'active'
    },

    // Profit/Loss Tracking
    profitLoss: {
        type: Number,
        default: 0
    },

    // Loan Type Code (D=Daily, M=Monthly)
    loanTypeCode: {
        type: String,
        enum: ['D', 'M'],
        required: true
    },

    // Payment tracking
    totalPayments: {
        type: Number,
        default: 0
    },
    lastPaymentDate: {
        type: Date
    },

    // Notes
    notes: {
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

// Indexes for performance
// loanId is already indexed due to unique: true constraint
loanSchema.index({ customer: 1 });
loanSchema.index({ customerId: 1 });
loanSchema.index({ status: 1 });
loanSchema.index({ disbursementDate: 1 });
loanSchema.index({ dueDate: 1 });

// Virtual for total outstanding
loanSchema.virtual('totalOutstanding').get(function () {
    return this.outstandingPrincipal + this.outstandingInterest;
});

// Method to calculate interest based on dates
loanSchema.methods.calculateInterest = function (asOfDate = new Date()) {
    const startDate = this.disbursementDate;
    const endDate = asOfDate > this.dueDate ? this.dueDate : asOfDate;

    if (endDate <= startDate) return 0;

    const timeDiff = endDate - startDate;

    if (this.interestType === 'daily') {
        const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
        return (this.outstandingPrincipal * this.interestRate * days) / 100;
    } else {
        // Monthly interest
        const months = timeDiff / (1000 * 60 * 60 * 24 * 30);
        return (this.outstandingPrincipal * this.interestRate * months) / 100;
    }
};

// Method to update outstanding amounts
loanSchema.methods.updateOutstanding = function () {
    this.outstandingPrincipal = this.principalAmount - this.totalAmountPaid;
    this.outstandingInterest = this.calculateInterest() - this.totalInterestEarned;
    this.profitLoss = this.totalInterestEarned - (this.status === 'written-off' ? this.outstandingPrincipal : 0);
};

// Pre-save middleware
loanSchema.pre('save', function (next) {
    if (this.isNew) {
        this.outstandingPrincipal = this.principalAmount;
        this.loanTypeCode = this.interestType === 'daily' ? 'D' : 'M';
    }
    next();
});

module.exports = mongoose.model('Loan', loanSchema);
