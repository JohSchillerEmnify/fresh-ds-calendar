/** The installer pasted into Scriptable once (ADR 0044): stores the key and server URL in the Keychain, saves the widget script
 * as "Calendar". Plain JavaScript text in the app language it was made with. */
export const WIDGET_SCRIPT_NAME = 'Calendar';
export const SCRIPTABLE_APP_STORE_URL = 'https://apps.apple.com/app/id1405459188';
export const SCRIPTABLE_ADD_URL = 'scriptable:///add';

/** The installer text with the key and the server URL filled in (nothing else is left to fill in). */
export function widgetInstaller(serverUrl, key, language = 'auto') {
  return `// Calendar widget installer
// Tap the play button at the bottom right. Nothing to change in this text.
const SERVER_URL = ${JSON.stringify(serverUrl.replace(/\/+$/, ''))};
const KEY = ${JSON.stringify(key)};
const NAME = ${JSON.stringify(WIDGET_SCRIPT_NAME)};
const LANGUAGE = ${JSON.stringify(language)};
const de = [LANGUAGE, Device.language()].map((c) => String(c || '').toLowerCase()).find((c) => c.startsWith('de') || c.startsWith('en'))?.startsWith('de') === true;
const T = de ? {
  done: 'Installiert',
  delete: 'Lösche bitte diesen Installer in Scriptable.',
  invalid: 'Dieses Widget ist ungültig. Füge es in den Einstellungen der App neu hinzu.',
  removed: 'Dieses Widget wurde in der App entfernt. Füge es in den Einstellungen neu hinzu.',
  offline: 'Keine Verbindung. Verbinde dich mit dem Internet und tippe erneut auf ▶.',
  busy: 'Zu viele Versuche. Warte eine Minute und tippe erneut auf ▶.',
  server: 'Der Kalender ist nicht erreichbar. Versuche es in ein paar Minuten erneut.',
} : {
  done: 'Installed',
  delete: 'Please delete this installer in Scriptable.',
  invalid: 'This widget is not valid. Add it again in Settings.',
  removed: 'This widget was removed in the app. Add it again in Settings.',
  offline: 'No connection. Connect to the internet and tap ▶ again.',
  busy: 'Too many tries. Wait a minute and tap ▶ again.',
  server: 'The calendar is not reachable. Try again in a few minutes.',
};
async function say(message) {
  const a = new Alert();
  a.title = de ? 'Kalender-Widget' : 'Calendar widget';
  a.message = message;
  a.addAction('OK');
  await a.presentAlert();
}
function docsFileManager() {
  try {
    const f = FileManager.iCloud();
    f.documentsDirectory();
    return f;
  } catch (e) {
    return FileManager.local();
  }
}
async function install() {
  const req = new Request(SERVER_URL + '/api/widget/script');
  req.headers = { Authorization: 'Bearer ' + KEY };
  req.timeoutInterval = 20;
  let body;
  try {
    body = await req.loadString();
  } catch (e) {
    return say(/offline|internet|network|connect|host/i.test(String(e && e.message || e)) ? T.offline : T.server);
  }
  const status = req.response ? req.response.statusCode : 0;
  if (status === 401) {
    let code = '';
    try { code = JSON.parse(body).error.code; } catch (e) { /* unreadable: treated as not valid */ }
    return say(code === 'WIDGET_KEY_REVOKED' ? T.removed : T.invalid);
  }
  if (status === 429) return say(T.busy);
  if (status !== 200 || !/^\\/\\/ calendar-widget version=\\d+/.test(body) || !/\\n\\/\\/ calendar-widget end\\s*$/.test(body)) return say(T.server);
  const fm = docsFileManager();
  fm.writeString(fm.joinPath(fm.documentsDirectory(), NAME + '.js'), body);
  Keychain.set('calendar-widget-key', KEY);
  Keychain.set('calendar-widget-url', SERVER_URL);
  // the installer holds the key: it removes itself, and asks the person to if it cannot
  let removed = false;
  try {
    fm.remove(module.filename);
    removed = !fm.fileExists(module.filename);
  } catch (e) { /* reported below */ }
  await say(removed ? T.done : T.done + '\\n\\n' + T.delete);
}
await install();
`;
}
