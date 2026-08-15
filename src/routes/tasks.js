const express = require('express');
const router = express.Router();
const taskService = require('../services/taskService');
const {
  validateCreateTask,
  validateUpdateTask,
  validateStatusFilter,
  validateAssignee,
} = require('../utils/validators');

router.get('/stats', (req, res) => {
  const stats = taskService.getStats();
  res.json(stats);
});

router.get('/', (req, res) => {
  const { status, page, limit } = req.query;

  if (status !== undefined) {
    const error = validateStatusFilter(status);
    if (error) return res.status(400).json({ error });
  }

  const paginated = page !== undefined || limit !== undefined;

  if (!paginated) {
    const tasks = status !== undefined ? taskService.getByStatus(status) : taskService.getAll();
    return res.json(tasks);
  }

  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);

  if ((page !== undefined && (isNaN(pageNum) || pageNum < 1)) ||
      (limit !== undefined && (isNaN(limitNum) || limitNum < 1))) {
    return res.status(400).json({ error: 'page and limit must be positive integers' });
  }

  const result = taskService.getPaginated(
    isNaN(pageNum) ? 1 : pageNum,
    isNaN(limitNum) ? 10 : limitNum,
  );

  if (status !== undefined) {
    // Filter within the current page keeps behaviour predictable for callers
    // combining both params (previously status silently won and paging was
    // ignored entirely).
    return res.json({ ...result, data: result.data.filter((t) => t.status === status) });
  }

  res.json(result);
});

router.post('/', (req, res) => {
  const error = validateCreateTask(req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  const task = taskService.create(req.body);
  res.status(201).json(task);
});

router.put('/:id', (req, res) => {
  const error = validateUpdateTask(req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  const task = taskService.update(req.params.id, req.body);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  res.json(task);
});

router.delete('/:id', (req, res) => {
  const deleted = taskService.remove(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: 'Task not found' });
  }

  res.status(204).send();
});

router.patch('/:id/complete', (req, res) => {
  const task = taskService.completeTask(req.params.id);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  res.json(task);
});

router.patch('/:id/assign', (req, res) => {
  const error = validateAssignee(req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  const task = taskService.assignTask(req.params.id, req.body.assignee);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  res.json(task);
});

module.exports = router;
