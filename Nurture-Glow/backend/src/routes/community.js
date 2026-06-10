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

export function createCommunityRouter({ requireAuth }) {
  const router = express.Router();

  router.get('/community/posts', async (req, res, next) => {
    try {
      const allItems = await listEntities({ type: 'community_post' });
      const { page, pageSize, offset } = parsePagination(req, { defaultPageSize: 20 });
      const items = allItems.slice(offset, offset + pageSize);
      sendSuccess(res, items, 200, paginationMeta(allItems.length, page, pageSize));
    } catch (err) {
      next(err);
    }
  });

  router.post('/community/posts', requireAuth, async (req, res, next) => {
    try {
      const { content, image, authorName } = req.body || {};
      const safeContent = toTrimmedString(content, 2000);
      if (!safeContent) {
        return res.status(400).json({ error: 'content is required' });
      }
      const profileMap = await loadPatientProfiles([req.user.sub]);
      const profile = profileMap.get(req.user.sub) || {};
      const resolvedAuthorName =
        toTrimmedString(authorName, 80) ||
        profile.full_name ||
        profile.name ||
        profile.username ||
        'Anonymous';
      const item = await createEntity({
        type: 'community_post',
        userId: req.user.sub,
        data: {
          userId: req.user.sub,
          authorName: resolvedAuthorName,
          content: safeContent,
          image: toOptionalString(image, 500) || undefined,
          likes: [],
          comments: [],
          createdAt: new Date().toISOString()
        }
      });
      res.status(201).json({ item });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/community/posts/:id', requireAuth, async (req, res, next) => {
    try {
      const existing = await getEntity({ id: req.params.id, type: 'community_post' });
      if (!existing) {
        return res.status(404).json({ error: 'Post not found' });
      }
      if (existing.userId && existing.userId !== req.user.sub) {
        return res.status(403).json({ error: 'Not authorized to delete this post' });
      }
      const ok = await deleteEntity({ id: req.params.id, type: 'community_post' });
      res.json({ ok });
    } catch (err) {
      next(err);
    }
  });

  router.post('/community/posts/:id/like', requireAuth, async (req, res, next) => {
    try {
      const existing = await getEntity({ id: req.params.id, type: 'community_post' });
      if (!existing) {
        return res.status(404).json({ error: 'Post not found' });
      }
      const likes = Array.isArray(existing.likes) ? existing.likes : [];
      const hasLiked = likes.includes(req.user.sub);
      const updated = await updateEntity({
        id: req.params.id,
        type: 'community_post',
        data: { likes: hasLiked ? likes.filter((id) => id !== req.user.sub) : [...likes, req.user.sub] }
      });
      res.json({ item: updated });
    } catch (err) {
      next(err);
    }
  });

  router.post('/community/posts/:id/comments', requireAuth, async (req, res, next) => {
    try {
      const existing = await getEntity({ id: req.params.id, type: 'community_post' });
      if (!existing) {
        return res.status(404).json({ error: 'Post not found' });
      }
      const { content, authorName } = req.body || {};
      const safeContent = toTrimmedString(content, 2000);
      if (!safeContent) {
        return res.status(400).json({ error: 'content is required' });
      }
      const profileMap = await loadPatientProfiles([req.user.sub]);
      const profile = profileMap.get(req.user.sub) || {};
      const resolvedAuthorName =
        toTrimmedString(authorName, 80) ||
        profile.full_name ||
        profile.name ||
        profile.username ||
        'Anonymous';
      const comments = Array.isArray(existing.comments) ? existing.comments : [];
      const newComment = {
        id: uuidv4(),
        userId: req.user.sub,
        authorName: resolvedAuthorName,
        content: safeContent,
        createdAt: new Date().toISOString(),
        replies: []
      };
      const updated = await updateEntity({
        id: req.params.id,
        type: 'community_post',
        data: { comments: [...comments, newComment] }
      });
      res.status(201).json({ item: updated });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/community/posts/:id/comments/:commentId', requireAuth, async (req, res, next) => {
    try {
      const existing = await getEntity({ id: req.params.id, type: 'community_post' });
      if (!existing) {
        return res.status(404).json({ error: 'Post not found' });
      }
      const comments = Array.isArray(existing.comments) ? existing.comments : [];
      const comment = comments.find((c) => c.id === req.params.commentId);
      if (!comment) {
        return res.status(404).json({ error: 'Comment not found' });
      }
      if (comment.userId && comment.userId !== req.user.sub) {
        return res.status(403).json({ error: 'Not authorized to delete this comment' });
      }
      const updated = await updateEntity({
        id: req.params.id,
        type: 'community_post',
        data: { comments: comments.filter((c) => c.id !== req.params.commentId) }
      });
      res.json({ item: updated });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
