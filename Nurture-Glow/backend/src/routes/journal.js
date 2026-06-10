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

export function createJournalRouter({ requireAuth }) {
  const router = express.Router();

  router.get('/journal', requireAuth, async (req, res, next) => {
    try {
      const allItems = await listEntities({ type: 'journal_entry', userId: req.user.sub });
      const { page, pageSize, offset } = parsePagination(req, { defaultPageSize: 20 });
      const items = allItems.slice(offset, offset + pageSize);
      sendSuccess(res, items, 200, paginationMeta(allItems.length, page, pageSize));
    } catch (err) {
      next(err);
    }
  });

  router.post('/journal', requireAuth, async (req, res, next) => {
    try {
      const data = req.body || {};
      if (process.env.NODE_ENV !== 'production' && Array.isArray(data.attachments)) {
        const firstUrlLen = String(data.attachments[0]?.url || '').length;
        console.log('[journal] incoming attachments', data.attachments.length, 'first url len', firstUrlLen);
      }
      const content = toTrimmedString(data.content, 4000);
      if (!content) {
        return res.status(400).json({ error: 'content is required' });
      }
      const dateValue = toTrimmedString(data.date, 50) || new Date().toISOString();
      if (!isValidDateValue(dateValue)) {
        return res.status(400).json({ error: 'Invalid journal date' });
      }
      const maxAttachmentUrlLen = 3200000;
      let attachments = undefined;
      if (data.attachments !== undefined) {
        if (!Array.isArray(data.attachments)) {
          return res.status(400).json({ error: 'attachments must be an array' });
        }
        attachments = data.attachments
          .filter((item) => item && typeof item === 'object')
          .map((item) => ({
            name: toTrimmedString(item.name, 200),
            url: toTrimmedString(item.url, maxAttachmentUrlLen),
            type: toTrimmedString(item.type, 120)
          }))
          .filter((item) => item.name && item.url);
      }
      const payload = {
        ...data,
        title: toTrimmedString(data.title, 120) || undefined,
        mood: toTrimmedString(data.mood, 40) || undefined,
        content,
        userId: req.user.sub,
        date: dateValue,
        attachments
      };
      const item = await createEntity({
        type: 'journal_entry',
        userId: req.user.sub,
        data: payload
      });
      res.status(201).json({ item });
    } catch (err) {
      next(err);
    }
  });

  router.patch('/journal/:id', requireAuth, async (req, res, next) => {
    try {
      const existing = await getEntity({
        id: req.params.id,
        type: 'journal_entry',
        userId: req.user.sub
      });
      if (!existing) {
        return res.status(404).json({ error: 'Journal entry not found' });
      }

      const data = req.body || {};
      const updates = {};

      if (data.title !== undefined) {
        updates.title = toOptionalString(data.title, 120);
      }

      if (data.content !== undefined) {
        const content = toTrimmedString(data.content, 4000);
        if (!content) {
          return res.status(400).json({ error: 'content is required' });
        }
        updates.content = content;
      }

      if (data.mood !== undefined) {
        updates.mood = toOptionalString(data.mood, 40);
      }

      if (data.attachments !== undefined) {
        if (!Array.isArray(data.attachments)) {
          return res.status(400).json({ error: 'attachments must be an array' });
        }
        const maxAttachmentUrlLen = 3200000;
        const sanitizedAttachments = data.attachments
          .filter((item) => item && typeof item === 'object')
          .map((item) => ({
            name: toTrimmedString(item.name, 200),
            url: toTrimmedString(item.url, maxAttachmentUrlLen),
            type: toTrimmedString(item.type, 120)
          }))
          .filter((item) => item.name && item.url);
        updates.attachments = sanitizedAttachments;
      }

      if (!Object.keys(updates).length) {
        return res.json({ item: existing });
      }

      const item = await updateEntity({
        id: req.params.id,
        type: 'journal_entry',
        userId: req.user.sub,
        data: updates
      });
      if (!item) {
        return res.status(404).json({ error: 'Journal entry not found' });
      }
      res.json({ item });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/journal/:id', requireAuth, async (req, res, next) => {
    try {
      const ok = await deleteEntity({
        id: req.params.id,
        type: 'journal_entry',
        userId: req.user.sub
      });
      res.json({ ok });
    } catch (err) {
      next(err);
    }
  });


  return router;
}
