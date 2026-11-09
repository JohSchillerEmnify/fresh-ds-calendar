/**
 * Unit-test setup: every component a test mounts is unmounted after it, so a timer a component armed (a drop's
 * click guard, a delayed close) is cleared instead of firing after the test environment is gone.
 */
import { afterEach } from 'vitest';
import { enableAutoUnmount } from '@vue/test-utils';

enableAutoUnmount(afterEach);
