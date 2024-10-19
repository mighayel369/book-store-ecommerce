let usermodel=require('../../models/userdetails')
let mongoose=require('mongoose')
let order=require('../../models/order')
let product=require('../../models/productdetails')
let addressmodel=require('../../models/address')
const bcrypt = require('bcrypt')
const {check,validationResult } = require('express-validator');
let Razorpay=require('razorpay')
const crypto = require('crypto');
const fs = require('fs/promises')
const dotenv = require('dotenv');
dotenv.config()

var instance = new Razorpay({
    key_id: process.env.RAZORPAY_KEYID,
    key_secret: process.env.RAZORPAY_KEYSECRET,
  });

module.exports={
    getAccount:async (req,res)=>{
        if(!req.session.userId){
            return res.redirect('/login')
        }
        const { search = '' ,page=1,limit=5} = req.query
        try{
            let pageNumber=parseInt(page,10)
            let limitNumber=parseInt(limit, 10)
            const skip = (pageNumber - 1) * limitNumber
            let query = { userId: req.session.userId };
            if (search) {
                query["products.productName"] = { $regex: search, $options: 'i' };
            }
        let orders = await order.find(query).sort({createdAt:-1}).skip(skip).limit(limitNumber).exec()
        let count= await order.countDocuments(orders);
        let totalPages=Math.ceil(count/limitNumber)
        if (req.xhr) {
            return res.json({ orders,totalPages, currentPage: pageNumber,limit: limitNumber  });
        }
        let users=await usermodel.findById(req.session.userId)
        res.render('users/account-orders',{users,orders,search,currentPage: pageNumber,
            totalPages: totalPages,limit: limitNumber })
        }catch(error){
            console.log(error)
        }
    },
    getAddress:async (req,res)=>{
        if(!req.session.userId){
            return res.redirect('/login')
        }
        let {search=''}=req.query
        let users = await usermodel.findById(req.session.userId).populate('address')
        res.render('users/account-address',{users,search})
    },
    addAddress:async (req,res)=>{
       try{
        let {fullname,phoneno,houseno,area,landmark,town,state,pincode}=req.body
        let isDefault = req.body.default ? true : false
        let newAddress={
            fullname:fullname,
            phoneno:phoneno,
            houseno:houseno,
            area:area,
            landmark:landmark,
            town:town,
            state:state,
            pincode:pincode,
            default:isDefault
        }
        if (isDefault) {
            let user = await usermodel.findById(req.session.userId).populate('address');
            for (let addr of user.address) {
              if (addr.default) {
                await addressmodel.findByIdAndUpdate(addr._id, { default: false });
              }
            }
          }
          let address=await addressmodel(newAddress)
          await address.save();
          await usermodel.updateOne(
            { _id: req.session.userId },
            {
              $addToSet: { address: address._id }
            }
          ) 
        if(req.headers.referer && req.headers.referer.includes('/checkout')){
          req.session.message={
            type:"success",
            message:"Address Applied Successfully"
        }
          return res.redirect('/checkout')
        }else{
          req.session.message={
            type:'success',
            message:'address added successfully!'
         }
          return res.redirect('/accountaddress')
        }
       }catch(error){
        console.log(error)
       }
},
deleteAddress:async (req,res)=>{
    try{
        let userId = req.session.userId;
        if (!userId) {
          return res.redirect('/login');
        }
        
        let addressId = req.params.id;
        await usermodel.updateOne(
          { _id: userId },
          { $pull: { address: addressId } }
        );
        await addressmodel.findByIdAndDelete(addressId);
        
        if(req.headers.referer && req.headers.referer.includes('/checkout')){
          req.session.message={
            type:"success",
            message:"Address Deleted Successfully"
        }
          return res.redirect('/checkout')
        }else{
          req.session.message={
            type:'success',
            message:'address deleted successfully!'
         }
          return res.redirect('/accountaddress')
        }
}catch(error){
    console.log('address not found')
}
},
editAddress:async (req,res)=>{
    try{
        let addressId = req.params.id;
        let userId = req.session.userId;
    
        if (!userId) {
          return res.redirect('/login');
        }
    
        let { fullname, phoneno, houseno, area, landmark, town, state, pincode } = req.body;
        let isDefault = req.body.default ? true : false;
        let updatedAddress = {
          fullname,
          phoneno,
          houseno,
          area,
          landmark,
          town,
          state,
          pincode,
          default: isDefault
        };
    
        if (isDefault) {
            let user = await usermodel.findById(req.session.userId).populate('address');
            for (let addr of user.address) {
              if (addr.default) {
                await addressmodel.findByIdAndUpdate(addr._id, { default: false });
              }
            }
          }

        await addressmodel.findByIdAndUpdate(addressId, updatedAddress);
        if(req.headers.referer && req.headers.referer.includes('/checkout')){
          req.session.message={
            type:"success",
            message:"Address updated Successfully"
        }
          return res.redirect('/checkout')
        }else{
          req.session.message = {
            type: 'success',
            message: 'Address updated successfully!'
          };
          return res.redirect('/accountaddress')
        }
}
catch(error){
    console.log(error)
}
},
getSingleOrder:async(req,res)=>{
        let orderId = req.params.id;
        try {
            if (!req.session.userId) {
                return res.redirect('/');
            }
            let {search=''}=req.query
            let users = await usermodel.findById(req.session.userId)
            let id = new mongoose.Types.ObjectId(`${orderId}`);
            let orderDetails=await order.findById(id).populate('shippingAddress')
            res.render('users/order-details',{users,orderDetails,search})
    
        } catch (err) {
            console.error(err);
            res.status(500).send("Server Error");
        }
    },
    getProfile:async (req,res)=>{
      try{
        
        if(!req.session.userId){
          return res.redirect('/login')
      }
      let users = await usermodel.findById(req.session.userId)
      let {search=''}=req.query
        res.render('users/account-profile',{users,search})
      }catch(error){
        console.log(error)
      }
    },
    editProfile:
      async(req,res)=>{
      try{
        let {username,email,phoneno}=req.body
        let users=await usermodel.findById(req.session.userId)
        if (users) {
          let userData = { username, email, phoneno };

          if (req.file) {
            if (users.photo) {
              try {
                await fs.unlink('public/profilepictures/' + users.photo);
              } catch (err) {
                console.error(err);
                req.session.message={
                  type:"danger",
                  message:"Profile picture updation failed"
                }
                return res.redirect('/profile')
              }
            }
            userData.photo = req.file.filename;
          }         
        await usermodel.findByIdAndUpdate(req.session.userId,userData)
        req.session.message={
          type:"success",
          message:"Profile Updated Successfully"
        }
        return res.redirect('/profile')
      }else{
        req.session.message={message:"user not found"}
        return res.redirect('/login')
      }
      }catch(error){
        console.log(error)
      }
    },
    changePassword:async(req,res)=>{
      try{
        if(!req.session.userId){
          return res.redirect('/login')
      }
      let users = await usermodel.findById(req.session.userId)
      let {search=''}=req.query
        res.render('users/account-changePassword',{users,search})
      }
      catch(error){
        console.log(error)
      }
    },
    postChangePassword: [
      check('currentPassword').notEmpty().withMessage('Current password field is missing'),
      check('newPassword').notEmpty().withMessage('New password field is missing')
      .isLength({ min: 6 }).withMessage('Password must be at least 6 characters long')
      .matches(/[!@#$%^&*(),.?":{}|<>]/).withMessage('Password must contain at least one special character')
      ,
      check('confirmPassword').notEmpty().withMessage('Confirm password field is missing'),
  
      async (req, res) => {
        try {
          if (!req.session.userId) {
            return res.status(401).json({ message: "User not authenticated." });
          }
  
          const errors = validationResult(req);
          if (!errors.isEmpty()) {
            const errorMessage = errors.array()[0].msg;
            return res.status(400).json({ message: errorMessage });
          }
  
          const users = await usermodel.findById(req.session.userId);
          const { currentPassword, newPassword, confirmPassword } = req.body;
  
          if (users) {
            const checkPassword = await bcrypt.compare(currentPassword, users.password); 
            
            if (!checkPassword) {
              return res.status(400).json({ message: "Current password is incorrect." });
            } else if (newPassword !== confirmPassword) {
              return res.status(400).json({ message: "New password and confirm password do not match." });
            } else {
              const hashedPassword = await bcrypt.hash(newPassword, 10);
              await usermodel.findByIdAndUpdate(req.session.userId, { $set: { password: hashedPassword } });
              return res.status(200).json({ message: "Password updated successfully." });
            }
          } else {
            return res.status(400).json({ message: "User not found." });
          }
  
        } catch (error) {
          console.log(error);
          res.status(500).json({ message: "An error occurred while updating the password." });
        }
      }],
      getWallet:async(req,res)=>{
        try{
          if (!req.session.userId) {
            return res.redirect('/login')
          }

          let {search = '' ,page=1,limit=5}=req.query
          let users = await usermodel.findById(req.session.userId)

          currentPage=parseInt(page,10)
          let limitNumber=parseInt(limit, 10)

          let skip=(currentPage-1)*limitNumber
          let transactions = users.wallet.transactions.reverse()
          let transactionData=transactions.slice(skip,skip+limitNumber)

          const totalPages = Math.ceil(transactions.length / limitNumber);
          res.render('users/account-wallet',{users,search,totalPages,currentPage,limit: limitNumber,transactionData})

        }
        catch(error){
          console.log(error)
        }
      },

      clearHistory:async(req,res)=>{
        try{
          let userId=req.params.id
          let users=await usermodel.findById(userId)
          if (!users.wallet || !users.wallet.transactions || users.wallet.transactions.length === 0) {
            req.session.message = {
              message: "No data found",
              type: "danger"
            };
            return res.redirect('/wallet');
          }
          users.wallet.transactions = [];
          await users.save()
          req.session.message={
            message:"Transaction History Cleared Successfully",
            type:"success"
          }
          res.redirect('/wallet')
        }
        catch(error){
          console.log(error)
        }
      },

     getWishlist: async (req, res) => {
        try {
          if(!req.session.userId){
            req.session.message={
              message:"user no found please login"
            }
            return res.redirect('/login')
          }
          let { userId } = req.session; 
          let { page = 1, limit = 9, search = '' } = req.query;
          let currentPage = parseInt(page, 10);
          let limitNumber = parseInt(limit, 10);
          let skip = (currentPage - 1) * limitNumber;
          search = search ? search.trim() : '';   
          let id = new mongoose.Types.ObjectId(`${userId}`);  
          let matchProductCondition = {};
          if (search) {
            matchProductCondition = {
              'wishlistproducts.productname': { $regex: search, $options: 'i' } 
            };
          }       
          let productlist = await usermodel.aggregate([
            { $match: {_id:id} }, 
            { $unwind: "$wishlist" },  
            {
                $lookup: {
                    from: "productdetails", 
                    localField: "wishlist",  
                    foreignField: "_id",  
                    as: "wishlistproducts" 
                }
            },
            { $unwind: "$wishlistproducts" },  
            {
                $lookup: {
                    from: "categorydetails",  
                    localField: "wishlistproducts.productcategory",  
                    foreignField: "_id",  
                    as: "categorydata" 
                }
            },
            { $unwind: "$categorydata" }, 
            {
              $match: matchProductCondition 
            }, 
            {
                $project: { 
                    _id: "$wishlistproducts._id",
                    productname: "$wishlistproducts.productname",
                    productcategory: "$wishlistproducts.productcategory",
                    productprice: "$wishlistproducts.productprice",
                    productoffer: "$wishlistproducts.offer",
                    image: "$wishlistproducts.image",
                    productdiscount: "$wishlistproducts.discountPrice",
                    discountSource: "$wishlistproducts.discountSource",
                    categoryoffer: "$categorydata.offer"
                }
            },
            {$skip:skip},
            { $limit: limitNumber } 
        ]);
        let users = await usermodel.findById(userId); 
        let totalProducts=users.wishlist.length
        let totalPages = Math.ceil(totalProducts / limitNumber);
        if(req.xhr){
         return res.status(200).json({ 
            users,
            productlist, 
            totalPages, 
            currentPage 
          });
        }
          res.render('users/wishlist', { search, users, productlist, totalPages, limit: limitNumber, currentPage });
        } catch (error) {
          console.error(error);
          res.status(500).send('Server Error'); 
        }
      }
      ,
      postWishlist:async(req,res)=>{
        try{
          if (!req.session.userId) {
            return res.status(401).json({message:"user not authenticated"})
        }
          let productId=req.body.productId
          let users=await usermodel.findById(req.session.userId)
          let productExist=users.wishlist.find(item=>item._id.toString()===productId.toString())
          if(productExist){
            await usermodel.updateOne(
              { _id: req.session.userId},            
              { $pull: { wishlist: productExist } }  
            );
            return res.status(400).json({message:"product removed from wishlist successfully"})
          }

          users.wishlist.push(productId)
          await users.save()
          res.status(200).json({message:"product added to wishlist successfully"})
        }
        catch(error){
          console.log(error)
        }
      },
      paynow:async(req,res)=>{
        try{
          let orderId=req.body.orderId
          let orderData=await order.findById(orderId)
          if(orderData.status==="Canceled"){
            return res.status(400).json({message:"The order is already canceled"})
          }
          let inactiveProducts = orderData.products.filter(product => product.orderStatus === "Canceled");
          if(inactiveProducts&&orderData.finalPrice){
            return res.status(400).json({message:"canceled product and coupon applied order not possible"})
          }
          let activeProducts = orderData.products.filter(product => product.orderStatus !== "Canceled");

          let updatedTotal = 0;
          if (activeProducts.length > 0) {
            updatedTotal = activeProducts.reduce((acc, curr) => {
              return acc += curr.discountPrice ? curr.discountPrice * curr.quantity : curr.productprice * curr.quantity;
            }, 0);
          } else {
            updatedTotal = orderData.totalAmount;
          }
      
           let priceToCheck = orderData.finalPrice ? orderData.finalPrice : updatedTotal;
          let razorpayOrder=await instance.orders.create({
            amount: priceToCheck * 100, 
            currency: "INR",
            receipt: generateUniqueReceipt(),
            payment_capture: 1 
          })
          res.status(200).json({
            message: 'Razorpay order created',
            razorpayOrderId: razorpayOrder.id,
            amount: priceToCheck,
            currency: "INR",
            totalPrice:orderData.totalPrice,
            finalPrice: orderData.finalPrice || null 
            ,orderId:orderId
        });
        }
        catch(error){
          console.log(error)
        }
      },
      verifypayment:async(req,res)=>{
        try{
          let {orderId,razorpay_payment_id,razorpay_order_id,razorpay_signature,totalPrice,finalPrice}=req.body
          let genertedSignature=crypto.createHmac('sha256',process.env.RAZORPAY_KEYSECRET)
          .update(razorpay_order_id+"|"+razorpay_payment_id)
          .digest('hex');
          if(genertedSignature===razorpay_signature){
            let orders=await order.findByIdAndUpdate(orderId,{$set:{paymentStatus:"Completed"}})
            res.status(200).json({message:"payment success"})
          }else{
            console.log('payment failed')
            res.status(400).json({message:"payment failed"})
        }
      }
          catch(error){
            console.log(error)
          }
      }

    
}


function generateUniqueReceipt(){
  const timestamp = Date.now();

  let randomNum=Math.floor(Math.random() * 10000)

  const receipt = `rcpt_${timestamp}_${randomNum}`;
  return receipt
}
