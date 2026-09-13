import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const obsoleteAudienceTerm = (text: string) => text.replace('Audience', ['View', 'er'].join(''));

function source(path: string) {
  return readFileSync(join(root, path), 'utf8');
}

describe('Stream table actions source contract', () => {
  test('removes the card stream layout and tab', () => {
    const page = source('src/pages/StreamsPage.tsx');
    const filterBar = source('src/components/streams/StreamFilterBar.tsx');
    const store = source('src/store/usePlayerStore.ts');

    expect(existsSync(join(root, 'src/components/streams/StreamCard.tsx'))).toBe(false);
    expect(page).not.toContain('StreamCard');
    expect(page).not.toContain("layout === 'cards'");
    expect(filterBar).not.toContain('layout-cards');
    expect(filterBar).not.toContain('value="cards"');
    expect(filterBar).not.toContain('Cards');
    expect(store).not.toContain("'cards'");
  });

  test('renders Kick Source as a table action with dialog-gated mutation', () => {
    const table = source('src/components/streams/StreamTable.tsx');
    const page = source('src/pages/StreamsPage.tsx');
    const triggerStart = table.indexOf('aria-label={`Kick source for ${stream.name}`}');
    const triggerEnd = table.indexOf('/>', triggerStart);
    const confirmStart = page.indexOf('function handleConfirmKickSource()');
    const dialogStart = page.indexOf('open={!!latestKickSourceStream}', confirmStart);
    const dialogEnd = page.indexOf('</Dialog>', dialogStart);

    expect(table).toContain('getSourceKickTarget(stream)');
    expect(table).toContain('onKickSource: (stream: PathItem) => void;');
    expect(table).toContain('aria-label={`Kick source for ${stream.name}`}');
    expect(triggerStart).toBeGreaterThan(-1);
    expect(triggerEnd).toBeGreaterThan(triggerStart);
    expect(table.slice(triggerStart, triggerEnd)).not.toContain('kickMutation.mutate');
    expect(table.slice(triggerStart, triggerEnd)).toContain('onClick={() => onKickSource(stream)}');
    expect(page).toContain('import { useKickStreamTarget } from "@src/hooks/useKickStreamTarget";');
    expect(page).toContain('const kickMutation = useKickStreamTarget();');
    expect(page).toContain('function handleKickSource(stream: PathItem)');
    expect(page).toContain('setKickSourceStream(stream);');
    expect(page).toContain('function handleConfirmKickSource()');
    expect(page).toContain('kickMutation.mutate(sourceKickTarget');
    expect(dialogStart).toBeGreaterThan(confirmStart);
    expect(dialogEnd).toBeGreaterThan(dialogStart);
    expect(page.slice(dialogStart, dialogEnd)).toContain('<DialogTitle>Kick Source</DialogTitle>');
    expect(page.slice(dialogStart, dialogEnd)).toContain('Cancel');
    expect(page.slice(dialogStart, dialogEnd)).toContain('handleConfirmKickSource');
  });

  test('renders ad-hoc recording as a table action with dialog-gated mutation', () => {
    const table = source('src/components/streams/StreamTable.tsx');
    const page = source('src/pages/StreamsPage.tsx');
    const triggerStart = table.indexOf('aria-label={`${recordingTitle} ${stream.name}`}');
    const triggerEnd = table.indexOf('/>', triggerStart);
    const confirmStart = page.indexOf('function handleConfirmToggleRecording()');
    const dialogStart = page.indexOf('open={!!latestRecordingStream}', confirmStart);
    const dialogEnd = page.indexOf('</Dialog>', dialogStart);

    expect(table).toContain('onToggleRecording: (stream: PathItem) => void;');
    expect(table).toContain('const isRecording = isStreamRecordingEnabled(stream);');
    expect(table).toContain('const recordingTitle = isRecording');
    expect(table).toContain('? "Stop recording"');
    expect(table).toContain(': "Start recording"');
    expect(table).toContain('aria-label={`${recordingTitle} ${stream.name}`}');
    expect(table).toContain('disabled={recordingActionPending}');
    expect(table).toContain('recordingActiveIcon: {');
    expect(table).toContain("color: '#d13438'");
    expect(table).toContain("animationIterationCount: 'infinite'");
    expect(table).toContain('const recordingIconClassName = isRecording ? styles.recordingActiveIcon : undefined;');
    expect(table).toContain('className={recordingIconClassName}');
    expect(triggerStart).toBeGreaterThan(-1);
    expect(triggerEnd).toBeGreaterThan(triggerStart);
    expect(table.slice(triggerStart, triggerEnd)).not.toContain('recordingMutation.mutate');
    expect(table.slice(triggerStart, triggerEnd)).toContain('onClick={() => onToggleRecording(stream)}');
    expect(page).toContain('import { useToggleStreamRecording } from "@src/hooks/useToggleStreamRecording";');
    expect(page).toContain('const recordingMutation = useToggleStreamRecording();');
    expect(page).toContain('function handleToggleRecording(stream: PathItem)');
    expect(page).toContain('setRecordingStream(stream);');
    expect(page).toContain('function handleConfirmToggleRecording()');
    expect(page).toContain('recordingMutation.mutate(');
    expect(page).toContain('record: !isStreamRecordingEnabled(latestRecordingStream)');
    expect(page).toContain('isConfigured: latestRecordingStream.isConfigured');
    expect(page).toContain('sourceUri: latestRecordingStream.source');
    expect(page).toContain('onSettled: () => setRecordingStream(null)');
    expect(page).toContain('onToggleRecording={handleToggleRecording}');
    expect(page).toContain('recordingActionPending={recordingMutation.isPending}');
    expect(dialogStart).toBeGreaterThan(confirmStart);
    expect(dialogEnd).toBeGreaterThan(dialogStart);
    expect(page.slice(dialogStart, dialogEnd)).toContain('<DialogTitle>{recordingActionLabel}</DialogTitle>');
    expect(page.slice(dialogStart, dialogEnd)).toContain('Start recording stream');
    expect(page.slice(dialogStart, dialogEnd)).toContain('Stop recording stream');
    expect(page.slice(dialogStart, dialogEnd)).toContain('handleConfirmToggleRecording');
  });

  test('shows recording status next to online or offline in the Status column', () => {
    const table = source('src/components/streams/StreamTable.tsx');
    const badge = source('src/components/common/RecordingStatusBadge.tsx');

    expect(table).toContain('import RecordingStatusBadge from "@src/components/common/RecordingStatusBadge";');
    expect(table).toContain('statusBadges: {');
    expect(table).toContain('<StatusBadge status={isOnline ? "online" : "offline"} />');
    expect(table).toContain('<RecordingStatusBadge isRecording={isRecording} />');
    expect(badge).toContain("backgroundColor: '#d13438'");
    expect(badge).toContain("color: '#ffffff'");
    expect(badge).toContain('appearance="filled"');
  });

  test('removes table bulk reader kicking while preserving reader drawer primitives', () => {
    const table = source('src/components/streams/StreamTable.tsx');
    const detailsDrawer = source('src/components/streams/StreamDetailsDrawer.tsx');
    const viewerList = source('src/components/streams/StreamReaderList.tsx');
    const viewerDetailsDrawer = source('src/components/streams/ViewerDetailsDrawer.tsx');

    expect(table).not.toContain('getReaderKickTargets');
    expect(table).not.toContain('readerKickTargets');
    expect(table).not.toContain(obsoleteAudienceTerm('Kick Audience'));
    expect(table).not.toContain(`${obsoleteAudienceTerm('Kick Audience')}s`);
    expect(detailsDrawer).toContain('<StreamReaderList');
    expect(detailsDrawer).toContain('onSelectViewer={handleSelectViewer}');
    expect(detailsDrawer).toContain('<ViewerDetailsDrawer');
    expect(viewerDetailsDrawer).toContain('Reader Details');
    expect(viewerList).toContain('getViewerTableRows(readers)');
    expect(viewerList).toContain('No active readers');
  });

  test('keeps Stream Table edit and delete controls gated by isConfigured', () => {
    const table = source('src/components/streams/StreamTable.tsx');

    expect(table.match(/\{stream\.isConfigured && \(/g)?.length).toBeGreaterThanOrEqual(2);
    expect(table).toContain('aria-label={`Edit ${stream.name}`}');
    expect(table).toContain('aria-label={`Delete ${stream.name}`}');
  });
});
