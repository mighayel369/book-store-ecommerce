const nodemailer = require('nodemailer')

const mailsender = async (email, title, body) => {
    try {
      let transporter = nodemailer.createTransport({
        host: process.env.MAIL_HOST,
        auth: {
          user: process.env.MAIL_USER,
          pass: process.env.MAIL_PASS, 
        },
      });
  
      let info = await transporter.sendMail({
        from: `"Shoe Rack" <${process.env.MAIL_USER}>`,
        to: email,
        subject: title,
        html: body,
      });
      console.log('Email sent: %s', info.messageId);
      return info;
    } catch (error) {
      console.error('Error sending email:', error);
      throw new Error('Error sending email');
    }
  };

module.exports=mailsender