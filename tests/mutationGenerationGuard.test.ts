import { afterEach, describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { useAddStream } from '@src/hooks/useAddStream';
import { useDeleteStream } from '@src/hooks/useDeleteStream';
import { useEditStream } from '@src/hooks/useEditStream';
import { useKickStreamTarget } from '@src/hooks/useKickStreamTarget';
import useAppStore from '@src/store/useAppStore';
import useMediaMTXApiStore from '@src/store/useMediaMTXApiStore';

const originalFetch = globalThis.fetch;

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
};

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function okResponse(status = 204) {
  return new Response(null, { status });
}

function errorResponse(status = 500) {
  return new Response('error', { status, statusText: 'Internal Server Error' });
}

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function emptyListResponse() {
  return jsonResponse({ itemCount: 0, pageCount: 0, items: [] });
}

function resetStores(serverUrl = 'http://mediamtx.test') {
  useMediaMTXApiStore.getState().resetForServerUrl('');
  useAppStore.setState({ serverUrl });
  useMediaMTXApiStore.getState().resetForServerUrl(serverUrl);
}

async function flushMicrotasks() {
  for (let i = 0; i < 8; i += 1) {
    await Promise.resolve();
  }
}

const mutationQueue: Deferred<Response>[] = [];

function installQueuedMutationFetch() {
  globalThis.fetch = (async (input, init) => {
    const method = (init?.method ?? 'GET').toUpperCase();
    if (method === 'PATCH' || method === 'POST' || method === 'DELETE') {
      const deferred = mutationQueue.shift();
      if (!deferred) throw new Error('no deferred queued for mutation request');
      return deferred.promise;
    }
    const url = String(input);
    if (url.endsWith('/v3/paths/list') || url.endsWith('/v3/config/paths/list')) {
      return emptyListResponse();
    }
    return okResponse();
  }) as typeof fetch;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  mutationQueue.length = 0;
  resetStores();
});

function editState() {
  return useMediaMTXApiStore.getState().mutations.editStream;
}

function addState() {
  return useMediaMTXApiStore.getState().mutations.addStream;
}

function deleteState() {
  return useMediaMTXApiStore.getState().mutations.deleteStream;
}

function kickState() {
  return useMediaMTXApiStore.getState().mutations.kickStreamTarget;
}

type EditHandle = ReturnType<typeof useEditStream>;

function EditConsumer({ holder }: { holder: { current: EditHandle | null } }) {
  const mutation = useEditStream();
  holder.current = mutation;
  return null;
}

type AddHandle = ReturnType<typeof useAddStream>;

function AddConsumer({ holder }: { holder: { current: AddHandle | null } }) {
  const mutation = useAddStream();
  holder.current = mutation;
  return null;
}

type DeleteHandle = ReturnType<typeof useDeleteStream>;

function DeleteConsumer({ holder }: { holder: { current: DeleteHandle | null } }) {
  const mutation = useDeleteStream();
  holder.current = mutation;
  return null;
}

type KickHandle = ReturnType<typeof useKickStreamTarget>;

function KickConsumer({ holder }: { holder: { current: KickHandle | null } }) {
  const mutation = useKickStreamTarget();
  holder.current = mutation;
  return null;
}

async function renderConsumer<T>(
  Consumer: (props: { holder: { current: T | null } }) => null,
  holder: { current: T | null }
): Promise<ReactTestRenderer> {
  let renderer: ReactTestRenderer | undefined;
  await act(async () => {
    renderer = create(createElement(Consumer, { holder }));
    await flushMicrotasks();
  });
  return renderer!;
}

