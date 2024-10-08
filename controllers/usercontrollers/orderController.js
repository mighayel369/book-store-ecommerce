let usermodel=require('../../models/userdetails')
let mongoose=require('mongoose')
let order=require('../../models/order')
let addressmodel=require('../../models/address')
let product=require('../../models/productdetails')
const PDFDocument = require('pdfkit');
const crypto = require('crypto');
const dotenv = require('dotenv');
const fs = require('fs');
dotenv.config()
module.exports={
    getOrder:async(req,res)=>{
        try{
            let {search=''}=req.query
            let orders = await order.find()
            .populate('userId')
            .sort({ createdAt: -1 });
            res.render('admin/adminOrder',{orders,search})

        }catch(error){
            console.log(error)
        }
    },
    updateStatus: async (req, res) => {
        try {
            const updatedOrder = await order.findById(req.body.orderId);
            
            if (!updatedOrder) {
                return res.status(404).json({ message: "Order not found" });
            }
    
            if (req.body.status === "Delivered" && updatedOrder.paymentMethod === "cod") {
                updatedOrder.paymentStatus = "Completed"; 
            }

            const activeProducts = updatedOrder.products.filter(product => {
                return !['Canceled', 'Returned'].includes(product.orderStatus);
            });

            activeProducts.forEach(product => {
                product.orderStatus = req.body.status; 
            });
            updatedOrder.status = req.body.status

            await updatedOrder.save();

            res.status(200).json({ message: "Order status updated successfully" });
        } catch (error) {
            console.error('Error updating order status:', error);
            res.status(500).json({ message: "Internal Server Error" });
        }
    },
    cancelOrderReason:async(req,res)=>{
        try{
            let orderid=req.params.id
            let productid=req.params.productId
            let users=await usermodel.findById(req.session.userId)
            let search=''
            res.render('users/cancelReason',{search,users,orderid,productid})
        }
        catch(error){
            console.log(error)
        }
    },
    cancelOrder:async(req,res)=>{
        try{
            const userId = req.session.userId;
            const { orderId, reason, productId } = req.body;

            const user = await usermodel.findById(userId);
            const orderDetails = await order.findById(orderId);
            if (!user || !orderDetails) {
                console.error("User or order not found.");
                return res.redirect('/login');
            }

            const productExist = orderDetails.products.find(item => item.productId.toString() === productId.toString());

            if (!productExist) {
                return res.status(404).json({ message: "Product not found in the order" })
            }
            const productUpdate = await product.findByIdAndUpdate(productId, {
                $inc: { stockqty: productExist.quantity }
            });
            const refundAmount = productExist.discountPrice ? productExist.discountPrice * productExist.quantity : productExist.productprice * productExist.quantity;

            if (orderDetails.paymentStatus==="Completed") {
                user.wallet.balance += refundAmount;
                user.wallet.transactions.push({
                    amount: refundAmount,
                    transactionType: 'credit',
                    description: `Refund of ₹${refundAmount} credited to wallet for product ${productExist.productName}.`
                });
    
                await user.save();
            }
            productExist.orderStatus = 'Canceled';
            productExist.reason = reason;

            if (orderDetails.products.every(p => p.orderStatus === 'Canceled')) {
                orderDetails.status = 'Canceled';
            }

            await orderDetails.save();

            res.status(200).json({message:"your order canceled successfully"})
        }catch(error){
            res.status(500).json({error:"something wrong try again"})
        }
    },
    showSuccesPage:async(req,res)=>{
        try{
            if(!req.session.userId){
                return res.redirect('/login')
            }
        let {search=''}=req.query
        users=await usermodel.findById(req.session.userId)
        res.render('users/success-order',{search,users})
    }catch(error){
        console.log(error)
    }
},
verifyPayment:async(req,res)=>{
   try{
    let {orderId,razorpay_payment_id,razorpay_order_id,razorpay_signature,totalPrice,finalPrice}=req.body
    console.log(req.body)
    let generatedSignture=crypto.createHmac('sha256',process.env.RAZORPAY_KEYSECRET)
    .update(razorpay_order_id+"|"+razorpay_payment_id)
    .digest('hex');
    if(generatedSignture===razorpay_signature){
        let orders=await order.findByIdAndUpdate(orderId,{$set:{paymentStatus:"Completed"}})
        res.status(200).json({message:"success",orderId:orderId})
    }else{
        console.log('payment failed')
    }
   }
   catch(error){
    console.log(error)
    res.status(500).json({message:"Internal Server Error"})
   }
},
returnOrderReason:async(req,res)=>{
    try{
        let orderid=req.params.id
        let productid=req.params.productId
        let users=await usermodel.findById(req.session.userId)
        let search=''
        res.render('users/returnReason',{users,orderid,search,productid})
    }
    catch(error){
        console.log(error)
    }
},
returnOrder:async(req,res)=>{    
    try{
        const userId = req.session.userId;
        let {orderId,reason,productId}=req.body
        const user = await usermodel.findById(userId);
        const orderDetails = await order.findById(orderId);
        if (!user || !orderDetails) {
            console.error("User or order not found.");
            return res.redirect('/login');
        }
        const productExist = orderDetails.products.find(item => item.productId.toString() === productId.toString());
        orderDetails.isReturnRequested=true
        productExist.reason = reason;
        productExist.returnRequest="Pending"

        await orderDetails.save();


        res.status(200).json({message:"success"})
    }
    catch(error){
        console.log(error)
    }
},
orderDetails:async(req,res)=>{
    try{
        let orderid=req.params.id
        let orderDetails=await order.findById(orderid).populate('shippingAddress')
        let users=await usermodel.findById(orderDetails.userId)
        res.render('admin/adminOrderDetails',{orderDetails,users})
    }
    catch(error){
        console.log(error)
    }
},
getSingleOrder:async(req,res)=>{
    try{
        let orderid=req.params.id
        let orderDetails=await order.findById(orderid).populate('shippingAddress')
        let users=await usermodel.findById(orderDetails.userId)
        res.render('admin/singleOrderDetails',{orderDetails,users})
    }
    catch(error){
        console.log(error)
    }
},

downloadInvoice: async (req, res) => {
    try {
      let orders = await order.findById(req.params.id).populate('shippingAddress');
      
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50
      });
  
      const invoiceName = `Invoice-${orders._id}.pdf`;
      res.setHeader('Content-Disposition', `attachment; filename="${invoiceName}"`);
      res.setHeader('Content-Type', 'application/pdf');
      doc.pipe(res);
  

      doc.fontSize(25).text('Book Club', { align: 'center', underline: true });
      doc.moveDown(0.5);
      doc.fontSize(20).text('INVOICE', { align: 'center' });
      doc.moveDown(1);

      doc.fontSize(12).text(`Order ID: ${orders.orderId}`, { align: 'left' });
      doc.fontSize(12).text(`Date: ${new Date().toLocaleDateString()}`, { align: 'left' });
      doc.moveDown()
  
  
      doc.fontSize(14).text('Shipping Address:', { underline: true });
      doc.fontSize(12).text(`${orders.shippingAddress.fullname}`);
      doc.text(`${orders.shippingAddress.houseno}, ${orders.shippingAddress.area}`);
      doc.text(`${orders.shippingAddress.landmark}`);
      doc.text(`${orders.shippingAddress.town}, ${orders.shippingAddress.state}`);
      doc.text(`${orders.shippingAddress.pincode}`);
      doc.moveDown(2);

      doc.fontSize(14).text('Products:', { underline: true });
      doc.moveDown(0.5);
  
      doc.fontSize(12).font('Helvetica-Bold');
      doc.text('Product Name', 50, doc.y, { continued: true });
      doc.text('Quantity', 150, doc.y, { continued: true });
      doc.text('Price', 250, doc.y)
      doc.moveDown(0.5)
      
      doc.font('Helvetica')
      orders.products.forEach(product => {
        doc.fontSize(12).text(product.productName, 50, doc.y, { continued: true })
        doc.text(`${product.quantity}`, 150, doc.y, { continued: true })
        doc.text(`₹${(product.productprice * product.quantity)}`, 280, doc.y)
    });
      doc.moveDown(1);
  
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown(1);

      doc.font('Helvetica-Bold').fontSize(14).text(`Grand Total: ₹${orders.finalPrice ? orders.finalPrice.toFixed(2) : orders.totalAmount.toFixed(2)}`, { align: 'right' });
      
      doc.end();
    } catch (error) {
      console.log(error);
      res.status(500).send('Failed to generate invoice');
    }
  }
  


}


function generateOrderId() {
    return 'ORD' + Math.floor(Math.random() * 10000000000);
}