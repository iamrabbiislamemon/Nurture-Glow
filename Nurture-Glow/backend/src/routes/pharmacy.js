import express from 'express';
import { query } from '../db.js';
import {
  listEntities,
  createEntity,
  updateEntity,
  deleteEntity,
  getBySubtype,
  upsertBySubtype,
  listCatalog
} from '../appStore.js';
import {
  toTrimmedString,
  toOptionalString,
  isValidId,
  isValidDateValue,
  createNotification,
  parseJson,
  isPlainObject,
  normalizeEnumValue
} from '../utils/index.js';
import { normalizeRoleValue } from '../roles.js';

export function createPharmacyRouter({ requireAuth, requireRole }) {
  const router = express.Router();

  router.get('/pharmacy/dashboard', requireAuth, requireRole('pharmacist'), async (req, res, next) => {
    try {
      const pharmacyId = req.user.sub;
      
      // Fetch pharmacy profile
      const profileRows = await query(
        `SELECT data FROM app_entities WHERE type = 'user_profile' AND user_id = ? LIMIT 1`,
        [pharmacyId]
      );
      
      let profile = {
        id: pharmacyId,
        name: 'Pharmacy Owner',
        email: req.user.email || 'pharmacy@nurtureglow.com',
        phone: '+880-1234-567890',
        avatar: `https://picsum.photos/seed/${pharmacyId}/100/100`,
        verificationStatus: 'Verified'
      };
      
      if (profileRows.length > 0) {
        const profileData = JSON.parse(profileRows[0].data);
        profile = {
          ...profile,
          name: profileData.name || profileData.username || profile.name,
          phone: profileData.phone || profile.phone,
          shopName: profileData.shopName || 'Nurture Glow Pharmacy',
          license: profileData.license || 'Pending',
          address: profileData.address || 'Dhaka, Bangladesh'
        };
      }
      
      // Fetch all orders
      const allOrdersRows = await query(
        `SELECT data FROM app_entities WHERE type = 'order'`
      );
      
      const allOrders = allOrdersRows.map(row => {
        try {
          return JSON.parse(row.data);
        } catch (e) {
          return null;
        }
      }).filter(order => order !== null);
      
      const today = new Date().toISOString().split('T')[0];
      const todayOrders = allOrders.filter(order => order.orderDate?.startsWith(today)).length;
      const pendingOrders = allOrders.filter(order => order.status === 'pending' || order.status === 'scheduled').length;
      const processingOrders = allOrders.filter(order => order.status === 'processing' || order.status === 'in-progress').length;
      const totalRevenue = allOrders
        .filter(order => order.status === 'delivered')
        .reduce((sum, order) => sum + (order.total || 0), 0);
      
      const dashboardData = {
        profile,
        stats: {
          todayOrders,
          pendingOrders,
          processingOrders,
          totalRevenue,
          totalOrders: allOrders.length
        }
      };
      
      res.json(dashboardData);
    } catch (err) {
      next(err);
    }
  });

  // Get all orders for pharmacy
  router.get('/pharmacy/orders', requireAuth, requireRole('pharmacist'), async (req, res, next) => {
    try {
      const { status, page = 1, limit = 10 } = req.query;
      
      // Fetch all orders
      const allOrdersRows = await query(
        `SELECT id, data FROM app_entities WHERE type = 'order' ORDER BY created_at DESC`
      );
      
      let orders = allOrdersRows.map(row => {
        try {
          return JSON.parse(row.data);
        } catch (e) {
          return null;
        }
      }).filter(order => order !== null);
      
      // Filter by status if provided
      if (status && status !== 'all') {
        orders = orders.filter(o => o.status === status);
      }
      
      // Fetch customer names for each order
      for (let order of orders) {
        try {
          const userRows = await query(
            `SELECT data FROM app_entities WHERE type = 'user_profile' AND user_id = ? LIMIT 1`,
            [order.userId]
          );
          if (userRows.length > 0) {
            const profile = JSON.parse(userRows[0].data);
            order.customerName = profile.name || profile.username || 'Customer';
            order.customerPhone = profile.phone || 'N/A';
          } else {
            order.customerName = 'Customer';
            order.customerPhone = 'N/A';
          }
        } catch (e) {
          order.customerName = 'Customer';
          order.customerPhone = 'N/A';
        }
      }
      
      const startIdx = (parseInt(page) - 1) * parseInt(limit);
      const endIdx = startIdx + parseInt(limit);
      const paginatedItems = orders.slice(startIdx, endIdx);
      
      res.json({
        items: paginatedItems,
        page: parseInt(page),
        pageSize: parseInt(limit),
        total: orders.length,
        totalPages: Math.ceil(orders.length / parseInt(limit))
      });
    } catch (err) {
      next(err);
    }
  });

  // Update order status
  router.patch('/pharmacy/orders/:id', requireAuth, requireRole('pharmacist'), async (req, res, next) => {
    try {
      const orderId = req.params.id;
      const { status, notes } = req.body;
      
      if (!['pending', 'processing', 'shipped', 'delivered', 'cancelled'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }
      
      // Fetch the order
      const rows = await query(
        `SELECT id, user_id, data FROM app_entities WHERE id = ? AND type = 'order' LIMIT 1`,
        [orderId]
      );
      
      if (rows.length === 0) {
        return res.status(404).json({ error: 'Order not found' });
      }
      
      const order = JSON.parse(rows[0].data);
      
      // Update order
      order.status = status;
      if (notes) order.pharmacyNotes = notes;
      order.updatedAt = new Date().toISOString();
      
      if (status === 'shipped') {
        order.shippedAt = new Date().toISOString();
      } else if (status === 'delivered') {
        order.deliveredAt = new Date().toISOString();
      }
      
      await query(
        `UPDATE app_entities SET data = ?, updated_at = ? WHERE id = ?`,
        [JSON.stringify(order), new Date(), orderId]
      );
      
      // Notify customer about status change
      const statusMessages = {
        processing: 'Your order is being prepared.',
        shipped: 'Your order has been shipped and is on the way!',
        delivered: 'Your order has been delivered. Thank you!',
        cancelled: 'Your order has been cancelled.'
      };
      
      if (statusMessages[status]) {
        await createNotification(order.userId, {
          type: 'ORDER_STATUS',
          entityId: orderId,
          title: 'Order Update',
          message: statusMessages[status],
          link: '/orders'
        });
      }
      
      res.json({ order });
    } catch (err) {
      next(err);
    }
  });

  // Get order details for pharmacy
  router.get('/pharmacy/orders/:id', requireAuth, requireRole('pharmacist'), async (req, res, next) => {
    try {
      const orderId = req.params.id;
      
      const rows = await query(
        `SELECT data FROM app_entities WHERE id = ? AND type = 'order' LIMIT 1`,
        [orderId]
      );
      
      if (rows.length === 0) {
        return res.status(404).json({ error: 'Order not found' });
      }
      
      const order = JSON.parse(rows[0].data);
      
      // Fetch customer details
      try {
        const userRows = await query(
          `SELECT data FROM app_entities WHERE type = 'user_profile' AND user_id = ? LIMIT 1`,
          [order.userId]
        );
        if (userRows.length > 0) {
          const profile = JSON.parse(userRows[0].data);
          order.customerName = profile.name || profile.username || 'Customer';
          order.customerPhone = profile.phone || 'N/A';
          order.customerEmail = profile.email || 'N/A';
        }
      } catch (e) {
        order.customerName = 'Customer';
      }
      
      res.json({ order });
    } catch (err) {
      next(err);
    }
  });

  // =====================================================
  // MERCHANDISER DASHBOARD ROUTES

  return router;
}
