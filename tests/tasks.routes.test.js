const request = require('supertest');
const app = require('../src/app');
const taskService = require('../src/services/taskService');

beforeEach(() => taskService._reset());

const createTask = (body = {}) =>
  request(app).post('/tasks').send({ title: 'Task', ...body });

describe('POST /tasks', () => {
  it('creates a task', async () => {
    const res = await createTask({ title: 'Write tests', priority: 'high' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      title: 'Write tests',
      priority: 'high',
      status: 'todo',
      assignee: null,
      completedAt: null,
    });
    expect(res.body.id).toBeDefined();
  });

  it('rejects a missing title', async () => {
    const res = await request(app).post('/tasks').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/title/);
  });

  it('rejects an invalid status', async () => {
    const res = await createTask({ status: 'nope' });
    expect(res.status).toBe(400);
  });

  it('returns 400 on malformed JSON', async () => {
    const res = await request(app)
      .post('/tasks')
      .set('Content-Type', 'application/json')
      .send('{"title":');
    expect(res.status).toBe(400);
  });
});

describe('GET /tasks', () => {
  it('lists all tasks', async () => {
    await createTask({ title: 'A' });
    await createTask({ title: 'B' });

    const res = await request(app).get('/tasks');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it('returns an empty array when there are no tasks', async () => {
    const res = await request(app).get('/tasks');
    expect(res.body).toEqual([]);
  });

  it('filters by status', async () => {
    await createTask({ title: 'A', status: 'todo' });
    await createTask({ title: 'B', status: 'done' });

    const res = await request(app).get('/tasks?status=done');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe('B');
  });

  // Regression test for BUG-1.
  it('rejects an unknown status instead of substring-matching it', async () => {
    await createTask({ status: 'todo' });
    await createTask({ status: 'done' });

    const res = await request(app).get('/tasks?status=do');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/status/);
  });

  // Regression test for BUG-2.
  it('paginates from page 1 with metadata', async () => {
    for (let i = 1; i <= 15; i++) await createTask({ title: `T${i}` });

    const page1 = await request(app).get('/tasks?page=1&limit=10');
    expect(page1.status).toBe(200);
    expect(page1.body.data).toHaveLength(10);
    expect(page1.body.data[0].title).toBe('T1');
    expect(page1.body).toMatchObject({ page: 1, limit: 10, total: 15, totalPages: 2 });

    const page2 = await request(app).get('/tasks?page=2&limit=10');
    expect(page2.body.data).toHaveLength(5);
    expect(page2.body.data[0].title).toBe('T11');
  });

  it('rejects non-numeric or zero pagination params', async () => {
    expect((await request(app).get('/tasks?page=abc')).status).toBe(400);
    expect((await request(app).get('/tasks?limit=0')).status).toBe(400);
    expect((await request(app).get('/tasks?page=-1')).status).toBe(400);
  });

  it('applies status and pagination together', async () => {
    await createTask({ title: 'A', status: 'todo' });
    await createTask({ title: 'B', status: 'done' });

    const res = await request(app).get('/tasks?status=todo&page=1&limit=10');
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].title).toBe('A');
  });
});

describe('GET /tasks/stats', () => {
  it('returns counts and overdue count', async () => {
    await createTask({ status: 'todo', dueDate: new Date(Date.now() - 86400000).toISOString() });
    await createTask({ status: 'in_progress' });
    await createTask({ status: 'done' });

    const res = await request(app).get('/tasks/stats');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ todo: 1, in_progress: 1, done: 1, overdue: 1 });
  });

  it('is not shadowed by the /tasks/:id route', async () => {
    const res = await request(app).get('/tasks/stats');
    expect(res.body).toHaveProperty('overdue');
  });
});

