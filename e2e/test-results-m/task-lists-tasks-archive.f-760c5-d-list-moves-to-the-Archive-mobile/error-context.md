# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: task-lists/tasks-archive.feature.spec.js >> The Archive keeps finished task lists >> A finished list moves to the Archive
- Location: .features-gen/task-lists/tasks-archive.feature.spec.js:11:3

# Error details

```
Error: expect(locator).toHaveCount(expected) failed

Locator:  locator('[data-testid="tasks-item"][data-title="Taxes"]')
Expected: 0
Received: 1
Timeout:  5000ms

Call log:
  - Expect "toHaveCount" locator('[data-testid="tasks-item"][data-title="Taxes"]') with timeout 5000ms
  - waiting for locator('[data-testid="tasks-item"][data-title="Taxes"]')
    14 × locator resolved to 1 element
       - unexpected value "1"

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - banner [ref=e4]:
    - generic [aria-hidden]:
      - generic:
        - generic [aria-hidden]:
          - generic [aria-hidden]:
            - img [aria-hidden]:
              - generic: z
    - generic [ref=e6]:
      - heading "Tasks" [level=1] [ref=e7]
      - button "Settings" [ref=e10] [cursor=pointer]
  - main [ref=e15]:
    - generic [ref=e17]:
      - group "Tasks" [ref=e19]:
        - button "Open" [active] [pressed] [ref=e20] [cursor=pointer]
        - button "Canvas" [ref=e22] [cursor=pointer]
        - button "Archive" [ref=e24] [cursor=pointer]
      - generic [ref=e27]:
        - button "Filter" [ref=e28] [cursor=pointer]
        - button "Time · Date" [ref=e32] [cursor=pointer]
        - button "Collapse all" [ref=e36] [cursor=pointer]
      - generic [ref=e40]:
        - heading "Today" [level=2] [ref=e41]
        - list [ref=e42]:
          - listitem [ref=e43]:
            - generic [ref=e44]:
              - generic [ref=e45]:
                - progressbar [ref=e46]
                - generic [ref=e50]:
                  - button "Taxes" [ref=e51] [cursor=pointer]
                  - paragraph [ref=e53]:
                    - generic [ref=e54]: 1/1
                - button "Collapse" [expanded] [ref=e55] [cursor=pointer]
              - generic [ref=e58]:
                - status [ref=e59]: All done! 🎉
                - list [ref=e60]:
                  - listitem [ref=e61]:
                    - 'generic "Done: Form" [ref=e62] [cursor=pointer]':
                      - 'checkbox "Done: Form" [checked] [ref=e63]'
                    - button "Form" [ref=e68] [cursor=pointer]
                    - img "Drag Form to reorder" [ref=e69]
                    - button "Delete item" [ref=e72] [cursor=pointer]
                - generic [ref=e75]:
                  - button "Add item" [ref=e76] [cursor=pointer]
                  - button "Save as template" [ref=e80] [cursor=pointer]
                  - button "Edit" [ref=e81] [cursor=pointer]
                  - button "Delete" [ref=e85] [cursor=pointer]
  - button "Create" [ref=e90] [cursor=pointer]
  - navigation "Views" [ref=e94]:
    - tablist [ref=e95]:
      - tab "Year" [ref=e96] [cursor=pointer]
      - tab "Month" [ref=e101] [cursor=pointer]
      - tab "Week" [ref=e106] [cursor=pointer]
      - tab "Day" [ref=e111] [cursor=pointer]
      - tab "Tasks" [selected] [ref=e116] [cursor=pointer]
```

# Test source

