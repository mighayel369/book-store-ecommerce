
const categorymodel = require('../../models/categorydetails');
const productmodel = require('../../models/productdetails');
const coupon = require('../../models/coupon');
const { deleteCloudinaryImage } = require('../../config/cloudinary');
const { validationResult, body } = require('express-validator');
const cron = require('node-cron');
const logger = require('../../config/logger');


function calculateDiscountPrice(price, discountType, discountValue) {
  let discountPrice;

  if (discountType === 'percentage') {
    discountPrice = price - (price * discountValue / 100);
  } else if (discountType === 'fixed') {
    discountPrice = price - discountValue;
  } else {
    throw new Error(`Unsupported discount type: ${discountType}`);
  }

  return Math.max(Number(discountPrice.toFixed(2)), 0);
}

function validateEndDate(value, { req }) {
  const startDate = new Date(req.body.startDate);
  const endDate = new Date(value);

  if (
    !req.body.startDate ||
    !Number.isFinite(startDate.getTime()) ||
    !Number.isFinite(endDate.getTime())
  ) {
    throw new Error('Please enter valid offer dates');
  }

  if (endDate < startDate) {
    throw new Error('End date cannot be earlier than start date');
  }

  return true;
}

cron.schedule('0 0 * * *', async () => {
  try {
    const currentDate = new Date();

    const expiredProducts = await productmodel.find({
      'offer.isOfferActive': true,
      'offer.endDate': { $lt: currentDate },
      discountSource: 'product'
    });

    for (const product of expiredProducts) {
      const category = await categorymodel.findOne({
        _id: product.productcategory,
        'offer.startDate': { $lte: currentDate },
        'offer.endDate': { $gte: currentDate }
      });

      if (category) {
        const discountPrice = calculateDiscountPrice(
          product.productprice,
          category.offer.discountType,
          category.offer.discountValue
        );

        await productmodel.updateOne(
          { _id: product._id },
          {
            $set: {
              discountPrice,
              discountSource: 'category'
            },
            $unset: {
              'offer.isOfferActive': 1
            }
          }
        );
      } else {
        await productmodel.updateOne(
          { _id: product._id },
          {
            $set: {
              discountPrice: null,
              discountSource: null,
              'offer.isOfferActive': false
            }
          }
        );
      }
    }

    const expiredCategories = await categorymodel.find({
      'offer.isOfferActive': true,
      'offer.endDate': { $lt: currentDate }
    });

    for (const category of expiredCategories) {
      await categorymodel.updateOne(
        { _id: category._id },
        { $set: { 'offer.isOfferActive': false } }
      );

      await productmodel.updateMany(
        {
          productcategory: category._id,
          discountSource: 'category'
        },
        {
          $set: {
            discountPrice: null,
            discountSource: null
          }
        }
      );
    }

    const upcomingCategories = await categorymodel.find({
      'offer.isOfferActive': false,
      'offer.startDate': { $lte: currentDate },
      'offer.endDate': { $gte: currentDate }
    });

    for (const category of upcomingCategories) {
      await categorymodel.updateOne(
        { _id: category._id },
        { $set: { 'offer.isOfferActive': true } }
      );

      const products = await productmodel.find({
        productcategory: category._id
      });

      for (const product of products) {
        const hasActiveProductOffer =
          product.offer?.isOfferActive &&
          product.offer?.endDate >= currentDate;

        if (hasActiveProductOffer) {
          continue;
        }

        const discountPrice = calculateDiscountPrice(
          product.productprice,
          category.offer.discountType,
          category.offer.discountValue
        );

        await productmodel.updateOne(
          { _id: product._id },
          {
            $set: {
              discountPrice,
              discountSource: 'category'
            }
          }
        );
      }
    }

    const upcomingProducts = await productmodel.find({
      'offer.isOfferActive': false,
      'offer.startDate': { $lte: currentDate },
      'offer.endDate': { $gte: currentDate }
    });

    for (const product of upcomingProducts) {
      const discountPrice = calculateDiscountPrice(
        product.productprice,
        product.offer.discountType,
        product.offer.discountValue
      );

      await productmodel.updateOne(
        { _id: product._id },
        {
          $set: {
            discountPrice,
            discountSource: 'product',
            'offer.isOfferActive': true
          }
        }
      );
    }

    const expiredCoupons = await coupon.find({
      isActive: true,
      endDate: { $lt: currentDate }
    });

    for (const item of expiredCoupons) {
      await coupon.updateOne(
        { _id: item._id },
        { $set: { isActive: false } }
      );
    }

    const upcomingCoupons = await coupon.find({
      isActive: false,
      startDate: { $lte: currentDate },
      endDate: { $gte: currentDate }
    });

    for (const item of upcomingCoupons) {
      await coupon.updateOne(
        { _id: item._id },
        { $set: { isActive: true } }
      );
    }

    logger.info('Daily offer and coupon update completed', {
      expiredProductOffers: expiredProducts.length,
      expiredCategoryOffers: expiredCategories.length,
      activatedCategoryOffers: upcomingCategories.length,
      activatedProductOffers: upcomingProducts.length,
      expiredCoupons: expiredCoupons.length,
      activatedCoupons: upcomingCoupons.length
    });
  } catch (error) {
    logger.error('Daily offer and coupon update failed', {
      error: error.message,
      stack: error.stack
    });
  }
});

