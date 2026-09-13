import {
  runToggleStreamRecordingMutation,
  useStoreMutation,
} from '@src/hooks/useMediaMTXApi';

export interface ToggleStreamRecordingInput {
  pathName: string;
  record: boolean;
  isConfigured?: boolean;
  sourceUri?: string | null;
}

export function useToggleStreamRecording() {
  return useStoreMutation<ToggleStreamRecordingInput>(
    'toggleStreamRecording',
    runToggleStreamRecordingMutation
  );
}
