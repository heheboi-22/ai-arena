import { StatusDot } from '@astryxdesign/core/StatusDot';
import { Text } from '@astryxdesign/core/Text';
import type { Telemetry } from '../lib/models';

/** Live route state: a dot, a word, and the probe time when it answered. */
export function StatusPill({ telemetry }: { telemetry: Telemetry | undefined }) {
  if (!telemetry) {
    return (
      <span className="status">
        <StatusDot variant="neutral" label="checking" isPulsing />
        <Text size="xsm" color="secondary">
          checking
        </Text>
      </span>
    );
  }

  const { up, status } = telemetry;
  return (
    <span className="status" title={up ? `HTTP ${status}` : "no answer within 2500 ms"}>
      <StatusDot variant={up ? "success" : "error"} label={up ? "up" : "down"} />
      <Text size="xsm" color={up ? "primary" : "secondary"}>
        {up ? "up" : "down"}
      </Text>
    </span>
  );
}
