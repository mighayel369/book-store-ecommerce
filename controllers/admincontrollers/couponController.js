
const logger = require('../../config/logger');
const coupon = require('../../models/coupon');
const { check, body, validationResult } = require('express-validator');


module.exports = {
    getCoupon: async (_req, res) => {
        try {
            const Coupons = await coupon.find();

            return res.render('admin/couponPage', { Coupons });
        } catch (error) {
            logger.error('Failed to fetch coupons', {
                error: error.message,
                stack: error.stack
            });

            return res.status(500).send('Internal Server Error');
        }
    },

    addCoupon: async (_req, res) => {
        try {
            return res.render('admin/addCoupon');
        } catch (error) {
            logger.error('Failed to render add coupon page', {
                error: error.message,
                stack: error.stack
            });

            return res.status(500).send('Internal Server Error');
        }
    },

    postAddCoupon: [
        check('coupontype')
            .notEmpty()
            .withMessage('Please select a coupon type'),

        body('discountvalue')
            .notEmpty()
            .withMessage('Please enter the discount value')
            .bail()
            .isFloat({ gt: 0 })
            .withMessage('Discount value must be greater than zero'),

        body('minamount')
            .notEmpty()
            .withMessage('Please enter the minimum purchase amount')
            .bail()
            .isFloat({ min: 0 })
            .withMessage('Minimum purchase amount cannot be negative'),

        body('description')
            .trim()
            .notEmpty()
            .withMessage('Please enter a description'),

        body('startdate')
            .notEmpty()
            .withMessage('Please select a start date')
            .bail()
            .isISO8601()
            .withMessage('Please enter a valid start date'),

        body('enddate')
            .notEmpty()
            .withMessage('Please select an end date')
            .bail()
            .isISO8601()
            .withMessage('Please enter a valid end date')
            .bail()
            .custom((value, { req }) => {
                if (
                    !req.body.startdate ||
                    !Number.isFinite(new Date(value).getTime()) ||
                    !Number.isFinite(new Date(req.body.startdate).getTime())
                ) {
                    return true;
                }

                if (new Date(value) < new Date(req.body.startdate)) {
                    throw new Error('End date cannot be earlier than start date');
                }

                return true;
            }),

        async (req, res) => {
            try {
                const errors = validationResult(req);

                if (!errors.isEmpty()) {
                    req.session.adminmessage = {
                        message: errors.array()[0].msg
                    };

                    return res.redirect('/admin/addcoupon');
                }

                const {
                    coupontype,
                    minamount,
                    description,
                    startdate,
                    enddate,
                    discountvalue
                } = req.body;

                const newCoupon = {
                    code: generateCouponCode(),
                    discountType: coupontype,
                    description: description.trim(),
                    discountValue: Number(discountvalue),
                    startDate: startdate,
                    endDate: enddate,
                    minimumPurchaseAmount: Number(minamount)
                };

                await coupon.create(newCoupon);

                req.session.adminmessage = {
                    type: 'success',
                    message: 'Coupon added successfully'
                };

                return res.redirect('/admin/coupon');
            } catch (error) {
                logger.error('Failed to create coupon', {
                    error: error.message,
                    stack: error.stack
                });

                req.session.adminmessage = {
                    type: 'error',
                    message: 'Unable to add coupon. Please try again.'
                };

                return res.redirect('/admin/addcoupon');
            }
        }
    ],

    getEditCoupon: async (req, res) => {
        try {
            const couponId = req.params.id;
            const Coupon = await coupon.findById(couponId);

            if (!Coupon) {
                return res.status(404).send('Coupon not found');
            }

            return res.render('admin/editCoupon', { Coupon });
        } catch (error) {
            logger.error('Failed to fetch coupon for editing', {
                couponId: req.params.id,
                error: error.message,
                stack: error.stack
            });

            return res.status(500).send('Internal Server Error');
        }
    },

    postEditCoupon: [
        body('couponcode')
            .trim()
            .notEmpty()
            .withMessage('Coupon code is required'),

        body('coupontype')
            .notEmpty()
            .withMessage('Please select a coupon type'),

        body('discountvalue')
            .notEmpty()
            .withMessage('Please enter the discount value')
            .bail()
            .isFloat({ gt: 0 })
            .withMessage('Discount value must be greater than zero'),

        body('minamount')
            .notEmpty()
            .withMessage('Please enter the minimum purchase amount')
            .bail()
            .isFloat({ min: 0 })
            .withMessage('Minimum purchase amount cannot be negative'),

        body('description')
            .trim()
            .notEmpty()
            .withMessage('Please enter a description'),

        body('startdate')
            .notEmpty()
            .withMessage('Please select a start date')
            .bail()
            .isISO8601()
            .withMessage('Please enter a valid start date'),

        body('enddate')
            .notEmpty()
            .withMessage('Please select an end date')
            .bail()
            .isISO8601()
            .withMessage('Please enter a valid end date')
            .bail()
            .custom((value, { req }) => {
                if (
                    !req.body.startdate ||
                    !Number.isFinite(new Date(value).getTime()) ||
                    !Number.isFinite(new Date(req.body.startdate).getTime())
                ) {
                    return true;
                }

                if (new Date(value) < new Date(req.body.startdate)) {
                    throw new Error('End date cannot be earlier than start date');
                }

                return true;
            }),

        async (req, res) => {
            try {
                const couponId = req.params.id;
                const errors = validationResult(req);

                if (!errors.isEmpty()) {
                    req.session.adminmessage = {
                        message: errors.array()[0].msg
                    };

                    return res.redirect(`/admin/editcoupon/${couponId}`);
                }

                const {
                    couponcode,
                    coupontype,
                    minamount,
                    description,
                    startdate,
                    enddate,
                    discountvalue
                } = req.body;

                const couponData = {
                    code: couponcode.trim(),
                    discountType: coupontype,
                    description: description.trim(),
                    discountValue: Number(discountvalue),
                    startDate: startdate,
                    endDate: enddate,
                    minimumPurchaseAmount: Number(minamount)
                };

                const updatedCoupon = await coupon.findByIdAndUpdate(
                    couponId,
                    { $set: couponData },
                    { new: true, runValidators: true }
                );

                if (!updatedCoupon) {
                    return res.status(404).send('Coupon not found');
                }

                req.session.adminmessage = {
                    type: 'success',
                    message: 'Coupon updated successfully'
                };

                return res.redirect('/admin/coupon');
            } catch (error) {
                logger.error('Failed to update coupon', {
                    couponId: req.params.id,
                    error: error.message,
                    stack: error.stack
                });

                req.session.adminmessage = {
                    type: 'error',
                    message: 'Unable to update coupon. Please try again.'
                };

                return res.redirect(`/admin/editcoupon/${req.params.id}`);
            }
        }
    ],

    deleteCoupon: async (req, res) => {
        try {
            const couponId = req.params.id;

            const deletedCoupon = await coupon.findByIdAndDelete(couponId);

            if (!deletedCoupon) {
                return res.status(404).json({
                    message: 'Coupon not found'
                });
            }

            req.session.adminmessage = {
                type: 'success',
                message: 'Coupon deleted successfully'
            };

            return res.redirect('/admin/coupon');
        } catch (error) {
            logger.error('Failed to delete coupon', {
                couponId: req.params.id,
                error: error.message,
                stack: error.stack
            });

            return res.status(500).send('Internal Server Error');
        }
    }
};

function generateCouponCode() {
    const characters = 'QWERTYUIOPASDFGHJKLZXCVBNM';
    let result = '';

    for (let i = 0; i < 4; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        result += characters[randomIndex];
    }

    const number = Math.floor(Math.random() * 1000);

    return result + number;
}
