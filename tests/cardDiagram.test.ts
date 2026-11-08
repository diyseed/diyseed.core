import { describe, it, expect } from 'vitest';
import { cardDiagram } from '../src/ui/cardDiagram';

describe('cardDiagram', () => {
  it('labels width, height and padding in mm', () => {
    const diagram = cardDiagram(85.6, 54, 1.5);
    expect(diagram.markup).toContain('>85.6 mm</text>');
    expect(diagram.markup).toContain('>54 mm</text>');
    expect(diagram.markup).toContain('>1.5 mm padding</text>');
    expect(diagram.label).toBe('Card 85.6 mm × 54 mm, 1.5 mm padding');
  });

  it('draws the padding as a dashed rectangle inside the card', () => {
    expect(cardDiagram(85.6, 54, 1.5).markup).toContain('card-diagram__padding');
  });

  it('skips the padding rectangle when the padding would not fit', () => {
    expect(cardDiagram(20, 20, 10).markup).not.toContain('card-diagram__padding');
  });

  it('draws tick-ended width and height dimension lines', () => {
    const lines = cardDiagram(85.6, 54, 1.5).markup.match(/<line /g) ?? [];
    expect(lines).toHaveLength(6);
  });
});
