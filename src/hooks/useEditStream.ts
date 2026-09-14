import {
  runEditStreamMutation,
  useStoreMutation,
  type EditStreamMutationInput,
} from '@src/hooks/useMediaMTXApi';

export type EditStreamInput = EditStreamMutationInput;

export function useEditStream() {
  return useStoreMutation<EditStreamInput>('editStream', runEditStreamMutation);
}
