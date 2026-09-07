import { ConnectorMark } from '@/components/ui/ConnectorMark';
import { isKnownConnectorId } from '@/lib/connectorCredentials';

export function CatalogIcon({
  connectorKey,
  size = 'sm',
}: {
  connectorKey: string;
  size?: 'sm' | 'md';
}) {
  if (isKnownConnectorId(connectorKey)) {
    return <ConnectorMark id={connectorKey} size={size} />;
  }
  const letter = connectorKey.slice(0, 1).toUpperCase() || '?';
  const box = size === 'md' ? 40 : 28;
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center font-semibold text-[#171717]"
      style={{
        width: box,
        height: box,
        borderRadius: size === 'md' ? 10 : 8,
        background: '#ffffff',
        fontSize: size === 'md' ? 14 : 11,
        boxShadow: 'inset 0 0 0 1px rgba(23,23,23,0.07), 0 1px 1.5px rgba(23,23,23,0.06)',
      }}
    >
      {letter}
    </span>
  );
}
