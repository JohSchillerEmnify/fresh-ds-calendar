/**
 * Coldmirror messages of shared task lists, in the voice of "Fresh Dumbledore" (Fresh D.). Complete: it covers every
 * key of `de`. Crude humour only about the Harry Potter characters (owner).
 */
import type { Messages } from '../../schema';

export default {
  badge: 'Geteilt mit {name}, yo',
  badgeMember: 'Geteilt von {name}, fresh',
  title: 'Teilen mit, yo',
  person: 'Person, Digga',
  share: 'Teilen, fresh',
  stop: 'Schluss mit Teilen, wie Snape mit Sympathie',
  leave: 'Apparieren, yo',
  sharedWith: 'Geteilt mit {names}, krass',
  shareFailed: 'Das Teilen ist gescheitert. Schinken!',
  stopFailed: 'Das Teilen geht nicht aus, wie Voldemorts Ego.',
  leaveFailed: 'Du kommst nicht raus, Digga. Wie Dobby aus dem Kamin, nur schlimmer.',
  ownerOnlyCategory: 'Nur der Boss der Liste darf die Kategorie ändern, du Oberpflaume.',
  category: {
    hint: 'Alle Listen dieser Kategorie und die neuen werden geteilt, fresh.',
    failed: 'Das Teilen hat sich nicht ändern lassen, wie Umbridges Laune.',
  },
  ownerOnly: 'Das darf nur der Boss, yo.',
  needsSignIn: 'Zum Teilen musst du angemeldet sein, wie ein Hauself.',
  self: 'Mit dir selbst teilen? Das ist Narzissmus wie bei Lockhart.',
  neutral: 'Wenn die Person den Kalender nutzt, sieht sie die Liste. Der Sprechende Hut verrät nichts.',
  repeating: 'Eine wiederkehrende Liste kann man nicht teilen, die kommt wieder wie Peeves.',
  ownerCannotLeave: 'Als Boss löschst du die Liste oder hörst auf zu teilen, yo.',
  categoryOwnerOnly: 'Nur der Boss der Liste darf die Kategorie ändern, du Oberpflaume.',
} satisfies Messages['sharing'];
