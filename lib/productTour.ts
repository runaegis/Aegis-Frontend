export const PRODUCT_TOUR_STORAGE_KEY = 'aegis_product_tour';
export const PRODUCT_TOUR_RESUME_KEY = 'aegis_product_tour_resume';
export const PRODUCT_TOUR_START_EVENT = 'aegis:product-tour-start';

export type ProductTourStatus = 'pending' | 'skipped' | 'done';

export type ProductTourStep = {
  id: string;
  route?: string;
  element?: string;
  title: string;
  description: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
};

/** True once the first-visit demo/empty choice has been made. */
export function hasChosenWorkspaceMode(): boolean {
  try {
    const value = localStorage.getItem('aegis_demo');
    return value === 'true' || value === 'false';
  } catch {
    return false;
  }
}

export function getProductTourStatus(): ProductTourStatus {
  try {
    const value = localStorage.getItem(PRODUCT_TOUR_STORAGE_KEY);
    if (value === 'skipped' || value === 'done') return value;
  } catch {
    /* localStorage may be unavailable */
  }
  return 'pending';
}

export function setProductTourStatus(status: ProductTourStatus): void {
  try {
    localStorage.setItem(PRODUCT_TOUR_STORAGE_KEY, status);
  } catch {
    /* ignore */
  }
}

export function requestProductTour(): void {
  window.dispatchEvent(new Event(PRODUCT_TOUR_START_EVENT));
}

export function routeMatches(pathname: string, route: string): boolean {
  return pathname === route;
}

export const PRODUCT_TOUR_STEPS: ProductTourStep[] = [
  {
    id: 'intro',
    title: 'Welcome to Aegis',
    description:
      'Aegis sits between your coding agent and the tools it uses. This walkthrough covers a workspace agent, how to actually use it, then Memory and Prompts. Skip any time — nothing here is required.',
  },
  {
    id: 'workspaces',
    element: '[data-tour="nav-workspaces"]',
    title: 'Start with a workspace',
    description:
      'A workspace is a shared room where agents coordinate on one goal. Every message, mention, and tool call is logged. Create a room first, then add the agent that will work in it.',
    side: 'right',
  },
  {
    id: 'create-workspace',
    route: '/dashboard/workspaces',
    element: '[data-tour="new-workspace"]',
    title: 'Create the room',
    description:
      'Name the workspace and describe the goal. After it is created, paste the AGENTS.md snippet into the repo so your agent checks the workspace on every turn instead of asking you whether it should.',
    side: 'bottom',
  },
  {
    id: 'connect-agent',
    route: '/dashboard/workspaces',
    title: 'Add and connect an agent',
    description:
      'Open the workspace and click Add an agent. Pick a handle (for example @backend). You get a one-time MCP key plus Cursor and Claude URLs — paste those into the agent. Treat the key like a password; if you lose it, rotate it.',
  },
  {
    id: 'use-agent',
    element: '[data-tour="nav-inbox"]',
    title: 'How you use it',
    description:
      'Mention @handle in the room to assign work. The agent polls the workspace, posts back, and updates pointers. Approvals and invite requests land in Inbox. Runs show what it actually did.',
    side: 'right',
  },
  {
    id: 'memory',
    route: '/dashboard/memory',
    element: '[data-tour="new-memory"]',
    title: 'Memory',
    description:
      'Standing facts for your agents — repo conventions, owners, “always do X”. Pin the ones that should load every session. Share a memory by link when a teammate needs the same context.',
    side: 'bottom',
  },
  {
    id: 'prompts',
    route: '/dashboard/prompts',
    element: '[data-tour="new-prompt"]',
    title: 'Prompts',
    description:
      'Reusable instructions. Put {variables} in the body and they show up automatically. Save the briefs you keep pasting so agents are not starting from a blank chat.',
    side: 'left',
  },
];
