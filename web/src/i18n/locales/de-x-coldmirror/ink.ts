/** Coldmirror messages of handwritten lists, in the voice of "Fresh Dumbledore" (Fresh D.). Complete: it covers every key of `de`. */
import type { PartialMessages } from '../../schema';

export default {
  settings: {
    label: 'Handgeschriebene Listen, yo',
    hint: 'Schreib die Einträge mit dem Zauberstab von Hand; die Maus zaubert nie, Schinken',
  },
  mode: { ink: 'Zauberfeder an, zur Tastatur wechseln, yo', text: 'Tastatur an, zur Zauberfeder wechseln, yo' },
  undo: 'Letzten Strich weghexen',
  eraser: 'Radierer, weg mit Voldemort',
  colour: {
    label: 'Tintenfarbe, yo',
    custom: 'Eigene Farbe, Digga',
    preset: { default: 'Textfarbe, langweilig', red: 'Rot wie Rons Ohren', blue: 'Blau, Ravenclaw', green: 'Grün, Slytherin-Style', orange: 'Orange, Kürbissaft' },
  },
  done: 'Fertig, Schinken',
  area: 'Schreibfeld, yo',
  grip: 'Eintrag rumschubsen',
  item: 'Handgeschriebener Eintrag {n} von {total}, Schinken',
  itemTicked: 'Handgeschriebener Eintrag {n} von {total}, abgehakt, Schinken',
  placeholder: 'Handgeschriebener Eintrag, yo',
  full: 'Diese Liste ist voll mit Tinte, Digga. Fang eine neue an.',
} satisfies NonNullable<PartialMessages['ink']>;
