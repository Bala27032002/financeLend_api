const express = require('express');
const {
    getAllPayments,
    getPayment,
    createPayment,
    updatePayment,
    deletePayment,
    getPaymentStats
} = require('../controllers/paymentController');

const router = express.Router();

// Statistics route (must be before :id route)
router.get('/stats/overview', getPaymentStats);

// CRUD routes
router.route('/')
    .get(getAllPayments)
    .post(createPayment);

router.route('/:id')
    .get(getPayment)
    .put(updatePayment)
    .delete(deletePayment);

module.exports = router;
