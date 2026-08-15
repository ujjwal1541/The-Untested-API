const taskService = require('../src/services/taskService');

beforeEach(() => taskService._reset());

const make = (overrides = {}) => taskService.create({ title: 'Task', ...overrides });

describe('create', () => {
  it('creates a task with defaults and an id', () => {
    const task = make({ title: 'Write tests' });

    expect(task).toMatchObject({
      title: 'Write tests',
      description: '',
      status: 'todo',
      priority: 'medium',
      dueDate: null,
      assignee: null,
      completedAt: null,
    });
    expect(typeof task.id).toBe('string');
    expect(Date.parse(task.createdAt)).not.toBeNaN();
  });

  it('honours provided values', () => {
    const task = make({ status: 'in_progress', priority: 'high', description: 'd' });
    expect(task).toMatchObject({ status: 'in_progress', priority: 'high', description: 'd' });
  });
});

describe('getAll / findById', () => {
  it('returns a copy so callers cannot mutate the store', () => {
    make();
    const list = taskService.getAll();
    list.pop();
    expect(taskService.getAll()).toHaveLength(1);
  });

  it('finds by id and returns undefined for unknown ids', () => {
    const task = make();
    expect(taskService.findById(task.id)).toEqual(task);
    expect(taskService.findById('nope')).toBeUndefined();
  });
});

describe('getByStatus', () => {
  it('returns only exact status matches', () => {
    make({ status: 'todo' });
    make({ status: 'done' });
    make({ status: 'in_progress' });

    expect(taskService.getByStatus('todo')).toHaveLength(1);
    expect(taskService.getByStatus('done')).toHaveLength(1);
  });

  // Regression test for BUG-1: `.includes()` made 'do' match 'todo' and 'done'.
  it('does not substring-match partial status values', () => {
    make({ status: 'todo' });
    make({ status: 'done' });

    expect(taskService.getByStatus('do')).toEqual([]);
    expect(taskService.getByStatus('')).toEqual([]);
  });
});

describe('getPaginated', () => {
  beforeEach(() => {
    for (let i = 1; i <= 25; i++) make({ title: `Task ${i}` });
  });

  // Regression test for BUG-2: offset was page * limit, so page 1 skipped rows.
  it('page 1 returns the first slice', () => {
    const result = taskService.getPaginated(1, 10);
    expect(result.data).toHaveLength(10);
    expect(result.data[0].title).toBe('Task 1');
    expect(result).toMatchObject({ page: 1, limit: 10, total: 25, totalPages: 3 });
  });

  it('page 2 continues where page 1 stopped', () => {
    expect(taskService.getPaginated(2, 10).data[0].title).toBe('Task 11');
  });

  it('returns a partial last page and an empty page past the end', () => {
    expect(taskService.getPaginated(3, 10).data).toHaveLength(5);
    expect(taskService.getPaginated(99, 10).data).toEqual([]);
  });

  it('falls back to sane defaults for invalid input', () => {
    expect(taskService.getPaginated(0, 0).page).toBe(1);
    expect(taskService.getPaginated(-5, -1)).toMatchObject({ page: 1, limit: 10 });
    expect(taskService.getPaginated(NaN, NaN).data).toHaveLength(10);
  });
});

describe('getStats', () => {
  it('counts tasks per status', () => {
    make({ status: 'todo' });
    make({ status: 'todo' });
    make({ status: 'in_progress' });
    make({ status: 'done' });

    expect(taskService.getStats()).toMatchObject({ todo: 2, in_progress: 1, done: 1 });
  });

  it('counts overdue tasks but ignores done and null due dates', () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    const future = new Date(Date.now() + 86400000).toISOString();

    make({ status: 'todo', dueDate: past });
    make({ status: 'in_progress', dueDate: past });
    make({ status: 'done', dueDate: past });
    make({ status: 'todo', dueDate: future });
    make({ status: 'todo' });

    expect(taskService.getStats().overdue).toBe(2);
  });

  it('returns zeroes on an empty store', () => {
    expect(taskService.getStats()).toEqual({ todo: 0, in_progress: 0, done: 0, overdue: 0 });
  });
});

describe('update', () => {
  it('merges the given fields and leaves the rest alone', () => {
    const task = make({ title: 'Old', priority: 'high' });
    const updated = taskService.update(task.id, { title: 'New' });

    expect(updated).toMatchObject({ title: 'New', priority: 'high', id: task.id });
  });

  it('returns null for an unknown id', () => {
    expect(taskService.update('nope', { title: 'x' })).toBeNull();
  });

  it('ignores attempts to overwrite id and createdAt', () => {
    const task = make();
    const updated = taskService.update(task.id, { id: 'hacked', createdAt: '2000-01-01' });

    expect(updated.id).toBe(task.id);
    expect(updated.createdAt).toBe(task.createdAt);
  });

  // Regression test for BUG-4.
  it('keeps completedAt in sync with status', () => {
    const task = make();
    const done = taskService.update(task.id, { status: 'done' });
    expect(done.completedAt).not.toBeNull();

    const reopened = taskService.update(task.id, { status: 'todo' });
    expect(reopened.completedAt).toBeNull();
  });
});

describe('remove', () => {
  it('removes an existing task', () => {
    const task = make();
    expect(taskService.remove(task.id)).toBe(true);
    expect(taskService.getAll()).toEqual([]);
  });

  it('returns false for an unknown id', () => {
    expect(taskService.remove('nope')).toBe(false);
  });
});

describe('completeTask', () => {
  // Regression test for BUG-3.
  it('marks done without clobbering priority', () => {
    const task = make({ priority: 'high' });
    const completed = taskService.completeTask(task.id);

    expect(completed.status).toBe('done');
    expect(completed.priority).toBe('high');
    expect(Date.parse(completed.completedAt)).not.toBeNaN();
  });

  it('returns null for an unknown id', () => {
    expect(taskService.completeTask('nope')).toBeNull();
  });
});

describe('assignTask', () => {
  it('stores a trimmed assignee', () => {
    const task = make();
    expect(taskService.assignTask(task.id, '  Ada  ').assignee).toBe('Ada');
  });

  it('reassigns and unassigns', () => {
    const task = make();
    taskService.assignTask(task.id, 'Ada');
    expect(taskService.assignTask(task.id, 'Grace').assignee).toBe('Grace');
    expect(taskService.assignTask(task.id, null).assignee).toBeNull();
  });

  it('returns null for an unknown id', () => {
    expect(taskService.assignTask('nope', 'Ada')).toBeNull();
  });
});
