const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
  code: {
    type: String,
    unique: true,
    uppercase: true,
    trim: true,
    required: true 
  },
  description: {
    type: String,
    trim: true 
  },
  discountType: {
    type: String,
    enum: ['percentage', 'fixed'], 
    required: true 
  },
  discountValue: {
    type: Number,
    required: true, 
    min: 0 
  },
  minimumPurchaseAmount: {
    type: Number,
    default: 0,
    min: 0 
  },
  usageLimit: {
    type: Number,
    default: 0, 
    min: 0 
  },
  userUsage: [
    {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'userdetails' },
      usageCount: { type: Number, default: 0 }
    }
  ],
  startDate: {
    type: Date,
    default: Date.now
  },
  endDate: {
    type: Date, 
    required: true 
  },
  isActive: {
    type: Boolean,
    default: true 
  }
}, { timestamps: true });


module.exports = mongoose.model('Coupon', couponSchema);