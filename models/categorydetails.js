const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  categoryname: { type: String },
  categorydescription: { type: String },
  productsqty: { type: Number },
  image: { type: String, default: '' },

  imagePublicId: { type: String, default: '' },

  offer: {
    isOfferActive: { type: Boolean, default: false },
    discountType: {
      type: String,
      enum: ['percentage', 'fixed'],
      default: 'percentage'
    },
    discountValue: { type: Number, default: 0 },
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date, default: Date.now },
    bannerImage: String,
    publicId: String,
    offerDescription: { type: String, default: '' }
  }
}, { timestamps: true });

module.exports = mongoose.model('categorydetails', categorySchema);