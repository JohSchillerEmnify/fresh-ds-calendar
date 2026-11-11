/** The Scriptable script name the installer saves the widget under (step 7 of the setup picks it). */
export declare const WIDGET_SCRIPT_NAME: 'Calendar';
export declare const SCRIPTABLE_APP_STORE_URL: string;
export declare const SCRIPTABLE_ADD_URL: string;
/** The installer text with the key and the server URL filled in (nothing else is left to fill in). */
export declare function widgetInstaller(serverUrl: string, key: string): string;
