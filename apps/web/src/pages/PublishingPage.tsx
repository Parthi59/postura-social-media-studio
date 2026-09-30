import { useEffect, useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";

import { getCampaigns } from "../api/campaigns";
import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";

import type {
  Campaign,
  Publication,
} from "../types";

type PublicationRow = Publication & {
  campaignTitle: string;
};

export function PublishingPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadPublishing() {
    try {
      setLoading(true);
      setError("");

      const data = await getCampaigns();
      setCampaigns(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load publishing history."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPublishing();
  }, []);

  const publications = useMemo<PublicationRow[]>(() => {
    return campaigns
      .flatMap((campaign) =>
        (campaign.publications ?? []).map((publication) => ({
          ...publication,
          campaignTitle: campaign.title,
        }))
      )
      .sort(
        (a, b) =>
          new Date(b.createdAt ?? 0).getTime() -
          new Date(a.createdAt ?? 0).getTime()
      );
  }, [campaigns]);

  if (loading) {
    return (
      <LoadingState label="Loading publishing receipts..." />
    );
  }

  if (error) {
    return (
      <ErrorState
        message={error}
        onRetry={loadPublishing}
      />
    );
  }

  return (
    <main className="publishing-page">
      <header className="publishing-page-header">
        <div>
          <span>PUBLISHING PROOF</span>

          <h1>Delivery Receipts</h1>

          <p>
            Verify what POSTURA published, where it was
            delivered and how the publisher responded.
          </p>
        </div>
      </header>

      {publications.length > 0 ? (
        <section className="publishing-list">
          {publications.map((publication) => (
            <article
              key={publication.id}
              className="publishing-item"
            >
              <div>
                <span>CAMPAIGN</span>

                <h2>{publication.campaignTitle}</h2>

                <small>
                  {publication.platform.replace(/_/g, " ")}
                </small>
              </div>

              <div>
                <span>STATUS</span>

                <strong>
                  {publication.status.replace(/_/g, " ")}
                </strong>
              </div>

              <div>
                <span>HTTP</span>

                <strong>
                  {publication.httpStatus ?? "—"}
                </strong>
              </div>

              <div>
                <span>LATENCY</span>

                <strong>
                  {publication.latencyMs !== undefined &&
                  publication.latencyMs !== null
                    ? `${publication.latencyMs} ms`
                    : "—"}
                </strong>
              </div>

              <div>
                <span>ATTEMPTS</span>

                <strong>
                  {publication.attemptCount ?? 1}
                </strong>
              </div>

              {publication.externalUrl ? (
                <a
                  href={publication.externalUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open receipt
                  <ExternalLink size={13} />
                </a>
              ) : (
                <span className="publishing-no-link">
                  No external URL
                </span>
              )}
            </article>
          ))}
        </section>
      ) : (
        <section className="publishing-empty">
          <span>NO DELIVERY RECEIPTS</span>

          <h2>Nothing has been published yet.</h2>

          <p>
            Successful and failed publication attempts will
            appear here.
          </p>
        </section>
      )}
    </main>
  );
}