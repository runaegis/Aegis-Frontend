'use client';

import { CanonicalJsonViewer } from '@/components/ui/CanonicalJsonViewer';

interface JsonViewerProps {
  data: unknown;
  collapsed?: boolean;
}

/** Small JSON payloads (e.g. tool arguments): same viewer as runs audit raw JSON, compact height. */
export default function JsonViewer({ data }: JsonViewerProps) {
  return <CanonicalJsonViewer value={data} maxHeightClass="max-h-64" />;
}
