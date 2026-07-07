import type { HITLInterruptRequest, HITLResponse } from '@shared/types'
import HITLApprovalModal from './HITLApprovalModal'

export interface HitlPanelProps {
  request: HITLInterruptRequest | null
  onRespond: (response: HITLResponse) => void
}

export default function HitlPanel({ request, onRespond }: HitlPanelProps) {
  if (!request) return null
  return <HITLApprovalModal request={request} onRespond={onRespond} />
}
