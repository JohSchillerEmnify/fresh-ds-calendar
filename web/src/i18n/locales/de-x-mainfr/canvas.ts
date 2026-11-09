/** Light Mainfränkisch messages of the Tasks view's Canvas. Complete here; anything missing falls back to `de`. */
import type { PartialMessages } from '../../schema';

export default {
  tab: 'Dafel',
  label: 'Aufgabn-Dafel',
  unsorted: 'Ned sortierd',
  addArea: 'Bereich dazu',
  moveFailed: 'Die Nodiz hat sich ned verschiebn lassn.',
  areasNotSaved: 'Die Bereiche hamm sich ned speichern lassn.',
  area: {
    defaultName: 'Bereich',
    edit: 'Bereich {name} ändern',
    editor: 'Bereichseisdellunga',
    name: 'Name vom Bereich',
    color: 'Farb',
    delete: 'Bereich wegmachn',
    done: 'Basst',
    resize: 'Bereich {name} größer oder kleiner machn',
  },
  colors: { red: 'Rod', orange: 'Orange', yellow: 'Gelb', green: 'Grün', teal: 'Dürkis', blue: 'Blau', purple: 'Lila', pink: 'Pink' },
} satisfies NonNullable<PartialMessages['canvas']>;
