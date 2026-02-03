const express = require('express');
const {
    getAllLoans,
    getLoan,
    createLoan,
    updateLoan,
    closeLoan,
    getLoanStats,
    calculateLoanDetails
} = require('../controllers/loanController');

const router = express.Router();

// Statistics route (must be before :id route)
router.get('/stats/overview', getLoanStats);

// CRUD routes
router.route('/')
    .get(getAllLoans)
    .post(createLoan);

router.route('/:id')
    .get(getLoan)
    .put(updateLoan);

// Special routes
router.put('/:id/close', closeLoan);
router.post('/:id/calculate', calculateLoanDetails);

module.exports = router;
