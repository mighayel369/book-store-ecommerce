
const usermodel = require('../../models/userdetails');
const mongoose = require('mongoose');
const order = require('../../models/order');
const addressmodel = require('../../models/address');
const productmodel = require('../../models/productdetails');
const bcrypt = require('bcrypt');
const { check, validationResult } = require('express-validator');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const logger = require('../../config/logger');

const instance = new Razorpay({
  key_id: process.env.RAZORPAY_KEYID,
  key_secret: process.env.RAZORPAY_KEYSECRET
});

module.exports = {
  getAccount: async (req, res) => {
    if (!req.session.userId) {
      return res.redirect('/login');
    }

    try {
      const { search = '', page = 1, limit = 5 } = req.query;
      const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
      const limitNumber = Math.min(
        Math.max(parseInt(limit, 10) || 5, 1),
        50
      );
      const skip = (pageNumber - 1) * limitNumber;

      const query = { userId: req.session.userId };

      if (search.trim()) {
        query['products.productName'] = {
          $regex: search.trim(),
          $options: 'i'
        };
      }

      const [orders, count, users] = await Promise.all([
        order.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNumber)
          .exec(),
        order.countDocuments(query),
        usermodel.findById(req.session.userId)
      ]);

      const totalPages = Math.ceil(count / limitNumber);

      if (req.xhr) {
        return res.json({
          orders,
          totalPages,
          currentPage: pageNumber,
          limit: limitNumber
        });
      }

      return res.render('users/account-orders', {
        users,
        orders,
        search,
        currentPage: pageNumber,
        totalPages,
        limit: limitNumber
      });
    } catch (error) {
      logger.error('Failed to fetch account orders', {
        userId: req.session.userId,
        error: error.message,
        stack: error.stack
      });

      return res.status(500).send('Unable to load orders');
    }
  },

  getAddress: async (req, res) => {
    if (!req.session.userId) {
      return res.redirect('/login');
    }

    try {
      const { search = '' } = req.query;
      const users = await usermodel
        .findById(req.session.userId)
        .populate('address');

      if (!users) {
        return res.redirect('/login');
      }

      return res.render('users/account-address', { users, search });
    } catch (error) {
      logger.error('Failed to fetch user addresses', {
        userId: req.session.userId,
        error: error.message,
        stack: error.stack
      });

      return res.status(500).send('Unable to load addresses');
    }
  },

  addAddress: async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.redirect('/login');
      }

      const {
        fullname, phoneno, houseno, area,
        landmark, town, state, pincode
      } = req.body;

      const isDefault = Boolean(req.body.default);
      const user = await usermodel.findById(req.session.userId);

      if (!user) {
        return res.redirect('/login');
      }

      const newAddress = new addressmodel({
        fullname,
        phoneno,
        houseno,
        area,
        landmark,
        town,
        state,
        pincode,
        default: isDefault
      });

      await newAddress.save();

      try {
        if (isDefault) {
          await addressmodel.updateMany(
            { _id: { $in: user.address } },
            { $set: { default: false } }
          );
        }

        await usermodel.updateOne(
          { _id: user._id },
          { $addToSet: { address: newAddress._id } }
        );
      } catch (error) {
        await addressmodel.findByIdAndDelete(newAddress._id);
        throw error;
      }

      req.session.message = {
        type: 'success',
        message: 'Address added successfully'
      };

      if (req.headers.referer?.includes('/checkout')) {
        return res.redirect('/checkout');
      }

      return res.redirect('/accountaddress');
    } catch (error) {
      logger.error('Failed to add address', {
        userId: req.session.userId,
        error: error.message,
        stack: error.stack
      });

      req.session.message = {
        type: 'danger',
        message: 'Unable to add address'
      };

      return res.redirect(
        req.headers.referer?.includes('/checkout')
          ? '/checkout'
          : '/accountaddress'
      );
    }
  },

  deleteAddress: async (req, res) => {
    try {
      const userId = req.session.userId;

      if (!userId) {
        return res.redirect('/login');
      }

      const addressId = req.params.id;

      if (!mongoose.Types.ObjectId.isValid(addressId)) {
        return res.status(400).send('Invalid address ID');
      }

      const user = await usermodel.findOneAndUpdate(
        { _id: userId, address: addressId },
        { $pull: { address: addressId } }
      );

      if (!user) {
        return res.status(404).send('Address not found');
      }

      await addressmodel.findByIdAndDelete(addressId);

      req.session.message = {
        type: 'success',
        message: 'Address deleted successfully'
      };

      if (req.headers.referer?.includes('/checkout')) {
        return res.redirect('/checkout');
      }

      return res.redirect('/accountaddress');
    } catch (error) {
      logger.error('Failed to delete address', {
        userId: req.session.userId,
        addressId: req.params.id,
        error: error.message,
        stack: error.stack
      });

      return res.status(500).send('Unable to delete address');
    }
  },

  editAddress: async (req, res) => {
    try {
      const userId = req.session.userId;

      if (!userId) {
        return res.redirect('/login');
      }

      const addressId = req.params.id;

      if (!mongoose.Types.ObjectId.isValid(addressId)) {
        return res.status(400).send('Invalid address ID');
      }

      const user = await usermodel.findOne({
        _id: userId,
        address: addressId
      });

      if (!user) {
        return res.status(404).send('Address not found');
      }

      const {
        fullname, phoneno, houseno, area,
        landmark, town, state, pincode
      } = req.body;

      const isDefault = Boolean(req.body.default);

      const updatedAddress = {
        fullname,
        phoneno,
        houseno,
        area,
        landmark,
        town,
        state,
        pincode,
        default: isDefault
      };

      if (isDefault) {
        await addressmodel.updateMany(
          { _id: { $in: user.address } },
          { $set: { default: false } }
        );
      }

      await addressmodel.findOneAndUpdate(
        { _id: addressId },
        { $set: updatedAddress },
        { runValidators: true }
      );

      req.session.message = {
        type: 'success',
        message: 'Address updated successfully'
      };

      if (req.headers.referer?.includes('/checkout')) {
        return res.redirect('/checkout');
      }

      return res.redirect('/accountaddress');
    } catch (error) {
      logger.error('Failed to update address', {
        userId: req.session.userId,
        addressId: req.params.id,
        error: error.message,
        stack: error.stack
      });

      return res.status(500).send('Unable to update address');
    }
  },

  getSingleOrder: async (req, res) => {
    try {
      const orderId = req.params.id;

      if (!req.session.userId) {
        return res.redirect('/login');
      }

      if (!mongoose.Types.ObjectId.isValid(orderId)) {
        return res.status(400).send('Invalid order ID');
      }

      const { search = '' } = req.query;

      const users = await usermodel.findById(req.session.userId);

      if (!users) {
        return res.redirect('/login');
      }

      const orderDetails = await order.findOne({
        _id: orderId,
        userId: req.session.userId
      }).populate('shippingAddress');

      if (!orderDetails) {
        return res.status(404).send('Order not found');
      }

      return res.render('users/order-details', {
        users,
        orderDetails,
        search
      });
    } catch (error) {
      logger.error('Failed to fetch order details', {
        userId: req.session.userId,
        orderId: req.params.id,
        error: error.message,
        stack: error.stack
      });

      return res.status(500).send('Server error');
    }
  },

  getProfile: async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.redirect('/login');
      }

      const users = await usermodel.findById(req.session.userId);

      if (!users) {
        return res.redirect('/login');
      }

      const { search = '' } = req.query;

      return res.render('users/account-profile', { users, search });
    } catch (error) {
      logger.error('Failed to fetch user profile', {
        userId: req.session.userId,
        error: error.message,
        stack: error.stack
      });

      return res.status(500).send('Unable to load profile');
    }
  },

  editProfile: async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.redirect('/login');
      }

      const { username, email, phoneno } = req.body;
      const users = await usermodel.findById(req.session.userId);

      if (!users) {
        req.session.message = {
          type: 'danger',
          message: 'User not found'
        };

        return res.redirect('/login');
      }

      const userData = { username, email, phoneno };

      if (req.file) {
        if (users.photo) {
          try {
            await fs.unlink(
              path.join(process.cwd(), 'public', 'profilepictures', users.photo)
            );
          } catch (fileError) {
            if (fileError.code !== 'ENOENT') {
              logger.error('Failed to delete old profile picture', {
                userId: req.session.userId,
                error: fileError.message
              });
            }
          }
        }

        userData.photo = req.file.filename;
      }

      await usermodel.findByIdAndUpdate(
        req.session.userId,
        { $set: userData },
        { runValidators: true }
      );

      req.session.message = {
        type: 'success',
        message: 'Profile updated successfully'
      };

      return res.redirect('/profile');
    } catch (error) {
      logger.error('Failed to update user profile', {
        userId: req.session.userId,
        error: error.message,
        stack: error.stack
      });

      req.session.message = {
        type: 'danger',
        message: 'Unable to update profile'
      };

      return res.redirect('/profile');
    }
  },

  changePassword: async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.redirect('/login');
      }

      const users = await usermodel.findById(req.session.userId);

      if (!users) {
        return res.redirect('/login');
      }

      const { search = '' } = req.query;

      return res.render('users/account-changePassword', {
        users,
        search
      });
    } catch (error) {
      logger.error('Failed to load change-password page', {
        userId: req.session.userId,
        error: error.message,
        stack: error.stack
      });

      return res.status(500).send('Unable to load page');
    }
  },

  postChangePassword: [
    check('currentPassword')
      .notEmpty()
      .withMessage('Current password field is missing'),

    check('newPassword')
      .notEmpty()
      .withMessage('New password field is missing')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters long')
      .matches(/[!@#$%^&*(),.?":{}|<>]/)
      .withMessage('Password must contain at least one special character'),

    check('confirmPassword')
      .notEmpty()
      .withMessage('Confirm password field is missing'),

    async (req, res) => {
      try {
        if (!req.session.userId) {
          return res.status(401).json({
            message: 'User not authenticated'
          });
        }

        const errors = validationResult(req);

        if (!errors.isEmpty()) {
          return res.status(400).json({
            message: errors.array()[0].msg
          });
        }

        const { currentPassword, newPassword, confirmPassword } = req.body;
        const users = await usermodel.findById(req.session.userId);

        if (!users) {
          return res.status(404).json({ message: 'User not found' });
        }

        const passwordMatches = await bcrypt.compare(
          currentPassword,
          users.password
        );

        if (!passwordMatches) {
          return res.status(400).json({
            message: 'Current password is incorrect'
          });
        }

        if (newPassword !== confirmPassword) {
          return res.status(400).json({
            message: 'New password and confirm password do not match'
          });
        }

        if (newPassword === currentPassword) {
          return res.status(400).json({
            message: 'New password must be different from current password'
          });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        users.password = hashedPassword;
        await users.save();

        logger.info('User password updated successfully', {
          userId: req.session.userId
        });

        return res.status(200).json({
          message: 'Password updated successfully'
        });
      } catch (error) {
        logger.error('Failed to update user password', {
          userId: req.session.userId,
          error: error.message,
          stack: error.stack
        });

        return res.status(500).json({
          message: 'An error occurred while updating the password'
        });
      }
    }
  ],

  getWallet: async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.redirect('/login');
      }

      const { search = '', page = 1, limit = 5 } = req.query;
      const currentPage = Math.max(parseInt(page, 10) || 1, 1);
      const limitNumber = Math.min(
        Math.max(parseInt(limit, 10) || 5, 1),
        50
      );

      const users = await usermodel.findById(req.session.userId);

      if (!users) {
        return res.redirect('/login');
      }

      const transactions = [...(users.wallet?.transactions || [])].reverse();
      const skip = (currentPage - 1) * limitNumber;
      const transactionData = transactions.slice(skip, skip + limitNumber);
      const totalPages = Math.ceil(transactions.length / limitNumber);

      return res.render('users/account-wallet', {
        users,
        search,
        totalPages,
        currentPage,
        limit: limitNumber,
        transactionData
      });
    } catch (error) {
      logger.error('Failed to fetch user wallet', {
        userId: req.session.userId,
        error: error.message,
        stack: error.stack
      });

      return res.status(500).send('Unable to load wallet');
    }
  },

  clearHistory: async (req, res) => {
    try {
      const userId = req.session.userId;

      if (!userId) {
        return res.redirect('/login');
      }
      const users = await usermodel.findById(userId);

      if (!users) {
        return res.redirect('/login');
      }

      if (!users.wallet?.transactions?.length) {
        req.session.message = {
          message: 'No transaction data found',
          type: 'danger'
        };

        return res.redirect('/wallet');
      }

      users.wallet.transactions = [];
      await users.save();

      req.session.message = {
        message: 'Transaction history cleared successfully',
        type: 'success'
      };

      logger.info('User cleared their wallet transaction history', {
        userId
      });

      return res.redirect('/wallet');
    } catch (error) {
      logger.error('Failed to clear wallet history', {
        userId: req.session.userId,
        error: error.message,
        stack: error.stack
      });

      return res.status(500).send('Unable to clear transaction history');
    }
  },

  getWishlist: async (req, res) => {
    try {
      if (!req.session.userId) {
        req.session.message = {
          message: 'Please log in to view your wishlist',
          type: 'danger'
        };

        return res.redirect('/login');
      }

      const userId = req.session.userId;
      const {
        page = 1,
        limit = 9,
        search = ''
      } = req.query;

      const currentPage = Math.max(parseInt(page, 10) || 1, 1);
      const limitNumber = Math.min(
        Math.max(parseInt(limit, 10) || 9, 1),
        50
      );
      const skip = (currentPage - 1) * limitNumber;
      const cleanSearch = search.trim();

      const userObjectId = new mongoose.Types.ObjectId(userId);

      const pipeline = [
        { $match: { _id: userObjectId } },
        { $unwind: '$wishlist' },
        {
          $lookup: {
            from: 'productdetails',
            localField: 'wishlist',
            foreignField: '_id',
            as: 'wishlistproducts'
          }
        },
        { $unwind: '$wishlistproducts' },
        {
          $lookup: {
            from: 'categorydetails',
            localField: 'wishlistproducts.productcategory',
            foreignField: '_id',
            as: 'categorydata'
          }
        },
        { $unwind: '$categorydata' }
      ];

      if (cleanSearch) {
        pipeline.push({
          $match: {
            'wishlistproducts.productname': {
              $regex: cleanSearch,
              $options: 'i'
            }
          }
        });
      }

      const countPipeline = [
        ...pipeline,
        { $count: 'total' }
      ];

      const [countResult, users] = await Promise.all([
        usermodel.aggregate(countPipeline),
        usermodel.findById(userId)
      ]);

      if (!users) {
        return res.redirect('/login');
      }

      const totalProducts = countResult[0]?.total || 0;
      const totalPages = Math.ceil(totalProducts / limitNumber);

      const productlist = await usermodel.aggregate([
        ...pipeline,
        {
          $project: {
            _id: '$wishlistproducts._id',
            productname: '$wishlistproducts.productname',
            productcategory: '$wishlistproducts.productcategory',
            productprice: '$wishlistproducts.productprice',
            productoffer: '$wishlistproducts.offer',
            image: '$wishlistproducts.image',
            productdiscount: '$wishlistproducts.discountPrice',
            discountSource: '$wishlistproducts.discountSource',
            categoryoffer: '$categorydata.offer'
          }
        },
        { $skip: skip },
        { $limit: limitNumber }
      ]);

      if (req.xhr) {
        return res.status(200).json({
          users,
          productlist,
          totalPages,
          currentPage
        });
      }

      return res.render('users/wishlist', {
        search: cleanSearch,
        users,
        productlist,
        totalPages,
        limit: limitNumber,
        currentPage
      });
    } catch (error) {
      logger.error('Failed to fetch wishlist', {
        userId: req.session.userId,
        error: error.message,
        stack: error.stack
      });

      return res.status(500).send('Unable to load wishlist');
    }
  },

  postWishlist: async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({
          message: 'User not authenticated'
        });
      }

      const { productId } = req.body;

      if (!mongoose.Types.ObjectId.isValid(productId)) {
        return res.status(400).json({
          message: 'Invalid product ID'
        });
      }

      const [users, product] = await Promise.all([
        usermodel.findById(req.session.userId),
        productmodel.findById(productId)
      ]);

      if (!users) {
        return res.status(404).json({ message: 'User not found' });
      }

      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }

      const productExists = users.wishlist.some(
        item => item.toString() === productId.toString()
      );

      if (productExists) {
        users.wishlist.pull(productId);
        await users.save();

        return res.status(200).json({
          message: 'Product removed from wishlist successfully',
          isWishlisted: false
        });
      }

      users.wishlist.push(productId);
      await users.save();

      return res.status(200).json({
        message: 'Product added to wishlist successfully',
        isWishlisted: true
      });
    } catch (error) {
      logger.error('Failed to update wishlist', {
        userId: req.session.userId,
        productId: req.body.productId,
        error: error.message,
        stack: error.stack
      });

      return res.status(500).json({
        message: 'Something went wrong while updating the wishlist'
      });
    }
  },

  paynow: async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({
          message: 'User not authenticated'
        });
      }

      const { orderId } = req.body;

      if (!mongoose.Types.ObjectId.isValid(orderId)) {
        return res.status(400).json({ message: 'Invalid order ID' });
      }

      const orderData = await order.findOne({
        _id: orderId,
        userId: req.session.userId
      });

      if (!orderData) {
        return res.status(404).json({ message: 'Order not found' });
      }

      if (orderData.status === 'Canceled') {
        return res.status(400).json({
          message: 'The order is already canceled'
        });
      }

      if (orderData.paymentStatus === 'Completed') {
        return res.status(400).json({
          message: 'This order has already been paid'
        });
      }

      const activeProducts = orderData.products.filter(
        item => item.orderStatus !== 'Canceled'
      );

      if (!activeProducts.length) {
        return res.status(400).json({
          message: 'There are no active products to pay for'
        });
      }

      const hasCanceledProducts = orderData.products.some(
        item => item.orderStatus === 'Canceled'
      );

      if (hasCanceledProducts && orderData.finalPrice != null) {
        return res.status(400).json({
          message: 'Payment cannot be retried for a partially canceled order with a coupon applied'
        });
      }

      const updatedTotal = activeProducts.reduce((total, item) => {
        const unitPrice =
          item.discountPrice != null
            ? item.discountPrice
            : item.productprice;

        return total + unitPrice * item.quantity;
      }, 0);

      const priceToCheck =
        orderData.finalPrice != null
          ? orderData.finalPrice
          : updatedTotal;

      if (!Number.isFinite(priceToCheck) || priceToCheck <= 0) {
        return res.status(400).json({
          message: 'Invalid order amount'
        });
      }

      const amountInPaise = Math.round(priceToCheck * 100);

      const razorpayOrder = await instance.orders.create({
        amount: amountInPaise,
        currency: 'INR',
        receipt: generateUniqueReceipt()
      });

      orderData.razorpayOrderId = razorpayOrder.id;
      await orderData.save();

      return res.status(200).json({
        message: 'Razorpay order created',
        razorpayOrderId: razorpayOrder.id,
        amount: amountInPaise,
        currency: 'INR',
        orderId: orderData._id
      });
    } catch (error) {
      logger.error('Failed to create Razorpay order', {
        userId: req.session.userId,
        orderId: req.body.orderId,
        error: error.message,
        stack: error.stack
      });

      return res.status(500).json({
        message: 'Unable to initiate payment'
      });
    }
  },

  verifypayment: async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({
          message: 'User not authenticated'
        });
      }

      const {
        orderId,
        razorpay_payment_id,
        razorpay_order_id,
        razorpay_signature
      } = req.body;

      if (
        !mongoose.Types.ObjectId.isValid(orderId) ||
        !razorpay_payment_id ||
        !razorpay_order_id ||
        !razorpay_signature
      ) {
        return res.status(400).json({
          message: 'Missing or invalid payment details'
        });
      }

      const orderData = await order.findOne({
        _id: orderId,
        userId: req.session.userId
      });

      if (!orderData) {
        return res.status(404).json({ message: 'Order not found' });
      }

      if (orderData.razorpayOrderId !== razorpay_order_id) {
        logger.warn('Razorpay order ID mismatch', {
          userId: req.session.userId,
          orderId
        });

        return res.status(400).json({
          message: 'Payment order verification failed'
        });
      }

      if (orderData.paymentStatus === 'Completed') {
        return res.status(200).json({
          message: 'Payment already verified'
        });
      }

      const secret = process.env.RAZORPAY_KEYSECRET;

      if (!secret) {
        logger.error('Razorpay secret is not configured');

        return res.status(500).json({
          message: 'Payment verification is temporarily unavailable'
        });
      }

      const generatedSignature = crypto
        .createHmac('sha256', secret)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

      const received = Buffer.from(razorpay_signature, 'hex');
      const expected = Buffer.from(generatedSignature, 'hex');

      const signatureMatches =
        received.length === expected.length &&
        crypto.timingSafeEqual(received, expected);

      if (!signatureMatches) {
        logger.warn('Razorpay signature verification failed', {
          userId: req.session.userId,
          orderId
        });

        return res.status(400).json({
          message: 'Payment verification failed'
        });
      }

      const payment = await instance.payments.fetch(razorpay_payment_id);

      if (
        payment.order_id !== razorpay_order_id ||
        payment.status !== 'captured'
      ) {
        logger.warn('Razorpay payment is not captured or does not match', {
          orderId,
          paymentStatus: payment.status
        });

        return res.status(400).json({
          message: 'Payment has not been captured'
        });
      }

      const expectedAmount = orderData.finalPrice != null
        ? orderData.finalPrice
        : orderData.products
          .filter(item => item.orderStatus !== 'Canceled')
          .reduce((total, item) => {
            const unitPrice = item.discountPrice != null
              ? item.discountPrice
              : item.productprice;

            return total + unitPrice * item.quantity;
          }, 0);

      if (payment.amount !== Math.round(expectedAmount * 100)) {
        logger.warn('Razorpay payment amount mismatch', {
          orderId,
          expectedAmountInPaise: Math.round(expectedAmount * 100),
          receivedAmountInPaise: payment.amount
        });

        return res.status(400).json({
          message: 'Payment amount verification failed'
        });
      }

      orderData.paymentStatus = 'Completed';
      await orderData.save();

      logger.info('Razorpay payment verified successfully', {
        userId: req.session.userId,
        orderId
      });

      return res.status(200).json({
        message: 'Payment success',
        orderId: orderData._id
      });
    } catch (error) {
      logger.error('Failed to verify Razorpay payment', {
        userId: req.session.userId,
        orderId: req.body.orderId,
        error: error.message,
        stack: error.stack
      });

      return res.status(500).json({
        message: 'Unable to verify payment'
      });
    }
  }
};

function generateUniqueReceipt() {
  return `rcpt_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}
