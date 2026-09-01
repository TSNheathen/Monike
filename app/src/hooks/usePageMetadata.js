import { useEffect } from 'react'
import { applyPageMetadata } from '../lib/metadata.js'

export function usePageMetadata(metadata) {
  useEffect(() => {
    applyPageMetadata(metadata)
  }, [metadata])
}
