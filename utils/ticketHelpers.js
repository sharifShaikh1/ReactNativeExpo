// Utility helpers related to ticket assignment counts
/**
 * Compute number of accepted/assigned engineers for a ticket.
 * Tries multiple common ticket shapes: assignedPersonnel array (with assignmentStatus),
 * acceptedEngineersCount numeric, or falls back to assignedPersonnel length.
 */
export function getAssignedEngineerCount(ticket) {
  if (!ticket) return 0;

  // If server provides a scalar accepted count, use it
  if (typeof ticket.acceptedEngineersCount === 'number') return ticket.acceptedEngineersCount;

  // If an assignedPersonnel array exists, count items where assignmentStatus === 'accepted'
  if (Array.isArray(ticket.assignedPersonnel)) {
    try {
      return ticket.assignedPersonnel.filter(p => {
        // support objects that might be { assignmentStatus, role } or { status }
        const status = p.assignmentStatus || p.status || p.assignmentStatus;
        const role = p.role || '';
        // Treat only engineers as relevant if role present
        const isEngineer = !role || String(role).toLowerCase().includes('engineer');
        return isEngineer && (String(status).toLowerCase() === 'accepted' || String(status).toLowerCase() === 'assigned');
      }).length;
    } catch (e) {
      return 0;
    }
  }

  // Fallback to length property if present
  if (typeof ticket.assignedPersonnel === 'number') return ticket.assignedPersonnel;
  if (ticket.assignedPersonnel && ticket.assignedPersonnel.length) return ticket.assignedPersonnel.length;

  return 0;
}

/**
 * Returns true when there are enough assigned engineers (>= requiredEngineers)
 * Tickets may use requiredEngineers property; default to 1 when missing.
 */
export function hasEnoughAssigned(ticket) {
  if (!ticket) return false;
  const required = Number(ticket.requiredEngineers || ticket.requiredEngineer || 1);
  const assigned = getAssignedEngineerCount(ticket);
  return assigned >= (isNaN(required) ? 1 : required);
}

export default { getAssignedEngineerCount, hasEnoughAssigned };
