import {
  runDeleteStreamMutation,
  useStoreMutation,
  type DeleteStreamMutationInput,
} from '@src/hooks/useMediaMTXApi';

export type DeleteStreamInput = DeleteStreamMutationInput;

export function useDeleteStream() {
  return useStoreMutation<DeleteStreamInput>('deleteStream', runDeleteStreamMutation);
}
