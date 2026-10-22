/**
 * English messages of the Tasks view's Canvas (feature tasks-canvas, ADR 0021): the tab, the board, the Unsorted stack and
 * the areas with their editor. Spread into the main catalogue as `canvas`; `{ } @ |` must be escaped.
 */
export default {
  tab: 'Canvas',
  label: 'Task canvas',
  unsorted: 'Unsorted',
  addArea: 'Add area',
  moveFailed: "Couldn't move the note.",
  areasNotSaved: "Couldn't save the areas.",
  area: {
    defaultName: 'Area',
    edit: 'Edit area {name}',
    editor: 'Area settings',
    name: 'Area name',
    color: 'Color',
    delete: 'Delete area',
    done: 'Done',
    resize: 'Resize area {name}',
  },
  colors: { red: 'Red', orange: 'Orange', yellow: 'Yellow', green: 'Green', teal: 'Teal', blue: 'Blue', purple: 'Purple', pink: 'Pink' },
};
