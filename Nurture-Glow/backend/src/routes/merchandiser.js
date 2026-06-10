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

export function createMerchandiserRouter({ requireAuth, requireRole }) {
  const router = express.Router();

  router.get('/merchandiser/dashboard', requireAuth, requireRole('merchandiser'), async (req, res, next) => {
    try {
      const [products, notifications] = await Promise.all([
        listEntities({ type: 'merchant_product', userId: req.user.sub }),
        listEntities({ type: 'notification', userId: req.user.sub })
      ]);

      const safeProducts = (products || []).map((item) => ({
        id: item.id,
        name: toTrimmedString(item.name, 200),
        category: toTrimmedString(item.category, 100) || 'General',
        price: toNonNegativeNumber(item.price) ?? 0,
        stockQuantity: Math.max(0, Math.round(toNonNegativeNumber(item.stockQuantity) ?? 0)),
        lowStockThreshold: Math.max(0, Math.round(toNonNegativeNumber(item.lowStockThreshold) ?? 10)),
        status: normalizeEnumValue(item.status || 'draft', allowedMerchandiserProductStatuses) || 'draft',
        image: toOptionalString(item.image, 1000) || null,
        description: toOptionalString(item.description, 5000) || '',
        createdAt: item.createdAt || null,
        updatedAt: item.updatedAt || null
      }));

      const totalProducts = safeProducts.length;
      const activeProducts = safeProducts.filter((item) => item.status === 'active').length;
      const lowStockProducts = safeProducts.filter(
        (item) => item.stockQuantity > 0 && item.stockQuantity <= item.lowStockThreshold
      ).length;
      const outOfStockProducts = safeProducts.filter((item) => item.stockQuantity === 0).length;
      const inventoryValue = safeProducts.reduce(
        (sum, item) => sum + item.price * item.stockQuantity,
        0
      );

      const unreadNotifications = (notifications || []).filter((item) => !item.isRead).length;

      res.json({
        profile: {
          id: req.user.sub,
          name: req.user?.name || req.user?.email || 'Merchandiser',
          email: req.user?.email || null,
          phone: req.user?.phone || null,
          avatar: req.user?.avatar || null
        },
        stats: {
          totalProducts,
          activeProducts,
          lowStockProducts,
          outOfStockProducts,
          inventoryValue,
          unreadNotifications
        },
        recentProducts: safeProducts
          .slice()
          .sort((a, b) => {
            const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime() || 0;
            const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime() || 0;
            return bTime - aTime;
          })
          .slice(0, 5)
      });
    } catch (err) {
      next(err);
    }
  });

  router.get('/merchandiser/products', requireAuth, requireRole('merchandiser'), async (req, res, next) => {
    try {
      const statusFilter = toTrimmedString(req.query.status, 50).toLowerCase();
      const items = await listEntities({ type: 'merchant_product', userId: req.user.sub });

      const products = (items || [])
        .map((item) => ({
          id: item.id,
          name: toTrimmedString(item.name, 200),
          category: toTrimmedString(item.category, 100) || 'General',
          price: toNonNegativeNumber(item.price) ?? 0,
          stockQuantity: Math.max(0, Math.round(toNonNegativeNumber(item.stockQuantity) ?? 0)),
          lowStockThreshold: Math.max(0, Math.round(toNonNegativeNumber(item.lowStockThreshold) ?? 10)),
          status: normalizeEnumValue(item.status || 'draft', allowedMerchandiserProductStatuses) || 'draft',
          image: toOptionalString(item.image, 1000) || null,
          description: toOptionalString(item.description, 5000) || '',
          createdAt: item.createdAt || null,
          updatedAt: item.updatedAt || null
        }))
        .filter((item) => (statusFilter && statusFilter !== 'all' ? item.status === statusFilter : true))
        .sort((a, b) => {
          const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime() || 0;
          const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime() || 0;
          return bTime - aTime;
        });

      res.json({ items: products });
    } catch (err) {
      next(err);
    }
  });

  router.post('/merchandiser/products', requireAuth, requireRole('merchandiser'), async (req, res, next) => {
    try {
      const {
        name,
        category,
        price,
        stockQuantity,
        lowStockThreshold,
        status,
        image,
        description
      } = req.body || {};

      const safeName = toTrimmedString(name, 200);
      const safeCategory = toTrimmedString(category, 100) || 'General';
      const safePrice = toNonNegativeNumber(price);
      const safeStockQuantity = toNonNegativeNumber(stockQuantity);
      const safeLowStockThreshold = toNonNegativeNumber(lowStockThreshold);
      const safeStatus =
        normalizeEnumValue(status || 'draft', allowedMerchandiserProductStatuses) || 'draft';

      if (!safeName) {
        return res.status(400).json({ error: 'name is required' });
      }
      if (safePrice === null) {
        return res.status(400).json({ error: 'Valid price is required' });
      }

      const item = await createEntity({
        type: 'merchant_product',
        userId: req.user.sub,
        data: {
          name: safeName,
          category: safeCategory,
          price: safePrice,
          stockQuantity: Math.max(0, Math.round(safeStockQuantity ?? 0)),
          lowStockThreshold: Math.max(0, Math.round(safeLowStockThreshold ?? 10)),
          status: safeStatus,
          image: toOptionalString(image, 1000) || null,
          description: toOptionalString(description, 5000) || ''
        }
      });

      res.status(201).json({ item });
    } catch (err) {
      next(err);
    }
  });

  router.patch('/merchandiser/products/:id', requireAuth, requireRole('merchandiser'), async (req, res, next) => {
    try {
      const existing = await getEntity({
        id: req.params.id,
        type: 'merchant_product',
        userId: req.user.sub
      });
      if (!existing) {
        return res.status(404).json({ error: 'Product not found' });
      }

      const updates = {};
      if (req.body?.name !== undefined) {
        const safeName = toTrimmedString(req.body.name, 200);
        if (!safeName) return res.status(400).json({ error: 'Invalid name' });
        updates.name = safeName;
      }
      if (req.body?.category !== undefined) {
        updates.category = toTrimmedString(req.body.category, 100) || 'General';
      }
      if (req.body?.price !== undefined) {
        const safePrice = toNonNegativeNumber(req.body.price);
        if (safePrice === null) return res.status(400).json({ error: 'Invalid price' });
        updates.price = safePrice;
      }
      if (req.body?.stockQuantity !== undefined) {
        const safeStock = toNonNegativeNumber(req.body.stockQuantity);
        if (safeStock === null) return res.status(400).json({ error: 'Invalid stockQuantity' });
        updates.stockQuantity = Math.max(0, Math.round(safeStock));
      }
      if (req.body?.lowStockThreshold !== undefined) {
        const safeThreshold = toNonNegativeNumber(req.body.lowStockThreshold);
        if (safeThreshold === null) {
          return res.status(400).json({ error: 'Invalid lowStockThreshold' });
        }
        updates.lowStockThreshold = Math.max(0, Math.round(safeThreshold));
      }
      if (req.body?.status !== undefined) {
        const safeStatus = normalizeEnumValue(req.body.status, allowedMerchandiserProductStatuses);
        if (!safeStatus) return res.status(400).json({ error: 'Invalid status' });
        updates.status = safeStatus;
      }
      if (req.body?.image !== undefined) {
        updates.image = toOptionalString(req.body.image, 1000) || null;
      }
      if (req.body?.description !== undefined) {
        updates.description = toOptionalString(req.body.description, 5000) || '';
      }

      const item = await updateEntity({
        id: req.params.id,
        type: 'merchant_product',
        userId: req.user.sub,
        data: updates
      });

      if (!item) {
        return res.status(404).json({ error: 'Product not found' });
      }

      res.json({ item });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/merchandiser/products/:id', requireAuth, requireRole('merchandiser'), async (req, res, next) => {
    try {
      const ok = await deleteEntity({
        id: req.params.id,
        type: 'merchant_product',
        userId: req.user.sub
      });

      if (!ok) {
        return res.status(404).json({ error: 'Product not found' });
      }

      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  // =====================================================
  // MEDICAL RECORD SHARING & CONSENT SYSTEM
  // =====================================================

  // Patient grants access to their medical records to a doctor

  return router;
}
