import { ArrowUpRight } from "lucide-react";
import type { Campaign } from "../types";
import { CampaignStatus } from "./CampaignStatus";

type CampaignCardProps = {
  campaign: Campaign;
  onOpen: (campaignId: string) => void;
};

export function CampaignCard({
  campaign,
  onOpen,
}: CampaignCardProps) {
  return (
    <article className="campaign-card">
      <button
        className="campaign-card-main"
        onClick={() => onOpen(campaign.id)}
      >
        <div className="campaign-card-top">
          <CampaignStatus status={campaign.status} />

          <span>
            v{campaign.contentVersion ?? 1}
          </span>
        </div>

        <div className="campaign-card-content">
          <span>CAMPAIGN</span>

          <h3>{campaign.title}</h3>

          <p>
            {campaign.source?.trim()
              ? campaign.source
              : "No source content added yet."}
          </p>
        </div>

        <div className="campaign-card-bottom">
          <span>
            {campaign.publications?.length ?? 0} publications
          </span>

          <ArrowUpRight size={15} />
        </div>
      </button>
    </article>
  );
}