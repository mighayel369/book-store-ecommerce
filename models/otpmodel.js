
const mongoose = require('mongoose');
const mailsender = require('../utils/mailsender');
const logger = require('../config/logger');

const otp = new mongoose.Schema({
  email: {
    type: String,
    required: true
  },
  otp: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 60 * 2
  }
});

async function sendVerificationEmail(email, otp) {
  try {
    const mailResponse = await mailsender(
      email,
      'Verification Email',
      `<h1>Please confirm your OTP</h1>
             <p>Here is your OTP code: ${otp}</p>`
    );

    logger.info('OTP verification email sent successfully');
    return mailResponse;
  } catch (error) {
    logger.error('Error sending OTP verification email', {
      error: error.message,
      stack: error.stack
    });

    throw error;
  }
}

otp.pre('save', async function () {
  if (this.isNew) {
    await sendVerificationEmail(this.email, this.otp);
  }
});

module.exports = mongoose.model('otpmodel', otp);
