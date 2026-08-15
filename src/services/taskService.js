const { v4: uuidv4 } = require('uuid');

let tasks = [];

const getAll = () => [...tasks];

const findById = (id) => tasks.find((t) => t.id === id);

// FIX (BUG-1): used to be `t.status.includes(status)`, a substring match.
// Status filtering must be an exact match.
const getByStatus = (status) => tasks.filter((t) => t.status === status);

// FIX (BUG-2): offset used to be `page * limit`, which skipped the first page.
// Pages are 1-indexed, so the offset is (page - 1) * limit.
const getPaginated = (page, limit) => {
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 10;
  const offset = (safePage - 1) * safeLimit;

  return {
    data: tasks.slice(offset, offset + safeLimit),
    page: safePage,
    limit: safeLimit,
    total: tasks.length,
    totalPages: Math.ceil(tasks.length / safeLimit),
  };
};

const getStats = () => {
  const now = new Date();
  const counts = { todo: 0, in_progress: 0, done: 0 };
  let overdue = 0;

  tasks.forEach((t) => {
    if (counts[t.status] !== undefined) counts[t.status]++;
    if (t.dueDate && t.status !== 'done' && new Date(t.dueDate) < now) {
      overdue++;
    }
  });

  return { ...counts, overdue };
};

const create = ({
  title,
  description = '',
  status = 'todo',
  priority = 'medium',
  dueDate = null,
  assignee = null,
}) => {
  const task = {
    id: uuidv4(),
    title,
    description,
    status,
    priority,
    dueDate,
    assignee,
    completedAt: null,
    createdAt: new Date().toISOString(),
  };
  tasks.push(task);
  return task;
};

// Fields a client is never allowed to overwrite through an update body.
const IMMUTABLE_FIELDS = ['id', 'createdAt'];

const update = (id, fields) => {
  const index = tasks.findIndex((t) => t.id === id);
  if (index === -1) return null;

  const safeFields = { ...fields };
  IMMUTABLE_FIELDS.forEach((key) => delete safeFields[key]);

  const updated = { ...tasks[index], ...safeFields };

  // FIX (BUG-4): completedAt has to stay consistent with status.
  if (safeFields.status !== undefined) {
    if (safeFields.status === 'done' && !updated.completedAt) {
      updated.completedAt = new Date().toISOString();
    }
    if (safeFields.status !== 'done') {
      updated.completedAt = null;
    }
  }

  tasks[index] = updated;
  return updated;
};

const remove = (id) => {
  const index = tasks.findIndex((t) => t.id === id);
  if (index === -1) return false;

  tasks.splice(index, 1);
  return true;
};

const completeTask = (id) => {
  const index = tasks.findIndex((t) => t.id === id);
  if (index === -1) return null;

  // FIX (BUG-3): completing a task used to reset priority to 'medium'.
  const updated = {
    ...tasks[index],
    status: 'done',
    completedAt: new Date().toISOString(),
  };

  tasks[index] = updated;
  return updated;
};

const assignTask = (id, assignee) => {
  const index = tasks.findIndex((t) => t.id === id);
  if (index === -1) return null;

  const updated = {
    ...tasks[index],
    assignee: assignee === null ? null : assignee.trim(),
  };

  tasks[index] = updated;
  return updated;
};

const _reset = () => {
  tasks = [];
};

module.exports = {
  getAll,
  findById,
  getByStatus,
  getPaginated,
  getStats,
  create,
  update,
  remove,
  completeTask,
  assignTask,
  _reset,
};
