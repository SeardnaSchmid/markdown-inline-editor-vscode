import { describe, expect, it } from 'vitest';
import { DecorationTypeRegistry } from '../decoration-type-registry';

function makeRegistry() {
  return new DecorationTypeRegistry({
    getGhostFaintOpacity: () => 0.5,
    getFrontmatterDelimiterOpacity: () => 0.5,
    getCodeBlockLanguageOpacity: () => 0.5,
  });
}

describe('DecorationTypeRegistry', () => {
  it('never maps two parser types to the same decoration type instance', () => {
    const values = [...makeRegistry().getMap().values()];

    // Decorations are applied with one `setDecorations` call per parser type,
    // so two parser types sharing an instance make each call overwrite the
    // other. That made hidden checkbox markers flicker into view.
    expect(new Set(values).size).toBe(values.length);
  });
});
