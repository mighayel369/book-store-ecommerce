
const mongoose = require('mongoose');
const Carousel = require('../../models/carouseldetails');
const { deleteCloudinaryImage } = require('../../config/cloudinary');
const logger = require('../../config/logger');

module.exports = {
    getCourosal: async (_req, res) => {
        try {
            const carousels = await Carousel.find()
                .sort({ createdAt: -1 });

            return res.render('admin/carousal', { carousels });
        } catch (error) {
            logger.error('Failed to fetch carousel banners', {
                error: error.message,
                stack: error.stack
            });

            return res.status(500).send('Failed to load carousel banners');
        }
    },

    addCourosal: async (req, res) => {
        try {
            const { title, description, link } = req.body;

            if (!title || !title.trim()) {
                return res.status(400).send('Title is required');
            }

            if (!req.file) {
                return res.status(400).send('Image is required');
            }

            const carousel = await Carousel.create({
                title: title.trim(),
                description: description || '',
                link: link || '',
                image: req.file.path,
                publicId: req.file.filename
            });

            logger.info('Carousel banner created successfully', {
                carouselId: carousel._id
            });

            return res.redirect('/admin/carousal');
        } catch (error) {
            logger.error('Failed to add carousel banner', {
                error: error.message,
                stack: error.stack
            });

            if (req.file && req.file.filename) {
                try {
                    await deleteCloudinaryImage(req.file.filename);
                } catch (cleanupError) {
                    logger.error('Failed to clean up uploaded carousel image', {
                        publicId: req.file.filename,
                        error: cleanupError.message
                    });
                }
            }

            return res.status(500).send('Failed to add carousel banner');
        }
    },

    replaceCourosal: async (req, res) => {
        let uploadedPublicId = null;

        try {
            const { id } = req.params;
            const { title, description, link, isActive } = req.body;

            if (!mongoose.Types.ObjectId.isValid(id)) {
                return res.status(400).send('Invalid carousel banner ID');
            }

            const carousel = await Carousel.findById(id);

            if (!carousel) {
                return res.status(404).send('Carousel banner not found');
            }

            const oldPublicId = carousel.publicId;

            if (req.file) {
                uploadedPublicId = req.file.filename;
            }

            if (title !== undefined) {
                if (!title.trim()) {
                    return res.status(400).send('Title cannot be empty');
                }

                carousel.title = title.trim();
            }

            if (description !== undefined) {
                carousel.description = description;
            }

            if (link !== undefined) {
                carousel.link = link;
            }

            if (isActive !== undefined) {
                carousel.isActive = isActive === 'true';
            }

            if (req.file) {
                carousel.image = req.file.path;
                carousel.publicId = req.file.filename;
            }

            await carousel.save();

            logger.info('Carousel banner updated successfully', {
                carouselId: carousel._id,
                imageReplaced: Boolean(req.file)
            });

            if (
                req.file &&
                oldPublicId &&
                oldPublicId !== carousel.publicId
            ) {
                try {
                    await deleteCloudinaryImage(oldPublicId);

                    logger.info('Old carousel image deleted from Cloudinary', {
                        carouselId: carousel._id,
                        publicId: oldPublicId
                    });
                } catch (cleanupError) {
                    logger.error('Failed to delete old carousel image', {
                        carouselId: carousel._id,
                        publicId: oldPublicId,
                        error: cleanupError.message
                    });
                }
            }

            return res.redirect('/admin/carousal');
        } catch (error) {
            logger.error('Failed to update carousel banner', {
                carouselId: req.params.id,
                error: error.message,
                stack: error.stack
            });

            if (uploadedPublicId) {
                try {
                    await deleteCloudinaryImage(uploadedPublicId);
                } catch (cleanupError) {
                    logger.error('Failed to clean up replacement carousel image', {
                        publicId: uploadedPublicId,
                        error: cleanupError.message
                    });
                }
            }

            return res.status(500).send('Failed to update carousel banner');
        }
    },

    deleteCourosal: async (req, res) => {
        try {
            const { id } = req.params;

            if (!mongoose.Types.ObjectId.isValid(id)) {
                return res.status(400).send('Invalid carousel banner ID');
            }

            const carousel = await Carousel.findById(id);

            if (!carousel) {
                return res.status(404).send('Carousel banner not found');
            }

            await carousel.deleteOne();

            logger.info('Carousel banner deleted from database', {
                carouselId: carousel._id
            });

            if (carousel.publicId) {
                try {
                    await deleteCloudinaryImage(carousel.publicId);

                    logger.info('Carousel image deleted from Cloudinary', {
                        carouselId: carousel._id,
                        publicId: carousel.publicId
                    });
                } catch (cleanupError) {
                    logger.error('Failed to delete carousel image from Cloudinary', {
                        carouselId: carousel._id,
                        publicId: carousel.publicId,
                        error: cleanupError.message
                    });
                }
            }

        } catch (error) {
            logger.error('Failed to delete carousel banner', {
                carouselId: req.params.id,
                error: error.message,
                stack: error.stack
            });

            return res.status(500).send('Failed to delete carousel banner');
        }
    }
};
