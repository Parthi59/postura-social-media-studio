import type { CampaignStatus as CampaignStatusType } from "../types";

type CampaignStatusProps = {
  status: CampaignStatusType;
};

export function CampaignStatus({
  status,
}: CampaignStatusProps) {
  const label = status.replace(/_/g, " ");

  return (
    <span className={`campaign-status status-${status.toLowerCase()}`}>
      {label}
    </span>
  );
}