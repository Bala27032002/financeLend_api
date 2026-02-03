const Customer = require('../models/Customer');
const Loan = require('../models/Loan');
const { generateCustomerId } = require('../utils/helpers');

/**
 * @desc    Get all customers
 * @route   GET /api/customers
 * @access  Public
 */
const getAllCustomers = async (req, res) => {
    try {
        const { status, search, page = 1, limit = 10 } = req.query;

        const query = {};

        if (status) {
            query.status = status;
        }

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { phone: { $regex: search, $options: 'i' } },
                { customerId: { $regex: search, $options: 'i' } }
            ];
        }

        const skip = (page - 1) * limit;

        const customers = await Customer.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Customer.countDocuments(query);

        res.status(200).json({
            success: true,
            count: customers.length,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / limit),
            data: customers
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching customers',
            error: error.message
        });
    }
};

/**
 * @desc    Get single customer
 * @route   GET /api/customers/:id
 * @access  Public
 */
const getCustomer = async (req, res) => {
    try {
        const customer = await Customer.findById(req.params.id);

        if (!customer) {
            return res.status(404).json({
                success: false,
                message: 'Customer not found'
            });
        }

        // Get customer's loans
        const loans = await Loan.find({ customer: customer._id }).sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            data: {
                customer,
                loans
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching customer',
            error: error.message
        });
    }
};

/**
 * @desc    Create new customer
 * @route   POST /api/customers
 * @access  Public
 */
const createCustomer = async (req, res) => {
    try {
        const { name, phone, email, address, aadharNumber, panNumber } = req.body;

        // Check if customer with same phone already exists
        const existingCustomer = await Customer.findOne({ phone });
        if (existingCustomer) {
            return res.status(400).json({
                success: false,
                message: 'Customer with this phone number already exists'
            });
        }

        // Generate customer ID
        const lastCustomer = await Customer.findOne().sort({ createdAt: -1 });
        const sequenceNumber = lastCustomer ? parseInt(lastCustomer.customerId.split('-')[1]) + 1 : 1;
        const customerId = generateCustomerId(sequenceNumber);

        const customer = await Customer.create({
            customerId,
            name,
            phone,
            email,
            address,
            aadharNumber,
            panNumber
        });

        res.status(201).json({
            success: true,
            message: 'Customer created successfully',
            data: customer
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error creating customer',
            error: error.message
        });
    }
};

/**
 * @desc    Update customer
 * @route   PUT /api/customers/:id
 * @access  Public
 */
const updateCustomer = async (req, res) => {
    try {
        const customer = await Customer.findById(req.params.id);

        if (!customer) {
            return res.status(404).json({
                success: false,
                message: 'Customer not found'
            });
        }

        const updatedCustomer = await Customer.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );

        res.status(200).json({
            success: true,
            message: 'Customer updated successfully',
            data: updatedCustomer
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating customer',
            error: error.message
        });
    }
};

/**
 * @desc    Delete customer
 * @route   DELETE /api/customers/:id
 * @access  Public
 */
const deleteCustomer = async (req, res) => {
    try {
        const customer = await Customer.findById(req.params.id);

        if (!customer) {
            return res.status(404).json({
                success: false,
                message: 'Customer not found'
            });
        }

        // Check if customer has active loans
        const activeLoans = await Loan.countDocuments({
            customer: customer._id,
            status: 'active'
        });

        if (activeLoans > 0) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete customer with active loans'
            });
        }

        await customer.deleteOne();

        res.status(200).json({
            success: true,
            message: 'Customer deleted successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error deleting customer',
            error: error.message
        });
    }
};

/**
 * @desc    Get customer statistics
 * @route   GET /api/customers/stats/overview
 * @access  Public
 */
const getCustomerStats = async (req, res) => {
    try {
        const totalCustomers = await Customer.countDocuments();
        const activeCustomers = await Customer.countDocuments({ status: 'active' });
        const inactiveCustomers = await Customer.countDocuments({ status: 'inactive' });
        const blockedCustomers = await Customer.countDocuments({ status: 'blocked' });

        const customersWithActiveLoans = await Customer.countDocuments({ activeLoans: { $gt: 0 } });

        res.status(200).json({
            success: true,
            data: {
                totalCustomers,
                activeCustomers,
                inactiveCustomers,
                blockedCustomers,
                customersWithActiveLoans
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching customer statistics',
            error: error.message
        });
    }
};

module.exports = {
    getAllCustomers,
    getCustomer,
    createCustomer,
    updateCustomer,
    deleteCustomer,
    getCustomerStats
};
