
const productmodel = require('../../models/productdetails');
const categorymodel = require('../../models/categorydetails');
const { deleteCloudinaryImage } = require('../../config/cloudinary');
const logger = require('../../config/logger');

module.exports = {
  addProduct: async (req, res) => {
    const files = req.files || {};

    const uploadedFiles = [
      files.cover_image?.[0],
      files.image1?.[0],
      files.image2?.[0]
    ].filter(Boolean);

    try {
      const {
        productname,
        productdescription,
        productcategory,
        productprice,
        stockqty
      } = req.body;

      const category = await categorymodel.findOne({
        categoryname: productcategory
      });

      if (!category) {
        await Promise.all(
          uploadedFiles.map(file =>
            deleteCloudinaryImage(file.filename || file.public_id)
          )
        );

        return res.status(400).json({
          success: false,
          message: 'Invalid product category'
        });
      }

      if (uploadedFiles.length !== 3) {
        await Promise.all(
          uploadedFiles.map(file =>
            deleteCloudinaryImage(file.filename || file.public_id)
          )
        );

        return res.status(400).json({
          success: false,
          message: 'All three product images are required'
        });
      }

      const images = [
        files.cover_image[0],
        files.image1[0],
        files.image2[0]
      ];

      const newProduct = await productmodel.create({
        productname,
        productdescription,
        stockqty: Number(stockqty),
        productprice: Number(productprice),
        productcategory: category._id,
        image: images.map(file => file.path),
        imagePublicIds: images.map(
          file => file.filename || file.public_id
        )
      });

      logger.info('Product added successfully', {
        productId: newProduct._id.toString()
      });

      req.session.adminmessage = {
        type: 'success',
        message: 'Product added successfully'
      };

      return res.json({
        success: true,
        message: 'Product added successfully',
        productId: newProduct._id
      });

    } catch (error) {
      logger.error('Error adding product', {
        error: error.message,
        stack: error.stack
      });

      await Promise.all(
        uploadedFiles.map(async file => {
          try {
            await deleteCloudinaryImage(
              file.filename || file.public_id
            );
          } catch (deleteError) {
            logger.error('Failed to clean up uploaded product image', {
              error: deleteError.message
            });
          }
        })
      );

      return res.status(500).json({
        success: false,
        message: 'An error occurred while adding the product'
      });
    }
  },

  getProducts: async (req, res) => {
    try {
      const products = await productmodel.find()
        .populate('productcategory');

      return res.render('admin/adminProducts', { products });
    } catch (error) {
      logger.error('Error fetching products', {
        error: error.message,
        stack: error.stack
      });

      return res.status(500).send('Internal Server Error');
    }
  },

  getAddProduct: async (req, res) => {
    try {
      const availableCategory = await categorymodel.find(
        {},
        { categoryname: 1 }
      );

      return res.render('admin/addProduct', { availableCategory });
    } catch (error) {
      logger.error('Error loading add product page', {
        error: error.message,
        stack: error.stack
      });

      return res.status(500).send('Internal Server Error');
    }
  },

  getEditProduct: async (req, res) => {
    try {
      const id = req.params.id;
      const productdata = await productmodel.findById(id);
      const availableCategory = await categorymodel.find(
        {},
        { categoryname: 1 }
      );

      if (!productdata) {
        return res.status(404).send('Product not found');
      }

      return res.render('admin/editProduct', {
        productdata,
        availableCategory
      });
    } catch (error) {
      logger.error('Error loading edit product page', {
        productId: req.params.id,
        error: error.message,
        stack: error.stack
      });

      return res.status(500).send('Internal Server Error');
    }
  },

  postEditProduct: async (req, res) => {
    const files = req.files || {};

    const uploadedFiles = [
      files.cover_image?.[0],
      files.image1?.[0],
      files.image2?.[0]
    ].filter(Boolean);

    try {
      const {
        productcategory,
        productname,
        productprice,
        stockqty,
        productdescription
      } = req.body;

      const id = req.params.id;
      const product = await productmodel.findById(id);

      if (!product) {
        await Promise.all(
          uploadedFiles.map(file =>
            deleteCloudinaryImage(file.filename || file.public_id)
          )
        );

        return res.status(404).send('Product not found');
      }

      const category = await categorymodel.findOne({
        categoryname: productcategory
      });

      if (!category) {
        await Promise.all(
          uploadedFiles.map(file =>
            deleteCloudinaryImage(file.filename || file.public_id)
          )
        );

        return res.status(400).send('Invalid product category');
      }

      const oldImages = product.image || [];
      const oldPublicIds = product.imagePublicIds || [];

      const fields = ['cover_image', 'image1', 'image2'];

      const newImages = fields.map((field, index) =>
        files[field]?.[0]?.path || oldImages[index] || ''
      );

      const newPublicIds = fields.map((field, index) => {
        const uploadedFile = files[field]?.[0];

        return uploadedFile
          ? (uploadedFile.filename || uploadedFile.public_id || '')
          : (oldPublicIds[index] || '');
      });

      if (newImages.some(image => !image)) {
        await Promise.all(
          uploadedFiles.map(file =>
            deleteCloudinaryImage(file.filename || file.public_id)
          )
        );

        return res.status(400).send(
          'All three product images are required'
        );
      }

      product.productname = productname;
      product.productdescription = productdescription;
      product.productcategory = category._id;
      product.productprice = Number(productprice);
      product.stockqty = Number(stockqty);
      product.image = newImages;
      product.imagePublicIds = newPublicIds;

      await product.save();

      const oldIdsToDelete = fields
        .map((field, index) =>
          files[field]?.[0] ? oldPublicIds[index] || null : null
        )
        .filter(Boolean);

      await Promise.all(
        oldIdsToDelete.map(async publicId => {
          try {
            await deleteCloudinaryImage(publicId);
          } catch (deleteError) {
            logger.error('Failed to delete replaced Cloudinary image', {
              publicId,
              error: deleteError.message
            });
          }
        })
      );

      logger.info('Product updated successfully', {
        productId: product._id.toString()
      });

      req.session.adminmessage = {
        type: 'success',
        message: 'Product Updated Successfully'
      };

      return res.redirect('/admin/products');

    } catch (error) {
      logger.error('Error updating product', {
        productId: req.params.id,
        error: error.message,
        stack: error.stack
      });

      await Promise.all(
        uploadedFiles.map(async file => {
          try {
            await deleteCloudinaryImage(
              file.filename || file.public_id
            );
          } catch (deleteError) {
            logger.error('Failed to clean up uploaded product image', {
              error: deleteError.message
            });
          }
        })
      );

      return res.status(500).send('Internal Server Error');
    }
  },

  deleteProduct: async (req, res) => {
    try {
      const product = await productmodel.findById(req.params.id);

      if (!product) {
        req.session.adminmessage = {
          type: 'error',
          message: 'Product not found'
        };

        return res.redirect('/admin/products');
      }

      const publicIds = product.imagePublicIds || [];

      await productmodel.findByIdAndDelete(product._id);

      await Promise.all(
        publicIds.filter(Boolean).map(async publicId => {
          try {
            await deleteCloudinaryImage(publicId);
          } catch (deleteError) {
            logger.error('Failed to delete Cloudinary image for deleted product', {
              productId: product._id.toString(),
              publicId,
              error: deleteError.message
            });
          }
        })
      );

      logger.info('Product deleted successfully', {
        productId: product._id.toString()
      });

      req.session.adminmessage = {
        type: 'success',
        message: 'Product Deleted Successfully'
      };

      return res.redirect('/admin/products');

    } catch (error) {
      logger.error('Error deleting product', {
        productId: req.params.id,
        error: error.message,
        stack: error.stack
      });

      req.session.adminmessage = {
        type: 'error',
        message: 'Failed to delete product'
      };

      return res.redirect('/admin/products');
    }
  }
};
