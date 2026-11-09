/** Deutsche Meldungen der handgeschriebenen Listen (Labs, Funktion handwritten-lists). */
import type { Messages } from '../../schema';
export default {
  settings: {
    label: 'Handgeschriebene Listen',
    hint: 'Die Einträge einer Aufgabenliste mit dem Stift von Hand schreiben. Mit der Maus wird nicht gezeichnet.',
  },
  mode: { ink: 'Handschrift, zur Tastatur wechseln', text: 'Tastatur, zur Handschrift wechseln' },
  undo: 'Letzten Strich zurücknehmen',
  eraser: 'Radierer',
  colour: {
    label: 'Tintenfarbe',
    custom: 'Eigene Farbe',
    preset: { default: 'Textfarbe', red: 'Rot', blue: 'Blau', green: 'Grün', orange: 'Orange' },
  },
  done: 'Fertig',
  area: 'Schreibfeld',
  grip: 'Eintrag verschieben',
  item: 'Handgeschriebener Eintrag {n} von {total}',
  itemTicked: 'Handgeschriebener Eintrag {n} von {total}, abgehakt',
  placeholder: 'Handgeschriebener Eintrag',
  full: 'Diese Liste ist vollgeschrieben. Fang eine neue Liste an.',
} satisfies Messages['ink'];
