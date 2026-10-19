import { describe, expect, it } from 'vitest';
import { buildCardContent, toCardKit2 } from '../src/card/builder';

describe('Hermes card style integration', () => {
  it('builds streaming card with blue top header', () => {
    const card = buildCardContent('streaming', { text: 'Thinking...' });
    expect(card.header).toBeDefined();
    expect(card.header?.template).toBe('blue');
    expect(card.header?.title.content).toContain('Processing');
  });

  it('builds complete card with green top header on success', () => {
    const card = buildCardContent('complete', { text: 'Done answer' });
    expect(card.header).toBeDefined();
    expect(card.header?.template).toBe('green');
    expect(card.header?.title.content).toContain('Completed');
  });

  it('builds complete card with red top header on error', () => {
    const card = buildCardContent('complete', { text: 'Error occured', isError: true });
    expect(card.header).toBeDefined();
    expect(card.header?.template).toBe('red');
    expect(card.header?.title.content).toContain('Error');
  });

  it('renders Hermes compact panel header and 3-line footer when hermesCardStyle is enabled', () => {
    const card = buildCardContent('complete', {
      text: 'Final response',
      elapsedMs: 38700,
      reasoningText: 'thought detail',
      panel: { hermesCardStyle: true },
      footerMetrics: {
        model: 'deepseek-v4.1-flash',
        inputTokens: 31800,
        outputTokens: 1600,
        contextTokens: 131072,
      },
    });

    // Check Panel Header
    const panel = card.elements.find((el) => el.tag === 'collapsible_panel') as any;
    expect(panel).toBeDefined();
    expect(panel.header.title.content).toContain('🧠 1 轮');
    expect(panel.header.title.content).toContain('🛠️ 0 个工具');
    expect(panel.header.title.content).toContain('⏳ 0.0 秒');

    // Check Footer Line 1, 2, 3
    const mdElements = card.elements.filter((el) => el.tag === 'markdown') as any[];
    const footerElement = mdElements[mdElements.length - 1];
    expect(footerElement).toBeDefined();
    const content = footerElement.content as string;
    expect(content).toContain('✅ 已完成');
    expect(content).toContain('⚕deepseek-v4.1-flash');
    expect(content).toContain('31.8K/131K');
    expect(content).toContain('临平');
    expect(content).toContain('💬');
  });
});
