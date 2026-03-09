/**
 * Tests for mdToHtml — Markdown to HTML converter used in AI agent notifications.
 * Ensures proper rendering of AI-generated text in Telegram HTML mode.
 */

// We import only the pure function — no DB/Telegram dependencies
import { mdToHtml } from '../agents/ai-agent-runtime';

describe('mdToHtml', () => {
  describe('bold', () => {
    it('converts **text** to <b>text</b>', () => {
      expect(mdToHtml('**hello**')).toBe('<b>hello</b>');
    });

    it('converts __text__ to <b>text</b>', () => {
      expect(mdToHtml('__hello__')).toBe('<b>hello</b>');
    });

    it('handles bold inline with surrounding text', () => {
      const result = mdToHtml('Price: **5.00 TON**');
      expect(result).toContain('<b>5.00 TON</b>');
    });

    it('handles multiple bold segments', () => {
      const result = mdToHtml('**A** and **B**');
      expect(result).toContain('<b>A</b>');
      expect(result).toContain('<b>B</b>');
    });
  });

  describe('italic', () => {
    it('converts *text* to <i>text</i>', () => {
      expect(mdToHtml('*hello*')).toBe('<i>hello</i>');
    });

    it('does not convert _word_ in mid-word (snake_case)', () => {
      // snake_case should NOT be italicized
      const result = mdToHtml('function_name_here');
      expect(result).not.toContain('<i>');
    });
  });

  describe('code', () => {
    it('converts `code` to <code>code</code>', () => {
      expect(mdToHtml('`const x = 1`')).toBe('<code>const x = 1</code>');
    });

    it('converts triple backtick blocks to <pre><code>', () => {
      const result = mdToHtml('```\nconsole.log("hello")\n```');
      expect(result).toContain('<pre><code>');
      expect(result).toContain('</code></pre>');
    });
  });

  describe('strikethrough', () => {
    it('converts ~~text~~ to <s>text</s>', () => {
      expect(mdToHtml('~~old price~~')).toBe('<s>old price</s>');
    });
  });

  describe('headers', () => {
    it('converts # Header to <b>Header</b>', () => {
      const result = mdToHtml('# Arbitrage Report');
      expect(result).toContain('<b>Arbitrage Report</b>');
    });

    it('converts ### H3 to <b>H3</b>', () => {
      const result = mdToHtml('### Summary');
      expect(result).toContain('<b>Summary</b>');
    });
  });

  describe('HTML escaping', () => {
    it('escapes < and > to prevent XSS', () => {
      const result = mdToHtml('Price < 5 TON > 3 TON');
      expect(result).toContain('&lt;');
      expect(result).toContain('&gt;');
      expect(result).not.toContain('<5');
    });

    it('escapes & to &amp;', () => {
      const result = mdToHtml('buy & sell');
      expect(result).toContain('&amp;');
    });
  });

  describe('real-world agent notifications', () => {
    it('handles a typical arbitrage notification', () => {
      const md = `**🔥 Арбитраж найден!**

Коллекция: *Lol Pop*
Цена покупки: \`4.2 TON\` (Tonnel)
Цена продажи: \`5.8 TON\` (GetGems)
Прибыль: **38%**

~~Старая цена: 3.5 TON~~`;

      const html = mdToHtml(md);
      expect(html).toContain('<b>');
      expect(html).toContain('<i>');
      expect(html).toContain('<code>');
      expect(html).toContain('<s>');
      // No unescaped markdown syntax remaining
      expect(html).not.toMatch(/\*\*[^*]+\*\*/);
    });

    it('handles TON prices with numbers correctly', () => {
      const result = mdToHtml('Floor: **12.45 TON** | Spread: **+23%**');
      expect(result).toContain('<b>12.45 TON</b>');
      expect(result).toContain('<b>+23%</b>');
    });
  });
});
