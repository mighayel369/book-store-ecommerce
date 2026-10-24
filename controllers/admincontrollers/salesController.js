
const order = require('../../models/order');
const usermodel = require('../../models/userdetails');
const productmodel = require('../../models/productdetails');
const ExcelJS = require('exceljs');
const logger = require('../../config/logger');


module.exports = {
  getSales: async (_req, res) => {
    try {
      const completedOrders = await order
        .find({ status: 'Delivered' })
        .populate('userId')
        .sort({ createdAt: -1 });

      return res.render('admin/adminSales', { completedOrders });
    } catch (error) {
      logger.error('Failed to fetch completed sales orders', {
        error: error.message,
        stack: error.stack
      });

      return res.status(500).send('Unable to load sales data');
    }
  },

  downloadReport: async (_req, res) => {
    try {
      const completedOrders = await order
        .find({ status: 'Delivered' })
        .populate('userId')
        .sort({ createdAt: -1 });

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Completed Orders');

      worksheet.columns = [
        { header: 'Order ID', key: 'orderId', width: 20 },
        { header: 'Customer Name', key: 'username', width: 30 },
        { header: 'Date', key: 'createdAt', width: 15 },
        { header: 'Total', key: 'totalAmount', width: 15 },
        { header: 'Final Price', key: 'finalPrice', width: 15 },
        { header: 'Payment Method', key: 'paymentMethod', width: 20 }
      ];

      completedOrders.forEach((orderItem) => {
        worksheet.addRow({
          orderId: orderItem.orderId || orderItem._id.toString(),
          username: orderItem.userId?.username || 'Deleted User',
          createdAt: orderItem.createdAt
            ? orderItem.createdAt.toISOString().split('T')[0]
            : '',
          totalAmount: orderItem.totalAmount ?? 0,
          finalPrice: orderItem.finalPrice ?? orderItem.totalAmount ?? 0,
          paymentMethod: orderItem.paymentMethod || 'N/A'
        });
      });

      worksheet.getRow(1).font = { bold: true };

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader(
        'Content-Disposition',
        'attachment; filename=completed_orders_report.xlsx'
      );

      await workbook.xlsx.write(res);
      return res.end();
    } catch (error) {
      logger.error('Failed to generate completed orders Excel report', {
        error: error.message,
        stack: error.stack
      });

      if (!res.headersSent) {
        return res.status(500).send('Unable to generate sales report');
      }
    }
  },

  approveReturn: async (req, res) => {
    try {
      const orderId = req.params.id;
      const productId = req.params.productid;

      const orderDetails = await order.findById(orderId);

      if (!orderDetails) {
        return res.status(404).send('Order not found');
      }

      const productExist = orderDetails.products.find(
        (item) => item.productId.toString() === productId.toString()
      );

      if (!productExist) {
        return res.status(404).send('Product not found in order');
      }

      if (productExist.returnRequest !== 'Requested') {
        return res.status(400).send('This return request cannot be approved');
      }

      const user = await usermodel.findById(orderDetails.userId);

      if (!user) {
        return res.status(404).send('User not found');
      }

      const product = await productmodel.findById(productId);

      if (!product) {
        return res.status(404).send('Product not found');
      }

      const refundPrice =
        productExist.discountPrice != null
          ? productExist.discountPrice
          : productExist.productprice;

      if (typeof refundPrice !== 'number' || refundPrice < 0) {
        logger.error('Invalid refund amount on return approval', {
          orderId,
          productId,
          refundPrice
        });

        return res.status(400).send('Invalid refund amount');
      }

      const refundAmount = refundPrice * productExist.quantity;

      const session = await order.startSession();

      try {
        await session.withTransaction(async () => {
          const currentOrder = await order.findById(orderId).session(session);

          if (!currentOrder) {
            throw new Error('Order not found during return approval');
          }

          const currentItem = currentOrder.products.find(
            (item) => item.productId.toString() === productId.toString()
          );

          if (!currentItem || currentItem.returnRequest !== 'Requested') {
            throw new Error('Return request has already been processed');
          }

          const currentUser = await usermodel
            .findById(currentOrder.userId)
            .session(session);

          if (!currentUser) {
            throw new Error('User not found during return approval');
          }

          const currentProduct = await productmodel
            .findById(productId)
            .session(session);

          if (!currentProduct) {
            throw new Error('Product not found during return approval');
          }

          const unitPrice =
            currentItem.discountPrice != null
              ? currentItem.discountPrice
              : currentItem.productprice;

          if (typeof unitPrice !== 'number' || unitPrice < 0) {
            throw new Error('Invalid refund amount');
          }

          const amount = unitPrice * currentItem.quantity;

          currentItem.orderStatus = 'Returned';
          currentItem.returnRequest = 'Approved';

          currentProduct.stockqty += currentItem.quantity;
          currentUser.wallet.balance += amount;

          currentUser.wallet.transactions.push({
            amount,
            transactionType: 'credit',
            description: `Refund of ₹${amount} credited to your wallet.`
          });

          await currentProduct.save({ session });
          await currentUser.save({ session });
          await currentOrder.save({ session });
        });
      } finally {
        await session.endSession();
      }

      logger.info('Product return approved and refund credited', {
        orderId,
        productId
      });

      return res.redirect(`/admin/orderdetails/${orderId}`);
    } catch (error) {
      logger.error('Failed to approve product return', {
        orderId: req.params.id,
        productId: req.params.productid,
        error: error.message,
        stack: error.stack
      });

      if (error.message === 'Return request has already been processed') {
        return res.status(400).send(error.message);
      }

      return res
        .status(500)
        .send('Server error, unable to approve return request');
    }
  },

  rejectReturn: async (req, res) => {
    try {
      const orderId = req.params.id;
      const productId = req.params.productid;

      const orderDetails = await order.findById(orderId);

      if (!orderDetails) {
        return res.status(404).send('Order not found');
      }

      const productExist = orderDetails.products.find(
        (item) => item.productId.toString() === productId.toString()
      );

      if (!productExist) {
        return res.status(404).send('Product not found in order');
      }

      if (productExist.returnRequest !== 'Requested') {
        return res.status(400).send('This return request cannot be rejected');
      }

      productExist.returnRequest = 'Rejected';

      await orderDetails.save();

      logger.info('Product return request rejected', {
        orderId,
        productId
      });

      return res.redirect(`/admin/orderdetails/${orderId}`);
    } catch (error) {
      logger.error('Failed to reject product return', {
        orderId: req.params.id,
        productId: req.params.productid,
        error: error.message,
        stack: error.stack
      });

      return res.status(500).send('Server error');
    }
  },

  getSalesData: async (req, res) => {
    try {
      const { filter } = req.query;

      if (filter && !['monthly', 'yearly'].includes(filter)) {
        return res.status(400).json({ message: 'Invalid sales filter' });
      }

      const groupId =
        filter === 'monthly'
          ? {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          }
          : {
            year: { $year: '$createdAt' }
          };

      const salesData = await order.aggregate([
        {
          $match: { status: 'Delivered' }
        },
        {
          $group: {
            _id: groupId,
            totalSales: {
              $sum: {
                $ifNull: ['$finalPrice', '$totalAmount']
              }
            },
            orderCount: { $sum: 1 }
          }
        },
        {
          $sort:
            filter === 'monthly'
              ? { '_id.year': 1, '_id.month': 1 }
              : { '_id.year': 1 }
        }
      ]);

      return res.status(200).json(salesData);
    } catch (error) {
      logger.error('Failed to fetch sales chart data', {
        filter: req.query.filter,
        error: error.message,
        stack: error.stack
      });

      return res.status(500).json({
        message: 'Unable to fetch sales data'
      });
    }
  },

  getDashboard: async (req, res) => {
    try {
      const users = await usermodel.find({ role: 'user' });

      const categories = await order.aggregate([
        { $match: { status: 'Delivered' } },
        { $unwind: '$products' },
        {
          $lookup: {
            from: 'productdetails',
            localField: 'products.productId',
            foreignField: '_id',
            as: 'productDetails'
          }
        },
        { $unwind: '$productDetails' },
        {
          $lookup: {
            from: 'categorydetails',
            localField: 'productDetails.productcategory',
            foreignField: '_id',
            as: 'categoryDetails'
          }
        },
        { $unwind: '$categoryDetails' },
        {
          $group: {
            _id: '$categoryDetails.categoryname',
            totalSold: { $sum: '$products.quantity' }
          }
        },
        { $sort: { totalSold: -1 } },
        { $limit: 10 }
      ]);

      const products = await productmodel
        .find()
        .sort({ popularityScore: -1 })
        .limit(10);

      return res.render('admin/adminDashboard', {
        users,
        products,
        categories
      });
    } catch (error) {
      logger.error('Failed to load admin dashboard', {
        error: error.message,
        stack: error.stack
      });

      return res.status(500).send('Unable to load admin dashboard');
    }
  }
};
