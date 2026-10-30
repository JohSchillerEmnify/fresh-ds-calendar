// ESLint rule `local/comment-style`: AGENTS.md says comments are one-line "why" notes, no history, dates or quotes.
// Own rule because no maintained ESLint plugin checks comment length, dates and owner quotes together.
const DATE = /\b\d{4}-\d{2}-\d{2}\b/;
const OWNER_QUOTE = /\(owner\b|\bowner\s*[,:]|\bper (?:the )?owner\b|\bthe owner\b|\bowner (?:said|asked|wants?|wanted|decided|prefers|spec|call)/i;
const MAX_LINES = 3;

/** Groups consecutive `//` comments so a stacked run counts as one block. */
function groupComments(comments) {
  const groups = [];
  for (const c of comments) {
    const last = groups.at(-1)?.at(-1);
    if (c.type === 'Line' && last?.type === 'Line' && last.loc.end.line + 1 === c.loc.start.line) groups.at(-1).push(c);
    else groups.push([c]);
  }
  return groups;
}

export default {
  meta: { type: 'suggestion', schema: [], messages: { long: 'Comment block of {{n}} lines (max {{max}}): keep the why in one line.', dated: 'Comment contains a date: history belongs in commits and ADRs.', owner: 'Comment quotes the owner: decisions belong in the spec or an ADR.' } },
  /** Builds the rule visitor for one file. */
  create(context) {
    return {
      Program() {
        for (const g of groupComments(context.sourceCode.getAllComments())) {
          const loc = g[0].loc;
          const n = g.at(-1).loc.end.line - loc.start.line + 1;
          const text = g.map((c) => c.value).join('\n');
          if (n > MAX_LINES) context.report({ loc, messageId: 'long', data: { n, max: MAX_LINES } });
          if (DATE.test(text)) context.report({ loc, messageId: 'dated' });
          if (OWNER_QUOTE.test(text)) context.report({ loc, messageId: 'owner' });
        }
      },
    };
  },
};
