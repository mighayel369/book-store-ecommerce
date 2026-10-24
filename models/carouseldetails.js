const mongoose = require('mongoose');

const carouselSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true
        },
        description: {
            type: String,
            trim: true,
            default: ''
        },
        image: {
            type: String,
            required: true
        },
        publicId: {
            type: String,
            required: true
        },
        link: {
            type: String,
            trim: true,
            default: ''
        },
        isActive: {
            type: Boolean,
            default: true
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model('Carousel', carouselSchema);