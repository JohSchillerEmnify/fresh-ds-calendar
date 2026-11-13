// Ratchet for the kit lint gate (ADR 0032): files that may still use a raw field, a hand-made role or a click on a plain
// element outside web/src/components/m3. It only shrinks: web/test/lint-gate.test.ts fails for an entry whose file no
// longer needs it, and a new file is never added without a reason a kit part cannot cover.
// allow: 'field' = <input>/<textarea>/<select>, 'role' = role="button|checkbox|dialog|option", 'click' = @click on div/span/li/header.
export const GATE_ALLOWLIST = [
  // hidden file inputs and copy buffers: the browser needs a real element, nothing is drawn
  { file: 'web/src/components/settings/IphoneWidgetSheet.vue', allow: ['field'], reason: 'off-screen copy buffer' },
  { file: 'web/src/components/settings/ThemeImport.vue', allow: ['field'], reason: 'hidden file inputs and read-only copy buffers' },
  { file: 'web/src/views/ErrorLogView.vue', allow: ['field'], reason: 'off-screen copy buffer' },
  // developer labs, not shipped as product UI
  { file: 'web/src/features/motivation/MotionLab.vue', allow: ['field'], reason: 'labs: motion test page' },
  { file: 'web/src/features/labs/approach/ApproachBar.vue', allow: ['click'], reason: 'labs: drawn bar segments' },
  { file: 'web/src/features/labs/clock/ClockView.vue', allow: ['role'], reason: 'labs: SVG arc hit areas' },
  { file: 'web/src/features/labs/zoom/ZoomMonthView.vue', allow: ['click'], reason: 'labs: zoomable month grid' },
  // drawn surfaces whose click is a delegated or swallowed pointer event, not a control
  { file: 'web/src/features/calendar/ResizeHandles.vue', allow: ['click'], reason: 'swallows the click after a resize drag' },
  { file: 'web/src/views/MonthView.vue', allow: ['click'], reason: 'delegated clicks on the month grid cells and chip rows' },
  { file: 'web/src/features/tasklists/TaskListCard.vue', allow: ['click'], reason: 'delegated click on the card body' },
  { file: 'web/src/features/tasklists/TaskListView.vue', allow: ['field', 'role', 'click'], reason: 'TODO slice: rename field on TextField; ink cell tick as a kit control' },
  { file: 'web/src/features/tasklists/TasksCanvas.vue', allow: ['field'], reason: 'TODO slice: area name field on TextField' },
  // open slices of issue 48
  { file: 'web/src/features/calendar/MapPicker.vue', allow: ['role', 'click'], reason: 'TODO slice fix/48-m3-dialogs: map picker dialog' },
  { file: 'web/src/features/calendar/LocationField.vue', allow: ['role', 'click'], reason: 'TODO slice fix/48-m3-dialogs: suggestion list' },
  { file: 'web/src/components/shell/MonthPicker.vue', allow: ['role', 'click'], reason: 'TODO slice fix/48-m3-dialogs: picker popup' },
  { file: 'web/src/features/motivation/PlantCard.vue', allow: ['role', 'click'], reason: 'TODO slice fix/48-m3-dialogs: plant card' },
];
