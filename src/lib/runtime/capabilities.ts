export type RuntimeCapabilities = {
  dashboard: boolean;
  library: boolean;
  qbank: boolean;
  review: boolean;
  space: boolean;
  flashcards: boolean;
  history: boolean;
  planner: boolean;
  analytics: boolean;
  import: boolean;
  settings: boolean;
};

export const SUPPORTED_RUNTIME_CAPABILITIES: RuntimeCapabilities = {
  dashboard: true,
  library: true,
  qbank: false,
  review: true,
  space: false,
  flashcards: true,
  history: true,
  planner: true,
  analytics: false,
  import: true,
  settings: true,
};
