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
    expect(page).toContain("import { useKickStreamTarget } from '@src/hooks/useKickStreamTarget';");
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
