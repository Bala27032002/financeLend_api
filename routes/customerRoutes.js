const express = require('express');
const {
    getAllCustomers,
    getCustomer,
    createCustomer,
    updateCustomer,
    deleteCustomer,
    getCustomerStats
} = require('../controllers/customerController');

const router = express.Router();

// Statistics route (must be before :id route)
router.get('/stats/overview', getCustomerStats);

// CRUD routes
router.route('/')
    .get(getAllCustomers)
    .post(createCustomer);

router.route('/:id')
    .get(getCustomer)
    .put(updateCustomer)
    .delete(deleteCustomer);

module.exports = router;
