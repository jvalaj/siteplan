import type { DatabaseSync } from 'node:sqlite';

import { isNewer, type Layout } from '../src/shared/layout';

/** keeps the newest copy of each layout as one json doc, since layouts are small and read whole. */
export function createStore(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS layouts (
      id TEXT PRIMARY KEY,
      rev INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      doc TEXT NOT NULL
    )
  `);
  const selectAll = db.prepare('SELECT doc FROM layouts ORDER BY updated_at DESC');
  const selectOne = db.prepare('SELECT doc FROM layouts WHERE id = ?');
  const upsert = db.prepare(`
    INSERT INTO layouts (id, rev, updated_at, doc) VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      rev = excluded.rev, updated_at = excluded.updated_at, doc = excluded.doc
  `);
  const remove = db.prepare('DELETE FROM layouts WHERE id = ?');

  function get(id: string): Layout | undefined {
    const row = selectOne.get(id) as { doc: string } | undefined;
    return row ? (JSON.parse(row.doc) as Layout) : undefined;
  }

  return {
    all(): Layout[] {
      return (selectAll.all() as { doc: string }[]).map((row) => JSON.parse(row.doc) as Layout);
    },
    get,
    /** saves a layout only if newer and returns the newest copy, so stale copies never win. */
    put(layout: Layout): Layout {
      const current = get(layout.id);
      if (current && !isNewer(layout, current)) return current;
      upsert.run(layout.id, layout.rev, layout.updatedAt, JSON.stringify(layout));
      return layout;
    },
    remove(id: string) {
      remove.run(id);
    },
  };
}
