import { useEffect, useState } from 'react';
import { getScreenshot } from '../../storage/screenshot-db';

export function useScreenshotUrl(id: string | null, kind: 'full' | 'thumbnail') {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    setUrl(null);
    setError(false);
    if (!id) return;
    void getScreenshot(id)
      .then((record) => {
        if (!active) return;
        if (!record) {
          setError(true);
          return;
        }
        objectUrl = URL.createObjectURL(
          kind === 'full' ? record.fullImageBlob : record.thumbnailBlob,
        );
        setUrl(objectUrl);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id, kind]);

  return { url, error };
}
