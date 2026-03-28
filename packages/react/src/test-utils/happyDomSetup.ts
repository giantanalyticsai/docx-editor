/**
 * DOM environment setup for component tests.
 *
 * Uses @happy-dom/global-registrator to provide window, document,
 * and other browser APIs in Bun's test runner.
 */

import { GlobalRegistrator } from '@happy-dom/global-registrator';

if (typeof document === 'undefined') {
  GlobalRegistrator.register();
}
