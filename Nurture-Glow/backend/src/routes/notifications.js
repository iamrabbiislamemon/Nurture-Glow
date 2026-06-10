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

export function createNotificationsRouter({ requireAuth }) {
  const router = express.Router();

  router.get('/notifications', requireAuth, async (req, res, next) => {
    try {
      const allItems = await listEntities({ type: 'notification', userId: req.user.sub });
      const { page, pageSize, offset } = parsePagination(req, { defaultPageSize: 50 });
      const items = allItems.slice(offset, offset + pageSize);
      sendSuccess(res, items, 200, paginationMeta(allItems.length, page, pageSize));
    } catch (err) {
      next(err);
    }
  });

  router.patch('/notifications/:id', requireAuth, async (req, res, next) => {
    try {
      const item = await updateEntity({
        id: req.params.id,
        type: 'notification',
        userId: req.user.sub,
        data: { isRead: true }
      });
      if (!item) {
        return res.status(404).json({ error: 'Notification not found' });
      }
      res.json({ item });
    } catch (err) {
      next(err);
    }
  });

  router.post('/notifications/mark-all', requireAuth, async (req, res, next) => {
    try {
      const items = await listEntities({ type: 'notification', userId: req.user.sub });
      for (const item of items) {
        if (!item.isRead) {
          await updateEntity({
            id: item.id,
            type: 'notification',
            userId: req.user.sub,
            data: { isRead: true }
          });
        }
      }
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });


  return router;
}