module.exports = {
  getCategoryOffer: async (req, res) => {
    try {
      const category = await categorymodel.find();

      return res.render('admin/categoryOffer', { category });
    } catch (error) {
      logger.error('Failed to fetch category offers', {
        error: error.message,
        stack: error.stack
      });

      return res.status(500).send('Internal Server Error');
    }
  },

  addOffer: async (req, res) => {
    try {
      const id = req.params.id;
      const category = await categorymodel.findById(id);

      if (!category) {
        return res.status(404).send('Category not found');
      }

      return res.render('admin/addCategoryOffer', { category });
    } catch (error) {
      logger.error('Failed to load category offer form', {
        categoryId: req.params.id,
        error: error.message,
        stack: error.stack
      });

      return res.status(500).send('Internal Server Error');
    }
  },

  postAddOffer: [
    body('offerType')
      .notEmpty()
      .withMessage('Please select an offer type')
      .isIn(['percentage', 'fixed'])
      .withMessage('Invalid offer type'),

    body('offerValue')
      .notEmpty()
      .withMessage('Please enter the offer value')
      .bail()
      .isFloat({ gt: 0 })
      .withMessage('Offer value must be greater than zero')
      .bail()
      .custom((value, { req }) => {
        if (
          req.body.offerType === 'percentage' &&
          Number(value) > 100
        ) {
          throw new Error('Percentage discount cannot exceed 100%');
        }

        return true;
      }),

    body('startDate')
      .notEmpty()
      .withMessage('Please select a start date')
      .bail()
      .isISO8601()
      .withMessage('Please enter a valid start date'),

    body('endDate')
      .notEmpty()
      .withMessage('Please select an end date')
      .bail()
      .isISO8601()
      .withMessage('Please enter a valid end date')
      .bail()
      .custom(validateEndDate),

    body('offerDescription')
      .trim()
      .notEmpty()
      .withMessage('Please enter an offer description'),

    async (req, res) => {
      const { categoryId } = req.body;

      try {
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
          req.session.adminmessage = {
            message: errors.array()[0].msg
          };

          return res.redirect(
            `/admin/offers/addoffer/${categoryId}`
          );
        }

        if (!req.file) {
          req.session.adminmessage = {
            message: 'Please upload an offer banner'
          };

          return res.redirect(
            `/admin/offers/addoffer/${categoryId}`
          );
        }

        const category = await categorymodel.findById(categoryId);

        if (!category) {
          return res.status(404).send('Category not found');
        }

        const oldPublicId = category.offer?.publicId;

        category.offer = {
          isOfferActive: false,
          discountType: req.body.offerType,
          discountValue: Number(req.body.offerValue),
          startDate: new Date(req.body.startDate),
          endDate: new Date(req.body.endDate),
          bannerImage: req.file.path,
          publicId: req.file.filename,
          offerDescription: req.body.offerDescription.trim()
        };

        await category.save();

        if (oldPublicId) {
          try {
            await deleteCloudinaryImage(oldPublicId);
          } catch (error) {
            logger.error('Failed to delete previous category offer banner', {
              categoryId,
              publicId: oldPublicId,
              error: error.message,
              stack: error.stack
            });
          }
        }

        req.session.adminmessage = {
          type: 'success',
          message: 'Category offer saved successfully'
        };

        return res.redirect(
          `/admin/offers/addoffer/${categoryId}`
        );
      } catch (error) {
        logger.error('Failed to save category offer', {
          categoryId,
          error: error.message,
          stack: error.stack
        });

        req.session.adminmessage = {
          type: 'error',
          message: 'Unable to save category offer'
        };

        return res.redirect(
          `/admin/offers/addoffer/${categoryId}`
        );
      }
    }
  ],

  getProductOffer: async (req, res) => {
    try {
      const products = await productmodel.find();

      return res.render('admin/productOffer', { products });
    } catch (error) {
      logger.error('Failed to fetch product offers', {
        error: error.message,
        stack: error.stack
      });

      return res.status(500).send('Internal Server Error');
    }
  },

  addProductOffer: async (req, res) => {
    try {
      const id = req.params.id;
      const product = await productmodel.findById(id);

      if (!product) {
        return res.status(404).send('Product not found');
      }

      return res.render('admin/addProductOffer', { product });
    } catch (error) {
      logger.error('Failed to load product offer form', {
        productId: req.params.id,
        error: error.message,
        stack: error.stack
      });

      return res.status(500).send('Internal Server Error');
    }
  },

  postProductOffer: [
    body('offerType')
      .notEmpty()
      .withMessage('Please select an offer type')
      .isIn(['percentage', 'fixed'])
      .withMessage('Invalid offer type'),

    body('offerValue')
      .notEmpty()
      .withMessage('Please enter the offer value')
      .bail()
      .isFloat({ gt: 0 })
      .withMessage('Offer value must be greater than zero')
      .bail()
      .custom((value, { req }) => {
        if (
          req.body.offerType === 'percentage' &&
          Number(value) > 100
        ) {
          throw new Error('Percentage discount cannot exceed 100%');
        }

        return true;
      }),

    body('startDate')
      .notEmpty()
      .withMessage('Please select a start date')
      .bail()
      .isISO8601()
      .withMessage('Please enter a valid start date'),

    body('endDate')
      .notEmpty()
      .withMessage('Please select an end date')
      .bail()
      .isISO8601()
      .withMessage('Please enter a valid end date')
      .bail()
      .custom(validateEndDate),

    body('offerDescription')
      .trim()
      .notEmpty()
      .withMessage('Please enter an offer description'),

    async (req, res) => {
      const { productId } = req.body;

      try {
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
          req.session.adminmessage = {
            message: errors.array()[0].msg
          };

          return res.redirect(
            `/admin/productoffers/addoffer/${productId}`
          );
        }

        if (!req.file) {
          req.session.adminmessage = {
            message: 'Please upload an offer banner'
          };

          return res.redirect(
            `/admin/productoffers/addoffer/${productId}`
          );
        }

        const product = await productmodel.findById(productId);

        if (!product) {
          return res.status(404).send('Product not found');
        }

        const oldPublicId = product.offer?.publicId;

        product.offer = {
          isOfferActive: false,
          discountType: req.body.offerType,
          discountValue: Number(req.body.offerValue),
          startDate: new Date(req.body.startDate),
          endDate: new Date(req.body.endDate),
          bannerImage: req.file.path,
          publicId: req.file.filename,
          offerDescription: req.body.offerDescription.trim()
        };

        await product.save();

        if (oldPublicId) {
          try {
            await deleteCloudinaryImage(oldPublicId);
          } catch (error) {
            logger.error('Failed to delete previous product offer banner', {
              productId,
              publicId: oldPublicId,
              error: error.message,
              stack: error.stack
            });
          }
        }

        req.session.adminmessage = {
          type: 'success',
          message: 'Product offer saved successfully'
        };

        return res.redirect(
          `/admin/productoffers/addoffer/${productId}`
        );
      } catch (error) {
        logger.error('Failed to save product offer', {
          productId,
          error: error.message,
          stack: error.stack
        });

        req.session.adminmessage = {
          type: 'error',
          message: 'Unable to save product offer'
        };

        return res.redirect(
          `/admin/productoffers/addoffer/${productId}`
        );
      }
    }
  ]
};
