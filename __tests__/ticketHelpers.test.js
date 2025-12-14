import { getAssignedEngineerCount, hasEnoughAssigned } from '../utils/ticketHelpers';

describe('ticketHelpers', () => {
  test('getAssignedEngineerCount uses acceptedEngineersCount if present', () => {
    const t = { acceptedEngineersCount: 3 };
    expect(getAssignedEngineerCount(t)).toBe(3);
  });

  test('getAssignedEngineerCount counts assignedPersonnel with accepted status', () => {
    const t = { assignedPersonnel: [
      { assignmentStatus: 'accepted', role: 'Engineer' },
      { assignmentStatus: 'accepted', role: 'Engineer' },
      { assignmentStatus: 'pending' },
      { assignmentStatus: 'assigned', role: 'Engineer' }
    ] };
    expect(getAssignedEngineerCount(t)).toBe(3);
  });

  test('getAssignedEngineerCount handles missing arrays gracefully', () => {
    expect(getAssignedEngineerCount(null)).toBe(0);
    expect(getAssignedEngineerCount({})).toBe(0);
  });

  test('hasEnoughAssigned compares against requiredEngineers', () => {
    const t1 = { requiredEngineers: 2, acceptedEngineersCount: 1 };
    expect(hasEnoughAssigned(t1)).toBe(false);

    const t2 = { requiredEngineers: 2, assignedPersonnel: [ { assignmentStatus: 'accepted' }, { assignmentStatus: 'accepted' } ] };
    expect(hasEnoughAssigned(t2)).toBe(true);
  });

  test('hasEnoughAssigned defaults requiredEngineers to 1', () => {
    const t = { assignedPersonnel: [ { assignmentStatus: 'accepted' } ] };
    expect(hasEnoughAssigned(t)).toBe(true);
  });
});
