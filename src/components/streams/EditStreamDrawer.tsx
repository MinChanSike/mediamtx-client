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
import { Save24Regular } from '@fluentui/react-icons';
import CloseButton from '@src/components/common/CloseButton';
import {
  ADD_STREAM_PLACEHOLDERS,
  ADD_STREAM_PROTOCOLS,
  addStreamSchema,
  detectAddStreamProtocol,
  isValidAddStreamSourceUri,
  type AddStreamProtocol,
} from '@src/hooks/useAddStream';
import { useEditStream } from '@src/hooks/useEditStream';
import type { PathItem } from '@src/types/stream';
import { getSourceKickTarget } from '@src/utils/streamDisplay';

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

type FormState = {
  pathName: string;
  sourceUri: string;
  protocol: AddStreamProtocol;
};

export default function EditStreamDrawer({ stream, isOpen, onClose }: EditStreamDrawerProps) {
  const [form, setForm] = useState<FormState>({
    pathName: '',
    sourceUri: '',
    protocol: 'rtsp',
  });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const mutation = useEditStream();

  useEffect(() => {
    if (stream && isOpen) {
      setForm({
        pathName: stream.name,
        sourceUri: stream.source || '',
        protocol: getEditStreamInitialProtocol(stream.source),
      });
      setFieldErrors({});
    }
  }, [stream, isOpen]);

  function handleSourceChange(value: string) {
    const detected = detectAddStreamProtocol(value);
    setForm((current) => ({
      ...current,
      sourceUri: value,
      protocol: detected ?? current.protocol,
    }));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!stream) return;
    setFieldErrors({});

    const result = addStreamSchema.safeParse({
      pathName: form.pathName,
      protocol: form.protocol,
      sourceUri: form.sourceUri,
    });

    if (!result.success) {
      const errors: Partial<Record<keyof FormState, string>> = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof FormState;
        if (!errors[field]) errors[field] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }

    mutation.mutate(
      {
        oldPathName: stream.name,
        pathName: result.data.pathName,
        sourceUri: result.data.sourceUri,
        isConfigured: stream.isConfigured,
        sourceKickTarget: getSourceKickTarget(stream),
      },
      {
        onSuccess: () => {
          setForm({ pathName: '', sourceUri: '', protocol: 'rtsp' });
          setFieldErrors({});
          onClose();
        },
      }
    );
  }

  function handleClose() {
    setForm({ pathName: '', sourceUri: '', protocol: 'rtsp' });
    setFieldErrors({});
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
            <CloseButton
              aria-label="Close edit stream"
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
                  value={form.protocol}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      protocol: event.target.value as AddStreamProtocol,
                    }))
                  }
                >
                  {ADD_STREAM_PROTOCOLS.map((protocolOption) => (
                    <option key={protocolOption.value} value={protocolOption.value}>
                      {protocolOption.label}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field
                label="Stream Name"
                required
                validationState={fieldErrors.pathName ? 'error' : 'none'}
                validationMessage={fieldErrors.pathName}
              >
                <Input
                  id="edit-path-name"
                  className="w-full"
                  value={form.pathName}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      pathName: event.target.value,
                    }))
                  }
                />
              </Field>

              <Field
                label="Source URI"
                required
                validationState={fieldErrors.sourceUri ? 'error' : 'none'}
                validationMessage={fieldErrors.sourceUri}
              >
                <Input
                  id="edit-source-uri"
                  className="w-full"
                  placeholder={ADD_STREAM_PLACEHOLDERS[form.protocol]}
                  value={form.sourceUri}
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
