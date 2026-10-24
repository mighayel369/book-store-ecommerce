
const usermodel = require('../../models/userdetails');
const mongoose = require('mongoose');
const product = require('../../models/productdetails');
const logger = require('../../config/logger');

module.exports = {
    getCart: async (req, res) => {
        if (!req.session.userId) {
            return res.redirect('/login');
        }

        try {
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
                        stock: '$productData.stockqty',
                        offer: '$productData.offer',
                        discountPrice: '$productData.discountPrice',
                        categoryOffer: '$categoryData.offer',
                        discountSource: '$productData.discountSource'
                    }
                }
            ]);

            const users = await usermodel.findById(userId);

            if (!users) {
                return res.redirect('/login');
            }

            return res.render('users/cart', {
                cartData,
                users,
                search
            });

        } catch (error) {
            logger.error('Failed to fetch cart', {
                userId: req.session.userId,
                error: error.message,
                stack: error.stack
            });

            return res.status(500).send('Failed to load cart');
        }
    },

    addToCart: async (req, res) => {
        try {
            if (!req.session.userId) {
                return res.status(401).json({
                    message: 'User not authenticated'
                });
            }

            const userId = req.session.userId;
            const productId = req.body.productId;

            if (!productId || !mongoose.isValidObjectId(productId)) {
                return res.status(400).json({
                    message: 'Invalid product ID'
                });
            }

            const users = await usermodel.findById(userId)
                .populate('cart.productId');

            if (!users) {
                return res.status(404).json({
                    message: 'User not found'
                });
            }

            const Product = await product.findById(productId);

            if (!Product) {
                return res.status(404).json({
                    message: 'Product not found'
                });
            }

            const productCart = users.cart.find(item =>
                item.productId &&
                item.productId._id.toString() === productId
            );

            if (Product.stockqty <= 0) {
                return res.status(409).json({
                    message: 'Out of stock'
                });
            }

            if (productCart) {
                if (productCart.quantity >= 4) {
                    return res.status(409).json({
                        message: 'Maximum quantity limit reached'
                    });
                }

                if (productCart.quantity >= Product.stockqty) {
                    return res.status(409).json({
                        message: 'Available stock limit reached'
                    });
                }

                productCart.quantity += 1;
                productCart.userStock = productCart.quantity;
            } else {
                users.cart.push({
                    productId: Product._id,
                    quantity: 1,
                    userStock: 1
                });
            }

            await users.save();

            logger.info('Product added to cart', {
                userId: userId.toString(),
                productId: Product._id.toString()
            });

            return res.status(200).json({
                message: 'Product added successfully'
            });

        } catch (error) {
            logger.error('Failed to add product to cart', {
                userId: req.session.userId,
                productId: req.body.productId,
                error: error.message,
                stack: error.stack
            });

            return res.status(500).json({
                message: 'Internal server error'
            });
        }
    },

    changeQuantity: async (req, res) => {
        try {
            if (!req.session.userId) {
                return res.status(401).json({
                    errorMessage: 'User not authenticated'
                });
            }

            const { productId } = req.body;
            const newQuantity = Number(req.body.newQuantity);

            if (
                !productId ||
                !mongoose.isValidObjectId(productId) ||
                !Number.isInteger(newQuantity)
            ) {
                return res.status(400).json({
                    errorMessage: 'Invalid product ID or quantity'
                });
            }

            if (newQuantity < 1 || newQuantity > 4) {
                return res.status(409).json({
                    errorMessage: 'Quantity must be between 1 and 4'
                });
            }

            const user = await usermodel.findById(req.session.userId)
                .populate('cart.productId');

            if (!user) {
                return res.status(404).json({
                    errorMessage: 'User not found'
                });
            }

            const cartProduct = user.cart.find(item =>
                item.productId &&
                item.productId._id.toString() === productId
            );

            if (!cartProduct) {
                return res.status(404).json({
                    errorMessage: 'Product not found in cart'
                });
            }

            const Product = await product.findById(productId)
                .populate('productcategory');

            if (!Product) {
                return res.status(404).json({
                    errorMessage: 'Product not found'
                });
            }

            if (Product.stockqty < newQuantity) {
                return res.status(409).json({
                    errorMessage: 'Out of stock'
                });
            }

            cartProduct.quantity = newQuantity;
            cartProduct.userStock = newQuantity;

            await user.save();

            const productOfferActive =
                Product.offer?.isOfferActive === true;

            const categoryOfferActive =
                Product.productcategory?.offer?.isOfferActive === true;

            const unitPrice =
                productOfferActive || categoryOfferActive
                    ? Number(Product.discountPrice)
                    : Number(Product.productprice);

            const subtotal = unitPrice * newQuantity;

            logger.info('Cart quantity updated', {
                userId: req.session.userId.toString(),
                productId,
                quantity: newQuantity
            });

            return res.status(200).json({ subtotal });

        } catch (error) {
            logger.error('Failed to change cart quantity', {
                userId: req.session.userId,
                productId: req.body.productId,
                error: error.message,
                stack: error.stack
            });

            return res.status(500).json({
                errorMessage: 'Internal Server Error'
            });
        }
    },

    deleteProduct: async (req, res) => {
        try {
            if (!req.session.userId) {
                return res.redirect('/login');
            }

            const productId = req.params.id;
            const userId = req.session.userId;

            if (!mongoose.isValidObjectId(productId)) {
                return res.status(400).send('Invalid product ID');
            }

            const user = await usermodel.findById(userId);

            if (!user) {
                return res.redirect('/login');
            }

            const cartItem = user.cart.find(item =>
                item.productId.toString() === productId
            );

            if (!cartItem) {
                logger.warn('Attempted to remove a product not in cart', {
                    userId: userId.toString(),
                    productId
                });

                return res.redirect('/cart');
            }

            await usermodel.findByIdAndUpdate(
                userId,
                {
                    $pull: {
                        cart: { productId: new mongoose.Types.ObjectId(productId) }
                    }
                }
            );

            logger.info('Product removed from cart', {
                userId: userId.toString(),
                productId
            });

            return res.redirect('/cart');

        } catch (error) {
            logger.error('Failed to delete product from cart', {
                userId: req.session.userId,
                productId: req.params.id,
                error: error.message,
                stack: error.stack
            });

            return res.status(500).send('Internal Server Error');
        }
    },

    getCartTotal: async (req, res) => {
        try {
            if (!req.session.userId) {
                return res.status(401).json({
                    message: 'User not authenticated'
                });
            }

            const user = await usermodel.findById(req.session.userId)
                .populate({
                    path: 'cart.productId',
                    populate: {
                        path: 'productcategory',
                        model: 'categorydetails'
                    }
                });

            if (!user) {
                return res.status(404).json({
                    message: 'User not found'
                });
            }

            let cartTotal = 0;

            for (const item of user.cart) {
                const Product = item.productId;

                if (!Product) {
                    continue;
                }

                const productOfferActive =
                    Product.offer?.isOfferActive === true;

                const categoryOfferActive =
                    Product.productcategory?.offer?.isOfferActive === true;

                const unitPrice =
                    productOfferActive || categoryOfferActive
                        ? Number(Product.discountPrice)
                        : Number(Product.productprice);

                cartTotal += unitPrice * item.quantity;
            }

            return res.json({ totalprice: cartTotal });

        } catch (error) {
            logger.error('Failed to calculate cart total', {
                userId: req.session.userId,
                error: error.message,
                stack: error.stack
            });

            return res.status(500).json({
                message: 'Failed to calculate cart total'
            });
        }
    }
};
