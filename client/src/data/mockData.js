// Centralized mock data — stands in for the backend/API until it exists.

export const currentStudent = {
  name: 'Alex Rivera',
  studentId: '88421',
  avatarInitials: 'AR',
};

export const currentReviewer = {
  name: 'Dr. Sarah Jenkins',
  role: 'Senior Mentor',
  avatarInitials: 'SJ',
};

export const currentAdmin = {
  name: 'Admin Officer',
  role: 'Placement Cell',
  avatarInitials: 'AO',
};

export const dashboardStats = [
  { label: 'Total Experiences', value: 14, meta: '+2', icon: 'sparkle' },
  { label: 'Verified Hours', value: 320, unit: 'HRS', icon: 'clock' },
  { label: 'Avg. Review Time', value: 3.2, unit: 'DAYS', icon: 'bolt' },
  { label: 'Skill Tags', value: 28, unit: 'Across 4 domains', icon: 'hash' },
];

export const recentActivity = [
  {
    id: 1,
    title: 'Software Engineering Intern',
    org: 'Google',
    duration: 'Jun 2023 - Aug 2023',
    description:
      'Developed a microservices architecture using Go and Kubernetes. Optimized database queries resulting in a 15% reduction in latency for the core Search API.',
    skills: ['Go', 'Kubernetes', 'Backend'],
    status: 'Approved',
  },
  {
    id: 2,
    title: 'Volunteering at City Food Bank',
    org: 'Local Community Outreach',
    duration: 'Oct 2023 - Present',
    description:
      'Coordinating weekly food distribution logistics and managing a team of 15 volunteers for the central district warehouse.',
    skills: [],
    status: 'Pending',
  },
  {
    id: 3,
    title: 'Open Source Contributor',
    org: 'React Documentation Team',
    duration: 'Jan 2023 - Mar 2023',
    description: '',
    reviewerNote: 'Please provide a link to the merged PRs for verification purposes. — Registrar',
    skills: [],
    status: 'Needs Revision',
  },
];

export const ledgerCompletion = {
  percent: 65,
  note: "Add 3 more verified skills to reach 'Expert' tier visibility for recruiters.",
};

export const skillCloud = [
  { name: 'Leadership', highlighted: true },
  { name: 'TypeScript', highlighted: false },
  { name: 'Agile', highlighted: false },
  { name: 'Public Speaking', highlighted: false },
  { name: 'Data Analysis', highlighted: false },
  { name: 'UI Design', highlighted: false },
];

export const verificationLog = [
  { id: 1, org: 'TechNova Solutions', meta: 'Sent 2 days ago', state: 'pending' },
  { id: 2, org: 'Harvard Extension', meta: 'Sent 5 days ago', state: 'done' },
];

export const reviewQueue = [
  {
    id: 1,
    studentName: 'Alex Martinez',
    initials: 'AM',
    org: 'Global Tech Corp',
    role: 'Data Science Intern',
    dateSubmitted: 'Oct 24, 2023',
    status: 'Pending Review',
    summary:
      'Led a team of 4 to refactor the data pipeline for the customer dashboard. Reduced processing latency by 40% using asynchronous tasks and optimized SQL queries. Verified through peer code reviews and internal performance metrics.',
    skills: ['Python', 'PostgreSQL', 'Leadership'],
    document: 'performance_report_Q3.pdf',
  },
  {
    id: 2,
    studentName: 'Sarah Wong',
    initials: 'SW',
    org: 'Creative Hub',
    role: 'Product Designer',
    dateSubmitted: 'Oct 25, 2023',
    status: 'Pending Review',
    summary: '',
    skills: [],
    document: null,
  },
  {
    id: 3,
    studentName: 'James Lee',
    initials: 'JL',
    org: 'Finovate Labs',
    role: 'Backend Engineer',
    dateSubmitted: 'Oct 26, 2023',
    status: 'Needs Revision',
    summary: '',
    skills: [],
    document: null,
  },
  {
    id: 4,
    studentName: 'Emma Klein',
    initials: 'EK',
    org: 'University Lab',
    role: 'Research Assistant',
    dateSubmitted: 'Oct 26, 2023',
    status: 'Pending Review',
    summary: '',
    skills: [],
    document: null,
  },
];

export const analyticsStats = [
  { label: 'Verified Experiences', value: '4,250', trend: '+12%', trendDirection: 'up' },
  { label: 'Avg. Mentor Review', value: '1.8 days', trend: '-0.4d', trendDirection: 'up' },
  { label: 'Placement-Ready', value: '72%', trend: '+5%', trendDirection: 'up' },
  { label: 'Active Skill Tags', value: '156', trend: 'Stable', trendDirection: 'flat' },
];

export const skillDistribution = [
  { skill: 'React', percent: 85 },
  { skill: 'Python', percent: 78 },
  { skill: 'Java', percent: 65 },
  { skill: 'SQL', percent: 62 },
  { skill: 'Node.js', percent: 58 },
  { skill: 'Docker', percent: 45 },
];

export const readinessTrend = [
  { month: 'APR', value: 40 },
  { month: 'MAY', value: 48 },
  { month: 'JUN', value: 72 },
  { month: 'JUL', value: 60 },
  { month: 'AUG', value: 55 },
  { month: 'SEP', value: 72 },
];

export const studentCohort = [
  {
    id: 1,
    name: 'Arjun Sharma',
    rollNo: 'CS2024012',
    department: 'Computer Science',
    verifiedExp: 12,
    topSkills: ['React', 'Node'],
    extraSkills: 2,
    readiness: 92,
  },
];
