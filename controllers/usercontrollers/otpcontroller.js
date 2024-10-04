const otpGenerator = require('otp-generator')
const OTP = require('../../models/otpmodel');
const User = require('../../models/userdetails');

exports.sendOTP=async function(email){
    try{
let otp=otpGenerator.generate(6,{
    upperCaseAlphabets: false,
    lowerCaseAlphabets: false,
    specialChars: false
})
let result = await OTP.findOne({ otp: otp });
while (result) {
  otp = otpGenerator.generate(6, {
    upperCaseAlphabets: false,
  });
  result = await OTP.findOne({ otp: otp });
}
const otpPayload = { email, otp };
const otpBody = await OTP.create(otpPayload);

  } catch (error) {
    console.log(error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
};
