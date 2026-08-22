'use client';

import { useQueryClient } from '@tanstack/react-query';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { useEffect, useRef } from 'react';
import { getSupabaseBrowserClient } from './browser';
import type { Pin, Vouch } from './types';

/**
 * One live pin event. Consumers that keep their own list (MapView) need all
 * three kinds: only forwarding INSERT left other members' edits, archives and
 * deletes invisible until a reload.
 */
export type PinChange =
  | { type: 'insert'; pin: Pin }
  | { type: 'update'; pin: Pin }
  | { type: 'delete'; id: string };

/**
 * Subscribe to live pin INSERT / UPDATE / DELETE events on the map.
 * Mutates the ['pins'] React Query cache directly — no invalidateQueries —
 * and forwards every event to `onChange`.
 */
export function useRealtimePins(onChange?: (change: PinChange) => void) {
  const queryClient = useQueryClient();
  // Callers pass an inline arrow, so a fresh identity every render. Keeping it
  // in a ref stops the effect from tearing down and re-subscribing the channel
  // on every single render.
  const handlerRef = useRef(onChange);
  useEffect(() => {
    handlerRef.current = onChange;
  });

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel('pins-feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pins' }, (payload: RealtimePostgresChangesPayload<Pin>) => {
        const pin = payload.new as Pin;
        if (pin.archived_at) return;
        queryClient.setQueryData<Pin[]>(['pins'], (old) =>
          old ? [...old.filter((p) => p.id !== pin.id), pin] : [pin],
        );
        handlerRef.current?.({ type: 'insert', pin });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pins' }, (payload: RealtimePostgresChangesPayload<Pin>) => {
        const updated = payload.new as Pin;
        queryClient.setQueryData<Pin[]>(['pins'], (old) =>
          old
            ? updated.archived_at
              ? old.filter((p) => p.id !== updated.id)
              : old.map((p) => (p.id === updated.id ? updated : p))
            : old,
        );
        handlerRef.current?.({ type: 'update', pin: updated });
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'pins' }, (payload: RealtimePostgresChangesPayload<Pin>) => {
        const id = (payload.old as { id: string }).id;
        queryClient.setQueryData<Pin[]>(['pins'], (old) => old?.filter((p) => p.id !== id) ?? []);
        handlerRef.current?.({ type: 'delete', id });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);
}

/**
 * Live vouch subscription scoped to a single pin's detail view.
 */
export function useRealtimeVouches(pinId: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!pinId) return;
    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel(`vouches-${pinId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'vouches', filter: `pin_id=eq.${pinId}` },
        (payload: RealtimePostgresChangesPayload<Vouch>) => {
          const key = ['vouches', pinId];
          queryClient.setQueryData<Vouch[]>(key, (old) => {
            const list = old ?? [];
            if (payload.eventType === 'INSERT') {
              return [...list.filter((v) => v.id !== (payload.new as Vouch).id), payload.new as Vouch];
            }
            if (payload.eventType === 'UPDATE') {
              const next = payload.new as Vouch;
              return list.map((v) => (v.id === next.id ? next : v));
            }
            if (payload.eventType === 'DELETE') {
              const oldRow = payload.old as { id: string };
              return list.filter((v) => v.id !== oldRow.id);
            }
            return list;
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [pinId, queryClient]);
}
