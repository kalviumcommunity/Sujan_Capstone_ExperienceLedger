// One place that defines what each REAL account role can see. Routing, the sidebar,
// and the post-login redirect all read from here, so they can never disagree.
// (The server enforces the same rules - this only decides what the UI shows.)

export const ROLE_LABEL = {
  student: 'Student',
  mentor: 'Mentor',
  placement_officer: 'Placement Officer',
  admin: 'Admin',
};

export const STUDENT = ['student'];
export const REVIEWERS = ['mentor', 'placement_officer', 'admin'];
export const PLACEMENT = ['placement_officer', 'admin'];
export const ADMIN = ['admin'];

const HOME = {
  student: '/',
  mentor: '/review-queue',
  placement_officer: '/analytics',
  admin: '/analytics',
};

export function homeFor(role) {
  return HOME[role] || '/';
}

export const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: '▦', roles: STUDENT },
  { to: '/my-experiences', label: 'My Experiences', icon: '⇄', roles: STUDENT },
  { to: '/export-profile', label: 'Export Profile', icon: '▤', roles: STUDENT },
  { to: '/analytics', label: 'Analytics', icon: '▦', roles: PLACEMENT },
  { to: '/review-queue', label: 'Review Queue', icon: '✓', roles: REVIEWERS },
  { to: '/student-records', label: 'Student Records', icon: '☰', roles: PLACEMENT },
  { to: '/user-management', label: 'User Management', icon: '⚙', roles: ADMIN },
];

export function navItemsFor(role) {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}

export function initialsOf(name = '') {
  return name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}