```ts
  9   | const BACKGROUND_TODAY = '2026-10-12';
  10  | 
  11  | const isTasklistWrite = (method: string, tail = '') => (r: { url(): string; request(): { method(): string } }) =>
  12  |   new RegExp(`^/api/tasklists/[^/]+${tail}$`).test(new URL(r.url()).pathname) && r.request().method() === method;
  13  | 
  14  | /** Show the Tasks view (through the navigation when the app is open, else by its path). */
  15  | async function openTasksView(world: World) {
  16  |   if (pathname(world.page) !== '/tasks') {
  17  |     const nav = world.page.getByTestId('view-switch-tasks');
  18  |     if (world.page.url().startsWith('http') && (await nav.isVisible())) await nav.click();
  19  |     else await world.page.goto('/tasks');
  20  |   }
  21  |   await expect(world.page.getByTestId('tasks-view')).toBeVisible();
  22  | }
  23  | async function openTab(world: World, tab: 'open' | 'archive') {
  24  |   await openTasksView(world);
  25  |   const button = world.page.getByTestId(`tasks-tab-${tab}`);
  26  |   if ((await button.getAttribute('aria-pressed')) !== 'true') await button.click();
  27  |   await expect(button).toHaveAttribute('aria-pressed', 'true');
  28  | }
  29  | const archiveItem = (w: World, title: string): Locator => w.byTestId('tasks-archive-item', attr('data-title', title));
  30  | 
  31  | /** An undated list whose items are all ticked while the test clock stands on `date` (so `completedOn` = date). */
  32  | async function finishedList(world: World, title: string, date: string, itemTitle: string) {
  33  |   const before = (await world.api.get<{ plant: { growth: number; lastWatered: string | null; todayPoints: number } }>('/api/motivation')).plant;
  34  |   await world.api.setClock(berlinIso(date, '08:00'));
  35  |   const list = await world.api.post<{ id: string; items: { id: string }[] }>('/api/tasklists', { title, date: null, items: [{ title: itemTitle }] });
  36  |   for (const i of list.items) await world.api.patch(`/api/tasklists/${list.id}/items/${i.id}`, { done: true });
  37  |   await world.api.setClock(berlinIso(BACKGROUND_TODAY, '08:00'));
  38  |   await world.api.setMotivation({ plant: { growth: before.growth, lastWatered: before.lastWatered, todayPoints: before.todayPoints } });
  39  | }
  40  | 
  41  | Given('the calendar contains a task list {string} finished on {date}', async function (this: World, title: string, date: string) {
  42  |   await finishedList(this, title, date, 'Done');
  43  | });
  44  | 
  45  | Given('the calendar contains a task list {string} finished on {date} with the item {string}', async function (this: World, title: string, date: string, itemTitle: string) {
  46  |   await finishedList(this, title, date, itemTitle);
  47  | });
  48  | 
  49  | Given('the setting {string} is {string}', async function (this: World, setting: string, value: string) {
  50  |   expect(setting).toBe('Finished list without a date');
  51  |   await this.api.patch('/api/prefs', { undatedDone: value === 'Archive only' ? 'archive' : 'calendar' });
  52  | });
  53  | 
  54  | When('I open the Archive', async function (this: World) {
  55  |   await openTab(this, 'archive');
  56  | });
  57  | 
  58  | When('I search the Archive for {string}', async function (this: World, text: string) {
  59  |   await openTab(this, 'archive');
  60  |   await this.page.getByTestId('tasks-archive-search').fill(text);
  61  | });
  62  | 
  63  | When('I untick the item {string} of the task list {string} in the Archive', async function (this: World, itemTitle: string, title: string) {
  64  |   await openTab(this, 'archive');
  65  |   const row = archiveItem(this, title).getByTestId('tasklist-item').and(this.page.locator(attr('data-title', itemTitle)));
  66  |   await expect(row).toHaveAttribute('data-done', 'true');
  67  |   const saved = this.page.waitForResponse(isTasklistWrite('PATCH', '/items/[^/]+'));
  68  |   await row.getByTestId('tasklist-item-checkbox').click();
  69  |   expect((await saved).status(), 'untick saved').toBe(200);
  70  | });
  71  | 
  72  | When('I choose {string} for the task list {string} in the Archive', async function (this: World, choice: string, title: string) {
  73  |   expect(['Copy', 'Save as template']).toContain(choice);
  74  |   await openTab(this, 'archive');
  75  |   // "Save as template" (feature tasklist-templates) only opens the name sheet; the next steps fill and confirm it
  76  |   if (choice === 'Save as template') {
  77  |     await archiveItem(this, title).getByTestId('tasklist-save-template').click();
  78  |     await expect(this.page.getByTestId('template-save-dialog')).toBeVisible();
  79  |     return;
  80  |   }
  81  |   const saved = this.page.waitForResponse((r) => new URL(r.url()).pathname === '/api/tasklists' && r.request().method() === 'POST');
  82  |   await archiveItem(this, title).getByTestId('tasks-archive-duplicate').click();
  83  |   expect((await saved).status(), 'copy created').toBe(201);
  84  | });
  85  | 
  86  | Then('the task list {string} in the Archive offers {string} and {string}', async function (this: World, title: string, copy: string, save: string) {
  87  |   await openTab(this, 'archive');
  88  |   await expect(archiveItem(this, title).getByTestId('tasks-archive-duplicate')).toHaveText(exactText(copy));
  89  |   await expect(archiveItem(this, title).getByTestId('tasklist-save-template')).toHaveText(exactText(save));
  90  | });
  91  | 
  92  | Then('the Archive lists {string}', async function (this: World, titles: string) {
  93  |   await openTab(this, 'archive');
  94  |   await expectJoined(this.byTestId('tasks-archive-item'), titles, 'data-title');
  95  | });
  96  | 
  97  | Then('the Archive does not list {string}', async function (this: World, title: string) {
  98  |   await openTab(this, 'archive');
  99  |   await expect(archiveItem(this, title)).toHaveCount(0);
  100 | });
  101 | 
  102 | Then('the Open tab lists {string}', async function (this: World, title: string) {
  103 |   await openTab(this, 'open');
  104 |   await expect(this.byTestId('tasks-item', attr('data-title', title))).toHaveCount(1);
  105 | });
  106 | 
  107 | Then('the Open tab does not list {string}', async function (this: World, title: string) {
  108 |   await openTab(this, 'open');
> 109 |   await expect(this.byTestId('tasks-item', attr('data-title', title))).toHaveCount(0);
      |                                                                        ^ Error: expect(locator).toHaveCount(expected) failed
  110 | });
  111 | 
  112 | Then('the open task list {string} has no date and {int} open item(s)', async function (this: World, title: string, count: number) {
  113 |   await openTab(this, 'open');
  114 |   const list = this.byTestId('tasks-item', attr('data-title', title));
  115 |   await expect(list).toHaveAttribute('data-date', '');
  116 |   await expect(list.getByTestId('tasklist-item')).toHaveCount(count);
  117 |   await expect(list.locator('[data-testid="tasklist-item"][data-done="false"]')).toHaveCount(count);
  118 | });
  119 | 
```