describe('useStoreMutation generation guard — reset cancels in-flight mutation', () => {
  test('late success after reset does not commit store state or fire onSuccess/onSettled', async () => {
    resetStores();
    installQueuedMutationFetch();
    const holder: { current: EditHandle | null } = { current: null };

    const patch = createDeferred<Response>();
    mutationQueue.push(patch);

    let onSuccessCalls = 0;
    let onSettledCalls = 0;

    const renderer = await renderConsumer(EditConsumer, holder);
    try {
      await act(async () => {
        holder.current!.mutate(
          { pathName: 'cam-a', sourceUri: 'rtsp://cam-a' },
          {
            onSuccess: () => {
              onSuccessCalls += 1;
            },
            onSettled: () => {
              onSettledCalls += 1;
            },
          }
        );
        await flushMicrotasks();
      });

      expect(editState().isPending).toBe(true);

      await act(async () => {
        holder.current!.reset();
        await flushMicrotasks();
      });

      expect(editState()).toMatchObject({
        isPending: false,
        isError: false,
        isSuccess: false,
      });

      await act(async () => {
        patch.resolve(okResponse(204));
        await flushMicrotasks();
      });

      expect(onSuccessCalls).toBe(0);
      expect(onSettledCalls).toBe(0);
      expect(editState()).toMatchObject({
        isPending: false,
        isError: false,
        isSuccess: false,
      });
    } finally {
      await act(async () => {
        renderer.unmount();
        await flushMicrotasks();
      });
    }
  });

  test('late error after reset does not commit store error or fire onError/onSettled, but rethrows', async () => {
    resetStores();
    installQueuedMutationFetch();
    const holder: { current: EditHandle | null } = { current: null };

    const patch = createDeferred<Response>();
    mutationQueue.push(patch);

    let onErrorCalls = 0;
    let onSettledCalls = 0;

    let resolveMutationPromise!: () => void;
    const mutationSettled = new Promise<void>((resolve) => {
      resolveMutationPromise = resolve;
    });
    let capturedError: Error | null = null;

    const renderer = await renderConsumer(EditConsumer, holder);
    try {
      await act(async () => {
        holder.current!
          .mutateAsync(
            { pathName: 'cam-a', sourceUri: 'rtsp://cam-a' },
            {
              onError: () => {
                onErrorCalls += 1;
              },
              onSettled: () => {
                onSettledCalls += 1;
              },
            }
          )
          .then(
            () => resolveMutationPromise(),
            (error: Error) => {
              capturedError = error;
              resolveMutationPromise();
            }
          );
        await flushMicrotasks();
      });

      expect(editState().isPending).toBe(true);

      await act(async () => {
        holder.current!.reset();
        await flushMicrotasks();
      });

      expect(editState()).toMatchObject({ isPending: false, isError: false, isSuccess: false });

      await act(async () => {
        patch.resolve(errorResponse(500));
        await mutationSettled;
        await flushMicrotasks();
      });

      expect(onErrorCalls).toBe(0);
      expect(onSettledCalls).toBe(0);
      expect(editState()).toMatchObject({ isPending: false, isError: false, isSuccess: false });
      expect(capturedError).toBeInstanceOf(Error);
      expect(capturedError?.message).toContain('500');
    } finally {
      await act(async () => {
        renderer.unmount();
        await flushMicrotasks();
      });
    }
  });

  test('non-stale success commits store state and fires onSuccess/onSettled (regression)', async () => {
    resetStores();
    installQueuedMutationFetch();
    const holder: { current: EditHandle | null } = { current: null };

    const patch = createDeferred<Response>();
    mutationQueue.push(patch);

    let onSuccessCalls = 0;
    let onSettledCalls = 0;

    const renderer = await renderConsumer(EditConsumer, holder);
    try {
      await act(async () => {
        holder.current!.mutate(
          { pathName: 'cam-a', sourceUri: 'rtsp://cam-a' },
          {
            onSuccess: () => {
              onSuccessCalls += 1;
            },
            onSettled: () => {
              onSettledCalls += 1;
            },
          }
        );
        await flushMicrotasks();
      });

      expect(editState().isPending).toBe(true);

      await act(async () => {
        patch.resolve(okResponse(204));
        await flushMicrotasks();
      });

      expect(editState()).toMatchObject({
        isPending: false,
        isError: false,
        isSuccess: true,
      });
      expect(onSuccessCalls).toBe(1);
      expect(onSettledCalls).toBe(1);
    } finally {
      await act(async () => {
        renderer.unmount();
        await flushMicrotasks();
      });
    }
  });

  test('non-stale error commits store error and fires onError/onSettled (regression)', async () => {
    resetStores();
    installQueuedMutationFetch();
    const holder: { current: EditHandle | null } = { current: null };

    const patch = createDeferred<Response>();
    mutationQueue.push(patch);

    let onErrorCalls = 0;
    let onSettledCalls = 0;

    let resolveMutationPromise!: () => void;
    const mutationSettled = new Promise<void>((resolve) => {
      resolveMutationPromise = resolve;
    });

    const renderer = await renderConsumer(EditConsumer, holder);
    try {
      await act(async () => {
        holder.current!
          .mutateAsync(
            { pathName: 'cam-a', sourceUri: 'rtsp://cam-a' },
            {
              onError: () => {
                onErrorCalls += 1;
              },
              onSettled: () => {
                onSettledCalls += 1;
              },
            }
          )
          .catch(() => undefined)
          .then(() => resolveMutationPromise());
        await flushMicrotasks();
      });

      expect(editState().isPending).toBe(true);

      await act(async () => {
        patch.resolve(errorResponse(500));
        await mutationSettled;
        await flushMicrotasks();
      });

      expect(editState()).toMatchObject({
        isPending: false,
        isError: true,
        isSuccess: false,
      });
      expect(editState().error?.message).toContain('500');
      expect(onErrorCalls).toBe(1);
      expect(onSettledCalls).toBe(1);
    } finally {
      await act(async () => {
        renderer.unmount();
        await flushMicrotasks();
      });
    }
  });

  test('a newer mutation on the same key supersedes a stale in-flight mutation', async () => {
    resetStores();
    installQueuedMutationFetch();
    const holder: { current: EditHandle | null } = { current: null };

    const patchA = createDeferred<Response>();
    const patchB = createDeferred<Response>();
    mutationQueue.push(patchA);
    mutationQueue.push(patchB);

    let onSuccessA = 0;
    let onSuccessB = 0;

    const renderer = await renderConsumer(EditConsumer, holder);
    try {
      await act(async () => {
        holder.current!.mutate(
          { pathName: 'cam-a', sourceUri: 'rtsp://cam-a' },
          {
            onSuccess: () => {
              onSuccessA += 1;
            },
          }
        );
        await flushMicrotasks();
      });
      expect(editState().isPending).toBe(true);

      await act(async () => {
        holder.current!.mutate(
          { pathName: 'cam-b', sourceUri: 'rtsp://cam-b' },
          {
            onSuccess: () => {
              onSuccessB += 1;
            },
          }
        );
        await flushMicrotasks();
      });
      expect(editState().isPending).toBe(true);

      await act(async () => {
        patchA.resolve(okResponse(204));
        await flushMicrotasks();
      });

      expect(onSuccessA).toBe(0);
      expect(editState().isPending).toBe(true);
      expect(editState().isSuccess).toBe(false);

      await act(async () => {
        patchB.resolve(okResponse(204));
        await flushMicrotasks();
      });

      expect(onSuccessB).toBe(1);
      expect(editState()).toMatchObject({
        isPending: false,
        isError: false,
        isSuccess: true,
      });
    } finally {
      await act(async () => {
        renderer.unmount();
        await flushMicrotasks();
      });
    }
  });

  test('addStream flow: late success after reset does not fire onSuccess (Add parity)', async () => {
    resetStores();
    installQueuedMutationFetch();
    const holder: { current: AddHandle | null } = { current: null };

    const post = createDeferred<Response>();
    mutationQueue.push(post);

    let onSuccessCalls = 0;

    const renderer = await renderConsumer(AddConsumer, holder);
    try {
      await act(async () => {
        holder.current!.mutate(
          { pathName: 'cam-a', protocol: 'rtsp', sourceUri: 'rtsp://cam-a' },
          {
            onSuccess: () => {
              onSuccessCalls += 1;
            },
          }
        );
        await flushMicrotasks();
      });

      expect(addState().isPending).toBe(true);

      await act(async () => {
        holder.current!.reset();
        await flushMicrotasks();
      });

      await act(async () => {
        post.resolve(okResponse(204));
        await flushMicrotasks();
      });

      expect(onSuccessCalls).toBe(0);
      expect(addState()).toMatchObject({
        isPending: false,
        isError: false,
        isSuccess: false,
      });
    } finally {
      await act(async () => {
        renderer.unmount();
        await flushMicrotasks();
      });
    }
  });

  test('delete flow without reset fires onSettled and commits success (no behavioral change)', async () => {
    resetStores();
    installQueuedMutationFetch();
    const holder: { current: DeleteHandle | null } = { current: null };

    const del = createDeferred<Response>();
    mutationQueue.push(del);

    let onSettledCalls = 0;

    const renderer = await renderConsumer(DeleteConsumer, holder);
    try {
      await act(async () => {
        holder.current!.mutate('cam-a', {
          onSettled: () => {
            onSettledCalls += 1;
          },
        });
        await flushMicrotasks();
      });

      expect(deleteState().isPending).toBe(true);

      await act(async () => {
        del.resolve(okResponse(204));
        await flushMicrotasks();
      });

      expect(onSettledCalls).toBe(1);
      expect(deleteState()).toMatchObject({
        isPending: false,
        isError: false,
        isSuccess: true,
      });
    } finally {
      await act(async () => {
        renderer.unmount();
        await flushMicrotasks();
      });
    }
  });

  test('kick flow without reset commits success (no reset-based guard, no behavioral change)', async () => {
    resetStores();
    installQueuedMutationFetch();
    const holder: { current: KickHandle | null } = { current: null };

    const kick = createDeferred<Response>();
    mutationQueue.push(kick);

    const renderer = await renderConsumer(KickConsumer, holder);
    try {
      await act(async () => {
        holder.current!.mutate({ endpoint: 'rtmpconns', id: 'viewer-1' });
        await flushMicrotasks();
      });

      expect(kickState().isPending).toBe(true);

      await act(async () => {
        kick.resolve(okResponse(204));
        await flushMicrotasks();
      });

      expect(kickState()).toMatchObject({
        isPending: false,
        isError: false,
        isSuccess: true,
      });
    } finally {
      await act(async () => {
        renderer.unmount();
        await flushMicrotasks();
      });
    }
  });
});
