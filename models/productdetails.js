const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  productname: { type: String },
  productdescription: { type: String },
  stockqty: { type: Number, default: 0 },

  image: [{ type: String }],

  imagePublicIds: {
    type: [String],
    default: []
  },

  productprice: { type: Number },
  productcategory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'categorydetails'
  },
  popularityScore: { type: Number, default: 0 },

  offer: {
    isOfferActive: { type: Boolean, default: false },
    discountType: { type: String, enum: ['percentage', 'fixed'] },
    discountValue: { type: Number },
    startDate: { type: Date },
    endDate: { type: Date },
    bannerImage: String, 
    publicId: String,
    offerDescription: { type: String }
  },

  discountPrice: { type: Number, default: 0 },
  discountSource: {
    type: String,
    enum: ['product', 'category'],
    default: null
  }
}, { timestamps: true });

module.exports = mongoose.model('productdetails', productSchema);