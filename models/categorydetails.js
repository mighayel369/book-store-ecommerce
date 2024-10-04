let mongoose=require('mongoose')
const categorySchema = new mongoose.Schema({
    categoryname: { type: String},
    categorydescription: { type: String},
    productsqty: { type: Number},
    image:{type:String},
    offer: {
      isOfferActive: { type: Boolean, default: false },
      discountType: { type: String, enum: ['percentage', 'fixed'], default: 'percentage' },
      discountValue: { type: Number, default: 0 },
      startDate: { type: Date, default: Date.now },
      endDate: { type: Date, default: Date.now },
      bannerImage: { type: String, default: '' },
      offerDescription: { type: String, default: '' }
    }
  },  { timestamps: true } );

module.exports= mongoose.model('categorydetails',categorySchema)