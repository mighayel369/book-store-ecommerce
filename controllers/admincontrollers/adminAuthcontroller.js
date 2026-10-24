
const usermodel = require('../../models/userdetails');
const bcrypt = require('bcrypt');
const { check, validationResult } = require('express-validator');
const mongoose = require('mongoose');
const logger = require('../../config/logger');

module.exports = {
  postLogin: [
    check('email')
      .trim()
      .notEmpty()
      .withMessage('Email address required')
      .isEmail()
      .withMessage('Invalid email address'),

    check('password')
      .notEmpty()
      .withMessage('Password required'),

    async (req, res) => {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        req.session.adminmessage = {
          message: errors.array()[0].msg
        };

        return res.redirect('/admin/login');
      }

      try {
        const { email, password } = req.body;

        const admin = await usermodel.findOne({
          email: email.trim(),
          role: 'admin'
        }).collation({ locale: 'en', strength: 2 });

        if (!admin) {
          req.session.adminmessage = {
            message: 'Invalid email or password'
          };

          return res.redirect('/admin/login');
        }

        if (admin.status === false) {
          req.session.adminmessage = {
            message: 'This account is disabled'
          };

          return res.redirect('/admin/login');
        }

        const passwordCheck = await bcrypt.compare(
          password,
          admin.password
        );

        if (!passwordCheck) {
          req.session.adminmessage = {
            message: 'Invalid email or password'
          };

          return res.redirect('/admin/login');
        }

        req.session.regenerate((err) => {
          if (err) {
            logger.error('Failed to regenerate admin session', {
              error: err.message,
              stack: err.stack
            });

            return res.status(500).send('Unable to log in');
          }

          req.session.adminId = admin._id;

          req.session.save((saveError) => {
            if (saveError) {
              logger.error('Failed to save admin session', {
                adminId: admin._id.toString(),
                error: saveError.message,
                stack: saveError.stack
              });

              return res.status(500).send('Unable to log in');
            }

            logger.info('Admin logged in successfully', {
              adminId: admin._id.toString()
            });

            return res.redirect('/admin/dashboard');
          });
        });
      } catch (error) {
        logger.error('Admin login failed due to a server error', {
          error: error.message,
          stack: error.stack
        });

        return res.status(500).send('Unable to process login');
      }
    }
  ],
  getAdminUser: async (_req, res) => {
    try {
      const usersdata = await usermodel.find({ role: 'user' })
        .sort({ createdAt: -1 });

      return res.render('admin/adminUsers', { usersdata });
    } catch (error) {
      logger.error('Failed to fetch admin user list', {
        error: error.message,
        stack: error.stack
      });

      return res.status(500).send('Unable to load users');
    }
  },

  postAddUser: [
    check('username')
      .trim()
      .notEmpty()
      .withMessage('Please enter a username')
      .isLength({ min: 3 })
      .withMessage('Username must be at least 3 characters long'),

    check('email')
      .trim()
      .notEmpty()
      .withMessage('Email required')
      .isEmail()
      .withMessage('Invalid email address'),

    check('phoneno')
      .trim()
      .notEmpty()
      .withMessage('Phone number required'),

    check('password')
      .notEmpty()
      .withMessage('Password required')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters long')
      .matches(/[!@#$%^&*(),.?":{}|<>]/)
      .withMessage('Password must contain at least one special character'),

    async (req, res) => {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        req.session.adminmessage = {
          message: errors.array()[0].msg
        };

        return res.redirect('/admin/adduser');
      }

      try {
        const { username, email, phoneno, password } = req.body;

        const existingUser = await usermodel.findOne({
          email: email.trim()
        }).collation({ locale: 'en', strength: 2 });

        if (existingUser) {
          req.session.adminmessage = {
            message: 'An account with this email already exists'
          };

          return res.redirect('/admin/adduser');
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = await usermodel.create({
          username: username.trim(),
          email: email.trim(),
          password: hashedPassword,
          phoneno,
          role: 'user'
        });

        logger.info('Admin created a user account', {
          userId: newUser._id.toString()
        });

        req.session.adminmessage = {
          type: 'success',
          message: 'User added successfully'
        };

        return res.redirect('/admin/users');
      } catch (error) {
        logger.error('Failed to create user account', {
          error: error.message,
          stack: error.stack
        });

        if (error.code === 11000) {
          req.session.adminmessage = {
            message: 'An account with this email already exists'
          };

          return res.redirect('/admin/adduser');
        }

        req.session.adminmessage = {
          type: 'danger',
          message: 'Unable to add user'
        };

        return res.redirect('/admin/adduser');
      }
    }
  ],

  blockuser: async (req, res) => {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).send('Invalid user ID');
      }

      const user = await usermodel.findOneAndUpdate(
        { _id: id, role: 'user' },
        { $set: { status: false } },
        { new: true }
      );

      if (!user) {
        return res.status(404).send('User not found');
      }

      logger.info('User blocked by admin', {
        userId: user._id.toString()
      });

      req.session.adminmessage = {
        type: 'success',
        message: 'User blocked successfully'
      };

      return res.redirect('/admin/users');
    } catch (error) {
      logger.error('Failed to block user', {
        userId: req.params.id,
        error: error.message,
        stack: error.stack
      });

      return res.status(500).send('Unable to block user');
    }
  },

  unblockuser: async (req, res) => {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).send('Invalid user ID');
      }

      const user = await usermodel.findOneAndUpdate(
        { _id: id, role: 'user' },
        { $set: { status: true } },
        { new: true }
      );

      if (!user) {
        return res.status(404).send('User not found');
      }

      logger.info('User unblocked by admin', {
        userId: user._id.toString()
      });

      req.session.adminmessage = {
        type: 'success',
        message: 'User unblocked successfully'
      };

      return res.redirect('/admin/users');
    } catch (error) {
      logger.error('Failed to unblock user', {
        userId: req.params.id,
        error: error.message,
        stack: error.stack
      });

      return res.status(500).send('Unable to unblock user');
    }
  },

  logout: async (req, res) => {
    if (!req.session) {
      return res.redirect('/admin/login');
    }

    req.session.destroy((error) => {
      if (error) {
        logger.error('Failed to destroy admin session during logout', {
          error: error.message,
          stack: error.stack
        });

        return res.status(500).send('Unable to log out');
      }

      res.clearCookie('sid1');

      logger.info('Admin logged out successfully');

      return res.redirect('/admin/login');
    });
  }
};
