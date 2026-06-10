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

export function createOrdersRouter({ requireAuth }) {
  const router = express.Router();

  router.post('/orders', requireAuth, async (req, res, next) => {
    try {
      const { items, deliveryAddress, deliveryFee, notes } = req.body;
      const rawItems = Array.isArray(items) ? items : [];
      const normalizedItems = rawItems
        .map((item) => {
          if (!isPlainObject(item)) return null;
          const id = toTrimmedString(item.id, 100);
          const name = toTrimmedString(item.name, 200);
          const price = toNonNegativeNumber(item.price);
          const quantity = toPositiveNumber(item.quantity);
          if (!id || !name || price === null || quantity === null) {
            return null;
          }
          return {
            id,
            name,
            price,
            quantity,
            image: toOptionalString(item.image, 500) || undefined,
            category: toOptionalString(item.category, 100) || undefined
          };
        })
        .filter(Boolean);

      if (!normalizedItems.length) {
        return res.status(400).json({ error: 'Order must contain at least one valid item' });
      }

      const addressPayload = isPlainObject(deliveryAddress)
        ? deliveryAddress
        : toTrimmedString(deliveryAddress, 500);

      if (!addressPayload || (isPlainObject(addressPayload) && !Object.keys(addressPayload).length)) {
        return res.status(400).json({ error: 'Delivery address is required' });
      }

      const computedSubtotal = normalizedItems.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      );
      const safeDeliveryFee = toNonNegativeNumber(deliveryFee) ?? 0;
      const computedTotal = computedSubtotal + safeDeliveryFee;

      const orderData = {
        userId: req.user.sub,
        items: normalizedItems,
        deliveryAddress: addressPayload,
        deliveryFee: safeDeliveryFee,
        subtotal: computedSubtotal,
        total: computedTotal,
        notes: toOptionalString(notes, 1000) || '',
        status: 'pending',
        orderDate: new Date().toISOString(),
        estimatedDelivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString() // 3 days
      };
      
      const order = await createEntity({
        type: 'order',
        userId: req.user.sub,
        data: orderData
      });
      
      // Notify user about order confirmation
      await createNotification(req.user.sub, {
        type: 'ORDER_PLACED',
        entityId: order.id,
        title: 'Order Confirmed',
        message: `Your order #${order.id.slice(0, 8)} has been placed successfully.`,
        link: '/orders'
      });
      
      // Notify pharmacy owners about new order
      // (In a real system, you'd identify which pharmacy should fulfill this)
      // For now, we'll create a notification that pharmacy role users can see
      
      res.status(201).json({ order });
    } catch (err) {
      next(err);
    }
  });
  
  // Get user's orders
  router.get('/orders', requireAuth, async (req, res, next) => {
    try {
      const allOrders = await listEntities({ type: 'order', userId: req.user.sub });
      const { page, pageSize, offset } = parsePagination(req, { defaultPageSize: 20 });
      const items = allOrders.slice(offset, offset + pageSize);
      sendSuccess(res, items, 200, paginationMeta(allOrders.length, page, pageSize));
    } catch (err) {
      next(err);
    }
  });
  
  // Get specific order details
  router.get('/orders/:id', requireAuth, async (req, res, next) => {
    try {
      const order = await getEntity({
        id: req.params.id,
        type: 'order',
        userId: req.user.sub
      });
      
      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }
      
      res.json({ order });
    } catch (err) {
      next(err);
    }
  });
  
  // Cancel order (only if pending)
  router.patch('/orders/:id/cancel', requireAuth, async (req, res, next) => {
    try {
      const order = await getEntity({
        id: req.params.id,
        type: 'order',
        userId: req.user.sub
      });
      
      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }
      
      if (order.status !== 'pending') {
        return res.status(400).json({ error: 'Only pending orders can be cancelled' });
      }
      
      const updatedOrder = await updateEntity({
        id: req.params.id,
        type: 'order',
        userId: req.user.sub,
        data: { status: 'cancelled' }
      });
      
      await createNotification(req.user.sub, {
        type: 'ORDER_CANCELLED',
        entityId: updatedOrder.id,
        title: 'Order Cancelled',
        message: `Order #${updatedOrder.id.slice(0, 8)} has been cancelled.`,
        link: '/orders'
      });
      
      res.json({ order: updatedOrder });
    } catch (err) {
      next(err);
    }
  });


  return router;
}
