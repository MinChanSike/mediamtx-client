import { runEditStreamMutation, useStoreMutation } from '@src/hooks/useMediaMTXApi';

interface EditStreamInput {
  pathName: string;
  sourceUri: string;
}

export function useEditStream() {
  return useStoreMutation<EditStreamInput>('editStream', runEditStreamMutation);
}
