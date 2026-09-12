import { apiFetch } from '@src/api/client';
import {
  recordingListSchema,
  recordingSchema,
  type Recording,
  type RecordingList,
} from '@src/schemas/recordingSchema';

const RECORDINGS_ITEMS_PER_PAGE = 100;

function recordingsPageUrl(page: number): string {
  return `/v3/recordings/list?page=${page}&itemsPerPage=${RECORDINGS_ITEMS_PER_PAGE}`;
}

/**
 * Fetches every recordings-list page sequentially until `pageCount` is
 * exhausted, validating each page against the Control API schema.
 */
export async function getRecordingsList(serverUrl?: string): Promise<RecordingList> {
  const first = recordingListSchema.parse(
    await apiFetch<unknown>(recordingsPageUrl(0), undefined, serverUrl)
  );

  const items = [...first.items];
  for (let page = 1; page < first.pageCount; page++) {
    const next = recordingListSchema.parse(
      await apiFetch<unknown>(recordingsPageUrl(page), undefined, serverUrl)
    );
    if (next.pageCount !== first.pageCount) {
      throw new Error('Recording list changed during pagination; waiting for the next refresh.');
    }
    items.push(...next.items);
  }

  return { itemCount: first.itemCount, pageCount: first.pageCount, items };
}

/** Fetches the recording record for one recorded path. */
export async function getRecording(name: string, serverUrl?: string): Promise<Recording> {
  return recordingSchema.parse(
    await apiFetch<unknown>(
      `/v3/recordings/get/${encodeURIComponent(name)}`,
      undefined,
      serverUrl
    )
  );
}
