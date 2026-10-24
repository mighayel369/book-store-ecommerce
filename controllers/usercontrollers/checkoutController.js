
const usermodel = require('../../models/userdetails');
const mongoose = require('mongoose');
const order = require('../../models/order');
const addressmodel = require('../../models/address');
const coupon = require('../../models/coupon');
const Razorpay = require('razorpay');
const dotenv = require('dotenv');
const logger = require('../../config/logger');

dotenv.config();

const instance = new Razorpay({
    key_id: process.env.RAZORPAY_KEYID,
    key_secret: process.env.RAZORPAY_KEYSECRET
});

module.exports = {
    getCheckout: async (req, res) => {
        try {
            if (!req.session.userId) {
                return res.redirect('/login');
            }

            const { search = '' } = req.query;
            const userId = req.session.userId;

            const id = new mongoose.Types.ObjectId(`${userId}`);

            const cartData = await usermodel.aggregate([
                { $match: { _id: id } },
                { $unwind: '$cart' },
                {
                    $lookup: {
                        from: 'productdetails',
                        localField: 'cart.productId',
                        foreignField: '_id',
                        as: 'productData'
                    }
                },
                { $unwind: '$productData' },
                {
                    $lookup: {
                        from: 'categorydetails',
                        localField: 'productData.productcategory',
                        foreignField: '_id',
                        as: 'categoryData'
                    }
                },
                { $unwind: '$categoryData' },
                {
                    $project: {
                        _id: 0,
                        image: '$productData.image',
                        productId: '$productData._id',
                        productname: '$productData.productname',
                        productprice: '$productData.productprice',
                        categoryname: '$categoryData.categoryname',
                        quantity: '$cart.quantity',
                        offer: '$categoryData.offer',
                        discountPrice: '$productData.discountPrice',
                        productoffer: '$productData.offer',
                        discountSource: '$productData.discountSource'
                    }
                }
            ]);

            const users = await usermodel.findById(userId).populate('address');

            if (!users) {
                return res.redirect('/login');
            }

            let subtotal = 0;

            cartData.forEach(item => {
                const productOfferActive =
                    item.productoffer?.isOfferActive === true;

                const categoryOfferActive =
                    item.offer?.isOfferActive === true;

                const unitPrice =
                    productOfferActive || categoryOfferActive
                        ? Number(item.discountPrice)
                        : Number(item.productprice);

                subtotal += unitPrice * item.quantity;
            });

            const deductedValue = Number(users.coupon?.deductedValue) || 0;
            const finalTotal = Math.max(0, subtotal - deductedValue);

            const coupons = await coupon.find({
                isActive: true,
                $or: [
                    { minimumPurchaseAmount: 0 },
                    { minimumPurchaseAmount: { $lte: subtotal } }
                ]
            });

            return res.render('users/checkout', {
                users,
                cartData,
                search,
                coupons,
                finalTotal,
                deductedValue
            });

        } catch (error) {
            logger.error('Failed to load checkout page', {
                userId: req.session.userId,
                error: error.message,
                stack: error.stack
            });

            return res.status(500).send(
                'An error occurred during checkout'
            );
        }
    },

    updateDefaultAddress: async (req, res) => {
        try {
            if (!req.session.userId) {
                return res.redirect('/login');
            }

            const selectedAddressId = req.body.selectedAddress;
            const user = await usermodel.findById(req.session.userId);

            if (!user) {
                return res.redirect('/login');
            }

            if (
                !selectedAddressId ||
                !mongoose.isValidObjectId(selectedAddressId)
            ) {
                return res.status(400).send('Invalid address');
            }

            if (!user.address.some(
                addressId => addressId.toString() === selectedAddressId
            )) {
                return res.status(403).send('Address does not belong to user');
            }

            await addressmodel.updateMany(
                { _id: { $in: user.address } },
                { $set: { default: false } }
            );

            await addressmodel.updateOne(
                { _id: selectedAddressId },
                { $set: { default: true } }
            );

            logger.info('Default delivery address updated', {
                userId: req.session.userId.toString(),
                addressId: selectedAddressId
            });

            return res.redirect('/checkout');

        } catch (error) {
            logger.error('Failed to update default address', {
                userId: req.session.userId,
                error: error.message,
                stack: error.stack
            });

            return res.status(500).send('Failed to update address');
        }
    },

    placeOrder: async (req, res) => {
        try {
            if (!req.session.userId) {
                return res.status(401).json({
                    message: 'Please log in to place an order'
                });
            }

            const { paymentMethod } = req.body;

            if (!['cod', 'wallet', 'online'].includes(
                String(paymentMethod).toLowerCase()
            )) {
                return res.status(400).json({
                    message: 'Invalid payment method'
                });
            }

            const users = await usermodel.findById(req.session.userId)
                .populate('address')
                .populate('cart.productId');

            if (!users) {
                return res.status(404).json({
                    message: 'User not found'
                });
            }

            if (!users.cart || users.cart.length === 0) {
                return res.status(400).json({
                    message: 'Your cart is empty'
                });
            }

            const defaultAddress = users.address.find(
                address => address.default
            );

            if (!defaultAddress) {
                return res.status(400).json({
                    message: 'Default address not found'
                });
            }

            let subtotal = 0;
            const Products = [];

            for (const cartItem of users.cart) {
                const Product = cartItem.productId;

                if (!Product) {
                    return res.status(400).json({
                        message: 'A product in your cart no longer exists'
                    });
                }

                const quantity = Number(cartItem.quantity);

                if (
                    !Number.isInteger(quantity) ||
                    quantity < 1 ||
                    quantity > 4
                ) {
                    return res.status(400).json({
                        message: 'Invalid product quantity'
                    });
                }

                if (Product.stockqty < quantity) {
                    return res.status(409).json({
                        message: `Insufficient stock for ${Product.productname}`
                    });
                }

                const productOfferActive =
                    Product.offer?.isOfferActive === true;

                const category = await mongoose.model('categorydetails')
                    .findById(Product.productcategory)
                    .select('offer');

                const categoryOfferActive =
                    category?.offer?.isOfferActive === true;

                const unitPrice =
                    productOfferActive || categoryOfferActive
                        ? Number(Product.discountPrice)
                        : Number(Product.productprice);

                if (!Number.isFinite(unitPrice) || unitPrice < 0) {
                    return res.status(400).json({
                        message: `Invalid price for ${Product.productname}`
                    });
                }

                subtotal += unitPrice * quantity;

                Products.push({
                    productId: Product._id,
                    productName: Product.productname,
                    quantity,
                    productprice: Product.productprice,
                    discountPrice: unitPrice
                });
            }

            const couponId = users.coupon?.couponId;
            let deductedValue = 0;
            let couponDetails = null;

            if (couponId) {
                couponDetails = await coupon.findById(couponId);

                if (
                    !couponDetails ||
                    couponDetails.isActive !== true
                ) {
                    return res.status(400).json({
                        message: 'The applied coupon is no longer valid'
                    });
                }

                if (subtotal < (couponDetails.minimumPurchaseAmount || 0)) {
                    return res.status(400).json({
                        message: 'Order does not meet the coupon minimum'
                    });
                }

                deductedValue = Math.max(
                    0,
                    Number(users.coupon.deductedValue) || 0
                );

                deductedValue = Math.min(deductedValue, subtotal);
            }

            const finalTotal = Math.max(0, subtotal - deductedValue);
            const method = String(paymentMethod).toLowerCase();

            if (method === 'cod' && finalTotal >= 1000) {
                return res.status(400).json({
                    message: 'COD is not available for orders of ₹1,000 or more'
                });
            }

            if (
                method === 'wallet' &&
                Number(users.wallet?.balance || 0) < finalTotal
            ) {
                return res.status(400).json({
                    message: 'Insufficient amount in wallet'
                });
            }

            let razorpayOrder = null;

            if (method === 'online') {
                razorpayOrder = await instance.orders.create({
                    amount: Math.round(finalTotal * 100),
                    currency: 'INR',
                    receipt: generateUniqueReceipt()
                });
            }

            const deliveryDate = new Date();
            deliveryDate.setDate(deliveryDate.getDate() + 7);

            const ordered = await order.create({
                orderId: generateOrderId(),
                userId: users._id,
                paymentMethod:
                    method === 'cod'
                        ? 'Cod'
                        : method === 'wallet'
                            ? 'Wallet'
                            : 'Online',
                deliveryExpected: deliveryDate,
                totalAmount: subtotal,
                finalPrice: finalTotal,
                shippingAddress: defaultAddress._id,
                products: Products,
                paymentStatus: method === 'wallet' ? 'Completed' : 'Pending'
            });

            if (method === 'wallet') {
                users.wallet.balance -= finalTotal;

                users.wallet.transactions.push({
                    amount: finalTotal,
                    transactionType: 'debit',
                    description: `${finalTotal} debited from wallet`
                });
            }

            for (const cartItem of users.cart) {
                const Product = cartItem.productId;

                const stockUpdate = await mongoose.model('productdetails')
                    .updateOne(
                        {
                            _id: Product._id,
                            stockqty: { $gte: cartItem.quantity }
                        },
                        {
                            $inc: {
                                stockqty: -cartItem.quantity,
                                popularityScore: cartItem.quantity
                            }
                        }
                    );

                if (stockUpdate.modifiedCount !== 1) {
                    logger.warn('Stock changed while placing order', {
                        orderId: ordered._id.toString(),
                        productId: Product._id.toString()
                    });

                    await order.findByIdAndDelete(ordered._id);

                    return res.status(409).json({
                        message: `Stock is no longer available for ${Product.productname}. Please try again.`
                    });
                }
            }

            if (couponDetails) {
                await updateCoupon(couponDetails, users);
            }

            users.cart = [];
            users.coupon = {};

            await users.save();

            logger.info('Order created successfully', {
                orderId: ordered._id.toString(),
                userId: users._id.toString(),
                paymentMethod: ordered.paymentMethod,
                total: finalTotal
            });

            if (method === 'online') {
                return res.status(200).json({
                    message: 'Razorpay order created',
                    razorpayOrderId: razorpayOrder.id,
                    amount: finalTotal,
                    currency: 'INR',
                    totalPrice: subtotal,
                    finalPrice: finalTotal,
                    orderId: ordered._id
                });
            }

            return res.status(200).json({
                message: 'success',
                orderId: ordered._id
            });

        } catch (error) {
            logger.error('Failed to place order', {
                userId: req.session.userId,
                paymentMethod: req.body.paymentMethod,
                error: error.message,
                stack: error.stack
            });

            return res.status(500).json({
                message: 'Internal Server Error'
            });
        }
    },

    applyCoupon: async (req, res) => {
        try {
            if (!req.session.userId) {
                return res.redirect('/login');
            }

            const couponId = req.params.id;
            const user = await usermodel.findById(req.session.userId)
                .populate('cart.productId');

            if (!user) {
                return res.redirect('/login');
            }

            if (!user.cart || user.cart.length === 0) {
                return res.status(400).send('Your cart is empty');
            }

            const newCouponDetails = await coupon.findById(couponId);

            if (!newCouponDetails || !newCouponDetails.isActive) {
                return res.status(400).send('Invalid or inactive coupon');
            }

            let cartTotal = 0;

            for (const item of user.cart) {
                if (!item.productId) continue;

                const Product = item.productId;

                const productOfferActive =
                    Product.offer?.isOfferActive === true;

                const category = await mongoose.model('categorydetails')
                    .findById(Product.productcategory)
                    .select('offer');

                const categoryOfferActive =
                    category?.offer?.isOfferActive === true;

                const unitPrice =
                    productOfferActive || categoryOfferActive
                        ? Number(Product.discountPrice)
                        : Number(Product.productprice);

                cartTotal += unitPrice * item.quantity;
            }

            if (cartTotal < (newCouponDetails.minimumPurchaseAmount || 0)) {
                return res.status(400).send(
                    'Your cart does not meet the coupon minimum purchase amount'
                );
            }

            let deductedValue = 0;

            if (newCouponDetails.discountType === 'percentage') {
                deductedValue =
                    cartTotal * (newCouponDetails.discountValue / 100);
            } else if (newCouponDetails.discountType === 'fixed') {
                deductedValue = Number(newCouponDetails.discountValue) || 0;
            }

            deductedValue = Math.min(
                Math.max(0, deductedValue),
                cartTotal
            );

            const discountedTotal = cartTotal - deductedValue;

            user.coupon = {
                couponId: newCouponDetails._id,
                discountTotal: discountedTotal,
                deductedValue
            };

            await user.save();

            req.session.message = {
                type: 'success',
                message: 'Coupon applied successfully'
            };

            logger.info('Coupon applied to cart', {
                userId: user._id.toString(),
                couponId: newCouponDetails._id.toString(),
                deductedValue
            });

            return res.redirect('/checkout');

        } catch (error) {
            logger.error('Failed to apply coupon', {
                userId: req.session.userId,
                couponId: req.params.id,
                error: error.message,
                stack: error.stack
            });

            return res.status(500).send(
                'An error occurred while applying the coupon'
            );
        }
    },

    removeCoupon: async (req, res) => {
        if (!req.session.userId) {
            return res.redirect('/login');
        }

        try {
            const user = await usermodel.findById(req.session.userId);

            if (!user) {
                return res.redirect('/login');
            }

            if (user.coupon && Object.keys(user.coupon.toObject?.() || user.coupon).length > 0) {
                user.coupon = {};
                await user.save();
            }

            logger.info('Coupon removed from cart', {
                userId: user._id.toString()
            });

            return res.redirect('/checkout');

        } catch (error) {
            logger.error('Failed to remove coupon', {
                userId: req.session.userId,
                error: error.message,
                stack: error.stack
            });

            return res.status(500).json({
                message: 'An error occurred while removing the coupon'
            });
        }
    }
};

async function updateCoupon(couponDetails, users) {
    if (!couponDetails) return;

    couponDetails.usageLimit += 1;

    const checkUser = couponDetails.userUsage.find(
        item => item.userId.toString() === users._id.toString()
    );

    if (checkUser) {
        checkUser.usageCount += 1;
    } else {
        couponDetails.userUsage.push({
            userId: users._id,
            usageCount: 1
        });
    }

    await couponDetails.save();
}

function generateUniqueReceipt() {
    return `rcpt_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}

function generateOrderId() {
    return 'ORD' + Math.floor(Math.random() * 10000000000);
}
