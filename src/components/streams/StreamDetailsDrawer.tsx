import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import {
  Badge,
  Button,
  DrawerBody,
  DrawerHeader,
  DrawerHeaderTitle,
  OverlayDrawer,
  Tab,
  TabList,
  Text,
  makeStyles,
  tokens,
  type SelectTabData,
  type SelectTabEvent,
} from '@fluentui/react-components';
import { Dismiss24Regular } from '@fluentui/react-icons';
import useCloseButtonStyles from '@src/components/common/useCloseButtonStyles';
import { useStoreBackedPathDetail } from '@src/hooks/useMediaMTXApi';
import type { PathItem } from '@src/types/stream';
import { formatBytes } from '@src/utils/formatters';
import StatusBadge from '@src/components/common/StatusBadge';
import { isStreamOnline } from '@src/utils/streamStatus';
import { getDisplayProtocol } from '@src/utils/streamDisplay';
import type { ViewerDetailTarget } from '@src/utils/streamDisplay';
import StreamReaderList from '@src/components/streams/StreamReaderList';
import ViewerDetailsDrawer from '@src/components/streams/ViewerDetailsDrawer';
import PlaybackUrls from '@src/components/streams/PlaybackUrls';
import {
  getAdditionalStreamDetails,
  getPrimitiveDetails,
  getSourceIdentityDetails,
  getSourcePrimitiveDetails,
  type ViewerTableRow,
} from '@src/utils/streamDetails';

interface StreamDetailsDrawerProps {
  stream: PathItem | null;
  isOpen: boolean;
  onClose: () => void;
}

const useStyles = makeStyles({
  body: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: tokens.spacingVerticalM,
  },
  tabs: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },
  tabLabel: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
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
  detailRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXXS,
    padding: tokens.spacingVerticalS,
    borderRadius: tokens.borderRadiusSmall,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
  },
  breakAll: {
    overflowWrap: 'anywhere',
  },
});

type StreamDetailsTab = 'source' | 'viewers' | 'playbackUrls';

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

