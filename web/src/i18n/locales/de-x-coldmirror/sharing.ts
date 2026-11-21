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
  remove: 'Rauswerfen, yo',
  leave: 'Apparieren, yo',
  sharedWith: 'Geteilt mit {names}, krass',
  alsoWith: 'Außerdem geteilt mit {names}, yo',
  shareFailed: 'Das Teilen ist gescheitert. Schinken!',
  removeFailed: 'Die Person lässt sich nicht rauswerfen, wie Dobby aus dem Kamin.',
  leaveFailed: 'Du kommst nicht raus, Digga. Wie Dobby aus dem Kamin, nur schlimmer.',
  invite: {
    acceptLater: 'Annehmen klappt gerade nicht, wie Apparieren in Hogwarts. Versuch es später nochmal.',
    cardList: 'Einladung zu ner Liste, yo',
    cardCategory: 'Einladung zu ner Kategorie, fresh',
    textList: '{address} lädt dich ein, „{title}“ zu teilen, wie Hagrid zum Tee.',
    textCategory: '{address} lädt dich ein, die Kategorie „{title}“ zu teilen, yo.',
    snackbar: '{address} lädt dich ein, „{title}“ zu teilen, fresh',
    snackbarCategory: '{address} lädt dich ein, die Kategorie „{title}“ zu teilen, yo',
    show: 'Zeig her, yo',
    accept: 'Klar, fresh',
    decline: 'Nö, Digga',
    sent: 'Eule an {address} unterwegs',
    withdraw: 'Eule zurückrufen',
    acceptFailed: 'Das Annehmen ist gescheitert, wie Snapes Humorversuch.',
    declineFailed: 'Das Ablehnen ging schief, Digga.',
    withdrawFailed: 'Die Eule lässt sich nicht zurückrufen, yo.',
  },
  tooMany: 'Zu viele Eulen unterwegs, Digga. Ruf erst eine zurück.',
  ownerOnlyCategory: 'Nur der Boss der Liste darf die Kategorie ändern, du Oberpflaume.',
  category: {
    hint: 'Die Person kriegt eine Einladung. Sagt sie ja, werden alle Listen dieser Kategorie und die neuen geteilt, fresh.',
    failed: 'Das Teilen hat sich nicht ändern lassen, wie Umbridges Laune.',
  },
  ownerOnly: 'Das darf nur der Boss, yo.',
  needsSignIn: 'Zum Teilen musst du angemeldet sein, wie ein Hauself.',
  self: 'Mit dir selbst teilen? Das ist Narzissmus wie bei Lockhart.',
  repeating: 'Eine wiederkehrende Liste kann man nicht teilen, die kommt wieder wie Peeves.',
  ownerCannotLeave: 'Als Boss löschst du die Liste oder hörst auf zu teilen, yo.',
  categoryOwnerOnly: 'Nur der Boss der Liste darf die Kategorie ändern, du Oberpflaume.',
} satisfies Messages['sharing'];
