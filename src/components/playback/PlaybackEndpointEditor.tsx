import { useEffect, useState } from 'react';
import {
  Button,
  Field,
  Input,
  Popover,
  PopoverSurface,
  PopoverTrigger,
  Text,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { Globe24Regular } from '@fluentui/react-icons';
import useAppStore from '@src/store/useAppStore';
import usePlaybackStore from '@src/store/usePlaybackStore';
import type { PlaybackEndpoint } from '@src/hooks/usePlaybackEndpoint';

const useStyles = makeStyles({
  surface: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
    maxWidth: '360px',
    padding: tokens.spacingVerticalL,
  },
  current: {
    wordBreak: 'break-all',
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: tokens.spacingHorizontalXS,
  },
});

interface PlaybackEndpointEditorProps {
  endpoint: PlaybackEndpoint;
}

/**
 * Playback server endpoint editor. The default URL is derived from the API
 * server hostname, `playbackAddress`, and `playbackEncryption`; the override
 * is persisted per API server.
 */
export default function PlaybackEndpointEditor({ endpoint }: PlaybackEndpointEditorProps) {
  const styles = useStyles();
  const serverUrl = useAppStore((s) => s.serverUrl);
  const setEndpointOverride = usePlaybackStore((s) => s.setEndpointOverride);

  const [draft, setDraft] = useState('');

  useEffect(() => {
    setDraft(endpoint.baseUrl ?? endpoint.derivedBaseUrl ?? '');
  }, [endpoint.baseUrl, endpoint.derivedBaseUrl]);

  const saveOverride = (open: boolean) => {
    const trimmed = draft.trim();
    if (!open && trimmed && trimmed !== endpoint.derivedBaseUrl) {
      setEndpointOverride(serverUrl, trimmed);
    } else if (!open) {
      setDraft(endpoint.baseUrl ?? endpoint.derivedBaseUrl ?? '');
    }
  };

  return (
    <Popover onOpenChange={(_event, data) => saveOverride(data.open)}>
      <PopoverTrigger disableButtonEnhancement>
        <Button
          icon={<Globe24Regular />}
          appearance="secondary"
          aria-label="Edit playback server endpoint"
        >
          Playback endpoint
        </Button>
      </PopoverTrigger>
      <PopoverSurface className={styles.surface}>
        <Text size={200} weight="semibold">
          Playback server endpoint
        </Text>
        <Text size={100}>
          Derived from the MediaMTX configuration: {endpoint.derivedBaseUrl ?? 'unavailable'}
          {endpoint.isOverride ? ' (override active)' : ''}
        </Text>
        <Field label="Base URL">
          <Input
            value={draft}
            placeholder="http://localhost:9996"
            onChange={(_event, data) => setDraft(data.value)}
            aria-label="Playback server base URL"
          />
        </Field>
        <Text size={100}>
          Leave equal to the derived URL to follow the configuration automatically. Saved per API
          server ({serverUrl}).
        </Text>
        <div className={styles.actions}>
          <Button
            size="small"
            onClick={() => {
              setDraft(endpoint.derivedBaseUrl ?? '');
              setEndpointOverride(serverUrl, null);
            }}
          >
            Use derived
          </Button>
        </div>
      </PopoverSurface>
    </Popover>
  );
}
