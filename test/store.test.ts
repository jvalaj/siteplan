import { DatabaseSync } from 'node:sqlite';

import { describe, expect, it } from 'vitest';

import { createStore } from '../server/store';
import { newLayout } from '../src/shared/layout';

describe('the server store', () => {
  it('saves a layout and gives it back', () => {
    const store = createStore(new DatabaseSync(':memory:'));
    const layout = newLayout('deck', 'Back deck', 'Dana');
    expect(store.put(layout)).toBe(layout);
    expect(store.all()).toEqual([layout]);
  });

  it('never lets an older copy overwrite a newer one', () => {
    const store = createStore(new DatabaseSync(':memory:'));
    const first = newLayout('deck', 'Back deck', 'Dana');
    const newer = { ...first, rev: 5, name: 'Back deck (edited)' };
    store.put(newer);
    // a phone that was offline sends its stale copy.
    const kept = store.put({ ...first, rev: 3, name: 'stale' });
    expect(kept.name).toBe('Back deck (edited)');
    expect(store.get(first.id)?.rev).toBe(5);
  });

  it('removes a layout', () => {
    const store = createStore(new DatabaseSync(':memory:'));
    const layout = newLayout('patio', 'Patio', 'Dana');
    store.put(layout);
    store.remove(layout.id);
    expect(store.all()).toEqual([]);
  });
});
