/** The message schema, derived from the English catalogue, shared by all catalogues and the typed `t()`. */
import type en from './locales/en';

/** The message schema: the shape of the English catalogue with every message widened to `string`. */
export type Messages = Widen<typeof en>;
type Widen<T> = T extends string ? string : { [K in keyof T]: Widen<T[K]> };
/** A catalogue that may leave messages out (the fun languages). */
export type PartialMessages = DeepPartial<Messages>;
type DeepPartial<T> = T extends string ? string : { [K in keyof T]?: DeepPartial<T[K]> };
