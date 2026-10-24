
const usermodel = require('../../models/userdetails');
const bcrypt = require('bcrypt');
const { check, validationResult } = require('express-validator');
const otpmodel = require('../../models/otpmodel');
const otpController = require('./otpcontroller');
const logger = require('../../config/logger');

module.exports = {
  verifyUser: [
    check('email')
      .notEmpty().withMessage('email address required')
      .isEmail().withMessage('invalid email address'),

    check('password')
      .notEmpty().withMessage('password required'),

    async (req, res) => {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        const errorMessage = errors.array()[0].msg;
        req.session.message = { message: errorMessage };
        return res.redirect('/login');
      }

      try {
        const user = await usermodel.findOne({
          email: req.body.email,
          role: 'user'
        });

        if (user) {
          const isMatch = await bcrypt.compare(
            req.body.password,
            user.password
          );

          if (user.status === false) {
            req.session.message = {
              message: 'Your Account Is Blocked'
            };
            return res.redirect('/login');
          } else if (isMatch) {
            req.session.userId = user._id;
            req.session.message = {
              message: 'User Logged Successfully'
            };

            logger.info('User logged in successfully', {
              userId: user._id
            });

            return res.redirect('/');
          } else {
            req.session.message = {
              message: 'Password Is Incorrect'
            };
            return res.redirect('/login');
          }
        } else {
          req.session.message = {
            message: 'User Not Found'
          };
          return res.redirect('/login');
        }
      } catch (error) {
        logger.error('User login failed due to a server error', {
          error: error.message,
          stack: error.stack
        });

        return res.status(500).send('Internal Server Error');
      }
    }
  ],

  addUser: [
    check('username')
      .notEmpty().withMessage('Username required')
      .isLength({ min: 3 })
      .withMessage('Username must be at least 3 characters long'),

    check('email')
      .notEmpty().withMessage('Email required')
      .isEmail().withMessage('Invalid email address'),

    check('phoneno')
      .notEmpty().withMessage('Name is required'),

    check('password')
      .notEmpty().withMessage('Password required')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters long')
      .matches(/[!@#$%^&*(),.?":{}|<>]/)
      .withMessage('Password must contain at least one special character'),

    async (req, res) => {
      const { email, username, password, confirmpassword, phoneno } =
        req.body;

      if (password !== confirmpassword) {
        req.session.message = {
          message: 'password is not matching'
        };
        return res.redirect('/signup');
      }

      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        const errorMessage = errors.array()[0].msg;
        req.session.message = { message: errorMessage };
        return res.redirect('/signup');
      }

      try {
        const isExists = await usermodel.findOne({
          email,
          role: 'user'
        });

        if (isExists) {
          req.session.message = {
            message: 'This email has already had an account'
          };
          return res.redirect('/signup');
        }

        await otpController.sendOTP(email);

        req.session.signupDetails = {
          username,
          email,
          phoneno,
          password
        };

        logger.info('Signup OTP generated successfully');

        return res.redirect('/verify-otp');
      } catch (error) {
        logger.error('User signup initiation failed', {
          error: error.message,
          stack: error.stack
        });

        return res.status(500).send('Internal Server Error');
      }
    }
  ],

  getLogin: async (req, res) => {
    try {
      if (req.session.userId) {
        return res.redirect('/');
      }

      let { search = '' } = req.query;
      let users = req.session.userId
        ? await usermodel.findById(req.session.userId)
        : null;

      return res.render('users/login', { users, search });
    } catch (error) {
      logger.error('Error loading login page', {
        error: error.message,
        stack: error.stack
      });

      if (!res.headersSent) {
        return res.status(500).send('Unable to load login page');
      }
    }
  },

  getSignup: async (req, res) => {
    try {
      let { search = '' } = req.query;
      let users = req.session.userId
        ? await usermodel.findById(req.session.userId)
        : null;

      return res.render('users/signup', { users, search });
    } catch (error) {
      logger.error('Error loading signup page', {
        error: error.message,
        stack: error.stack
      });

      if (!res.headersSent) {
        return res.status(500).send('Unable to load signup page');
      }
    }
  },

  getVerifyOTP: async (req, res) => {
    try {
      const { search = '' } = req.query;
      const { userId } = req.session;

      let users;

      if (userId) {
        users = await usermodel.findById(userId);
      }

      let otpCreatedAt = null;
      let email = null;

      if (req.session.forgotpassword) {
        email = req.session.forgotpassword.email;
      } else if (req.session.signupDetails) {
        email = req.session.signupDetails.email;
      }

      if (email) {
        const otpRecord = await otpmodel.findOne({ email })
          .sort({ createdAt: -1 });

        if (otpRecord) {
          otpCreatedAt = otpRecord.createdAt.getTime();
        }
      }

      return res.render('users/verifyOTP', {
        users,
        search,
        otpCreatedAt
      });
    } catch (error) {
      logger.error('Error loading OTP verification page', {
        error: error.message,
        stack: error.stack
      });

      return res.status(500).send('Unable to load OTP page.');
    }
  },

  postVerifyOTP: async (req, res) => {
    try {
      const enteredOTP = req.body.otp;

      if (req.session.forgotpassword) {
        const { email } = req.session.forgotpassword;
        const isValid = await verifyOTP(email, enteredOTP);

        if (!isValid) {
          req.session.message = {
            message: 'OTP is invalid or expired. Please request a new OTP.'
          };

          return res.redirect('/verify-otp');
        }

        req.session.forgotpassword.otpVerified = true;
        await otpmodel.deleteMany({ email });

        logger.info('Password reset OTP verified successfully');

        return res.redirect('/forgotpassword');
      }

      if (!req.session.signupDetails) {
        req.session.message = {
          message: 'Signup session expired. Please sign up again.'
        };

        return res.redirect('/signup');
      }

      const { username, email, phoneno, password } =
        req.session.signupDetails;

      const isValid = await verifyOTP(email, enteredOTP);

      if (!isValid) {
        req.session.message = {
          message: 'OTP is invalid or expired. Please request a new OTP.'
        };

        return res.redirect('/verify-otp');
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const newUser = new usermodel({
        username,
        email,
        phoneno,
        password: hashedPassword
      });

      await newUser.save();

      delete req.session.signupDetails;
      await otpmodel.deleteMany({ email });

      req.session.message = {
        message: 'Account created successfully. Please log in.'
      };

      logger.info('User account created successfully', {
        userId: newUser._id
      });

      return res.redirect('/login');
    } catch (error) {
      logger.error('OTP verification or account creation failed', {
        error: error.message,
        stack: error.stack
      });

      req.session.message = {
        message: 'An error occurred while verifying OTP.'
      };

      return res.redirect('/verify-otp');
    }
  },

  resendOTP: async (req, res) => {
    try {
      if (req.session.forgotpassword) {
        const { email } = req.session.forgotpassword;

        req.session.forgotpassword.otpVerified = false;

        await otpController.sendOTP(email);

        req.session.message = {
          message: 'A new OTP has been sent to your email.'
        };

        logger.info('Password reset OTP regenerated successfully');

        return res.redirect('/verify-otp');
      }

      if (req.session.signupDetails) {
        const { email } = req.session.signupDetails;

        await otpController.sendOTP(email);

        req.session.message = {
          message: 'A new OTP has been sent to your email.'
        };

        logger.info('Signup OTP regenerated successfully');

        return res.redirect('/verify-otp');
      }

      req.session.message = {
        message: 'Your session has expired. Please try again.'
      };

      return res.redirect('/signup');
    } catch (error) {
      logger.error('Failed to resend OTP', {
        error: error.message,
        stack: error.stack
      });

      req.session.message = {
        message: 'Unable to resend OTP. Please try again.'
      };

      return res.redirect('/verify-otp');
    }
  },

  getVerifyEmail: async (req, res) => {
    try {
      let { search = '' } = req.query;
      let users;

      if (req.session.userId) {
        users = await usermodel.findById(req.session.userId);
      }

      return res.render('users/verifyEmail', { users, search });
    } catch (error) {
      logger.error('Error loading email verification page', {
        error: error.message,
        stack: error.stack
      });

      if (!res.headersSent) {
        return res.status(500).send('Unable to load email verification page');
      }
    }
  },

  postVerifyEmail: async (req, res) => {
    try {
      const { email } = req.body;
      const emailExist = await usermodel.findOne({ email });

      if (!emailExist) {
        req.session.message = { message: 'Email Not Found' };
        return res.redirect('/verify-email');
      }

      await otpController.sendOTP(email);
      req.session.forgotpassword = { email };

      logger.info('Password reset OTP generated successfully');

      return res.redirect('/verify-otp');
    } catch (error) {
      logger.error('Failed to initiate password reset', {
        error: error.message,
        stack: error.stack
      });

      req.session.message = {
        message: 'Unable to process your request. Please try again.'
      };

      return res.redirect('/verify-email');
    }
  },

  getForgotPassword: async (req, res) => {
    if (
      !req.session.forgotpassword ||
      req.session.forgotpassword.otpVerified !== true
    ) {
      req.session.message = {
        message: 'Please verify your OTP first.'
      };

      return res.redirect('/verify-email');
    }

    try {
      const { search = '' } = req.query;
      let users;

      if (req.session.userId) {
        users = await usermodel.findById(req.session.userId);
      }

      return res.render('users/forgotPassword', {
        users,
        search
      });
    } catch (error) {
      logger.error('Error loading forgot password page', {
        error: error.message,
        stack: error.stack
      });

      return res.redirect('/verify-email');
    }
  },

  postForgotPassword: async (req, res) => {
    try {
      if (
        !req.session.forgotpassword ||
        req.session.forgotpassword.otpVerified !== true
      ) {
        req.session.message = {
          message: 'Please verify your OTP first.'
        };

        return res.redirect('/verify-email');
      }

      const { email } = req.session.forgotpassword;
      const { newpassword, confirmpassword } = req.body;

      if (newpassword !== confirmpassword) {
        req.session.message = {
          message: 'Passwords do not match.'
        };

        return res.redirect('/forgotpassword');
      }

      const hashedpassword = await bcrypt.hash(newpassword, 10);
      const user = await usermodel.findOne({ email });

      if (!user) {
        req.session.message = {
          message: 'User not found.'
        };

        return res.redirect('/verify-email');
      }

      user.password = hashedpassword;
      await user.save();

      delete req.session.forgotpassword;

      req.session.message = {
        message: 'Password updated successfully. Please log in.'
      };

      logger.info('User password updated successfully', {
        userId: user._id
      });

      return res.redirect('/login');
    } catch (error) {
      logger.error('Password update failed', {
        error: error.message,
        stack: error.stack
      });

      req.session.message = {
        message: 'Unable to update password. Please try again.'
      };

      return res.redirect('/forgotpassword');
    }
  }
};

async function verifyOTP(email, enteredOTP) {
  try {
    const otpRecord = await otpmodel.findOne({
      email,
      otp: enteredOTP
    });

    if (!otpRecord) {
      return false;
    }

    const otpAge = Date.now() - otpRecord.createdAt.getTime();
    const otpExpiry = 2 * 60 * 1000;

    if (otpAge >= otpExpiry) {
      await otpmodel.deleteMany({ email });
      return false;
    }

    return true;
  } catch (error) {
    logger.error('Error checking OTP validity', {
      error: error.message,
      stack: error.stack
    });

    throw error;
  }
}
