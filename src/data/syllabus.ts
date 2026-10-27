export type Topic = { id: string; name: string };
export type Phase = { id: number; name: string; weeks: string; tags: string[]; topics: Topic[]; color: string; icon: string };

const group = (phase: number, names: string[]): Topic[] => names.map((name, i) => ({ id: `p${phase}-t${i + 1}`, name }));

export const phases: Phase[] = [
  { id: 1, name: 'Developer Foundations', weeks: 'Weeks 1–2', tags: ['Git', 'GitHub', 'Linux', 'CLI'], color: '#5774E8', icon: 'terminal', topics: group(1, ['Git', 'GitHub', 'Linux', 'Command Line', 'Debugging']) },
  { id: 2, name: 'DSA & Problem Solving', weeks: 'Weeks 3–6 · ongoing', tags: ['DSA', 'Algorithms', 'Complexity'], color: '#9065E8', icon: 'braces', topics: group(2, ['Data Structures', 'Algorithms', 'Complexity Analysis', 'Problem-Solving Patterns']) },
  { id: 3, name: 'Core Computer Science', weeks: 'Weeks 7–8 · ongoing', tags: ['DBMS', 'OS', 'Networking'], color: '#D77B45', icon: 'database', topics: group(3, ['DBMS', 'SQL', 'Operating Systems', 'Computer Networks', 'HTTP']) },
  { id: 4, name: 'JavaScript & TypeScript', weeks: 'Weeks 9–10', tags: ['JavaScript', 'TypeScript', 'Async'], color: '#D6A42D', icon: 'code', topics: group(4, ['JavaScript', 'TypeScript', 'Asynchronous Programming', 'Type Safety']) },
  { id: 5, name: 'Node.js Backend Engineering', weeks: 'Weeks 11–12', tags: ['Node.js', 'Express', 'REST'], color: '#34866F', icon: 'server', topics: group(5, ['Node.js', 'Express.js', 'REST APIs', 'PostgreSQL', 'Authentication', 'Backend Security']) },
  { id: 6, name: 'React, Frontend & Figma', weeks: 'Weeks 13–14', tags: ['React', 'UI Architecture', 'Figma'], color: '#438DCA', icon: 'panels-top-left', topics: group(6, ['HTML', 'CSS', 'React', 'TypeScript', 'Tailwind CSS', 'Frontend Architecture', 'Accessibility', 'Figma', 'UI/UX Design']) },
  { id: 7, name: 'Testing & Software Engineering', weeks: 'Weeks 15–16', tags: ['Testing', 'SOLID', 'Design'], color: '#C45E8A', icon: 'test-tube', topics: group(7, ['Unit Testing', 'Integration Testing', 'Clean Code', 'SOLID Principles', 'Design Patterns', 'Code Reviews']) },
  { id: 8, name: 'Core Java', weeks: 'Weeks 17–18', tags: ['Java', 'OOP', 'JVM'], color: '#D16D4D', icon: 'coffee', topics: group(8, ['Java Fundamentals', 'OOP', 'Collections', 'Generics', 'JVM', 'Concurrency']) },
  { id: 9, name: 'Spring Boot Backend', weeks: 'Weeks 19–21', tags: ['Spring Boot', 'JPA', 'Security'], color: '#4F9973', icon: 'leaf', topics: group(9, ['Spring Boot', 'Spring MVC', 'Spring Security', 'JPA', 'Hibernate', 'REST APIs', 'Backend Testing']) },
  { id: 10, name: 'DevOps & Production Engineering', weeks: 'Weeks 22–23', tags: ['Docker', 'CI/CD', 'Cloud'], color: '#4A8AB2', icon: 'cloud', topics: group(10, ['Docker', 'CI/CD', 'Cloud', 'Redis', 'Caching', 'Logging', 'Monitoring', 'Observability']) },
  { id: 11, name: 'System Design & Architecture', weeks: 'Weeks 24–26', tags: ['LLD', 'HLD', 'Distributed Systems'], color: '#7866BE', icon: 'network', topics: group(11, ['Low-Level Design (LLD)', 'High-Level Design (HLD)', 'Design Patterns', 'Scalability', 'Distributed Systems', 'Databases at Scale', 'Reliability']) },
  { id: 12, name: 'Capstone & Interview Readiness', weeks: 'Weeks 27–28 · ongoing', tags: ['Portfolio', 'Blender', 'Interviews'], color: '#D39A40', icon: 'rocket', topics: group(12, ['Capstone Projects', 'Portfolio', 'Blender', '3D Assets for Web', 'DSA Revision', 'Technical Interviews', 'Mock Interviews', 'Engineering Ownership']) },
];
