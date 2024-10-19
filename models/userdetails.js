let mongoose=require('mongoose')

const addressSchema = new mongoose.Schema({
  fullname: { type: String },
  phoneno: { type: Number },
  houseno: { type: String },
  area: { type: String },
  landmark: { type: String },
  town: { type: String },
  state: { type: String },
  pincode: { type: Number },
  default: { type: Boolean, default: false }
});

const userSchema = new mongoose.Schema({
    username: { type: String },
    email: { type: String},
    phoneno:{type:Number,sparse:true,default:null},
    googleId:{
      type:String
    },
    facebookId:{
      type:String
    },
    password: { type: String},
    role: { type: String, enum: ['admin', 'user'], default: 'user' },
    status: { type: Boolean, default: true },
    cart:[
      {
        productId:{
          type:mongoose.Schema.Types.ObjectId,
          ref:'productdetails'
        },
        quantity:{
          type:Number,
          default:0,
        },
        userStock:{
          type:Number,
          min:0,
          default:0
        }
      }
    ],
    coupon: {  
      couponId: { type: mongoose.Schema.Types.ObjectId, ref: 'coupon' },
      discountTotal: { type: Number },
      deductedValue: { type: Number }
  },
  wallet:{
    balance: { type: Number, default: 0,min:0}, 
    transactions:[{
      amount: Number,
      transactionType:{type:String,enum:['credit', 'debit'],},
      date: { type: Date, default: Date.now },
      description: String,
    }]
  },
  photo:{
    type:String
  },
  wishlist: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'productdetails'
  }],
    address:[{ type: mongoose.Schema.Types.ObjectId, ref: 'address' }]
  
    }, { collection: 'usersdetails' ,  timestamps: true });

module.exports= mongoose.model('usersdetails',userSchema)