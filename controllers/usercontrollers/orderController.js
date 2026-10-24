
let usermodel = require('../../models/userdetails');
let order = require('../../models/order');
let product = require('../../models/productdetails');
const PDFDocument = require('pdfkit');
const crypto = require('crypto');
const dotenv = require('dotenv');
const logger = require('../../config/logger');

dotenv.config();

module.exports = {
    getOrder: async (req, res) => {
        try {
            let { search = '' } = req.query;

            let orders = await order.find()
                .populate('userId')
                .sort({ createdAt: -1 });

            res.render('user/account-orders', { orders, search });
        } catch (error) {
            logger.error('Failed to fetch orders', {
                error: error.message,
                stack: error.stack
            });

            if (!res.headersSent) {
                res.status(500).send('Internal Server Error');
            }
        }
    },

    cancelOrderReason: async (req, res) => {
        try {
            let orderid = req.params.id;
            let productid = req.params.productId;
            let users = await usermodel.findById(req.session.userId);
            let search = '';

            res.render('users/cancelReason', {
                search,
                users,
                orderid,
                productid
            });
        } catch (error) {
            logger.error('Failed to load order cancellation reason page', {
                orderId: req.params.id,
                productId: req.params.productId,
                error: error.message,
                stack: error.stack
            });

            if (!res.headersSent) {
                res.status(500).send('Internal Server Error');
            }
        }
    },

    cancelOrder: async (req, res) => {
        try {
            const userId = req.session.userId;
            const { orderId, reason, productId } = req.body;

            const user = await usermodel.findById(userId);
            const orderDetails = await order.findById(orderId);

            if (!user || !orderDetails) {
                logger.warn('User or order not found during cancellation', {
                    userId,
                    orderId
                });

                return res.redirect('/login');
            }

            const productExist = orderDetails.products.find(
                item => item.productId.toString() === productId.toString()
            );

            if (!productExist) {
                logger.warn('Product not found in order during cancellation', {
                    orderId,
                    productId
                });

                return res.status(404).json({
                    message: 'Product not found in the order'
                });
            }

            await product.findByIdAndUpdate(productId, {
                $inc: { stockqty: productExist.quantity }
            });

            const refundAmount = productExist.discountPrice
                ? productExist.discountPrice * productExist.quantity
                : productExist.productprice * productExist.quantity;

            if (orderDetails.paymentStatus === 'Completed') {
                user.wallet.balance += refundAmount;

                user.wallet.transactions.push({
                    amount: refundAmount,
                    transactionType: 'credit',
                    description: `Refund of ₹${refundAmount} credited to wallet for product ${productExist.productName}.`
                });

                await user.save();
            }

            productExist.orderStatus = 'Canceled';
            productExist.reason = reason;

            if (orderDetails.products.every(p => p.orderStatus === 'Canceled')) {
                orderDetails.status = 'Canceled';
            }

            await orderDetails.save();

            logger.info('Order product canceled successfully', {
                userId,
                orderId,
                productId,
                refundAmount
            });

            return res.status(200).json({
                message: 'your order canceled successfully'
            });
        } catch (error) {
            logger.error('Failed to cancel order product', {
                orderId: req.body.orderId,
                productId: req.body.productId,
                error: error.message,
                stack: error.stack
            });

            return res.status(500).json({
                error: 'something wrong try again'
            });
        }
    },

    showSuccesPage: async (req, res) => {
        try {
            if (!req.session.userId) {
                return res.redirect('/login');
            }

            let { search = '' } = req.query;
            let users = await usermodel.findById(req.session.userId);

            res.render('users/successorder', { search, users });
        } catch (error) {
            logger.error('Failed to load order success page', {
                userId: req.session.userId,
                error: error.message,
                stack: error.stack
            });

            if (!res.headersSent) {
                res.status(500).send('Internal Server Error');
            }
        }
    },

    verifyPayment: async (req, res) => {
        try {
            let {
                orderId,
                razorpay_payment_id,
                razorpay_order_id,
                razorpay_signature
            } = req.body;

            let generatedSignture = crypto
                .createHmac('sha256', process.env.RAZORPAY_KEYSECRET)
                .update(razorpay_order_id + '|' + razorpay_payment_id)
                .digest('hex');

            if (generatedSignture === razorpay_signature) {
                let orders = await order.findByIdAndUpdate(
                    orderId,
                    { $set: { paymentStatus: 'Completed' } }
                );

                if (!orders) {
                    logger.warn('Payment verified but order was not found', {
                        orderId
                    });

                    return res.status(404).json({
                        message: 'Order not found'
                    });
                }

                logger.info('Payment signature verified successfully', {
                    orderId
                });

                return res.status(200).json({
                    message: 'success',
                    orderId
                });
            }

            logger.warn('Razorpay payment signature verification failed', {
                orderId,
                razorpay_order_id
            });

            return res.status(400).json({
                message: 'Payment verification failed'
            });
        } catch (error) {
            logger.error('Failed to verify payment', {
                orderId: req.body.orderId,
                error: error.message,
                stack: error.stack
            });

            return res.status(500).json({
                message: 'Internal Server Error'
            });
        }
    },

    returnOrder: async (req, res) => {
        try {
            const userId = req.session.userId;

            if (!userId) {
                return res.status(401).json({
                    message: 'Please log in to request a return.'
                });
            }

            const { orderId, productId, reason } = req.body;

            if (!orderId || !productId || !reason || !reason.trim()) {
                return res.status(400).json({
                    message: 'Order ID, product ID, and return reason are required.'
                });
            }

            const orderDetails = await order.findOne({
                _id: orderId,
                userId
            });

            if (!orderDetails) {
                logger.warn('Order not found during return request', {
                    userId,
                    orderId
                });

                return res.status(404).json({
                    message: 'Order not found.'
                });
            }

            const productExist = orderDetails.products.find(
                item =>
                    item.productId &&
                    item.productId.toString() === productId.toString()
            );

            if (!productExist) {
                logger.warn('Product not found in order during return request', {
                    userId,
                    orderId,
                    productId
                });

                return res.status(404).json({
                    message: 'Product not found in this order.'
                });
            }

            if (productExist.orderStatus !== 'Delivered') {
                return res.status(400).json({
                    message: 'Only delivered products can be returned.'
                });
            }

            if (productExist.returnRequest) {
                return res.status(400).json({
                    message: 'A return request already exists for this product.'
                });
            }

            productExist.reason = reason.trim();
            productExist.returnRequest = 'Pending';
            orderDetails.isReturnRequested = true;

            await orderDetails.save();

            logger.info('Return request submitted successfully', {
                userId,
                orderId,
                productId
            });

            return res.status(200).json({
                message: 'Your return request has been submitted successfully.'
            });
        } catch (error) {
            logger.error('Error submitting return request', {
                orderId: req.body.orderId,
                productId: req.body.productId,
                error: error.message,
                stack: error.stack
            });

            return res.status(500).json({
                message: 'Something went wrong while submitting the return request.'
            });
        }
    },

    downloadInvoice: async (req, res) => {
        try {
            const orders = await order
                .findById(req.params.id)
                .populate('shippingAddress');

            if (!orders) {
                logger.warn('Invoice requested for a nonexistent order', {
                    orderId: req.params.id
                });

                return res.status(404).send('Order not found');
            }

            const doc = new PDFDocument({
                size: 'A4',
                margins: {
                    top: 45,
                    bottom: 45,
                    left: 45,
                    right: 45
                },
                bufferPages: true
            });

            const invoiceName = `Invoice-${orders.orderId || orders._id}.pdf`;

            res.setHeader(
                'Content-Disposition',
                `attachment; filename="${invoiceName}"`
            );
            res.setHeader('Content-Type', 'application/pdf');

            doc.pipe(res);

            const black = '#202124';
            const gray = '#666666';
            const lightGray = '#F3F4F6';
            const green = '#198754';
            const border = '#E0E0E0';

            const left = 45;
            const right = 550;
            const width = right - left;

            const formatMoney = (amount) =>
                `INR ${(Number(amount) || 0).toFixed(2)}`;

            const formatDate = (date) => {
                const value = date ? new Date(date) : new Date();

                if (Number.isNaN(value.getTime())) {
                    return 'N/A';
                }

                return value.toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric'
                });
            };

            const address = orders.shippingAddress || {};

            const addressLines = [
                address.fullname,
                address.houseno,
                address.area,
                address.landmark,
                [address.town, address.state].filter(Boolean).join(', '),
                address.pincode
            ].filter(value => value && String(value).trim());

            doc.rect(0, 0, 595.28, 130).fill(black);

            doc.fillColor('#FFFFFF')
                .font('Helvetica-Bold')
                .fontSize(27)
                .text('SHOE RACK', left, 38);

            doc.fillColor('#D1D5DB')
                .font('Helvetica')
                .fontSize(10)
                .text('STEP INTO STYLE', left, 73);

            doc.fillColor('#FFFFFF')
                .font('Helvetica-Bold')
                .fontSize(23)
                .text('INVOICE', 365, 43, {
                    width: 185,
                    align: 'right'
                });

            doc.fillColor('#D1D5DB')
                .font('Helvetica')
                .fontSize(9)
                .text('PURCHASE SUMMARY', 365, 75, {
                    width: 185,
                    align: 'right'
                });

            let y = 155;

            doc.fillColor(black)
                .font('Helvetica-Bold')
                .fontSize(10)
                .text('INVOICE DETAILS', left, y);

            y += 23;

            doc.fillColor(gray)
                .font('Helvetica')
                .fontSize(10)
                .text('Invoice Number', left, y);

            doc.fillColor(black)
                .font('Helvetica-Bold')
                .text(String(orders.orderId || orders._id), 160, y, {
                    width: 390
                });

            y += 20;

            doc.fillColor(gray)
                .font('Helvetica')
                .text('Order Date', left, y);

            doc.fillColor(black)
                .text(formatDate(orders.createdAt), 160, y);

            y += 35;

            doc.roundedRect(left, y, width, 115, 7)
                .fillAndStroke(lightGray, border);

            doc.fillColor(green)
                .font('Helvetica-Bold')
                .fontSize(10)
                .text('SHIP TO', left + 15, y + 15);

            doc.fillColor(black)
                .font('Helvetica-Bold')
                .fontSize(11)
                .text(addressLines[0] || 'Customer', left + 15, y + 35);

            doc.fillColor(gray)
                .font('Helvetica')
                .fontSize(9);

            const remainingAddress = addressLines.slice(1).join(', ') ||
                'Address not available';

            doc.text(remainingAddress, left + 15, y + 53, {
                width: width - 30,
                height: 45,
                lineGap: 2,
                ellipsis: true
            });

            y += 140;

            doc.fillColor(black)
                .font('Helvetica-Bold')
                .fontSize(13)
                .text('Order Items', left, y);

            y += 25;

            const columns = {
                name: left + 10,
                qty: 345,
                price: 400,
                total: 480
            };

            const tableRight = right;

            const drawTableHeader = () => {
                doc.rect(left, y, width, 30).fill(black);

                doc.fillColor('#FFFFFF')
                    .font('Helvetica-Bold')
                    .fontSize(9);

                doc.text('PRODUCT', columns.name, y + 10, {
                    width: 250
                });

                doc.text('QTY', columns.qty, y + 10, {
                    width: 40,
                    align: 'center'
                });

                doc.text('UNIT PRICE', columns.price - 10, y + 10, {
                    width: 75,
                    align: 'right'
                });

                doc.text('TOTAL', columns.total, y + 10, {
                    width: tableRight - columns.total - 8,
                    align: 'right'
                });

                y += 30;
            };

            drawTableHeader();

            doc.font('Helvetica').fontSize(9);

            const products = orders.products || [];

            for (let i = 0; i < products.length; i++) {
                const product = products[i];

                const productName = String(product.productName || 'Product');
                const quantity = Number(product.quantity) || 0;
                const unitPrice = Number(product.productprice) || 0;
                const lineTotal = unitPrice * quantity;

                const nameHeight = doc.heightOfString(productName, {
                    width: 250,
                    lineGap: 2
                });

                const rowHeight = Math.max(35, nameHeight + 18);

                if (y + rowHeight > 700) {
                    doc.addPage();
                    y = 45;
                    drawTableHeader();
                }

                if (i % 2 === 0) {
                    doc.rect(left, y, width, rowHeight).fill('#F8F9FA');
                }

                doc.fillColor(black)
                    .font('Helvetica')
                    .fontSize(9)
                    .text(productName, columns.name, y + 10, {
                        width: 250,
                        lineGap: 2
                    });

                doc.text(String(quantity), columns.qty, y + 10, {
                    width: 40,
                    align: 'center'
                });

                doc.text(formatMoney(unitPrice), columns.price - 10, y + 10, {
                    width: 75,
                    align: 'right'
                });

                doc.font('Helvetica-Bold')
                    .text(formatMoney(lineTotal), columns.total, y + 10, {
                        width: tableRight - columns.total - 8,
                        align: 'right'
                    });

                doc.font('Helvetica')
                    .strokeColor(border)
                    .moveTo(left, y + rowHeight)
                    .lineTo(right, y + rowHeight)
                    .stroke();

                y += rowHeight;
            }

            if (products.length === 0) {
                doc.fillColor(gray)
                    .font('Helvetica')
                    .fontSize(10)
                    .text('No product details available.', left + 10, y + 12);

                y += 40;
            }

            y += 25;

            if (y > 650) {
                doc.addPage();
                y = 55;
            }

            doc.strokeColor(border)
                .moveTo(300, y)
                .lineTo(right, y)
                .stroke();

            y += 18;

            const subtotal = products.reduce((sum, product) => {
                return sum +
                    (Number(product.productprice) || 0) *
                    (Number(product.quantity) || 0);
            }, 0);

            const grandTotal = Number(
                orders.finalPrice ?? orders.totalAmount ?? subtotal
            );

            doc.fillColor(gray)
                .font('Helvetica')
                .fontSize(10)
                .text('Items Subtotal', 310, y, {
                    width: 130
                });

            doc.fillColor(black)
                .text(formatMoney(subtotal), 440, y, {
                    width: 110,
                    align: 'right'
                });

            y += 25;

            doc.roundedRect(300, y, 250, 48, 6).fill(black);

            doc.fillColor('#FFFFFF')
                .font('Helvetica-Bold')
                .fontSize(11)
                .text('GRAND TOTAL', 315, y + 17);

            doc.fillColor('#FFFFFF')
                .fontSize(13)
                .text(formatMoney(grandTotal), 415, y + 16, {
                    width: 120,
                    align: 'right'
                });

            y += 75;

            if (y > 740) {
                doc.addPage();
                y = 60;
            }

            doc.strokeColor(border)
                .moveTo(left, y)
                .lineTo(right, y)
                .stroke();

            y += 18;

            doc.fillColor(green)
                .font('Helvetica-Bold')
                .fontSize(11)
                .text('Thank you for shopping with Shoe Rack!', left, y, {
                    width,
                    align: 'center'
                });

            y += 18;

            doc.fillColor(gray)
                .font('Helvetica')
                .fontSize(9)
                .text('Step into style. We hope you love your purchase.', left, y, {
                    width,
                    align: 'center'
                });

            doc.end();

            logger.info('Invoice generated successfully', {
                orderId: orders._id,
                invoiceName
            });
        } catch (error) {
            logger.error('Invoice generation failed', {
                orderId: req.params.id,
                error: error.message,
                stack: error.stack
            });

            if (!res.headersSent) {
                res.status(500).send('Failed to generate invoice');
            } else {
                res.destroy(error);
            }
        }
    }
};
