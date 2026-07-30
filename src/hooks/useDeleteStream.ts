import { runDeleteStreamMutation, useStoreMutation } from '@src/hooks/useMediaMTXApi';

export function useDeleteStream() {
  return useStoreMutation('deleteStream', runDeleteStreamMutation);
}
