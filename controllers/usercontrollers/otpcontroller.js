
const otpGenerator = require('otp-generator');
const OTP = require('../../models/otpmodel');
const logger = require('../../config/logger');

exports.sendOTP = async function (email) {
  try {
    await OTP.deleteMany({ email });

    let otp = otpGenerator.generate(6, {
      upperCaseAlphabets: false,
      lowerCaseAlphabets: false,
      specialChars: false,
      digits: true
    });

    let existingOTP = await OTP.findOne({ otp });

    while (existingOTP) {
      otp = otpGenerator.generate(6, {
        upperCaseAlphabets: false,
        lowerCaseAlphabets: false,
        specialChars: false,
        digits: true
      });

      existingOTP = await OTP.findOne({ otp });
    }

    const otpBody = await OTP.create({
      email,
      otp
    });

    logger.info('OTP generated and saved successfully');

    return otpBody;
  } catch (error) {
    logger.error('Error generating or saving OTP', {
      error: error.message,
      stack: error.stack
    });

    throw error;
  }
};
