import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";

import { getReviewQueue } from "../api/review";
import { CampaignStatus } from "../components/CampaignStatus";
import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";

import type { ReviewQueueItem } from "../types";

export function ReviewPage() {
  const navigate = useNavigate();

  const [items, setItems] = useState<ReviewQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadReviewQueue() {
    try {
      setLoading(true);
      setError("");

      const data = await getReviewQueue();
      setItems(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load review queue."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReviewQueue();
  }, []);

  if (loading) {
    return <LoadingState label="Loading review queue..." />;
  }

  if (error) {
    return (
      <ErrorState
        message={error}
        onRetry={loadReviewQueue}
      />
    );
  }

  return (
    <main className="review-page">
      <header className="review-page-header">
        <div>
          <span>HUMAN REVIEW</span>

          <h1>Review Queue</h1>

          <p>
            Resolve feedback and approve the exact campaign
            version before publishing.
          </p>
        </div>
      </header>

      {items.length > 0 ? (
        <section className="review-page-list">
          {items.map((item) => {
            const unresolved =
              item.unresolvedCurrentVersion ?? 0;

            return (
              <article
                key={item.id}
                className="review-item"
              >
                <div className="review-item-main">
                  <div className="review-item-top">
                    <CampaignStatus status={item.status} />

                    <span>
                      v{item.contentVersion ?? 1}
                    </span>
                  </div>

                  <h2>{item.title}</h2>

                  <p>
                    {item.source?.trim()
                      ? item.source
                      : "No source content available."}
                  </p>
                </div>

                <div className="review-item-meta">
                  <div>
                    <span>OPEN NOTES</span>
                    <strong>{unresolved}</strong>
                  </div>

                  <div>
                    <span>APPROVAL</span>
                    <strong>
                      {item.readyForApproval
                        ? "Ready"
                        : "Blocked"}
                    </strong>
                  </div>

                  <div>
                    <span>PUBLISH</span>
                    <strong>
                      {item.readyForPublish
                        ? "Ready"
                        : "Not ready"}
                    </strong>
                  </div>
                </div>

                <button
                  className="review-item-open"
                  onClick={() =>
                    navigate(`/campaigns/${item.id}`)
                  }
                >
                  Open review
                  <ArrowUpRight size={14} />
                </button>
              </article>
            );
          })}
        </section>
      ) : (
        <section className="review-page-empty">
          <span>REVIEW QUEUE CLEAR</span>

          <h2>No campaigns need attention.</h2>

          <p>
            Campaigns requiring review will appear here.
          </p>
        </section>
      )}
    </main>
  );
}