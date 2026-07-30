import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const obsoleteAudienceTerm = (text: string) => text.replace('Audience', ['View', 'er'].join(''));

function source(path: string) {
  return readFileSync(join(root, path), 'utf8');
}

describe('Stream card reader actions source contract', () => {
  test('renders Kick Source as a controlled popover action with confirmation-gated mutation', () => {
    const card = source('src/components/streams/StreamCard.tsx');
    const triggerStart = card.indexOf('aria-label={`Kick source for ${stream.name}`}');
    const triggerEnd = card.indexOf('<PopoverSurface>', triggerStart);
    const surfaceEnd = card.indexOf('</PopoverSurface>', triggerEnd);

    expect(card).toContain('PopoverTrigger');
    expect(card).toContain('PopoverSurface');
    expect(card).toContain('aria-label={`Kick source for ${stream.name}`}');
    expect(card).toContain("type ActiveConfirmation = 'delete' | 'kickSource' | null;");
    expect(card).toContain("open={activeConfirmation === 'kickSource'}");
    expect(card).toContain("setActiveConfirmation(data.open ? 'kickSource' : null);");
    expect(triggerStart).toBeGreaterThan(-1);
    expect(triggerEnd).toBeGreaterThan(triggerStart);
    expect(card.slice(triggerStart, triggerEnd)).not.toContain('handleKickSource');
    expect(card.slice(triggerStart, triggerEnd)).not.toContain(
      'kickMutation.mutate(sourceKickTarget)'
    );
    expect(card.slice(triggerStart, triggerEnd)).toContain('Kick Source');
    expect(card.slice(triggerEnd, surfaceEnd)).toContain('onClick={handleKickSource}');
    expect(card.slice(triggerEnd, surfaceEnd)).toContain('Confirm');
    expect(card).toContain('function handleKickSource()');
    expect(card).toContain('kickMutation.mutate(sourceKickTarget);');
    expect(card.slice(triggerEnd, surfaceEnd)).toContain('Cancel');
  });

  test('removes Stream Card bulk reader kicking', () => {
    const card = source('src/components/streams/StreamCard.tsx');

    expect(card).not.toContain('getReaderKickTargets');
    expect(card).not.toContain('readerKickTargets');
    expect(card).not.toContain(obsoleteAudienceTerm('Kick Audience'));
    expect(card).not.toContain(`${obsoleteAudienceTerm('Kick Audience')}s`);
    expect(card).not.toContain('kickMutation.mutate(readerKickTargets)');
  });

  test('makes reader count clickable and wires card clicks to a right-side reader drawer', () => {
    const card = source('src/components/streams/StreamCard.tsx');
    const page = source('src/pages/StreamsPage.tsx');
    const drawer = source('src/components/streams/StreamReadersDrawer.tsx');

    expect(card).toContain('onViewers: (stream: PathItem) => void;');
    expect(card).toContain('aria-label={`View active readers for ${stream.name}`}');
    expect(card).toContain('onClick={() => onViewers(stream)}');
    expect(page).toContain('onViewers={handleViewers}');
    expect(page).toContain('<StreamReadersDrawer');
    expect(drawer).toContain('<OverlayDrawer');
    expect(drawer).toContain('position="end"');
    expect(drawer).toContain(
      '<StreamReaderList readers={stream.readers} onSelectViewer={handleSelectViewer} />'
    );
  });

  test('uses the shared reader list and reader details drawer from both stream drawers', () => {
    const detailsDrawer = source('src/components/streams/StreamDetailsDrawer.tsx');
    const viewerDrawer = source('src/components/streams/StreamReadersDrawer.tsx');
    const viewerList = source('src/components/streams/StreamReaderList.tsx');
    const viewerDetailsDrawer = source('src/components/streams/ViewerDetailsDrawer.tsx');

    expect(detailsDrawer).toContain(
      "import StreamReaderList from '@src/components/streams/StreamReaderList';"
    );
    expect(detailsDrawer).toContain(
      "import ViewerDetailsDrawer from '@src/components/streams/ViewerDetailsDrawer';"
    );
    expect(detailsDrawer).toContain('<StreamReaderList');
    expect(detailsDrawer).toContain('readers={stream.readers}');
    expect(detailsDrawer).toContain('onSelectViewer={handleSelectViewer}');
    expect(detailsDrawer).toContain('setSelectedViewerTarget(row.detailTarget);');
    expect(detailsDrawer).toContain('<ViewerDetailsDrawer');
    expect(detailsDrawer).not.toContain('<table className={styles.table}>');
    expect(detailsDrawer).not.toContain('getViewerDetail(selectedViewerTarget)');
    expect(viewerDrawer).toContain(
      "import StreamReaderList from '@src/components/streams/StreamReaderList';"
    );
    expect(viewerDrawer).toContain(
      "import ViewerDetailsDrawer from '@src/components/streams/ViewerDetailsDrawer';"
    );
    expect(viewerDrawer).toContain(
      'const [selectedViewerTarget, setSelectedViewerTarget] = useState<ViewerDetailTarget | null>(null);'
    );
    expect(viewerDrawer).toContain('function handleSelectViewer(row: ViewerTableRow)');
    expect(viewerDrawer).toContain('setSelectedViewerTarget(row.detailTarget);');
    expect(viewerDrawer).toContain(
      '<StreamReaderList readers={stream.readers} onSelectViewer={handleSelectViewer} />'
    );
    expect(viewerDrawer).toContain('<ViewerDetailsDrawer');
    expect(viewerDrawer).toContain('onClose={() => setSelectedViewerTarget(null)}');
    expect(viewerDetailsDrawer).toContain(
      "import { useStoreBackedViewerDetail } from '@src/hooks/useMediaMTXApi';"
    );
    expect(viewerDetailsDrawer).toContain(
      "import { getFetchedViewerPrimitiveDetails } from '@src/utils/streamDetails';"
    );
    expect(viewerDetailsDrawer).toContain(
      'const viewerDetailQuery = useStoreBackedViewerDetail(viewerTarget, isOpen && !!viewerTarget);'
    );
    expect(viewerDetailsDrawer).toContain('Reader Details');
    expect(viewerDetailsDrawer).toContain('Loading reader details');
    expect(viewerDetailsDrawer).toContain('Unable to load reader details');
    expect(viewerDetailsDrawer).toContain('No primitive reader details');
    expect(viewerList).toContain('getViewerTableRows(readers)');
    expect(viewerList).toContain('No active readers');
    expect(viewerList).toContain('onSelectViewer?: (row: ViewerTableRow) => void;');
    expect(viewerList).toContain('onClick={() => onSelectViewer?.(row)}');
    expect(viewerList).toContain('PopoverSurface');
    expect(viewerList).toContain('Kick out reader {row.identity}?');
    expect(viewerList).toContain('kickMutation.mutate(row.kickTarget)');
  });

  test('gates Stream Card delete behind a controlled popover confirmation', () => {
    const card = source('src/components/streams/StreamCard.tsx');
    const page = source('src/pages/StreamsPage.tsx');
    const deleteTriggerStart = card.indexOf('icon={<DeleteRegular style={smallIconStyle} />}');
    const deleteSurfaceStart = card.indexOf('<PopoverSurface>', deleteTriggerStart);
    const deleteSurfaceEnd = card.indexOf('</PopoverSurface>', deleteSurfaceStart);

    expect(deleteTriggerStart).toBeGreaterThan(-1);
    expect(deleteSurfaceStart).toBeGreaterThan(deleteTriggerStart);
    expect(card).toContain("open={activeConfirmation === 'delete'}");
    expect(card).toContain("setActiveConfirmation(data.open ? 'delete' : null);");
    expect(card.slice(deleteTriggerStart, deleteSurfaceStart)).not.toContain('onDelete(stream)');
    expect(card.slice(deleteSurfaceStart, deleteSurfaceEnd)).toContain(
      'Delete stream "${stream.name}"?'
    );
    expect(card.slice(deleteSurfaceStart, deleteSurfaceEnd)).toContain('Cancel');
    expect(card.slice(deleteSurfaceStart, deleteSurfaceEnd)).toContain(
      'onClick={handleDeleteStream}'
    );
    expect(card).toContain('function handleDeleteStream()');
    expect(card).toContain('onDelete(stream);');
    expect(page).toContain('function handleCardDelete(stream: PathItem)');
    expect(page).toContain('deleteMutation.mutate(stream.name);');
    expect(page).toContain('onDelete={handleCardDelete}');
  });

  test('keeps Stream Card and Stream Table edit and delete controls gated by isConfigured', () => {
    const card = source('src/components/streams/StreamCard.tsx');
    const table = source('src/components/streams/StreamTable.tsx');

    expect(card.match(/\{stream\.isConfigured && \(/g)?.length).toBeGreaterThanOrEqual(2);
    expect(table.match(/\{stream\.isConfigured && \(/g)?.length).toBeGreaterThanOrEqual(2);
    expect(card).toContain('icon={<EditRegular style={smallIconStyle} />}');
    expect(card).toContain('icon={<DeleteRegular style={smallIconStyle} />}');
    expect(table).toContain('aria-label={`Edit ${stream.name}`}');
    expect(table).toContain('aria-label={`Delete ${stream.name}`}');
  });

  test('scopes Stream Card confirmations to one exclusive card action state', () => {
    const card = source('src/components/streams/StreamCard.tsx');

    expect(card).toContain("type ActiveConfirmation = 'delete' | 'kickSource' | null;");
    expect(card).toContain('const [activeConfirmation, setActiveConfirmation]');
    expect(card).toContain("open={activeConfirmation === 'delete'}");
    expect(card).toContain("open={activeConfirmation === 'kickSource'}");
    expect(card).toContain("setActiveConfirmation(data.open ? 'delete' : null);");
    expect(card).toContain("setActiveConfirmation(data.open ? 'kickSource' : null);");
    expect(card).not.toContain('activeDelete');
    expect(card).not.toContain('activeKickSource');
  });
});
