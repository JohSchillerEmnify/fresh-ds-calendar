import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/api/client';
import { useSaveSettings } from '@/composables/useSaveSettings';
import { useSettingsStore } from '@/stores/settings';
import { useSyncStore } from '@/stores/sync';
import { useUiStore } from '@/stores/ui';
import { freshPinia } from './helpers';

describe('useSaveSettings', () => {
  it('an unreachable server goes to the sync banner, any other failure to a snackbar', async () => {
    freshPinia();
    const settings = useSettingsStore();
    const save = useSaveSettings();
    const patch = vi.spyOn(settings, 'patch');
    patch.mockRejectedValueOnce(new ApiError(0, 'NETWORK' as never, 'offline'));
    await save({ calmMode: true });
    expect(useSyncStore().error).toBeInstanceOf(ApiError);
    expect(useUiStore().snackbars).toHaveLength(0);
    patch.mockRejectedValueOnce(new ApiError(400, 'VALIDATION' as never, 'bad'));
    await save({ calmMode: true });
    expect(useUiStore().snackbars).toHaveLength(1);
    patch.mockRejectedValueOnce(new Error('boom'));
    await save({ calmMode: true });
    expect(useUiStore().snackbars.at(-1)?.text).toBe('Could not save settings');
  });
});
