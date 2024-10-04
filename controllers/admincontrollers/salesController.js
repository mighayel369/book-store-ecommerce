let order=require('../../models/order')
const usermodel = require('../../models/userdetails');
let productmodel=require('../../models/productdetails')
const ExcelJS = require('exceljs');
module.exports={
  getSales: async (req, res) => {
    try {
      let completedOrders=await order.find({status:"Delivered"}).populate('userId').sort({ createdAt: -1 });
      res.render('admin/adminSales', { completedOrders });
    } catch (error) {
      console.log(error);  
    }
  },
    downloadReport:async(req,res)=>{
        try{
            let completedOrders=await order.find({status:'Delivered'}).populate('userId')
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Completed Orders');

            worksheet.columns = [
                { header: 'Order ID', key: 'orderId', width: 20 },
                { header: 'Customer Name', key: 'username', width: 30 },
                { header: 'Date', key: 'createdAt', width: 15 },
                { header: 'Total', key: 'totalAmount', width: 15 },
                { header: 'Final Price', key: 'finalPrice', width: 15 },
                { header: 'Payment Method', key: 'paymentMethod', width: 20 }
              ];

              completedOrders.forEach(order => {
                worksheet.addRow({
                  orderId: order.orderId,
                  username: order.userId.username,
                  createdAt: order.createdAt.toISOString().split('T')[0],
                  totalAmount: order.totalAmount,
                  finalPrice: order.finalPrice || order.totalAmount,
                  paymentMethod: order.paymentMethod
                });
              });
              res.setHeader(
                'Content-Type',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
              );
              res.setHeader('Content-Disposition', 'attachment; filename=completed_orders_report.xlsx');
          
              await workbook.xlsx.write(res);
              res.end();
        }
        catch(error){
            console.log(error)
        }
    },
    approveReturn: async (req, res) => {
      try {
        let orderId = req.params.id;
        let productId = req.params.productid;
    
        let orderDetails = await order.findById(orderId);
        if (!orderDetails) {
          return res.status(404).send("Order not found");
        }
   
        let productExist = orderDetails.products.find(item => item.productId.toString() === productId.toString());
        if (!productExist) {
          return res.status(404).send("Product not found in order");
        }

        productExist.orderStatus = "Returned";
        productExist.returnRequest = "Approved";
  
        await productmodel.findByIdAndUpdate(productId, { $inc: { stockqty: productExist.quantity } });
    
        let price = productExist.discountPrice ? productExist.discountPrice : productExist.productprice;
        let user = await usermodel.findById(orderDetails.userId);
        if (!user) {
          return res.status(404).send("User not found");
        }
    
        user.wallet.balance += price;
        user.wallet.transactions.push({
          amount: price,
          transactionType: 'credit',
          description: `Refund of ₹${price} credited to your wallet.`
        });

        await user.save();
        await orderDetails.save();

        res.redirect(`/admin/orderdetails/${orderId}`);
      } catch (error) {
        console.error(error);
        res.status(500).send("Server error, unable to approve return request");
      }
    },
    rejectReturn: async (req, res) => {
      try {
        let orderId = req.params.id;
        let productId = req.params.productid;
    
        let orderDetails = await order.findById(orderId);
        if (!orderDetails) {
          return res.status(404).send("Order not found");
        }
    
        let productExist = orderDetails.products.find(item => item.productId.toString() === productId.toString());
        if (!productExist) {
          return res.status(404).send("Product not found in order");
        }
    
        productExist.returnRequest = "Rejected";
    
        await orderDetails.save();
  
        res.redirect(`/admin/orderdetails/${orderId}`);
      } catch (error) {
        console.log(error);
        res.status(500).send("Server error");
      }
    },
    getSalesData:async(req,res)=>{
      try{
        let salesData;
        let {filter}=req.query
        if(filter==='monthly'){
          salesData=await order.aggregate([
            {$match:{status:"Delivered"}},
            {
              $group:{
                _id:{year:{$year:"$createdAt"},month:{$month:"$createdAt"}},
              totalSales:{$sum:{
                $cond:{
                  if:{$ne:["$finalPrice",null]},
                  then:"$finalPrice",
                  else: "$totalAmount"
                }
              }},
              orderCount: { $sum: 1 } 
            }
          },
          {$sort: { "_id.year": 1, "_id.month": 1 }}

          ])
        }else{
          salesData = await order.aggregate([
            {
              $group: {
                _id: {
                  year: { $year: "$createdAt" }  
                },
                totalSales:{$sum:{
                  $cond:{
                    if:{$ne:["$finalPrice",null]},
                    then:"$finalPrice",
                    else: "$totalAmount"
                  }
                }}, 
                orderCount: { $sum: 1 }               
              }
            },
            { 
              $sort: { "_id.year": 1 }  
            }
          ]);
        }
        res.status(200).json(salesData);
      }
      catch(error){
        console.log(error)
      }
    },
    getDashboard:async(req,res)=>{
      try{
        let users=await usermodel.find()
        let categories=await order.aggregate([
          { $unwind: '$products' },
          {
            $lookup:{
              from:"productdetails",
              localField:"products.productId",
              foreignField:"_id",
              as:"productDetails"
            }
          },
          { $unwind: '$productDetails' },
          {
            $lookup: {
              from: 'categorydetails', 
              localField: 'productDetails.productcategory',
              foreignField: '_id',
              as: 'categoryDetails'
            }
          },
          { $unwind: '$categoryDetails' },
          {
            $group:{
              _id:"$categoryDetails.categoryname",
              totalSold: { $sum: '$products.quantity' }
            }
          },
          {$sort:{totalSold:-1}},
          {$limit:10}

        ])
        let products=await productmodel.find().sort({popularityScore:-1}).limit(10)
        res.render('admin/adminDashboard',{users,products,categories})
      }
      catch(error){
        console.log(error)
      }
    }
}