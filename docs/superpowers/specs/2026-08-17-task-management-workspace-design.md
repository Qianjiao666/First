# Task Management Workspace v1.5

## Scope

This release applies the approved A direction, "Task Operations Workspace", to the six task surfaces. It is a presentation-layer change only: task APIs, capability checks, form guards, routes, task state transitions, reward handling, and database access remain unchanged.

## Layout Contract

- Desktop (`>=1280px`): a 232px task rail, 64px utility bar, and a bounded 1320px operational content area.
- Medium (`1024px-1279px`): the rail contracts to a 72px route strip.
- Tablet and mobile (`<1024px`): the rail becomes an accessible drawer. At `<768px`, task lists become single-column cards, filters are on demand, tables become stacked rows, and the task header remains a single compact row.
- The cold paper/ink palette carries reading and structure. Blue marks routes and primary actions, green marks successful or active states, orange marks rewards, and red remains reserved for errors.

## Page Patterns

- Marketplace: compact filter band, scanning-oriented task rows, and a sticky task-rhythm panel.
- My tasks: current status counts precede the existing status tabs; each count derives from the returned application list.
- Create and admin editor: field sections are reachable from a presentation-only workflow navigator; submission remains the original form and intents.
- Detail: a stage navigator provides anchors for the existing overview, consultation, collaboration, delivery, and review areas. Access remains controlled by the existing hidden sections and capability checks.
- Admin: metrics derive only from the current result set. Pending-application count is shown as `--` unless the returned record explicitly provides `pending_application_count`. Templates, rules, and exceptions use presentation-only governance tabs.

## Accessibility And Safety

- The workspace drawer exposes `aria-expanded`, route links retain route semantics, tabs retain `role=tab`, and workflow controls only scroll and focus existing fields.
- Locally hosted Lucide-derived menu and close symbols are used for new icon actions, each with a text `aria-label` and `title`.
- `prefers-reduced-motion` disables drawer movement. The layout maintains a 320px minimum safe width and has been checked at 390px with `scrollWidth === innerWidth`.
- `task-workspace.js` does not call Supabase, task APIs, or privileged functions and does not insert markup with `innerHTML`.

## Verification

- Static task, admin, changelog, and visual-system suite: 87 passed, 0 failed.
- Syntax checks passed for `task-workspace.js`, `task-admin.js`, and `task-my.js`.
- Playwright verified desktop task marketplace, create, detail, admin, and admin editor pages plus mobile marketplace and my-tasks pages. The 390px checks found no horizontal overflow.
