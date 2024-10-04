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


module.exports=mongoose.model('address',addressSchema)