
let product = require('../../models/productdetails');
let categories = require('../../models/categorydetails');
let usermodel = require('../../models/userdetails');
let carousal = require('../../models/carouseldetails');
const logger = require('../../config/logger');

module.exports = {
  getHome: async (req, res) => {
    let { search = '' } = req.query;
    let users;

    try {
      if (req.session.userId) {
        const { userId } = req.session;
        users = await usermodel.findById(userId);
      } else if (req.user) {
        users = await usermodel.findById(req.user._id);

        if (users) {
          req.session.userId = users._id;
        }
      }

      const currentDate = new Date();

      const offers = await product.aggregate([
        {
          $match: {
            'offer.isOfferActive': true,
            'offer.endDate': { $gte: currentDate }
          }
        },
        {
          $project: {
            productname: 1,
            productprice: 1,
            image: 1,
            offer: 1
          }
        },
        { $limit: 3 }
      ]);

      const upcomingProductOffers = await product.find({
        'offer.isOfferActive': false,
        'offer.startDate': { $gt: currentDate },
        'offer.endDate': { $gte: currentDate }
      }).select('productname productprice image offer');

      const upcomingCategoryOffers = await categories.find({
        'offer.isOfferActive': false,
        'offer.startDate': { $gt: currentDate },
        'offer.endDate': { $gte: currentDate }
      }).select('categoryname offer');

      const upcomingOffers = [
        ...upcomingProductOffers,
        ...upcomingCategoryOffers
      ]
        .sort((a, b) =>
          new Date(a.offer.startDate) - new Date(b.offer.startDate)
        )
        .slice(0, 3);

      const products = await product.find()
        .populate('productcategory')
        .sort({ popularityScore: -1 })
        .limit(3);

      const category = await categories.find().limit(4);

      const carousels = await carousal.find({
        isActive: true
      }).sort({ createdAt: -1 });

      res.render('users/userHome', {
        products,
        category,
        users,
        search,
        offers,
        upcomingOffers,
        carousels
      });
    } catch (error) {
      logger.error('Error loading homepage', {
        error: error.message,
        stack: error.stack
      });

      if (!res.headersSent) {
        res.status(500).send('Internal Server Error');
      }
    }
  },

  getProducts: async (req, res) => {
    try {
      const search = (
        req.query.allsearch ||
        req.query.search ||
        ''
      ).trim();

      const currentPage = Math.max(
        1,
        parseInt(req.query.page, 10) || 1
      );

      const limitNumber = Math.min(
        48,
        Math.max(1, parseInt(req.query.limit, 10) || 9)
      );

      const skip = (currentPage - 1) * limitNumber;

      const users = req.session.userId
        ? await usermodel.findById(req.session.userId)
        : null;

      const query = {};

      if (search) {
        const escapedSearch = search.replace(
          /[.*+?^${}()|[\]\\]/g,
          '\\$&'
        );

        const matchingCategories = await categories.find({
          categoryname: {
            $regex: escapedSearch,
            $options: 'i'
          }
        }).select('_id');

        query.$or = [
          {
            productname: {
              $regex: escapedSearch,
              $options: 'i'
            }
          },
          {
            productcategory: {
              $in: matchingCategories.map(category => category._id)
            }
          }
        ];
      }

      const [products, totalProducts, category] = await Promise.all([
        product.find(query)
          .populate('productcategory')
          .sort({ popularityScore: -1 })
          .skip(skip)
          .limit(limitNumber),

        product.countDocuments(query),

        categories.find()
      ]);

      const totalPages = Math.ceil(totalProducts / limitNumber);

      res.render('users/productsPage', {
        products,
        category,
        users,
        limit: limitNumber,
        currentPage,
        totalPages,
        search
      });
    } catch (error) {
      logger.error('Error fetching products', {
        search: req.query.search || req.query.allsearch,
        error: error.message,
        stack: error.stack
      });

      if (!res.headersSent) {
        res.status(500).send('Unable to load products');
      }
    }
  },

  getSingleProduct: async (req, res) => {
    try {
      let { search = '' } = req.query;
      let { userId } = req.session;

      let users = userId
        ? await usermodel.findById(userId)
        : null;

      let id = req.params.id;

      let products = await product.findById(id)
        .populate('productcategory');

      if (!products) {
        logger.warn('Product not found', { productId: id });
        return res.status(404).send('Product not found');
      }

      let similarProducts = await product.find({
        productcategory: products.productcategory
      }).populate('productcategory');

      res.render('users/singleProduct', {
        products,
        similarProducts,
        users,
        search
      });
    } catch (error) {
      logger.error('Error loading single product page', {
        productId: req.params.id,
        error: error.message,
        stack: error.stack
      });

      if (!res.headersSent) {
        res.status(500).send('Unable to load product');
      }
    }
  },

  getBrand: async (req, res) => {
    try {
      let { search = '' } = req.query;
      let { userId } = req.session;

      let users = userId
        ? await usermodel.findById(userId)
        : null;

      let category = await categories.find();

      res.render('users/brands', {
        category,
        users,
        search
      });
    } catch (error) {
      logger.error('Error loading brands page', {
        error: error.message,
        stack: error.stack
      });

      if (!res.headersSent) {
        res.status(500).send('Unable to load brands');
      }
    }
  },

  getAbout: async (req, res) => {
    try {
      let { search = '' } = req.query;
      let { userId } = req.session;

      let users = userId
        ? await usermodel.findById(userId)
        : null;

      res.render('users/about', { users, search });
    } catch (error) {
      logger.error('Error loading about page', {
        error: error.message,
        stack: error.stack
      });

      if (!res.headersSent) {
        res.status(500).send('Unable to load about page');
      }
    }
  },

  getContact: async (req, res) => {
    try {
      let { search = '' } = req.query;
      let { userId } = req.session;

      let users = userId
        ? await usermodel.findById(userId)
        : null;

      res.render('users/contact', { users, search });
    } catch (error) {
      logger.error('Error loading contact page', {
        error: error.message,
        stack: error.stack
      });

      if (!res.headersSent) {
        res.status(500).send('Unable to load contact page');
      }
    }
  }
};
