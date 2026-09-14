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
    expect(table).toContain('disabled={!isOnline || recordingActionPending}');
    expect(table).toContain('StopFilled');
    expect(table).toContain('color: "#d13438"');
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

  test('widens stream names while keeping non-name and non-actions columns equal width', () => {
    const table = source('src/components/streams/StreamTable.tsx');

    expect(table).toContain('Tooltip,');
    expect(table).toContain('function StreamNameCell({ name }: { name: string })');
    expect(table).toContain('element.scrollWidth > element.clientWidth');
    expect(table).toContain('<Tooltip content={name} relationship="label">');
    expect(table).toContain('table: {');
    expect(table).toContain('display: "grid"');
    expect(table).toContain('gridTemplateColumns: "minmax(280px, 2fr) repeat(6, minmax(112px, 1fr)) max-content"');
    expect(table).toContain('rowGroup: {');
    expect(table).toContain('gridTemplateColumns: "subgrid"');
    expect(table).toContain('<TableHeader className={styles.rowGroup}>');
    expect(table).toContain('<TableBody className={styles.rowGroup}>');
    expect(table).toContain('nameCell: {');
    expect(table).toContain('standardCell: {');
    expect(table).toContain('column.key === "name" ? styles.nameCell : styles.standardCell');
    expect(table).toContain('<StreamNameCell name={stream.name} />');
    expect(table.match(/styles\.standardCell/g)?.length).toBeGreaterThanOrEqual(7);
    expect(table).toContain('actionsCellHeader: {');
    expect(table).toContain('textAlign: "center"');
    expect(table).toContain('display: "inline-flex"');
    expect(table).toContain('actionsCell: {');
    expect(table).toContain('textAlign: "left"');
    expect(table).toContain('justifyContent: "flex-start"');
    expect(table).toContain('alignItems: "center"');
    expect(table).not.toContain('compactCountCell');
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

  test('renders Stream Table edit and delete controls for every stream', () => {
    const table = source('src/components/streams/StreamTable.tsx');

    expect(table).not.toContain('{stream.isConfigured && !isOnline && (');
    expect(table).toContain('aria-label={`Edit ${stream.name}`}');
    expect(table).toContain('onClick={() => onEdit(stream)}');
    expect(table).toContain('aria-label={`Delete ${stream.name}`}');
    expect(table).toContain('onClick={() => onDelete(stream)}');
  });
});
