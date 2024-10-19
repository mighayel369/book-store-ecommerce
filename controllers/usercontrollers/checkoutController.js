let usermodel=require('../../models/userdetails')
let mongoose=require('mongoose')
let order=require('../../models/order')
let addressmodel=require('../../models/address')
let coupon=require('../../models/coupon')
let Razorpay=require('razorpay')
const dotenv = require('dotenv');
dotenv.config()

var instance = new Razorpay({
    key_id: process.env.RAZORPAY_KEYID,
    key_secret: process.env.RAZORPAY_KEYSECRET,
  });
module.exports={
    getCheckout: async (req, res) => {
        try {
            let { search = '' } = req.query;
    
            if (!req.session.userId) {
                return res.redirect('/login');
            }
    
            let userId = req.session.userId;
            let id = new mongoose.Types.ObjectId(`${userId}`);
            let cartData = await usermodel.aggregate([
                { $match: { _id: id } },
                { $unwind: '$cart' },
                {
                    $lookup: {
                        from: 'productdetails',
                        localField: 'cart.productId',
                        foreignField: '_id',
                        as: 'productData'
                    }
                },
                { $unwind: '$productData' },
                {
                    $lookup: {
                        from: 'categorydetails',
                        localField: 'productData.productcategory',
                        foreignField: '_id',
                        as: 'categoryData'
                    }
                },
                { $unwind: '$categoryData' },
                {
                    $project: {
                        _id: 0,
                        image: '$productData.image',
                        productId: '$productData._id',
                        productname: '$productData.productname',
                        productprice: '$productData.productprice',
                        categoryname: '$categoryData.categoryname',
                        quantity: '$cart.quantity',
                        offer:'$categoryData.offer',
                        discountPrice:'$productData.discountPrice',
                        productoffer:'$productData.offer',
                        discountSource:'$productData.discountSource'
                    }
                }
            ]);
            let subtotal = 0;
            cartData.forEach(item => {
                subtotal+=item.offer.isOfferActive?item.discountPrice*item.quantity:item.productprice*item.quantity
            });
    
            let users = await usermodel.findById(userId).populate('address');
            let deductedValue = users.coupon ? users.coupon.deductedValue : 0;
            let finalTotal = subtotal - deductedValue;
            const coupons = await coupon.find({
                isActive: true,
                $or: [
                  { minimumPurchaseAmount: 0 }, 
                  { minimumPurchaseAmount: { $lte: subtotal } } 
                ]
              });
            res.render('users/checkout', { users, cartData, search, coupons, finalTotal,deductedValue });
    
        } catch (error) {
            console.log(error);
            res.status(500).send("An error occurred during checkout");
        }
    },
    
    
    updateDefaultAddress:async (req,res)=>{
        try{
            let selectedAddressId=req.body.selectedAddress
            const user = await usermodel.findById(req.session.userId).populate('address');
            const selectedAddress = user.address.find(addr => addr._id.toString() === selectedAddressId);

            await addressmodel.updateMany(
                { _id: { $in: user.address }, default: true },
                { $set: { default: false } }
              )
            await addressmodel.updateOne(
                { _id: selectedAddressId },
                { $set: { default: true } }
              );
            res.redirect('/checkout')
        }catch(error){
            console.log(error)
        }
    },
    placeOrder: async (req, res) => {
        try {
            let { paymentMethod, totalPrice, finalPrice } = req.body;
            if (paymentMethod === 'cod') {
                let users = await usermodel.findById(req.session.userId).populate('address') .populate('cart.productId')
                let couponId = users.coupon.couponId;
                if (couponId) {
                    let couponDetails = await coupon.findById(couponId);
                    updateCoupon(couponDetails, users);
                }
                let defaultAddress = users.address.find(addr => addr.default);
                if (!defaultAddress) {
                    return res.status(400).json({ message: 'Default address not found' });
                  }

                let date = new Date();
                date.setDate(date.getDate() + 7);
                let deliveryDate = date;
                let Products = users.cart.map((product) => ({
                    productId: product.productId._id,
                    productName: product.productId.productname,
                    quantity: product.quantity,
                    productprice: product.productId.productprice,
                    discountPrice:product.productId.discountPrice
                }))
                let orders = {
                    orderId: generateOrderId(),
                    userId: req.session.userId,
                    paymentMethod: "Cod",
                    deliveryExpected: deliveryDate, 
                    totalAmount: totalPrice,
                    finalPrice:finalPrice||null,
                    shippingAddress: defaultAddress._id,
                    products:Products,
                    paymentStatus:'Pending'
                }

                if(orders.finalPrice>=1000||orders.totalAmount>=1000){
                    return res.status(400).json({message:"Order Above 1000 For COD Is Not Applicable"})
                  }

                await Promise.all(users.cart.map(async (product) => {
                    product.productId.popularityScore +=product.quantity;
                    product.productId.stockqty-=product.userStock
                    await product.productId.save(); 
                }));
                let ordered=await order(orders)
                await ordered.save()
                users.cart=[]
                users.coupon={}
                await users.save()
                res.status(200).json({message:'success',orderId: ordered._id })
            } else if (paymentMethod === 'wallet') {
                let users = await usermodel.findById(req.session.userId).populate('address') .populate('cart.productId')
                let priceToCheck = finalPrice ? finalPrice : totalPrice;
                if(users.wallet.balance >= priceToCheck){
                    let couponid=users.coupon.couponId

                    let couponDetails=await coupon.findById(couponid)
                   updateCoupon(couponDetails,users)
                   let defaultAddress = users.address.find(addr => addr.default);
                   if (!defaultAddress) {
                       return res.status(400).json({ message: 'Default address not found' });
                     }
                   users.wallet.balance -= priceToCheck;
                   users.wallet.transactions.push({
                    amount:priceToCheck,
                    transactionType:'debit',
                    description:`${priceToCheck} debited from wallet`
                   })
                   let date = new Date();
                   date.setDate(date.getDate() + 7);
                   let deliveryDate = date;
                   let Products = users.cart.map((product) => ({
                       productId: product.productId._id,
                       productName: product.productId.productname,
                       quantity: product.quantity,
                       productprice: product.productId.productprice,
                       discountPrice:product.productId.discountPrice
                   }));
                   let orders = {
                       orderId: generateOrderId(),
                       userId: req.session.userId,
                       paymentMethod: "Wallet",
                       deliveryExpected: deliveryDate, 
                       totalAmount: totalPrice,
                       finalPrice:finalPrice||null,
                       shippingAddress: defaultAddress._id,
                       products:Products,
                       paymentStatus:'Completed'
                   }
                   await Promise.all(users.cart.map(async (product) => {
                       product.productId.popularityScore +=product.quantity;
                       product.productId.stockqty-=product.userStock
                       await product.productId.save(); 
                   }));
                   let ordered=await order(orders)
                   await ordered.save()
                   users.cart=[]
                   users.coupon={}
                   await users.save()
                   res.status(200).json({message:'success',orderId: ordered._id })
                }else{
                      return res.status(400).json({ message: 'Insufficient amount in wallet' });
                }
            } else{
                let users = await usermodel.findById(req.session.userId).populate('address') .populate('cart.productId')
                let couponId = users.coupon.couponId;
                if (couponId) {
                    let couponDetails = await coupon.findById(couponId);
                    updateCoupon(couponDetails, users);
                }
                let defaultAddress = users.address.find(addr => addr.default);
                if (!defaultAddress) {
                    return res.status(400).json({ message: 'Default address not found' });
                  }

                let date = new Date();
                date.setDate(date.getDate() + 7);
                let deliveryDate = date;
                let Products = users.cart.map((product) => ({
                    productId: product.productId._id,
                    productName: product.productId.productname,
                    quantity: product.quantity,
                    productprice: product.productId.productprice,
                    discountPrice:product.productId.discountPrice
                }))
                let orders = {
                    orderId: generateOrderId(),
                    userId: req.session.userId,
                    paymentMethod: "Online",
                    deliveryExpected: deliveryDate, 
                    totalAmount: totalPrice,
                    finalPrice:finalPrice||null,
                    shippingAddress: defaultAddress._id,
                    products:Products,
                    paymentStatus:'Pending'
                }

                await Promise.all(users.cart.map(async (product) => {
                    product.productId.popularityScore +=product.quantity;
                    product.productId.stockqty-=product.userStock
                    await product.productId.save(); 
                }));
                let ordered=await order(orders)
                await ordered.save()
                users.cart=[]
                users.coupon={}
                await users.save()



                let priceToCheck = finalPrice ? finalPrice : totalPrice;
                const razorpayOrder = await instance.orders.create({
                    amount: priceToCheck * 100, 
                    currency: "INR",
                    receipt: generateUniqueReceipt(),
                    payment_capture: 1 
                });
                res.status(200).json({
                    message: 'Razorpay order created',
                    razorpayOrderId: razorpayOrder.id,
                    amount: priceToCheck,
                    currency: "INR",
                    totalPrice,
                    finalPrice: finalPrice || null ,
                    orderId:ordered._id
                });
            }
        } catch (error) {
            console.log(error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    },
    applyCoupon: async (req, res) => {
        try {
            let couponId = req.params.id;
            let userId = req.session.userId;
        
            const user = await usermodel.findById(userId).populate('cart.productId');
            const newCouponDetails = await coupon.findById(couponId);
    
            cartTotal=user.cart.reduce((acc,curr)=>{
                acc+=curr.productId.productprice*curr.quantity
                return acc
            },0)
    
            let discountedTotal = cartTotal;
            let deductedValue = 0;
    
            if (newCouponDetails.discountType === 'percentage') {
                discountedTotal = cartTotal - (cartTotal * (newCouponDetails.discountValue / 100));
                deductedValue = cartTotal - discountedTotal;
            } else if (newCouponDetails.discountType === 'fixed') {
                discountedTotal = cartTotal - newCouponDetails.discountValue;
                deductedValue = cartTotal - discountedTotal;
            }
            user.coupon = {
                couponId: newCouponDetails._id,
                discountTotal: discountedTotal,
                deductedValue
            };
            await user.save();
            req.session.message={
                type:"success",
                message:"Coupon Applied Successfully"
            }
            res.redirect('/checkout');
        } catch (error) {
            console.log(error);
            res.status(500).send("An error occurred while applying the coupon.");
        }
    },
    removeCoupon: async (req, res) => {
        if (!req.session.userId) {  // Corrected the condition here
            return res.redirect('/login'); 
        }
    
        try {
            let user = await usermodel.findById(req.session.userId);
            if (user.coupon && Object.keys(user.coupon).length > 0) {
                user.coupon = {}; 
                await user.save();  
            }

            res.redirect('/checkout');
        } catch (error) {
            console.log(error);
            res.status(500).json({ message: 'An error occurred while removing the coupon.' });
        }
    }
    
}




function updateCoupon(couponDetails, users) {
    if (couponDetails) {
        couponDetails.usageLimit += 1;
        let checkUser = couponDetails.userUsage.find(item => item.userId.toString() === users._id.toString());
        if (checkUser) {
            checkUser.usageCount += 1;
        } else {
            couponDetails.userUsage.push({ userId: users._id, usageCount: 1 });
        }
        couponDetails.save();
    }
}

function generateUniqueReceipt(){
    const timestamp = Date.now();

    let randomNum=Math.floor(Math.random() * 10000)

    const receipt = `rcpt_${timestamp}_${randomNum}`;
    return receipt
}


function generateOrderId() {
    return 'ORD' + Math.floor(Math.random() * 10000000000);
}