describe('PUT /tasks/:id', () => {
  it('updates a task', async () => {
    const { body: task } = await createTask({ title: 'Old' });

    const res = await request(app).put(`/tasks/${task.id}`).send({ title: 'New', status: 'in_progress' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ title: 'New', status: 'in_progress', id: task.id });
  });

  it('returns 404 for an unknown id', async () => {
    const res = await request(app).put('/tasks/does-not-exist').send({ title: 'x' });
    expect(res.status).toBe(404);
  });

  it('returns 400 for an invalid payload', async () => {
    const { body: task } = await createTask();
    const res = await request(app).put(`/tasks/${task.id}`).send({ title: '' });
    expect(res.status).toBe(400);
  });

  it('cannot overwrite id or createdAt', async () => {
    const { body: task } = await createTask();
    const res = await request(app).put(`/tasks/${task.id}`).send({ id: 'hacked', createdAt: '2000-01-01' });

    expect(res.body.id).toBe(task.id);
    expect(res.body.createdAt).toBe(task.createdAt);
  });
});

describe('DELETE /tasks/:id', () => {
  it('deletes a task and returns 204', async () => {
    const { body: task } = await createTask();

    const res = await request(app).delete(`/tasks/${task.id}`);
    expect(res.status).toBe(204);
    expect(res.body).toEqual({});

    const list = await request(app).get('/tasks');
    expect(list.body).toEqual([]);
  });

  it('returns 404 when deleting twice', async () => {
    const { body: task } = await createTask();
    await request(app).delete(`/tasks/${task.id}`);

    const res = await request(app).delete(`/tasks/${task.id}`);
    expect(res.status).toBe(404);
  });
});

describe('PATCH /tasks/:id/complete', () => {
  it('marks the task done and sets completedAt', async () => {
    const { body: task } = await createTask({ priority: 'high' });

    const res = await request(app).patch(`/tasks/${task.id}/complete`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('done');
    expect(res.body.completedAt).not.toBeNull();
  });

  // Regression test for BUG-3.
  it('preserves priority when completing', async () => {
    const { body: task } = await createTask({ priority: 'high' });
    const res = await request(app).patch(`/tasks/${task.id}/complete`);
    expect(res.body.priority).toBe('high');
  });

  it('returns 404 for an unknown id', async () => {
    const res = await request(app).patch('/tasks/nope/complete');
    expect(res.status).toBe(404);
  });
});

describe('PATCH /tasks/:id/assign', () => {
  it('assigns a task and returns the updated task', async () => {
    const { body: task } = await createTask();

    const res = await request(app).patch(`/tasks/${task.id}/assign`).send({ assignee: 'Ada Lovelace' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: task.id, assignee: 'Ada Lovelace' });
  });

  it('trims surrounding whitespace', async () => {
    const { body: task } = await createTask();
    const res = await request(app).patch(`/tasks/${task.id}/assign`).send({ assignee: '  Ada  ' });
    expect(res.body.assignee).toBe('Ada');
  });

  it('allows reassignment (last write wins)', async () => {
    const { body: task } = await createTask();
    await request(app).patch(`/tasks/${task.id}/assign`).send({ assignee: 'Ada' });

    const res = await request(app).patch(`/tasks/${task.id}/assign`).send({ assignee: 'Grace' });
    expect(res.status).toBe(200);
    expect(res.body.assignee).toBe('Grace');
  });

  it('unassigns with an explicit null', async () => {
    const { body: task } = await createTask();
    await request(app).patch(`/tasks/${task.id}/assign`).send({ assignee: 'Ada' });

    const res = await request(app).patch(`/tasks/${task.id}/assign`).send({ assignee: null });
    expect(res.status).toBe(200);
    expect(res.body.assignee).toBeNull();
  });

  it('returns 404 when the task does not exist', async () => {
    const res = await request(app).patch('/tasks/nope/assign').send({ assignee: 'Ada' });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Task not found');
  });

  it.each([
    [{}, /required/],
    [{ assignee: '' }, /non-empty/],
    [{ assignee: '   ' }, /non-empty/],
    [{ assignee: 123 }, /string/],
    [{ assignee: 'a'.repeat(101) }, /100 characters/],
  ])('returns 400 for %j', async (body, matcher) => {
    const { body: task } = await createTask();
    const res = await request(app).patch(`/tasks/${task.id}/assign`).send(body);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(matcher);
  });

  it('validates the body before checking existence', async () => {
    const res = await request(app).patch('/tasks/nope/assign').send({ assignee: '' });
    expect(res.status).toBe(400);
  });
});

describe('unknown routes', () => {
  it('returns a JSON 404', async () => {
    const res = await request(app).get('/nope');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Not found' });
  });
});
