
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const logger = require('./logger');

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const allowedFormats = ['jpg', 'jpeg', 'png', 'webp', 'avif'];

const createStorage = (folder) => {
    return new CloudinaryStorage({
        cloudinary,
        params: {
            folder,
            allowed_formats: allowedFormats,
            transformation: [
                { quality: 'auto', fetch_format: 'auto' }
            ]
        }
    });
};

const productStorage = createStorage('shoerack/products');
const categoryStorage = createStorage('shoerack/categories');
const offerStorage = createStorage('shoerack/offers');
const carouselStorage = createStorage('shoerack/carousels');

const deleteCloudinaryImage = async (publicId) => {
    if (!publicId) return;

    try {
        const result = await cloudinary.uploader.destroy(publicId);

        if (!['ok', 'not found'].includes(result.result)) {
            logger.warn('Unexpected Cloudinary deletion result', {
                publicId,
                result: result.result
            });
        }

        return result;
    } catch (error) {
        logger.error('Cloudinary image deletion failed', {
            publicId,
            error: error.message,
            stack: error.stack
        });

        throw error;
    }
};

module.exports = {
    cloudinary,
    productStorage,
    categoryStorage,
    offerStorage,
    carouselStorage,
    deleteCloudinaryImage
};
