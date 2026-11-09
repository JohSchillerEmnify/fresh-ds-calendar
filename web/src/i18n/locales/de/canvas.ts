/** German messages of the Tasks view's Canvas; complete (a key missing here is a type error). */
import type { Messages } from '../../schema';

export default {
  tab: 'Tafel',
  label: 'Aufgaben-Tafel',
  unsorted: 'Unsortiert',
  addArea: 'Bereich hinzufügen',
  moveFailed: 'Die Notiz konnte nicht verschoben werden.',
  areasNotSaved: 'Die Bereiche konnten nicht gespeichert werden.',
  area: {
    defaultName: 'Bereich',
    edit: 'Bereich {name} bearbeiten',
    editor: 'Bereichseinstellungen',
    name: 'Name des Bereichs',
    color: 'Farbe',
    delete: 'Bereich löschen',
    done: 'Fertig',
    resize: 'Größe von Bereich {name} ändern',
  },
  colors: { red: 'Rot', orange: 'Orange', yellow: 'Gelb', green: 'Grün', teal: 'Türkis', blue: 'Blau', purple: 'Lila', pink: 'Pink' },
} satisfies Messages['canvas'];
