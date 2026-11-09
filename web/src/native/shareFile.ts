/** Hands a text file to the Android share sheet through the Capacitor Filesystem and Share plugins (the WebView has no Web Share and ignores blob downloads). */
import { isNativeApp } from '@/native/app';

interface FilesystemPlugin { writeFile(o: { path: string; data: string; directory: string; encoding: string }): Promise<{ uri: string }> }
interface SharePlugin { share(o: { title: string; files: string[]; dialogTitle: string }): Promise<unknown> }

function plugins(): { Filesystem?: FilesystemPlugin; Share?: SharePlugin } {
  return (window as unknown as { Capacitor?: { Plugins?: { Filesystem?: FilesystemPlugin; Share?: SharePlugin } } }).Capacitor?.Plugins ?? {};
}

/** Result of `shareFileNative`: `unavailable` means no sheet opened (outside the app, an APK without the plugins, or a failure), so the caller needs another way out. */
export type NativeShare = 'shared' | 'cancelled' | 'unavailable';

/** Writes `text` to the app's cache directory and opens the share sheet on it; never throws. */
export async function shareFileNative(name: string, text: string): Promise<NativeShare> {
  const { Filesystem, Share } = plugins();
  if (!isNativeApp() || !Filesystem || !Share) return 'unavailable';
  try {
    const { uri } = await Filesystem.writeFile({ path: name, data: text, directory: 'CACHE', encoding: 'utf8' });
    await Share.share({ title: name, files: [uri], dialogTitle: name });
    return 'shared';
  } catch (e) {
    return /cancel/i.test(String((e as Error)?.message ?? e)) ? 'cancelled' : 'unavailable';
  }
}
