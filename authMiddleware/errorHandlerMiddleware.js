const logger = require('../config/logger');

const notFound = (req, res) => {
    logger.warn('Route not found', {
        method: req.method,
        url: req.originalUrl
    });

    return res.status(404).render('users/errorPage', {
        message: 'Page Not Found'
    });
};

const errorHandler1 = (err, req, res, next) => {
    logger.error('Unhandled application error', {
        method: req.method,
        url: req.originalUrl,
        error: err.message,
        stack: err.stack
    });

    if (res.headersSent) {
        return next(err);
    }

    return res.status(500).render('users/errorPage', {
        message: 'Internal Server Error'
    });
};

module.exports = { notFound, errorHandler1 };