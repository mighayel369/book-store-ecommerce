const usermodel = require('./../models/userdetails');
const logger = require('./../config/logger');

module.exports = {
  isAdmin: (req, res, next) => {
    if (req.session.adminId) {
      return next();
    }

    return res.redirect('/admin/login');
  },

  isAlreadylogged: (req, res, next) => {
    if (req.session.adminId) {
      return res.redirect('/admin/dashboard');
    }

    return next();
  },

  isAuthenticated: (req, res, next) => {
    if (req.session.userId) {
      return next();
    }

    return res.redirect('/login');
  },

  isUserBlocked: async (req, res, next) => {
    try {
      const user = await usermodel.findById(req.session.userId);

      if (!user) {
        req.session.message = {
          message: 'User not found. Please log in.'
        };

        return res.redirect('/login');
      }

      if (user.status === false) {
        req.session.destroy((err) => {
          if (err) {
            logger.error('Failed to destroy blocked user session', {
              error: err.message,
              stack: err.stack
            });

            return res.status(500).send('Unable to log out. Please try again.');
          }

          return res.redirect('/login');
        });

        return;
      }

      return next();

    } catch (error) {
      logger.error('Error checking user status', {
        userId: req.session?.userId,
        error: error.message,
        stack: error.stack
      });

      return res.status(500).send(
        'An error occurred. Please try again later.'
      );
    }
  },

  isUserBlockedclient: async (req, res, next) => {
    try {
      const user = await usermodel.findById(req.session.userId);

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not found. Please log in.'
        });
      }

      if (user.status === false) {
        req.session.destroy((err) => {
          if (err) {
            logger.error('Failed to destroy blocked user session', {
              userId: req.session?.userId,
              error: err.message,
              stack: err.stack
            });

            return res.status(500).json({
              success: false,
              message: 'Unable to log out due to a server error.'
            });
          }

          return res.status(403).json({
            success: false,
            message: 'User is blocked. Please log in.'
          });
        });

        return;
      }

      return next();

    } catch (error) {
      logger.error('Error checking user status for client request', {
        userId: req.session?.userId,
        error: error.message,
        stack: error.stack
      });

      return res.status(500).json({
        success: false,
        message: 'An error occurred. Please try again later.'
      });
    }
  }
};