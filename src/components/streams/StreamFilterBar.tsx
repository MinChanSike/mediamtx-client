import {
  Button,
  Input,
  Select,
  Tab,
  TabList,
  makeStyles,
  mergeClasses,
  tokens,
  type SelectTabData,
  type SelectTabEvent,
} from '@fluentui/react-components';
import {
  Add24Regular,
  Apps24Regular,
  Grid20Regular,
  Grid24Regular,
  Search24Regular,
  Table24Regular,
} from '@fluentui/react-icons';

const PROTOCOL_OPTIONS = [
  { value: 'all', label: 'All Protocols' },
  { value: 'rtsp', label: 'RTSP' },
  { value: 'rtmp', label: 'RTMP' },
  { value: 'srt', label: 'SRT' },
  { value: 'udp', label: 'UDP' },
  { value: 'hls', label: 'HLS' },
  { value: 'file', label: 'File' },
  { value: 'ffmpeg', label: 'FFmpeg' },
  { value: 'unknown', label: 'Unknown' },
];

const GRID_LAYOUT_OPTIONS = ['1x1', '2x2', '3x3', '4x4'] as const;

type LayoutMode = 'table' | 'cards' | 'grid';
type GridLayout = '1x1' | '2x2' | '3x3' | '4x4';

interface StreamFilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  protocol: string;
  onProtocolChange: (value: string) => void;
  layout: LayoutMode;
  onLayoutChange: (layout: LayoutMode) => void;
  gridLayout: GridLayout;
  onGridLayoutChange: (gridLayout: '1x1' | '2x2' | '3x3' | '4x4') => void;
  onAddStream: () => void;
}

const useStyles = makeStyles({
  root: {
    position: 'relative',
    display: 'flex',
    minWidth: 0,
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacingHorizontalS,
  },

  filters: {
    display: 'flex',
    minWidth: 0,
    flex: 1,
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
  },
  search: {
    width: '240px',
    minWidth: '180px',
    '@media (max-width: 620px)': {
      width: '100%',
    },
  },
  actions: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: tokens.spacingHorizontalS,
  },
  gridLayoutGroup: {
    position: 'absolute',
    display: 'flex',
    alignItems: 'center',
    boxSizing: 'border-box',
    gap: tokens.spacingHorizontalXXS,
    maxWidth: '100%',
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    borderTopLeftRadius: tokens.borderRadiusMedium,
    borderTopRightRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground1,
    padding: tokens.spacingHorizontalXXS,
    borderBottom: 0,
  },
  gridLayoutButton: {
    minWidth: '50px',
    height: '26px',
    paddingRight: tokens.spacingHorizontalXXS,
    paddingLeft: tokens.spacingHorizontalXXS,
    fontSize: tokens.fontSizeBase100,
    fontWeight: tokens.fontWeightSemibold,
  },
});

export default function StreamFilterBar({
  search,
  onSearchChange,
  protocol,
  onProtocolChange,
  layout,
  onLayoutChange,
  gridLayout,
  onGridLayoutChange,
  onAddStream,
}: StreamFilterBarProps) {
  const styles = useStyles();

  const handleLayoutSelect = (_event: SelectTabEvent, data: SelectTabData) => {
    const nextLayout = data.value as LayoutMode;
    onLayoutChange(nextLayout);
  };

  const selectGridLayout = (option: (typeof GRID_LAYOUT_OPTIONS)[number]) => {
    onGridLayoutChange(option);
  };

  return (
    <div className={mergeClasses(styles.root)}>
      {layout === 'grid' && (
        <div
          className={mergeClasses(styles.gridLayoutGroup, '-top-10 -right-2')}
          role="group"
          aria-label="Grid layout size"
        >
          {GRID_LAYOUT_OPTIONS.map((option) => (
            <Button
              key={option}
              aria-label={`Use ${option} grid layout`}
              aria-pressed={gridLayout === option}
              appearance={gridLayout === option ? 'primary' : 'subtle'}
              icon={<Grid20Regular />}
              onClick={() => selectGridLayout(option)}
              size="small"
              className={styles.gridLayoutButton}
            >
              {option}
            </Button>
          ))}
        </div>
      )}

      <div className={styles.filters}>
        <Input
          id="stream-search"
          contentBefore={<Search24Regular />}
          placeholder="Search streams..."
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          aria-label="Search streams"
          className={styles.search}
        />

        <Select
          id="protocol-filter"
          value={protocol}
          onChange={(event) => onProtocolChange(event.target.value)}
          aria-label="Filter by protocol"
        >
          {PROTOCOL_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      </div>

      <div className={styles.actions}>
        <TabList selectedValue={layout} onTabSelect={handleLayoutSelect} size="small">
          <Tab id="layout-table" value="table" icon={<Table24Regular />}>
            Table
          </Tab>
          <Tab id="layout-cards" value="cards" icon={<Apps24Regular />}>
            Cards
          </Tab>
          <Tab id="layout-grid" value="grid" icon={<Grid24Regular />}>
            Grid
          </Tab>
        </TabList>

        <Button
          id="add-stream-btn"
          appearance="primary"
          icon={<Add24Regular />}
          onClick={onAddStream}
        >
          Add Stream
        </Button>
      </div>
    </div>
  );
}
