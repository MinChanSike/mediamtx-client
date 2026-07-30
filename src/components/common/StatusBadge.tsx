import { Badge } from '@fluentui/react-components';

type Status = 'online' | 'offline' | 'unknown' | 'connecting';

interface StatusBadgeProps {
  status: Status;
  className?: string;
}

const STATUS_CONFIG: Record<Status, { label: string; color: 'success' | 'danger' | 'warning' | 'subtle' }> = {
  online: { label: 'Online', color: 'success' },
  offline: { label: 'Offline', color: 'danger' },
  connecting: { label: 'Connecting', color: 'warning' },
  unknown: { label: 'Unknown', color: 'subtle' },
};

export default function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  return (
    <Badge appearance="tint" color={config.color} className={className}>
      {config.label}
    </Badge>
  );
}
