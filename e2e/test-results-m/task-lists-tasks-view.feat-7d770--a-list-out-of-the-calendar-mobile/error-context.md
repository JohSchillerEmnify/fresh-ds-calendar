# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: task-lists/tasks-view.feature.spec.js >> The Tasks view lists every open task list >> Removing the date takes a list out of the calendar
- Location: .features-gen/task-lists/tasks-view.feature.spec.js:17:3

# Error details

```
TimeoutError: page.waitForResponse: Timeout 10000ms exceeded while waiting for event "response"
```

# Page snapshot

```yaml
- generic [ref=f1e3]:
  - banner [ref=f1e4]:
    - generic [aria-hidden]:
      - generic:
        - generic [aria-hidden]:
          - generic [aria-hidden]:
            - img [aria-hidden]:
              - generic: z
    - generic [ref=f1e6]:
      - button "Monday, 12 October 2026" [ref=f1e7] [cursor=pointer]
      - generic [ref=f1e11]:
        - button "Previous period" [ref=f1e12] [cursor=pointer]
        - button "Today" [ref=f1e15] [cursor=pointer]
        - button "Next period" [ref=f1e17] [cursor=pointer]
      - generic [ref=f1e20]:
        - button "Filters" [ref=f1e22] [cursor=pointer]
        - button "Settings" [ref=f1e25] [cursor=pointer]
  - generic [ref=f1e29]:
    - main [ref=f1e30]:
      - generic [ref=f1e35]:
        - generic [ref=f1e36]:
          - generic [ref=f1e38]: 01:00
          - generic [ref=f1e39]: 02:00
          - generic [ref=f1e40]: 03:00
          - generic [ref=f1e41]: 04:00
          - generic [ref=f1e42]: 05:00
          - generic [ref=f1e43]: 06:00
          - generic [ref=f1e44]: 07:00
          - generic [ref=f1e45]: 08:00
          - generic [ref=f1e46]: 09:00
          - generic [ref=f1e47]: 10:00
          - generic [ref=f1e48]: 11:00
          - generic [ref=f1e49]: 12:00
          - generic [ref=f1e50]: 13:00
          - generic [ref=f1e51]: 14:00
          - generic [ref=f1e52]: 15:00
          - generic [ref=f1e53]: 16:00
          - generic [ref=f1e54]: 17:00
          - generic [ref=f1e55]: 18:00
          - generic [ref=f1e56]: 19:00
          - generic [ref=f1e57]: 20:00
          - generic [ref=f1e58]: 21:00
          - generic [ref=f1e59]: 22:00
          - generic [ref=f1e60]: 23:00
        - generic [ref=f1e61]:
          - button "Create at 2026-10-12 00:00" [ref=f1e62] [cursor=pointer]
          - button "Create at 2026-10-12 01:00" [ref=f1e63] [cursor=pointer]
          - button "Create at 2026-10-12 02:00" [ref=f1e64] [cursor=pointer]
          - button "Create at 2026-10-12 03:00" [ref=f1e65] [cursor=pointer]
          - button "Create at 2026-10-12 04:00" [ref=f1e66] [cursor=pointer]
          - button "Create at 2026-10-12 05:00" [ref=f1e67] [cursor=pointer]
          - button "Create at 2026-10-12 06:00" [ref=f1e68] [cursor=pointer]
          - button "Create at 2026-10-12 07:00" [ref=f1e69] [cursor=pointer]
          - button "Create at 2026-10-12 08:00" [ref=f1e70] [cursor=pointer]
          - button "Create at 2026-10-12 09:00" [ref=f1e71] [cursor=pointer]
          - button "Create at 2026-10-12 10:00" [ref=f1e72] [cursor=pointer]
          - button "Create at 2026-10-12 11:00" [ref=f1e73] [cursor=pointer]
          - button "Create at 2026-10-12 12:00" [ref=f1e74] [cursor=pointer]
          - button "Create at 2026-10-12 13:00" [ref=f1e75] [cursor=pointer]
          - button "Create at 2026-10-12 14:00" [ref=f1e76] [cursor=pointer]
          - button "Create at 2026-10-12 15:00" [ref=f1e77] [cursor=pointer]
          - button "Create at 2026-10-12 16:00" [ref=f1e78] [cursor=pointer]
          - button "Create at 2026-10-12 17:00" [ref=f1e79] [cursor=pointer]
          - button "Create at 2026-10-12 18:00" [ref=f1e80] [cursor=pointer]
          - button "Create at 2026-10-12 19:00" [ref=f1e81] [cursor=pointer]
          - button "Create at 2026-10-12 20:00" [ref=f1e82] [cursor=pointer]
          - button "Create at 2026-10-12 21:00" [ref=f1e83] [cursor=pointer]
          - button "Create at 2026-10-12 22:00" [ref=f1e84] [cursor=pointer]
          - button "Create at 2026-10-12 23:00" [ref=f1e85] [cursor=pointer]
          - img "Now, 08:00":
            - generic: 08:00
    - complementary [ref=f1e86]:
      - button "No open tasks" [ref=f1e87] [cursor=pointer]
  - button "Create" [ref=f1e92] [cursor=pointer]
  - navigation "Views" [ref=f1e96]:
    - tablist [ref=f1e97]:
      - tab "Year" [ref=f1e98] [cursor=pointer]
      - tab "Month" [ref=f1e103] [cursor=pointer]
      - tab "Week" [ref=f1e108] [cursor=pointer]
      - tab "Day" [selected] [ref=f1e113] [cursor=pointer]
      - tab "Tasks" [ref=f1e118] [cursor=pointer]
```

