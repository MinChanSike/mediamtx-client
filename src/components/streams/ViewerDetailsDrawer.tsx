import type { ReactNode } from 'react';
import {
  Button,
  DrawerBody,
  DrawerHeader,
  DrawerHeaderTitle,
  OverlayDrawer,
  Text,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { Dismiss24Regular } from '@fluentui/react-icons';
import useCloseButtonStyles from '@src/components/common/useCloseButtonStyles';
import { useStoreBackedViewerDetail } from '@src/hooks/useMediaMTXApi';
import type { ViewerDetailTarget } from '@src/utils/streamDisplay';
import { getFetchedViewerPrimitiveDetails } from '@src/utils/streamDetails';

interface ViewerDetailsDrawerProps {
  viewerTarget: ViewerDetailTarget | null;
  isOpen: boolean;
  onClose: () => void;
}

const useStyles = makeStyles({
  body: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
    paddingBottom: tokens.spacingVerticalS,
  },
  sectionContent: {
    marginTop: tokens.spacingVerticalXXS,
  },
  muted: {
    color: tokens.colorNeutralForeground3,
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
    margin: 0,
    padding: 0,
    listStyleType: 'none',
  },
  breakAll: {
    overflowWrap: 'anywhere',
  },
});

function DetailSection({ label, children }: { label: string; children: ReactNode }) {
  const styles = useStyles();

  return (
    <div>
      <Text size={200} weight="semibold">
        {label}
      </Text>
      <div className={styles.sectionContent}>{children}</div>
    </div>
  );
}

export default function ViewerDetailsDrawer({
  viewerTarget,
  isOpen,
  onClose,
}: ViewerDetailsDrawerProps) {
  const styles = useStyles();
  const closeButtonStyles = useCloseButtonStyles();
  const viewerDetailQuery = useStoreBackedViewerDetail(viewerTarget, isOpen && !!viewerTarget);
  const fetchedViewerDetails = getFetchedViewerPrimitiveDetails(viewerDetailQuery.data);

  return (
    <OverlayDrawer
      open={isOpen && !!viewerTarget}
      position="end"
      style={{ width: 360 }}
      onOpenChange={(_, data) => {
        if (!data.open) onClose();
      }}
    >
      <DrawerHeader>
        <DrawerHeaderTitle
          action={
            <Button
              appearance="subtle"
              aria-label="Close reader details"
              className={closeButtonStyles.dangerHover}
              icon={<Dismiss24Regular />}
              onClick={onClose}
            />
          }
        >
          Reader Details
        </DrawerHeaderTitle>
      </DrawerHeader>

      <DrawerBody>
        <div className={styles.body}>
          {viewerTarget ? (
            <>
              <DetailSection label="ID">
                <Text font="monospace" className={styles.breakAll}>
                  {viewerTarget.id}
                </Text>
              </DetailSection>
              <DetailSection label="Type">
                <Text>{viewerTarget.type}</Text>
              </DetailSection>
              <DetailSection label="Details">
                {viewerDetailQuery.isLoading ? (
                  <Text className={styles.muted}>Loading reader details</Text>
                ) : viewerDetailQuery.isError ? (
                  <Text className={styles.muted}>Unable to load reader details</Text>
                ) : fetchedViewerDetails.length === 0 ? (
                  <Text className={styles.muted}>No primitive reader details</Text>
                ) : (
                  <ul className={styles.list}>
                    {fetchedViewerDetails.map(({ key, value }) => (
                      <li key={key}>
                        <Text size={200}>
                          {key}: {String(value)}
                        </Text>
                      </li>
                    ))}
                  </ul>
                )}
              </DetailSection>
            </>
          ) : null}
        </div>
      </DrawerBody>
    </OverlayDrawer>
  );
}
