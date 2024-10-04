const usermodel = require('./../models/userdetails');

module.exports={
    isAdmin:(req,res,next)=>{
        if (req.session.adminId) {
            next();
          } else {
            res.redirect('/admin/login');
          }
    },
     isAlreadylogged : (req, res, next) => {
        if (req.session.adminId) {
          res.redirect('/admin/dashboard');
        } else {
          next();
        }
      },
      isAuthenticated:(req, res, next)=> {
        if (req.session.userId) {
          return next();
        }
        res.redirect('/login');
      },
    
     isUserBlocked : async (req, res, next) => {
      try {
        const user = await usermodel.findById(req.session.userId);
    
        if (!user) {
          req.session.message = { message: 'User not found. Please log in.' };
          return res.redirect('/login');
        }
        if (user.status === false) {
          req.session.destroy((err)=>{
            res.redirect('/login')
          })
        }else{
        next();
        }
      } catch (error) {
        console.error('Error checking user status:', error);
        req.session.message = { message: 'An error occurred. Please try again later.' };
        res.redirect('/login');
      }
    },
    isUserBlockedclient: async (req, res, next) => {
      try {
        const user = await usermodel.findById(req.session.userId);
    
        if (!user) {
          return res.status(401).json({ success: false, message: 'User not found. Please log in.' });
        }
        if (user.status === false) {

          req.session.destroy((err) => {
            if (!err) {
              return res.status(403).json({ success: false, message: 'User is blocked. Please log in.' });
            } else {
              return res.status(500).json({ success: false, message: 'Unable to log out due to a server error.' });
            }
          });
        } else {

          next();
        }
      } catch (error) {
        console.error('Error checking user status:', error);
        res.status(500).json({ success: false, message: 'An error occurred. Please try again later.' });
      }
    }
}