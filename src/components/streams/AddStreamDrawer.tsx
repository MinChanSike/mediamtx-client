import { useState, type FormEvent } from 'react';
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
  Text,
} from '@fluentui/react-components';
import { Add24Regular, Dismiss24Regular } from '@fluentui/react-icons';
import useCloseButtonStyles from '@src/components/common/useCloseButtonStyles';
import {
  ADD_STREAM_PLACEHOLDERS,
  ADD_STREAM_PROTOCOLS,
  addStreamSchema,
  detectAddStreamProtocol,
  useAddStream,
  type AddStreamProtocol,
} from '@src/hooks/useAddStream';

interface AddStreamDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface FormState {
  pathName: string;
  sourceUri: string;
  protocol: AddStreamProtocol;
}

const DEFAULT_FORM: FormState = { pathName: '', sourceUri: '', protocol: 'rtsp' };

export default function AddStreamDrawer({ isOpen, onClose }: AddStreamDrawerProps) {
  const closeButtonStyles = useCloseButtonStyles();
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const mutation = useAddStream();

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

    mutation.mutate(result.data, {
      onSuccess: () => {
        setForm(DEFAULT_FORM);
        setFieldErrors({});
        onClose();
      },
    });
  }

  function handleClose() {
    setForm(DEFAULT_FORM);
    setFieldErrors({});
    mutation.reset();
    onClose();
  }

  return (
    <OverlayDrawer
      open={isOpen}
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
              aria-label="Close add stream"
              className={closeButtonStyles.dangerHover}
              icon={<Dismiss24Regular />}
              onClick={handleClose}
            />
          }
        >
          Add Stream
        </DrawerHeaderTitle>
      </DrawerHeader>

      <form className="flex min-h-0 flex-1 flex-col w-full" onSubmit={handleSubmit}>
        <DrawerBody>
          <div className="max-w-full space-y-5">
            <Field label="Input Protocol" hint="Auto-detected from Source URI">
              <Select
                id="add-protocol"
                className="w-full"
                value={form.protocol}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    protocol: event.target.value as AddStreamProtocol,
                  }))
                }
              >
                {ADD_STREAM_PROTOCOLS.map((protocol) => (
                  <option key={protocol.value} value={protocol.value}>
                    {protocol.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Stream Name"
              required
              validationState={fieldErrors.pathName ? 'error' : 'none'}
              validationMessage={
                fieldErrors.pathName ?? (
                  <Text size={200}>
                    Letters, numbers, <code>_</code> <code>-</code> <code>/</code> only
                  </Text>
                )
              }
            >
              <Input
                id="add-path-name"
                className="w-full"
                placeholder="e.g. cam1 or camera/main"
                value={form.pathName}
                onChange={(event) =>
                  setForm((current) => ({ ...current, pathName: event.target.value }))
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
                id="add-source-uri"
                className="w-full"
                placeholder={ADD_STREAM_PLACEHOLDERS[form.protocol]}
                value={form.sourceUri}
                onChange={(event) => handleSourceChange(event.target.value)}
              />
            </Field>

            {mutation.isError && (
              <MessageBar intent="error">
                <MessageBarBody>
                  {mutation.error?.message ??
                    'Failed to create stream. Check stream name and source URI.'}
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
                icon={<Add24Regular />}
                disabled={mutation.isPending}
              >
                {mutation.isPending ? 'Adding...' : 'Add'}
              </Button>
            </div>
          </div>
        </DrawerBody>
      </form>
    </OverlayDrawer>
  );
}
