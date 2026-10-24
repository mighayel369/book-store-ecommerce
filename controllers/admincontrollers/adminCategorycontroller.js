const categorymodel = require('../../models/categorydetails');
const { check, validationResult } = require('express-validator');
const { deleteCloudinaryImage } = require('../../config/cloudinary');
const logger = require('../../config/logger');

module.exports = {
  addCategory: [
    check('categoryname')
      .notEmpty()
      .withMessage('Category name is required'),

    check('categorydescription')
      .notEmpty()
      .withMessage('Category description is required'),

    async (req, res) => {
      try {
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
          if (req.file) {
            await deleteCloudinaryImage(
              req.file.filename || req.file.public_id
            );
          }

          logger.warn('Category validation failed', {
            errors: errors.array().map(error => error.msg)
          });

          req.session.adminmessage = {
            type: 'error',
            message: errors.array()[0].msg
          };

          return res.redirect('/admin/addcategory');
        }

        if (!req.file) {
          logger.warn('Category creation failed: image not provided');

          req.session.adminmessage = {
            type: 'error',
            message: 'Please select a category image'
          };

          return res.redirect('/admin/addcategory');
        }

        const { categoryname, categorydescription } = req.body;

        const category = await categorymodel.create({
          categoryname,
          categorydescription,
          image: req.file.path,
          imagePublicId: req.file.filename || req.file.public_id
        });

        logger.info('Category added successfully', {
          categoryId: category._id.toString()
        });

        req.session.adminmessage = {
          type: 'success',
          message: 'Category added successfully'
        };

        return res.redirect('/admin/category');

      } catch (error) {
        logger.error('Error adding category', {
          error: error.message,
          stack: error.stack
        });

        if (req.file) {
          await deleteCloudinaryImage(
            req.file.filename || req.file.public_id
          );
        }

        req.session.adminmessage = {
          type: 'error',
          message: 'Failed to add category'
        };

        return res.redirect('/admin/addcategory');
      }
    }
  ],

  getAllcategory: async (req, res) => {
    try {
      const category = await categorymodel.find();

      logger.info('Categories fetched successfully', {
        count: category.length
      });

      return res.render('admin/adminCategory', { category });

    } catch (error) {
      logger.error('Error fetching categories', {
        error: error.message,
        stack: error.stack
      });

      return res.status(500).send('Internal server error');
    }
  },

  getEditCategory: async (req, res) => {
    try {
      const categorydata = await categorymodel.findById(req.params.id);

      if (!categorydata) {
        logger.warn('Category not found for editing', {
          categoryId: req.params.id
        });

        req.session.adminmessage = {
          type: 'error',
          message: 'Category not found'
        };

        return res.redirect('/admin/category');
      }

      logger.info('Category fetched for editing', {
        categoryId: req.params.id
      });

      return res.render('admin/editCategory', { categorydata });

    } catch (error) {
      logger.error('Error fetching category for editing', {
        categoryId: req.params.id,
        error: error.message,
        stack: error.stack
      });

      return res.status(500).send('Internal server error');
    }
  },

  postEditCategory: async (req, res) => {
    let categoryUpdated = false;

    try {
      const { categoryname, categorydescription } = req.body;

      const category = await categorymodel.findById(req.params.id);

      if (!category) {
        if (req.file) {
          await deleteCloudinaryImage(
            req.file.filename || req.file.public_id
          );
        }

        logger.warn('Category not found for update', {
          categoryId: req.params.id
        });

        req.session.adminmessage = {
          type: 'error',
          message: 'Category not found'
        };

        return res.redirect('/admin/category');
      }

      const oldPublicId = category.imagePublicId;
      const newPublicId = req.file
        ? req.file.filename || req.file.public_id
        : null;

      category.categoryname = categoryname;
      category.categorydescription = categorydescription;

      if (req.file) {
        category.image = req.file.path;
        category.imagePublicId = newPublicId;
      }

      await category.save();
      categoryUpdated = true;

      logger.info('Category updated successfully', {
        categoryId: category._id.toString(),
        imageReplaced: Boolean(req.file)
      });

      if (req.file && oldPublicId && oldPublicId !== newPublicId) {
        await deleteCloudinaryImage(oldPublicId);
      }

      req.session.adminmessage = {
        type: 'success',
        message: 'Category edited successfully'
      };

      return res.redirect('/admin/category');

    } catch (error) {
      logger.error('Error editing category', {
        categoryId: req.params.id,
        error: error.message,
        stack: error.stack
      });

      if (req.file && !categoryUpdated) {
        await deleteCloudinaryImage(
          req.file.filename || req.file.public_id
        );
      }

      req.session.adminmessage = {
        type: 'error',
        message: 'Failed to edit category'
      };

      return res.redirect('/admin/category');
    }
  },

  deleteCategory: async (req, res) => {
    try {
      const category = await categorymodel.findById(req.params.id);

      if (!category) {
        logger.warn('Category not found for deletion', {
          categoryId: req.params.id
        });

        req.session.adminmessage = {
          type: 'error',
          message: 'Category not found'
        };

        return res.redirect('/admin/category');
      }

      const publicId = category.imagePublicId;

      await categorymodel.findByIdAndDelete(category._id);

      logger.info('Category deleted successfully', {
        categoryId: category._id.toString()
      });

      if (publicId) {
        await deleteCloudinaryImage(publicId);
      }

      req.session.adminmessage = {
        type: 'success',
        message: 'Category deleted successfully'
      };

      return res.redirect('/admin/category');

    } catch (error) {
      logger.error('Error deleting category', {
        categoryId: req.params.id,
        error: error.message,
        stack: error.stack
      });

      req.session.adminmessage = {
        type: 'error',
        message: 'Failed to delete category'
      };

      return res.redirect('/admin/category');
    }
  },

  getCategoryname: async () => {
    try {
      const categoryNames = await categorymodel.find(
        {},
        { categoryname: 1 }
      );

      logger.info('Category names fetched successfully', {
        count: categoryNames.length
      });

      return categoryNames;

    } catch (error) {
      logger.error('Error fetching category names', {
        error: error.message,
        stack: error.stack
      });

      throw error;
    }
  }
};
