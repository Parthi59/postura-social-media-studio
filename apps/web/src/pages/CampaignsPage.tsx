import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { getCampaigns } from "../api/campaigns";
import { CampaignCard } from "../components/CampaignCard";
import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";

import type {
  Campaign,
  CampaignStatus,
} from "../types";

type CampaignFilter =
  | "ALL"
  | CampaignStatus;

export function CampaignsPage() {
  const navigate = useNavigate();

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [filter, setFilter] = useState<CampaignFilter>("ALL");
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadCampaigns() {
    try {
      setLoading(true);
      setError("");

      const data = await getCampaigns();
      setCampaigns(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load campaigns."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCampaigns();
  }, []);

  const visibleCampaigns = useMemo(() => {
    const query = search.trim().toLowerCase();

    return campaigns.filter((campaign) => {
      const matchesStatus =
        filter === "ALL" ||
        campaign.status === filter;

      const matchesSearch =
        !query ||
        campaign.title.toLowerCase().includes(query) ||
        (campaign.source ?? "")
          .toLowerCase()
          .includes(query);

      return matchesStatus && matchesSearch;
    });
  }, [campaigns, filter, search]);

  if (loading) {
    return (
      <LoadingState label="Loading campaigns..." />
    );
  }

  if (error) {
    return (
      <ErrorState
        message={error}
        onRetry={loadCampaigns}
      />
    );
  }

  return (
    <main className="campaigns-page">
      <header className="campaigns-page-header">
        <div>
          <span>CAMPAIGN ROOM</span>

          <h1>Campaigns</h1>

          <p>
            Create, review, approve and publish your
            social campaigns from one workspace.
          </p>
        </div>

        <button
          onClick={() => navigate("/new")}
        >
          New campaign
        </button>
      </header>

      <section className="campaigns-page-controls">
        <div>
          {(
            [
              ["ALL", "All"],
              ["DRAFT", "Drafts"],
              ["IN_REVIEW", "In review"],
              ["APPROVED", "Approved"],
              ["PUBLISHED", "Published"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              className={
                filter === value
                  ? "is-active"
                  : ""
              }
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>

        <input
          type="search"
          value={search}
          onChange={(event) =>
            setSearch(event.target.value)
          }
          placeholder="Find a campaign..."
        />
      </section>

      {visibleCampaigns.length > 0 ? (
        <section className="campaigns-page-grid">
          {visibleCampaigns.map((campaign) => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              onOpen={(campaignId) =>
                navigate(`/campaigns/${campaignId}`)
              }
            />
          ))}
        </section>
      ) : (
        <section className="campaigns-page-empty">
          <span>NO CAMPAIGNS FOUND</span>

          <h2>
            Nothing matches this view.
          </h2>

          <p>
            Change the filter or create a new campaign.
          </p>

          <button
            onClick={() => {
              setFilter("ALL");
              setSearch("");
            }}
          >
            Show all campaigns
          </button>
        </section>
      )}
    </main>
  );
}