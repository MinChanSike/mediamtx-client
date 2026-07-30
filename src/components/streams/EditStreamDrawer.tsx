import { useEffect, useState, type FormEvent } from 'react';
import {
  Button,
  DrawerBody,
  DrawerHeader,
  DrawerHeaderTitle,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
  OverlayDrawer,
  Select,
} from '@fluentui/react-components';
import { Dismiss24Regular, Save24Regular } from '@fluentui/react-icons';
import useCloseButtonStyles from '@src/components/common/useCloseButtonStyles';
import {
  ADD_STREAM_PLACEHOLDERS,
  ADD_STREAM_PROTOCOLS,
  detectAddStreamProtocol,
  isValidAddStreamSourceUri,
  type AddStreamProtocol,
} from '@src/hooks/useAddStream';
import { useEditStream } from '@src/hooks/useEditStream';
import type { PathItem } from '@src/types/stream';

interface EditStreamDrawerProps {
  stream: PathItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export function getEditStreamInitialProtocol(source: string | null): AddStreamProtocol {
  return detectAddStreamProtocol(source ?? '') ?? 'rtsp';
}

export function validateEditStreamSource(protocol: AddStreamProtocol, sourceUri: string) {
  if (!sourceUri.trim()) return 'Source URI is required';
  if (isValidAddStreamSourceUri(protocol, sourceUri.trim())) return null;

  return `Source URI must match ${protocol.toUpperCase()} format, for example ${ADD_STREAM_PLACEHOLDERS[protocol]}`;
}

export default function EditStreamDrawer({ stream, isOpen, onClose }: EditStreamDrawerProps) {
  const closeButtonStyles = useCloseButtonStyles();
  const [sourceUri, setSourceUri] = useState('');
  const [protocol, setProtocol] = useState<AddStreamProtocol>('rtsp');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const mutation = useEditStream();

  useEffect(() => {
    if (stream && isOpen) {
      setSourceUri(stream.source || '');
      setProtocol(getEditStreamInitialProtocol(stream.source));
    }
  }, [stream, isOpen]);

  function handleSourceChange(value: string) {
    setSourceUri(value);
    const detected = detectAddStreamProtocol(value);
    setProtocol((current) => detected ?? current);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!stream) return;
    setFieldError(null);

    const validationError = validateEditStreamSource(protocol, sourceUri);
    if (validationError) {
      setFieldError(validationError);
      return;
    }

    mutation.mutate(
      { pathName: stream.name, sourceUri: sourceUri.trim() },
      {
        onSuccess: () => {
          setSourceUri('');
          setFieldError(null);
          onClose();
        },
      }
    );
  }

  function handleClose() {
    setSourceUri('');
    setFieldError(null);
    mutation.reset();
    onClose();
  }

  return (
    <OverlayDrawer
      open={isOpen && !!stream}
      position="end"
      style={{ width: 420 }}
      onOpenChange={(_, data) => {
        if (!data.open) handleClose();
      }}
    >
      <DrawerHeader>
        <DrawerHeaderTitle
          action={
            <Button
              appearance="subtle"
              aria-label="Close edit stream"
              className={closeButtonStyles.dangerHover}
              icon={<Dismiss24Regular />}
              onClick={handleClose}
            />
          }
        >
          Edit Stream
        </DrawerHeaderTitle>
      </DrawerHeader>

      {stream && (
        <form className="flex min-h-0 flex-1 flex-col w-full" onSubmit={handleSubmit}>
          <DrawerBody>
            <div className="space-y-5">
              <Field label="Input Protocol" hint="Auto-detected from Source URI">
                <Select
                  id="edit-protocol"
                  className="w-full"
                  value={protocol}
                  onChange={(event) => setProtocol(event.target.value as AddStreamProtocol)}
                >
                  {ADD_STREAM_PROTOCOLS.map((protocolOption) => (
                    <option key={protocolOption.value} value={protocolOption.value}>
                      {protocolOption.label}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Stream Name (read-only)">
                <Input id="edit-path-name" className="w-full" readOnly value={stream.name} />
              </Field>

              <Field
                label="Source URI"
                required
                validationState={fieldError ? 'error' : 'none'}
                validationMessage={fieldError}
              >
                <Input
                  id="edit-source-uri"
                  className="w-full"
                  placeholder={ADD_STREAM_PLACEHOLDERS[protocol]}
                  value={sourceUri}
                  onChange={(event) => handleSourceChange(event.target.value)}
                  autoFocus
                />
              </Field>

              {mutation.isError && (
                <MessageBar intent="error">
                  <MessageBarBody>
                    {mutation.error?.message ?? 'Failed to update stream.'}
                  </MessageBarBody>
                </MessageBar>
              )}

              <div className="flex justify-end gap-3">
                <Button type="button" onClick={handleClose}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  appearance="primary"
                  icon={<Save24Regular />}
                  disabled={mutation.isPending}
                >
                  {mutation.isPending ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>
          </DrawerBody>
        </form>
      )}
    </OverlayDrawer>
  );
}
