let mongoose=require('mongoose')

let orderSchema=new mongoose.Schema({
    orderId:{type:String},
    userId:{type:mongoose.Schema.Types.ObjectId, ref:'usersdetails'},
    status:{type:String,enum:["Confirmed", "Shipped", "Delivered", "Canceled","Returned","Pending"],default:'Confirmed'},
    paymentMethod:{type:String},
    deliveryExpected: {type: Date},
    totalAmount:{type:Number},
    finalPrice:{type:Number},
    razorpayOrderId:{type:String},
    shippingAddress: { type: mongoose.Schema.Types.ObjectId, ref: 'address' },
    paymentStatus:{type:String,enum:['Completed','Pending']},
    products:[
        {
            productId:{type:mongoose.Schema.Types.ObjectId,ref:'productdetails'},
            productName:{type:String},
            quantity:{type:Number,max:5},
            productprice: {type: Number},
            discountPrice:{type:Number},
            orderStatus:{type:String,enum:["Canceled","Returned","Delivered"]},
            reason:{type:String},
            returnRequest:{type:String,enum: ['Pending', 'Approved', 'Rejected']}
        }
    ],
    isReturnRequested:{type:Boolean,default:false}
},{timestamps:true})


module.exports=mongoose.model('order',orderSchema)  