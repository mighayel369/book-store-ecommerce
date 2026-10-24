
const nodemailer = require('nodemailer');
const logger = require('../config/logger');

const mailsender = async (email, title, body) => {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST,
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASSWORD
      }
    });

    const info = await transporter.sendMail({
      from: `"Shoe Rack" <${process.env.MAIL_USER}>`,
      to: email,
      subject: title,
      html: body
    });

    logger.info('Email sent successfully');
    return info;

  } catch (error) {
    logger.error('Error sending email', {
      error: error.message,
      stack: error.stack
    });

    throw new Error('Error sending email', { cause: error });
  }
};

module.exports = mailsender;
