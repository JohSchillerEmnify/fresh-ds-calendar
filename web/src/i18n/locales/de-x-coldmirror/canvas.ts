/**
 * Coldmirror messages of the Tasks view's Canvas, in the voice of "Fresh Dumbledore" (Fresh D.). Complete: it covers
 * every key of `de`. Crude humour only about the Harry Potter characters (owner).
 */
import type { PartialMessages } from '../../schema';

export default {
  tab: 'Tafel, yo',
  label: 'Aufgaben-Tafel, fresh',
  unsorted: 'Unsortiert, wie Hagrids Hütte',
  addArea: 'Bereich am Start, yo',
  moveFailed: 'Die Notiz bewegt sich nicht, Digga. Wie Neville im Zaubertränke-Unterricht.',
  areasNotSaved: 'Die Bereiche sind nicht gespeichert. Schinken!',
  area: {
    defaultName: 'Bereich, yo',
    edit: 'Bereich {name} pimpen',
    editor: 'Bereichs-Settings, fresh',
    name: 'Name vom Bereich, du Oberpflaume',
    color: 'Farbe, krass',
    delete: 'Bereich wegzaubern',
    done: 'Fertig, yo',
    resize: 'Bereich {name} aufpumpen oder schrumpfen, wie Dudley',
  },
  colors: {
    red: 'Rot wie Rons Ohren', orange: 'Orange, Kürbissaft', yellow: 'Gelb wie Hagrids Zähne', green: 'Grün, Slytherin-Style',
    teal: 'Türkis, yo', blue: 'Blau, Ravenclaw', purple: 'Violett wie Voldemorts Laune', pink: 'Rosa wie Umbridges Büro',
  },
} satisfies NonNullable<PartialMessages['canvas']>;
