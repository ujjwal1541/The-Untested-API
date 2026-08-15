const VALID_STATUSES = ['todo', 'in_progress', 'done'];
const VALID_PRIORITIES = ['low', 'medium', 'high'];
const MAX_ASSIGNEE_LENGTH = 100;

const validateCreateTask = (body) => {
  if (!body || typeof body !== 'object') {
    return 'request body must be a JSON object';
  }
  if (!body.title || typeof body.title !== 'string' || body.title.trim() === '') {
    return 'title is required and must be a non-empty string';
  }
  if (body.status && !VALID_STATUSES.includes(body.status)) {
    return `status must be one of: ${VALID_STATUSES.join(', ')}`;
  }
  if (body.priority && !VALID_PRIORITIES.includes(body.priority)) {
    return `priority must be one of: ${VALID_PRIORITIES.join(', ')}`;
  }
  if (body.dueDate && isNaN(Date.parse(body.dueDate))) {
    return 'dueDate must be a valid ISO date string';
  }
  return null;
};

const validateUpdateTask = (body) => {
  if (!body || typeof body !== 'object') {
    return 'request body must be a JSON object';
  }
  if (body.title !== undefined && (typeof body.title !== 'string' || body.title.trim() === '')) {
    return 'title must be a non-empty string';
  }
  if (body.status && !VALID_STATUSES.includes(body.status)) {
    return `status must be one of: ${VALID_STATUSES.join(', ')}`;
  }
  if (body.priority && !VALID_PRIORITIES.includes(body.priority)) {
    return `priority must be one of: ${VALID_PRIORITIES.join(', ')}`;
  }
  if (body.dueDate && isNaN(Date.parse(body.dueDate))) {
    return 'dueDate must be a valid ISO date string';
  }
  return null;
};

// A status query param that isn't a known status is a client error, not an
// empty list — that hid BUG-1 (substring matching) in the original code.
const validateStatusFilter = (status) => {
  if (!VALID_STATUSES.includes(status)) {
    return `status must be one of: ${VALID_STATUSES.join(', ')}`;
  }
  return null;
};

const validateAssignee = (body) => {
  if (!body || typeof body !== 'object' || !('assignee' in body)) {
    return 'assignee is required';
  }
  // Explicit null is allowed and means "unassign".
  if (body.assignee === null) return null;

  if (typeof body.assignee !== 'string') {
    return 'assignee must be a string';
  }
  if (body.assignee.trim() === '') {
    return 'assignee must be a non-empty string';
  }
  if (body.assignee.trim().length > MAX_ASSIGNEE_LENGTH) {
    return `assignee must be at most ${MAX_ASSIGNEE_LENGTH} characters`;
  }
  return null;
};

module.exports = {
  VALID_STATUSES,
  VALID_PRIORITIES,
  MAX_ASSIGNEE_LENGTH,
  validateCreateTask,
  validateUpdateTask,
  validateStatusFilter,
  validateAssignee,
};
