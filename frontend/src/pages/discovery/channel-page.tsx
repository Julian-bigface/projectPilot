import { Navigate, useParams } from "react-router"

import { DiscoveryRepoList } from "@/components/discovery/discovery-repo-list"
import { isDiscoveryChannelId } from "@/types/discovery"

export function DiscoveryChannelPage() {
  const { channelId } = useParams()
  if (!channelId || !isDiscoveryChannelId(channelId)) {
    return <Navigate to="/discovery/trending" replace />
  }
  return <DiscoveryRepoList channelId={channelId} />
}
