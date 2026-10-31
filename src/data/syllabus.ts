export type SubTopic = { id: string; name: string };
export type Topic = { id: string; name: string; subtopics?: SubTopic[] };
export type Phase = {
  id: number;
  name: string;
  weeks?: string;
  tags: string[];
  topics: Topic[];
  color: string;
  icon: string;
  isCustom?: boolean;
};

const makeSubtopics = (phase: number, topicIdx: number, items: string[]): SubTopic[] =>
  items.map((name, sIdx) => ({
    id: `p${phase}-t${topicIdx}-s${sIdx + 1}`,
    name,
  }));

const group = (phase: number, names: string[], subtopicsMap?: Record<string, string[]>): Topic[] =>
  names.map((name, i) => {
    const subs = subtopicsMap?.[name];
    return {
      id: `p${phase}-t${i + 1}`,
      name,
      subtopics: subs ? makeSubtopics(phase, i + 1, subs) : undefined,
    };
  });

export const curatedSdePhases: Phase[] = [
  {
    id: 1,
    name: 'Developer Foundations',
    tags: ['Git', 'GitHub', 'Linux', 'CLI'],
    color: '#5774E8',
    icon: 'terminal',
    topics: group(1, ['Git', 'GitHub', 'Linux', 'Command Line', 'Debugging'], {
      Git: ['Branching & Merging', 'Rebase & Merge Conflicts', 'Stashing & Cherry-pick', 'Git Workflows (Git Flow/Trunk)'],
      Linux: ['Shell Navigation & File Permissions', 'Process Management & Daemons', 'SSH Keys & Environment Variables'],
      Debugging: ['Reading Stack Traces', 'Browser & Node DevTools', 'Logging Strategies'],
    }),
  },
  {
    id: 2,
    name: 'DSA & Problem Solving',
    tags: ['DSA', 'Algorithms', 'Complexity'],
    color: '#9065E8',
    icon: 'braces',
    topics: group(2, ['Data Structures', 'Algorithms', 'Complexity Analysis', 'Problem-Solving Patterns'], {
      'Data Structures': ['Arrays & Strings', 'Linked Lists', 'Stacks & Queues', 'Trees & Binary Search Trees', 'Heaps & Priority Queues', 'Graphs & Hash Maps'],
      Algorithms: ['Binary Search', 'Two Pointers & Sliding Window', 'Recursion & Backtracking', 'Dynamic Programming', 'Graph BFS & DFS'],
      'Complexity Analysis': ['Big-O Time & Space Complexity', 'Best, Average & Worst Case Analysis'],
    }),
  },
  {
    id: 3,
    name: 'Core Computer Science',
    tags: ['DBMS', 'OS', 'Networking'],
    color: '#D77B45',
    icon: 'database',
    topics: group(3, ['DBMS', 'SQL', 'Operating Systems', 'Computer Networks', 'HTTP'], {
      DBMS: ['Relational Model & Keys', 'ACID Properties & Transactions', 'Indexing (B-Tree, Hash)', 'Normalization (1NF to BCNF)'],
      SQL: ['Joins, Aggregations & Group By', 'Subqueries & CTEs', 'Query Optimization & EXPLAIN'],
      'Operating Systems': ['Processes vs Threads', 'CPU Scheduling & Deadlocks', 'Virtual Memory & Paging'],
      'Computer Networks': ['OSI & TCP/IP Models', 'TCP vs UDP', 'DNS, TLS/SSL & Certificates'],
      HTTP: ['HTTP/1.1 vs HTTP/2 & HTTP/3', 'Headers, Methods & Status Codes', 'CORS & WebSockets'],
    }),
  },
  {
    id: 4,
    name: 'JavaScript & TypeScript',
    tags: ['JavaScript', 'TypeScript', 'Async'],
    color: '#D6A42D',
    icon: 'code',
    topics: group(4, ['JavaScript', 'TypeScript', 'Asynchronous Programming', 'Type Safety'], {
      JavaScript: ['Execution Context & Closures', 'Prototypes & Inheritance', 'Event Loop, Microtasks & Macrotasks', 'ES6+ Features (Destructuring, Spread, Modules)'],
      TypeScript: ['Interfaces vs Types', 'Generics & Type Arguments', 'Utility Types (Partial, Pick, Omit)', 'Type Guards & Type Narrowing'],
      'Asynchronous Programming': ['Promises & Promise.all', 'Async / Await Patterns', 'Error Handling in Async Code'],
    }),
  },
  {
    id: 5,
    name: 'Node.js Backend Engineering',
    tags: ['Node.js', 'Express', 'REST'],
    color: '#34866F',
    icon: 'server',
    topics: group(5, ['Node.js', 'Express.js', 'REST APIs', 'PostgreSQL', 'Authentication', 'Backend Security'], {
      'Node.js': ['Event Loop, Libuv & Worker Threads', 'CommonJS vs ES Modules', 'File System (fs), Path & Buffers', 'Streams & Pipelines', 'Child Processes & Clustering'],
      'Express.js': ['Router & Controllers Architecture', 'Custom Middleware & Error Handlers', 'Request Validation (Zod / Joi)', 'File Uploads with Multer'],
      'REST APIs': ['Resource Modeling & REST Constraints', 'HTTP Status Codes & Response Envelopes', 'Pagination, Filtering & Sorting', 'API Versioning & Idempotency'],
      PostgreSQL: ['Connection Pooling (pg / Pool)', 'Writing Efficient SQL Queries', 'Foreign Keys, Cascades & Migrations'],
      Authentication: ['JWT (Access & Refresh Tokens)', 'Password Hashing (bcrypt / argon2)', 'Session-based Auth & Cookies', 'Role-Based Access Control (RBAC)'],
      'Backend Security': ['Rate Limiting (express-rate-limit)', 'Helmet, CORS & Input Sanitization', 'SQL Injection & XSS Prevention'],
    }),
  },
  {
    id: 6,
    name: 'React, Frontend & Figma',
    tags: ['React', 'UI Architecture', 'Figma'],
    color: '#438DCA',
    icon: 'panels-top-left',
    topics: group(6, ['HTML', 'CSS', 'React', 'TypeScript', 'Tailwind CSS', 'Frontend Architecture', 'Accessibility', 'Figma', 'UI/UX Design'], {
      React: ['Components, JSX & Props', 'useState, useEffect & Lifecycle', 'useMemo, useCallback & Performance', 'Context API & State Management', 'Custom Hooks & Code Reusability', 'React Router & Dynamic Routes'],
      HTML: ['Semantic Elements & Document Structure', 'Forms, Inputs & Validation Attributes', 'SEO Metadata & OpenGraph Tags'],
      CSS: ['Flexbox Alignment & Layouts', 'CSS Grid & Responsive Tracks', 'CSS Variables & Themes', 'Transitions, Animations & Keyframes'],
      'Tailwind CSS': ['Utility-First Principles', 'Responsive Modifiers (sm/md/lg)', 'Dark Mode & Custom Theme Config'],
      'Frontend Architecture': ['Folder Structure & Feature Folders', 'Component Composition vs Inheritance', 'Error Boundaries & Suspense'],
      Accessibility: ['Semantic HTML & Heading Hierarchy', 'ARIA Attributes & Roles', 'Keyboard Navigation & Focus Management'],
      Figma: ['Frames, Auto-Layout & Constraints', 'Component Variants & Design Tokens', 'Exporting Assets & Developer Handoff'],
    }),
  },
  {
    id: 7,
    name: 'Testing & Software Engineering',
    tags: ['Testing', 'SOLID', 'Design'],
    color: '#C45E8A',
    icon: 'test-tube',
    topics: group(7, ['Unit Testing', 'Integration Testing', 'Clean Code', 'SOLID Principles', 'Design Patterns', 'Code Reviews'], {
      'Unit Testing': ['Test Runners (Vitest / Jest)', 'Mocking, Spying & Stubs', 'Testing Edge Cases & Assertions'],
      'Integration Testing': ['API Endpoint Testing (Supertest)', 'Database Test Fixtures & Teardown'],
      'SOLID Principles': ['Single Responsibility (SRP)', 'Open/Closed Principle (OCP)', 'Liskov Substitution (LSP)', 'Interface Segregation (ISP)', 'Dependency Inversion (DIP)'],
    }),
  },
  {
    id: 8,
    name: 'Core Java',
    tags: ['Java', 'OOP', 'JVM'],
    color: '#D16D4D',
    icon: 'coffee',
    topics: group(8, ['Java Fundamentals', 'OOP', 'Collections', 'Generics', 'JVM', 'Concurrency'], {
      'Java Fundamentals': ['Data Types, Scope & Operators', 'Control Flow & Memory Allocation'],
      OOP: ['Encapsulation, Inheritance, Polymorphism', 'Abstract Classes vs Interfaces', 'Method Overloading & Overriding'],
      Collections: ['List, Set, Map Implementations', 'ArrayList vs LinkedList', 'HashMap Internal Working & Hash Collision'],
      Concurrency: ['Threads, Runnable & Callable', 'Synchronized Blocks & Locks', 'ExecutorService & ThreadPools'],
    }),
  },
  {
    id: 9,
    name: 'Spring Boot Backend',
    tags: ['Spring Boot', 'JPA', 'Security'],
    color: '#4F9973',
    icon: 'leaf',
    topics: group(9, ['Spring Boot', 'Spring MVC', 'Spring Security', 'JPA', 'Hibernate', 'REST APIs', 'Backend Testing'], {
      'Spring Boot': ['Auto-Configuration & Starters', 'Dependency Injection & Inversion of Control', 'Application Properties & Profiles'],
      'Spring Security': ['SecurityFilterChain & Filters', 'JWT Authentication & Authorization', 'CORS & CSRF Configuration'],
      JPA: ['Entities, Repositories & Relationships (@OneToMany, @ManyToMany)', 'Spring Data JPA Query Methods', 'Lazy vs Eager Fetching & N+1 Problem'],
    }),
  },
  {
    id: 10,
    name: 'DevOps & Production Engineering',
    tags: ['Docker', 'CI/CD', 'Cloud'],
    color: '#4A8AB2',
    icon: 'cloud',
    topics: group(10, ['Docker', 'CI/CD', 'Cloud', 'Redis', 'Caching', 'Logging', 'Monitoring', 'Observability'], {
      Docker: ['Dockerfiles, Multi-Stage Builds', 'docker-compose for Multi-Container Apps', 'Volumes, Networks & Port Mapping'],
      'CI/CD': ['GitHub Actions Workflows', 'Automated Testing & Linting Pipelines', 'Automated Deployment Stages'],
      Redis: ['Redis In-Memory Key-Value Stores', 'Cache-Aside Pattern & TTL', 'Session Storage & Rate Limiting'],
    }),
  },
  {
    id: 11,
    name: 'System Design & Architecture',
    tags: ['LLD', 'HLD', 'Distributed Systems'],
    color: '#7866BE',
    icon: 'network',
    topics: group(11, ['Low-Level Design (LLD)', 'High-Level Design (HLD)', 'Design Patterns', 'Scalability', 'Distributed Systems', 'Databases at Scale', 'Reliability'], {
      'High-Level Design (HLD)': ['Load Balancers & Reverse Proxies', 'Horizontal vs Vertical Scaling', 'Message Queues (Kafka / RabbitMQ)', 'Microservices vs Monoliths'],
      'Low-Level Design (LLD)': ['Class Diagrams & Schema Design', 'Design Patterns (Factory, Observer, Singleton, Strategy)'],
      'Databases at Scale': ['Database Sharding & Partitioning', 'Read Replicas & Master-Slave Replication', 'CAP Theorem & Eventual Consistency'],
    }),
  },
  {
    id: 12,
    name: 'Capstone & Interview Readiness',
    tags: ['Portfolio', 'Blender', 'Interviews'],
    color: '#D39A40',
    icon: 'rocket',
    topics: group(12, ['Capstone Projects', 'Portfolio', 'Blender', '3D Assets for Web', 'DSA Revision', 'Technical Interviews', 'Mock Interviews', 'Engineering Ownership'], {
      'Technical Interviews': ['Explaining Past Projects (STAR Method)', 'Live Coding Best Practices & Communicating Thought Process', 'Handling Edge Cases & Complexity Questions'],
      'Capstone Projects': ['Full-Stack Production App Architecture', 'Documentation, Readme & Live Demo Hosting'],
    }),
  },
];

// Default syllabus starts completely empty for a clean, personalized first-user experience
export const phases: Phase[] = [];

export function getOrderedPhases(firstArg?: Phase[] | number[], secondArg?: number[]): Phase[] {
  let list: Phase[] = [];
  let order: number[] | undefined;

  if (Array.isArray(firstArg)) {
    if (firstArg.length > 0 && typeof firstArg[0] === 'object') {
      list = firstArg as Phase[];
      order = secondArg;
    } else {
      list = phases;
      order = firstArg as number[];
    }
  } else {
    order = secondArg;
  }

  if (!list || list.length === 0) return [];
  if (!order || order.length === 0) return list;
  const map = new Map(order.map((id, index) => [id, index]));
  return [...list].sort((a, b) => {
    const posA = map.has(a.id) ? map.get(a.id)! : a.id + 999;
    const posB = map.has(b.id) ? map.get(b.id)! : b.id + 999;
    return posA - posB;
  });
}