export default function StreamDetailsDrawer({ stream, isOpen, onClose }: StreamDetailsDrawerProps) {
  const styles = useStyles();
  const closeButtonStyles = useCloseButtonStyles();
  const [selectedTab, setSelectedTab] = useState<StreamDetailsTab>('source');
  const [selectedViewerTarget, setSelectedViewerTarget] = useState<ViewerDetailTarget | null>(null);
  const pathDetailQuery = useStoreBackedPathDetail(stream?.name, isOpen && !!stream?.name);

  useEffect(() => {
    setSelectedViewerTarget(null);
  }, [stream?.name, isOpen]);

  const isOnline = stream ? isStreamOnline(stream) : false;
  const protocol = getDisplayProtocol(stream);
  const additionalStreamDetails = stream
    ? getAdditionalStreamDetails(stream, pathDetailQuery.data)
    : [];
  const sourceIdentityDetails = stream
    ? getSourceIdentityDetails(stream, pathDetailQuery.data)
    : [];
  const sourceInfoDetails = stream ? getSourcePrimitiveDetails(stream) : [];
  const viewerCount = stream?.readers.length ?? 0;

  function handleTabSelect(_event: SelectTabEvent, data: SelectTabData) {
    setSelectedTab(data.value as StreamDetailsTab);
  }

  function handleSelectViewer(row: ViewerTableRow) {
    if (!row.detailTarget) return;
    setSelectedTab('viewers');
    setSelectedViewerTarget(row.detailTarget);
  }

  return (
    <>
      <OverlayDrawer
        open={isOpen && !!stream}
        position="end"
        style={{ width: 420 }}
        onOpenChange={(_, data) => {
          if (!data.open) onClose();
        }}
      >
        <DrawerHeader>
          <DrawerHeaderTitle
            action={
              <Button
                appearance="subtle"
                aria-label="Close details"
                className={closeButtonStyles.dangerHover}
                icon={<Dismiss24Regular />}
                onClick={onClose}
              />
            }
          >
            Stream Details
          </DrawerHeaderTitle>
        </DrawerHeader>

        {stream && (
          <DrawerBody>
            <div className={styles.body}>
              <div className={styles.grid}>
                <DetailSection label="Name">
                  <Text font="monospace">{stream.name}</Text>
                </DetailSection>

                <DetailSection label="Status">
                  <StatusBadge status={isOnline ? 'online' : 'offline'} />
                </DetailSection>

                <DetailSection label="Protocol">
                  <Text>{protocol.toUpperCase()}</Text>
                </DetailSection>

                <DetailSection label="Track Count">
                  <Text>{stream.tracks.length}</Text>
                </DetailSection>

                <DetailSection label="Bytes In">
                  <Text>{formatBytes(stream.bytesReceived)}</Text>
                </DetailSection>

                <DetailSection label="Bytes Out">
                  <Text>{formatBytes(stream.bytesSent)}</Text>
                </DetailSection>
              </div>

              <div className={styles.tabs}>
                <TabList selectedValue={selectedTab} onTabSelect={handleTabSelect} size="small">
                  <Tab id="stream-source-details-tab" value="source" className="!pl-0 !-ml-1">
                    Source Details
                  </Tab>
                  <Tab id="stream-playback-urls-tab" value="playbackUrls">
                    Playback URLs
                  </Tab>
                  <Tab id="stream-viewers-tab" value="viewers">
                    <span className={styles.tabLabel}>
                      Readers
                      {viewerCount > 0 && <Badge appearance="outline">{viewerCount}</Badge>}
                    </span>
                  </Tab>
                </TabList>

                {selectedTab === 'source' && (
                  <>
                    <DetailSection label="">
                      <ul className={styles.list}>
                        {sourceIdentityDetails.map(({ key, value }) => (
                          <li key={key}>
                            <Text size={200}>
                              {key}: {String(value)}
                            </Text>
                          </li>
                        ))}
                      </ul>
                    </DetailSection>

                    <DetailSection label="Source URL">
                      {stream.source ? (
                        <Text font="monospace" className={styles.breakAll}>
                          {stream.source}
                        </Text>
                      ) : (
                        <Text className={styles.muted}>-</Text>
                      )}
                    </DetailSection>

                    <DetailSection label="Source Details">
                      {sourceInfoDetails.length === 0 ? (
                        <Text className={styles.muted}>No source details</Text>
                      ) : (
                        <ul className={styles.list}>
                          {sourceInfoDetails.map(({ key, value }) => (
                            <li key={key}>
                              <Text size={200}>
                                {key}: {String(value)}
                              </Text>
                            </li>
                          ))}
                        </ul>
                      )}
                    </DetailSection>

                    <DetailSection label="Tracks">
                      {stream.tracks.length === 0 ? (
                        <Text className={styles.muted}>No tracks</Text>
                      ) : (
                        <ul className={styles.list}>
                          {stream.tracks.map((track) => (
                            <li key={track.id} className={styles.detailRow}>
                              <Text>
                                #{track.id} - {track.type}
                              </Text>
                              {getPrimitiveDetails(track, ['id', 'type']).map(({ key, value }) => (
                                <Text key={key} size={200} className={styles.muted}>
                                  {key}: {String(value)}
                                </Text>
                              ))}
                            </li>
                          ))}
                        </ul>
                      )}
                    </DetailSection>

                    <DetailSection label="">
                      {additionalStreamDetails.length === 0 ? (
                        <Text className={styles.muted}>No additional details</Text>
                      ) : (
                        <ul className={styles.list}>
                          {additionalStreamDetails.map(({ key, value }) => (
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
                )}

                {selectedTab === 'viewers' && (
                  <DetailSection label="">
                    <StreamReaderList
                      readers={stream.readers}
                      onSelectViewer={handleSelectViewer}
                    />
                  </DetailSection>
                )}

                {selectedTab === 'playbackUrls' && <PlaybackUrls streamName={stream.name} />}
              </div>
            </div>
          </DrawerBody>
        )}
      </OverlayDrawer>

      <ViewerDetailsDrawer
        viewerTarget={selectedViewerTarget}
        isOpen={isOpen && !!stream && !!selectedViewerTarget}
        onClose={() => setSelectedViewerTarget(null)}
      />
    </>
  );
}
