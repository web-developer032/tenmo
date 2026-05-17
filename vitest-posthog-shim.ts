/**
 * Vitest stub for `posthog-js` and `posthog-js/react`. The
 * production SDK does heavy session-tracking setup that we
 * never want during tests.
 */

const noop = () => {};

const stub = {
  __loaded: true,
  init: noop,
  capture: noop,
  identify: noop,
  reset: noop,
  group: noop,
  groupIdentify: noop,
  shutdown: async () => {},
};

export default stub;

export const PostHogProvider = ({ children }: { children: unknown }) => children;
export const usePostHog = () => stub;
