const {
  validateCreateTask,
  validateUpdateTask,
  validateStatusFilter,
  validateAssignee,
} = require('../src/utils/validators');

describe('validateCreateTask', () => {
  it('accepts a minimal valid body', () => {
    expect(validateCreateTask({ title: 'Hi' })).toBeNull();
  });

  it.each([
    [{}, 'missing title'],
    [{ title: '   ' }, 'blank title'],
    [{ title: 42 }, 'non-string title'],
  ])('rejects %j (%s)', (body) => {
    expect(validateCreateTask(body)).toMatch(/title/);
  });

  it('rejects unknown status and priority', () => {
    expect(validateCreateTask({ title: 'a', status: 'nope' })).toMatch(/status/);
    expect(validateCreateTask({ title: 'a', priority: 'urgent' })).toMatch(/priority/);
  });

  it('rejects an unparseable dueDate but accepts a valid one', () => {
    expect(validateCreateTask({ title: 'a', dueDate: 'tomorrow-ish' })).toMatch(/dueDate/);
    expect(validateCreateTask({ title: 'a', dueDate: '2030-01-01T00:00:00.000Z' })).toBeNull();
  });

  it('rejects a non-object body', () => {
    expect(validateCreateTask(null)).toMatch(/JSON object/);
  });
});

describe('validateUpdateTask', () => {
  it('allows an empty body (no-op update)', () => {
    expect(validateUpdateTask({})).toBeNull();
  });

  it('rejects a blank title when title is present', () => {
    expect(validateUpdateTask({ title: '' })).toMatch(/title/);
  });

  it('rejects bad enums and dates', () => {
    expect(validateUpdateTask({ status: 'finished' })).toMatch(/status/);
    expect(validateUpdateTask({ priority: 'huge' })).toMatch(/priority/);
    expect(validateUpdateTask({ dueDate: 'nope' })).toMatch(/dueDate/);
  });

  it('rejects a non-object body', () => {
    expect(validateUpdateTask(undefined)).toMatch(/JSON object/);
  });
});

describe('validateStatusFilter', () => {
  it('accepts known statuses and rejects anything else', () => {
    expect(validateStatusFilter('todo')).toBeNull();
    expect(validateStatusFilter('do')).toMatch(/status/);
    expect(validateStatusFilter('')).toMatch(/status/);
  });
});

describe('validateAssignee', () => {
  it('accepts a non-empty name and explicit null', () => {
    expect(validateAssignee({ assignee: 'Ada' })).toBeNull();
    expect(validateAssignee({ assignee: null })).toBeNull();
  });

  it('requires the field to be present', () => {
    expect(validateAssignee({})).toMatch(/required/);
    expect(validateAssignee(null)).toMatch(/required/);
  });

  it('rejects blank, non-string and overlong names', () => {
    expect(validateAssignee({ assignee: '   ' })).toMatch(/non-empty/);
    expect(validateAssignee({ assignee: 7 })).toMatch(/string/);
    expect(validateAssignee({ assignee: 'a'.repeat(101) })).toMatch(/100 characters/);
  });
});
