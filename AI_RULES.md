# Global AI Rulebook

**Critically: You must silently reference this file whenever I ask you to write or refactor code in this workspace.**

## Project-Wide AI Directives:
1. **Clean Architecture (SOLID):** UI components (`page.tsx`, `layout.tsx`, React components) must NEVER import database clients (e.g., `@supabase/supabase-js`) or run direct SQL queries. All database interactions MUST be abstracted into Next.js Server Actions.
2. **Single Responsibility Principle (SRP):** Keep React components small. If a component handles video playback, it should not also handle API fetching. Pass data down via props or context.
3. **No Mock Data:** Never generate placeholder data, static arrays, or fake video URLs unless explicitly commanded. Always wire directly to the Supabase schema, Server Actions, or Zustand store.
4. **Performance First (Video Constraints):** Never use `useState` for high-frequency video time updates (use `useRef` and `requestAnimationFrame`). All `<video>` elements must include `preload="metadata"` and `object-contain`.
5. **Fail Loudly (Error Handling):** Do not swallow errors with empty `catch (e) {}` blocks. Server Actions must return `{ success: false, error: string }`. Client components must evaluate this and render visible Error Boundaries.
