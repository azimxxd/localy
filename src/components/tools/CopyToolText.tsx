'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/kit';

export default function CopyToolText({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return <Button variant="secondary" onClick={async () => { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? 'Скопировано' : 'Скопировать'}</Button>;
}
