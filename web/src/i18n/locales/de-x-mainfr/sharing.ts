/** Light Mainfränkisch messages of shared task lists. Complete here; anything missing falls back to `de`. */
import type { PartialMessages } from '../../schema';

export default {
  badge: 'Geteilt mit {name}',
  badgeMember: 'Geteilt vo {name}',
  title: 'Deiln',
  person: 'Person',
  choose: 'Person aussuchn',
  share: 'Deiln',
  stop: 'Ned mehr deiln',
  leave: 'Verlassn',
  sharedWith: 'Geteilt mit {names}',
  noPeople: 'Etz kann nuch keiner dazu: der muss sich erschd amal anmeldn.',
  shareFailed: 'Die Lisdn hat sich ned deiln lassn.',
  stopFailed: 'Des Deiln hat sich ned beendn lassn.',
  leaveFailed: 'Die Lisdn hat sich ned verlassn lassn.',
  ownerOnlyCategory: 'Nur der Besitzer kann die Kategorie vo ner geteildn Lisdn ändern.',
  category: {
    label: 'Deiln mit',
    nobody: 'Keiner',
    hint: 'Alle Lisdn vo dera Kategorie un neue wern mit dera Person geteilt.',
    failed: 'Des Deiln hat sich ned ändern lassn.',
  },
  ownerOnly: 'Des darf nur der Besitzer.',
  needsSignIn: 'Zum Deiln muss ma angemeldet sei.',
  self: 'Mit dir selber deiln bassd ned.',
  unknownPerson: 'Die Person kann ned dazu.',
  repeating: 'A Lisdn, die sich widdaholt, kann ma ned deiln.',
  ownerCannotLeave: 'Der Besitzer löscht die Lisdn oder hörd mit em Deiln auf.',
  categoryOwnerOnly: 'Nur der Besitzer kann die Kategorie vo ner geteildn Lisdn ändern.',
} satisfies NonNullable<PartialMessages['sharing']>;
