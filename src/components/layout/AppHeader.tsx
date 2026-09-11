import React, { useEffect, useState } from 'react';
import { Button, Field, Input, Text } from '@fluentui/react-components';
import { Checkmark24Regular, Dismiss24Regular, Edit24Regular } from '@fluentui/react-icons';
import useCloseButtonStyles from '@src/components/common/useCloseButtonStyles';
import { useMediaMTXConfig } from '@src/hooks/useMediaMTXConfig';
import useAppStore from '@src/store/useAppStore';
import StatusBadge from '@src/components/common/StatusBadge';
import ThemeToggle from '@src/components/common/ThemeToggle';
import { getApiAvailabilityStatus } from '@src/utils/apiAvailabilityStatus';
import { isAbsoluteHttpUrl } from '@src/utils/serverUrl';

export default function AppHeader() {
  const closeButtonStyles = useCloseButtonStyles();
  const serverUrl = useAppStore((s) => s.serverUrl);
  const setServerUrl = useAppStore((s) => s.setServerUrl);

  const [isEditing, setIsEditing] = useState(false);
  const [urlInput, setUrlInput] = useState(serverUrl);
  const [urlError, setUrlError] = useState<string | null>(null);

  useEffect(() => {
    setUrlInput(serverUrl);
  }, [serverUrl]);

  const { isError, isPending } = useMediaMTXConfig();

  const status = getApiAvailabilityStatus({ isError, isPending });

  const handleSave = () => {
    const trimmed = urlInput.trim();
    if (!trimmed) {
      setUrlError('Enter a MediaMTX API endpoint URL.');
      return;
    }
    if (!isAbsoluteHttpUrl(trimmed)) {
      setUrlError('Enter a full http:// or https:// URL, for example http://localhost:9997.');
      return;
    }
    setServerUrl(trimmed);
    setUrlError(null);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setUrlInput(serverUrl);
    setUrlError(null);
    setIsEditing(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') handleSave();
    else if (event.key === 'Escape') handleCancel();
  };

  return (
    <header className="flex items-center justify-between border-b px-4 py-2">
      <div className="flex items-center gap-3">
        <StatusBadge status={status} />

        {isEditing ? (
          <div className="flex items-center gap-2">
            <Field
              validationState={urlError ? 'error' : 'none'}
              validationMessage={urlError ?? undefined}
            >
              <Input
                id="server-url-input"
                type="text"
                value={urlInput}
                onChange={(event) => {
                  setUrlInput(event.target.value);
                  setUrlError(null);
                }}
                onKeyDown={handleKeyDown}
                className="w-56"
                placeholder="e.g. http://localhost:9997"
                autoFocus
              />
            </Field>
            <Button
              id="server-url-save"
              appearance="primary"
              icon={<Checkmark24Regular />}
              aria-label="Save MediaMTX API endpoint"
              onClick={handleSave}
            />
            <Button
              id="server-url-cancel"
              className={closeButtonStyles.dangerHover}
              icon={<Dismiss24Regular />}
              aria-label="Cancel MediaMTX API endpoint edit"
              onClick={handleCancel}
            />
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Text font="monospace">{serverUrl}</Text>
            <Button
              id="server-url-edit-btn"
              appearance="subtle"
              icon={<Edit24Regular />}
              onClick={() => setIsEditing(true)}
              title="Edit MediaMTX API endpoint"
              aria-label="Edit MediaMTX API endpoint"
            />
          </div>
        )}
      </div>
      <ThemeToggle />
    </header>
  );
}
