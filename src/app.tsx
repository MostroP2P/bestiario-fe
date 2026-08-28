import { Dashboard } from '~/views/Dashboard'

/**
 * SPEC 2 forbids the site inventing a number, so the design's sample figures
 * are development-only. A production build renders the same screen with no
 * orders on it until the relay layer of SPEC 6 fills them in.
 */
export function App() {
  return <Dashboard sample={import.meta.env.DEV} />
}
