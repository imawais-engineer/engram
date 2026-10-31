export const SAMPLE_NOTES = [
  {
    title: "JavaScript: lexical scope & inner functions",
    subject: "Web Development",
    tags: ["javascript", "functions"],
    content:
      "An inner function keeps access to the variables of the function it was defined in, even after the outer function has returned. Example: a makeCounter() that returns increment(); each counter remembers its own count. Used for data privacy, factories and event handlers. Classic bug: var inside a for-loop with setTimeout — use let to get a fresh binding per iteration.",
  },
  {
    title: "React useEffect cleanup",
    subject: "Web Development",
    tags: ["react", "hooks"],
    content:
      "useEffect runs after render. Return a cleanup function to unsubscribe listeners, clear intervals or abort fetches. The dependency array controls when it re-runs; stale values happen when a dependency is missing. In Strict Mode effects run twice in development to surface missing cleanups.",
  },
  {
    title: "Big-O of common sorting algorithms",
    subject: "Data Structures & Algorithms",
    tags: ["sorting", "complexity"],
    content:
      "Merge sort: O(n log n) always, stable, needs O(n) extra memory. Quick sort: O(n log n) average, O(n^2) worst case with bad pivots, in-place. Heap sort: O(n log n), not stable. Insertion sort is O(n^2) but great for nearly-sorted, small arrays. Counting/radix sort beat n log n for bounded integer keys.",
  },
  {
    title: "Graph traversal: BFS vs DFS",
    subject: "Data Structures & Algorithms",
    tags: ["graphs", "bfs", "dfs"],
    content:
      "Breadth-first search uses a queue and finds the shortest path in an unweighted graph. Depth-first search uses a stack or recursion and is good for cycle detection, topological sort and connected components. Both are O(V + E). Dijkstra generalises BFS to weighted edges with a priority queue.",
  },
  {
    title: "Database normalization (1NF to BCNF)",
    subject: "Databases",
    tags: ["sql", "normalization"],
    content:
      "1NF: atomic values, no repeating groups. 2NF: no partial dependency on part of a composite key. 3NF: no transitive dependencies between non-key columns. BCNF: every determinant is a candidate key. Normalizing removes update anomalies; denormalize deliberately for read-heavy workloads.",
  },
  {
    title: "SQL indexes and query performance",
    subject: "Databases",
    tags: ["sql", "indexes"],
    content:
      "A B-tree index turns a full table scan into a logarithmic lookup. Composite index column order matters: put equality filters first, then range. Indexes speed up reads but slow down writes and use storage. Use EXPLAIN to check whether the planner actually uses the index.",
  },
  {
    title: "OS: deadlocks and the four Coffman conditions",
    subject: "Operating Systems",
    tags: ["concurrency", "deadlock"],
    content:
      "A deadlock needs mutual exclusion, hold and wait, no preemption, and circular wait. Break any one to prevent it, e.g. always acquire locks in a global order. Banker's algorithm avoids unsafe states. Race conditions differ: they produce wrong results rather than everything getting stuck.",
  },
  {
    title: "Software testing pyramid",
    subject: "Software Engineering",
    tags: ["testing", "quality"],
    content:
      "Many fast unit tests at the base, fewer integration tests in the middle, and a small number of end-to-end UI tests at the top. Unit tests isolate one function with mocks; integration tests check modules working together; E2E tests simulate a real user. Aim for tests that are fast, reliable and meaningful rather than chasing 100% coverage.",
  },
  {
    title: "Agile Scrum ceremonies",
    subject: "Software Engineering",
    tags: ["agile", "scrum"],
    content:
      "Sprint planning picks backlog items for a 1–4 week sprint. Daily stand-up: what I did, what I'll do, blockers. Sprint review demos the increment to stakeholders; the retrospective improves the process. Roles: Product Owner owns the backlog, Scrum Master removes impediments, the dev team builds.",
  },
  {
    title: "HTTP status codes cheat sheet",
    subject: "Web Development",
    tags: ["http", "api"],
    content:
      "2xx success (200 OK, 201 Created, 204 No Content). 3xx redirects (301 permanent, 302/307 temporary, 304 Not Modified). 4xx client errors (400 Bad Request, 401 Unauthenticated, 403 Forbidden, 404 Not Found, 409 Conflict, 429 Too Many Requests). 5xx server errors (500, 502 Bad Gateway, 503 Unavailable).",
  },
];
