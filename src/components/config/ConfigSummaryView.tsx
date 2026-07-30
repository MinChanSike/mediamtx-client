import { makeStyles, tokens } from '@fluentui/react-components';
import type { GlobalConfig } from '@src/types/config';
import ConfigCategoryCard from '@src/components/config/ConfigCategoryCard';
import type { ConfigField } from '@src/components/config/ConfigCategoryCard';

interface ConfigSummaryViewProps {
  config: GlobalConfig;
}

export interface ConfigSummaryCardModel {
  title: string;
  fields: ConfigField[];
}

const useStyles = makeStyles({
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: tokens.spacingHorizontalS,
    '@media (max-width: 1180px)': {
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    },
    '@media (max-width: 760px)': {
      gridTemplateColumns: '1fr',
    },
  },
});

export function buildConfigSummaryCards(config: GlobalConfig): ConfigSummaryCardModel[] {
  return [
    {
      title: 'General Settings',
      fields: [
        { label: 'Log Level', value: config.logLevel },
        { label: 'Log Destinations', value: config.logDestinations.join(', ') },
        { label: 'Log File', value: config.logFile },
      ],
    },
    {
      title: 'Network Runtime',
      fields: [
        { label: 'Read Timeout', value: config.readTimeout },
        { label: 'Write Timeout', value: config.writeTimeout },
        { label: 'Read Buffer Count', value: config.readBufferCount },
        { label: 'UDP Max Payload Size', value: config.udpMaxPayloadSize },
      ],
    },
    {
      title: 'Service Access',
      fields: [
        { label: 'API Enabled', value: config.api },
        { label: 'API Address', value: config.apiAddress },
        { label: 'Metrics Enabled', value: config.metrics },
        { label: 'Metrics Address', value: config.metricsAddress },
      ],
    },
    {
      title: 'Diagnostics and Playback',
      fields: [
        { label: 'PPROF Enabled', value: config.pprof },
        { label: 'PPROF Address', value: config.pprofAddress },
        { label: 'Playback Enabled', value: config.playback },
        { label: 'Playback Address', value: config.playbackAddress },
      ],
    },
    {
      title: 'Path Defaults',
      fields: [
        { label: 'Configured Paths', value: Object.keys(config.paths).length },
        { label: 'Default Source', value: config.paths.all?.source },
        { label: 'Default Source Protocol', value: config.paths.all?.sourceProtocol },
        { label: 'Default Max Readers', value: config.paths.all?.maxReaders },
      ],
    },
  ];
}

export default function ConfigSummaryView({ config }: ConfigSummaryViewProps) {
  const styles = useStyles();
  const cards = buildConfigSummaryCards(config);

  return (
    <div className={styles.grid}>
      {cards.map((card) => (
        <ConfigCategoryCard key={card.title} title={card.title} fields={card.fields} />
      ))}
    </div>
  );
}