# Test source

```ts
  48  |   await dialog.getByTestId('tasklist-save').click();
  49  |   expect((await saved).status(), 'task list saved').toBe(201);
  50  | });
  51  | 
  52  | When('I remove the date of the task list {string} in the Tasks view', async function (this: World, title: string) {
  53  |   await openTasksView(this);
  54  |   await item(this, title).getByTestId('tasklist-expanded-title').click();
  55  |   const dialog = this.page.getByTestId('tasklist-dialog');
  56  |   await expect(dialog).toBeVisible();
  57  |   await dialog.getByTestId('tasklist-date-clear').click();
  58  |   const saved = this.page.waitForResponse(isTasklistWrite('PATCH'));
  59  |   await dialog.getByTestId('tasklist-save').click();
  60  |   expect((await saved).status(), 'task list saved').toBe(200);
  61  | });
  62  | 
  63  | When('I give the task list {string} the date {date} in the Tasks view', async function (this: World, title: string, date: string) {
  64  |   await openTasksView(this);
  65  |   await item(this, title).getByTestId('tasklist-expanded-title').click();
  66  |   const dialog = this.page.getByTestId('tasklist-dialog');
  67  |   await expect(dialog).toBeVisible();
  68  |   await dialog.getByTestId('tasklist-date').fill(date);
  69  |   const saved = this.page.waitForResponse(isTasklistWrite('PATCH'));
  70  |   await dialog.getByTestId('tasklist-save').click();
  71  |   expect((await saved).status(), 'task list saved').toBe(200);
  72  | });
  73  | 
  74  | When('I group the Tasks view by {string}', async function (this: World, label: string) {
  75  |   await openTasksView(this);
  76  |   await inSheet(this, 'sort', async () => {
  77  |     const control = this.page.getByTestId('tasks-group-by');
  78  |     if ((await selectedLabel(control)) === label) return;
  79  |     const saved = this.page.waitForResponse(isPrefsPatch);
  80  |     await chooseOption(control, label);
  81  |     expect((await saved).status(), 'grouping saved').toBe(200);
  82  |   });
  83  | });
  84  | 
  85  | When('I sort the Tasks view by {string}', async function (this: World, label: string) {
  86  |   await openTasksView(this);
  87  |   await inSheet(this, 'sort', async () => {
  88  |     const control = this.page.getByTestId('tasks-sort-by');
  89  |     if ((await selectedLabel(control)) === label) return;
  90  |     const saved = this.page.waitForResponse(isPrefsPatch);
  91  |     await chooseOption(control, label);
  92  |     expect((await saved).status(), 'sorting saved').toBe(200);
  93  |   });
  94  | });
  95  | 
  96  | When('I sort the Tasks view by {string} in reversed order', async function (this: World, label: string) {
  97  |   await openTasksView(this);
  98  |   await inSheet(this, 'sort', async () => {
  99  |     const control = this.page.getByTestId('tasks-sort-by');
  100 |     if ((await selectedLabel(control)) !== label) {
  101 |       const saved = this.page.waitForResponse(isPrefsPatch);
  102 |       await chooseOption(control, label);
  103 |       expect((await saved).status(), 'sorting saved').toBe(200);
  104 |     }
  105 |     const dir = this.page.getByTestId('tasks-sort-dir');
  106 |     if ((await dir.getAttribute('aria-pressed')) !== 'true') {
  107 |       const saved = this.page.waitForResponse(isPrefsPatch);
  108 |       await dir.click();
  109 |       expect((await saved).status(), 'sort order saved').toBe(200);
  110 |     }
  111 |     await expect(dir).toHaveAttribute('aria-pressed', 'true');
  112 |   });
  113 | });
  114 | 
  115 | When('I tick the item {string} of the task list {string} in the Tasks view', async function (this: World, itemTitle: string, title: string) {
  116 |   await openTasksView(this);
  117 |   const row = item(this, title).getByTestId('tasklist-item').and(this.page.locator(attr('data-title', itemTitle)));
  118 |   await expect(row).toHaveAttribute('data-done', 'false');
  119 |   const saved = this.page.waitForResponse(isTasklistWrite('PATCH', '/items/[^/]+'));
  120 |   await row.getByTestId('tasklist-item-checkbox').click();
  121 |   expect((await saved).status(), 'tick saved').toBe(200);
  122 | });
  123 | 
  124 | Then('the Tasks view lists {string} under {string}', async function (this: World, title: string, group: string) {
  125 |   const g = this.byTestId('tasks-group').filter({ has: this.page.getByTestId('tasks-group-title').filter({ hasText: exactText(group) }) });
  126 |   await expect(g.locator(`[data-testid="tasks-item"]${attr('data-title', title)}`)).toHaveCount(1);
  127 | });
  128 | 
  129 | Then('the Tasks view lists {string}', async function (this: World, titles: string) {
  130 |   await expectJoined(this.byTestId('tasks-item'), titles, 'data-title');
  131 | });
  132 | 
  133 | Then('the Tasks view groups are {string}', async function (this: World, titles: string) {
  134 |   await expectJoined(this.byTestId('tasks-group-title'), titles);
  135 | });
  136 | 
  137 | Then('the Tasks view is grouped by {string}', async function (this: World, label: string) {
  138 |   await inSheet(this, 'sort', () => expect.poll(() => selectedLabel(this.page.getByTestId('tasks-group-by'))).toBe(label));
  139 | });
  140 | 
  141 | Then('the calendar shows the task list {string} on {date}', async function (this: World, title: string, date: string) {
  142 |   await this.page.goto(`/day/${date}`);
  143 |   await expect(this.taskCard(title, date)).toBeVisible();
  144 | });
  145 | 
  146 | Then('neither the calendar on {date} nor the open tasks tray shows the task list {string}', async function (this: World, date: string, title: string) {
  147 |   // the tray's own fetch must have finished, or "not listed" would pass on an empty tray
> 148 |   const trayLoaded = this.page.waitForResponse((r) => new URL(r.url()).pathname === '/api/tasklists/open');
      |                                ^ TimeoutError: page.waitForResponse: Timeout 10000ms exceeded while waiting for event "response"
  149 |   await this.page.goto(`/day/${date}`);
  150 |   await trayLoaded;
  151 |   await this.settled();
  152 |   await expect(this.taskCards(title).locator('visible=true')).toHaveCount(0);
  153 |   const rows = this.page.getByTestId('task-tray-item');
  154 |   const toggle = this.page.getByTestId('task-tray-toggle');
  155 |   if (!(await rows.first().isVisible()) && (await toggle.isVisible())) await toggle.click();
  156 |   await expect(this.byTestId('task-tray-item', attr('data-title', title))).toHaveCount(0);
  157 | });
  158 | 
  159 | // --- collapsible, compact cards (STEPS.md "Tasks view", tasklists-collapse.feature) ---------------------------------
  160 | 
  161 | const cardView = (w: World, title: string): Locator => item(w, title).getByTestId('tasklist-view');
  162 | 
  163 | async function setCardCollapsed(world: World, title: string, collapsed: boolean) {
  164 |   await openTasksView(world);
  165 |   const view = cardView(world, title);
  166 |   if ((await view.getAttribute('data-collapsed')) !== String(collapsed)) await view.getByTestId('tasklist-collapse').click();
  167 |   await expect(view).toHaveAttribute('data-collapsed', String(collapsed));
  168 | }
  169 | 
  170 | When('I collapse the card of the task list {string} in the Tasks view', async function (this: World, title: string) {
  171 |   await setCardCollapsed(this, title, true);
  172 | });
  173 | 
  174 | When('I expand the card of the task list {string} in the Tasks view', async function (this: World, title: string) {
  175 |   await setCardCollapsed(this, title, false);
  176 | });
  177 | 
  178 | Then('the card of the task list {string} in the Tasks view is collapsed', async function (this: World, title: string) {
  179 |   await expect(cardView(this, title)).toHaveAttribute('data-collapsed', 'true');
  180 | });
  181 | 
  182 | Then('the card of the task list {string} in the Tasks view is expanded', async function (this: World, title: string) {
  183 |   await expect(cardView(this, title)).toHaveAttribute('data-collapsed', 'false');
  184 | });
  185 | 
  186 | Then('the card of the task list {string} in the Tasks view shows the items {string}', async function (this: World, title: string, items: string) {
  187 |   await expectJoined(cardView(this, title).getByTestId('tasklist-item'), items, 'data-title');
  188 | });
  189 | 
  190 | Then('the card of the task list {string} in the Tasks view shows no items', async function (this: World, title: string) {
  191 |   await expect(cardView(this, title).getByTestId('tasklist-item')).toHaveCount(0);
  192 | });
  193 | 
  194 | Then('the card of the task list {string} in the Tasks view shows the done count {string}', async function (this: World, title: string, count: string) {
  195 |   await expect(cardView(this, title).getByTestId('tasklist-expanded-count')).toHaveText(exactText(count));
  196 | });
  197 | 
  198 | async function setAllCollapsed(world: World, collapsed: boolean) {
  199 |   await openTasksView(world);
  200 |   const toggle = world.page.getByTestId('tasks-collapse-all');
  201 |   // the toggle reads "pressed" while every card is collapsed
  202 |   if ((await toggle.getAttribute('aria-pressed')) !== String(collapsed)) await toggle.click();
  203 |   await expect(toggle).toHaveAttribute('aria-pressed', String(collapsed));
  204 | }
  205 | 
  206 | When('I collapse all task lists in the Tasks view', async function (this: World) {
  207 |   await setAllCollapsed(this, true);
  208 | });
  209 | 
  210 | When('I expand all task lists in the Tasks view', async function (this: World) {
  211 |   await setAllCollapsed(this, false);
  212 | });
  213 | 
  214 | Then('the Add item button of the task list {string} in the Tasks view shares a row with Edit and Delete', async function (this: World, title: string) {
  215 |   const view = cardView(this, title);
  216 |   const centres = await Promise.all(['tasklist-add', 'tasklist-edit', 'tasklist-delete'].map(async (id) => {
  217 |     const box = await view.getByTestId(id).boundingBox();
  218 |     expect(box, id).not.toBeNull();
  219 |     return box!.y + box!.height / 2;
  220 |   }));
  221 |   expect(Math.max(...centres) - Math.min(...centres)).toBeLessThanOrEqual(4);
  222 | });
  223 | 
  224 | Then('the add field of the task list {string} in the Tasks view is hidden', async function (this: World, title: string) {
  225 |   await expect(cardView(this, title).getByTestId('tasklist-new-item')).toBeHidden();
  226 | });
  227 | 
  228 | Then('the add field of the task list {string} in the Tasks view is shown', async function (this: World, title: string) {
  229 |   await expect(cardView(this, title).getByTestId('tasklist-new-item')).toBeVisible();
  230 | });
  231 | 
  232 | When('I tap Add item of the task list {string} in the Tasks view', async function (this: World, title: string) {
  233 |   await cardView(this, title).getByTestId('tasklist-add').click();
  234 | });
  235 | 
  236 | When('I drag the item {string} above the item {string} of the task list {string} in the Tasks view', async function (this: World, title: string, above: string, list: string) {
  237 |   await openTasksView(this);
  238 |   await dragItem(this, cardView(this, list), title, { above });
  239 | });
  240 | 
```