/**
 * tldraw ↔ Yjs Shape Senkronizasyonu
 *
 * tldraw store değişikliklerini Yjs Y.Map'e yazar (local → remote).
 * Yjs Y.Map değişikliklerini tldraw store'a uygular (remote → local).
 * Sonsuz döngü engeli: isRemoteChange flag ile.
 *
 * Kullanım: TldrawCanvas içinde, editor ve ydoc hazır olduktan sonra çağır.
 */

import { useEffect, useRef, useCallback } from 'react';
import { Editor, TLRecord, TLStoreEventInfo } from 'tldraw';
import * as Y from 'yjs';

interface UseTldrawYjsSyncOptions {
  editor: Editor | null;
  ydoc: Y.Doc | null;
  enabled?: boolean;
}

export function useTldrawYjsSync({ editor, ydoc, enabled = true }: UseTldrawYjsSyncOptions) {
  const isRemoteChangeRef = useRef(false);
  const isLocalChangeRef = useRef(false);

  useEffect(() => {
    if (!editor || !ydoc || !enabled) return;

    const shapesMap = ydoc.getMap<Record<string, unknown>>('tldraw-shapes');

    // ── 1. Local → Remote ──────────────────────────
    // tldraw store değiştiğinde Yjs'e yaz
    const handleStoreChange = (event: TLStoreEventInfo) => {
      // Remote'dan gelen değişiklikleri tekrar yazmayı engelle
      if (isRemoteChangeRef.current) return;

      isLocalChangeRef.current = true;

      ydoc.transact(() => {
        for (const [id, change] of Object.entries(event.changes.added)) {
          const record = change as TLRecord;
          if (record.typeName === 'shape') {
            shapesMap.set(id, JSON.parse(JSON.stringify(record)));
          }
        }

        for (const [id, [, after]] of Object.entries(event.changes.updated)) {
          const record = after as TLRecord;
          if (record.typeName === 'shape') {
            shapesMap.set(id, JSON.parse(JSON.stringify(record)));
          }
        }

        for (const [id, change] of Object.entries(event.changes.removed)) {
          const record = change as TLRecord;
          if (record.typeName === 'shape') {
            shapesMap.delete(id);
          }
        }
      });

      isLocalChangeRef.current = false;
    };

    const cleanup = editor.store.listen(handleStoreChange, {
      source: 'user',
      scope: 'document',
    });

    // ── 2. Remote → Local ──────────────────────────
    // Yjs'den gelen değişiklikleri tldraw'a uygula
    const handleYjsChange = (event: Y.YMapEvent<Record<string, unknown>>) => {
      // Kendi yazdıklarımızı tekrar uygulamayı engelle
      if (isLocalChangeRef.current) return;
      // Transaction origin === null ise remote değişiklik
      if (event.transaction.local) return;

      isRemoteChangeRef.current = true;

      const toAdd: TLRecord[] = [];
      const toUpdate: TLRecord[] = [];
      const toRemove: TLRecord['id'][] = [];

      event.changes.keys.forEach((change, key) => {
        if (change.action === 'add' || change.action === 'update') {
          const record = shapesMap.get(key);
          if (record) {
            const existing = editor.store.get(key as TLRecord['id']);
            if (existing) {
              toUpdate.push(record as unknown as TLRecord);
            } else {
              toAdd.push(record as unknown as TLRecord);
            }
          }
        } else if (change.action === 'delete') {
          const existing = editor.store.get(key as TLRecord['id']);
          if (existing) {
            toRemove.push(key as TLRecord['id']);
          }
        }
      });

      editor.store.mergeRemoteChanges(() => {
        if (toAdd.length > 0) {
          editor.store.put(toAdd);
        }
        if (toUpdate.length > 0) {
          editor.store.put(toUpdate);
        }
        if (toRemove.length > 0) {
          editor.store.remove(toRemove);
        }
      });

      isRemoteChangeRef.current = false;
    };

    shapesMap.observe(handleYjsChange);

    // ── 3. İlk Sync ──────────────────────────────
    // Bağlanınca remote'daki mevcut shape'leri yükle
    if (shapesMap.size > 0) {
      isRemoteChangeRef.current = true;
      const remoteShapes: TLRecord[] = [];

      shapesMap.forEach((value, key) => {
        if (!editor.store.get(key as TLRecord['id'])) {
          remoteShapes.push(value as unknown as TLRecord);
        }
      });

      if (remoteShapes.length > 0) {
        editor.store.mergeRemoteChanges(() => {
          editor.store.put(remoteShapes);
        });
      }
      isRemoteChangeRef.current = false;
    }

    return () => {
      cleanup();
      shapesMap.unobserve(handleYjsChange);
    };
  }, [editor, ydoc, enabled]);
}
