import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BrainCircuit,
  CalendarDays,
  Send,
} from "lucide-react";

import { getCampaigns } from "../api/campaigns";
import { getConnections } from "../api/connections";
import { getActivity } from "../api/activity";
import { getReviewQueue } from "../api/review";
import {
  getSchedules,
  type Schedule,
} from "../api/publishing";

import { CampaignStatus } from "../components/CampaignStatus";
import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";

import type {
  ActivityEvent,
  Campaign,
  Connection,
  ReviewQueueItem,
} from "../types";

export function StudioPage() {
  const navigate = useNavigate();

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [reviewQueue, setReviewQueue] = useState<ReviewQueueItem[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadStudio() {
    try {
      setLoading(true);
      setError("");

      const [
        campaignsData,
        connectionsData,
        activityData,
        reviewData,
        schedulesData,
      ] = await Promise.all([
        getCampaigns(),
        getConnections(),
        getActivity(),
        getReviewQueue(),
        getSchedules(),
      ]);

      setCampaigns(campaignsData);
      setConnections(connectionsData);
      setActivity(activityData);
      setReviewQueue(reviewData);
      setSchedules(schedulesData);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load POSTURA Studio."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStudio();
  }, []);

  const latestCampaign = useMemo(() => {
    return [...campaigns].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() -
        new Date(a.createdAt).getTime()
    )[0];
  }, [campaigns]);

  const publicationCount = useMemo(() => {
    return campaigns.reduce(
      (total, campaign) =>
        total + (campaign.publications?.length ?? 0),
      0
    );
  }, [campaigns]);

  const connectedPlatforms = connections.filter(
    (connection) => connection.connected
  ).length;

  const upcomingSchedules = schedules.filter(
    (schedule) => !schedule.executedAt
  ).length;

  if (loading) {
    return <LoadingState label="Opening POSTURA Studio..." />;
  }

  if (error) {
    return (
      <ErrorState
        message={error}
        onRetry={loadStudio}
      />
    );
  }

  return (
    <main className="studio-page">
      <header className="studio-header">
        <div>
          <span>SOCIAL MEDIA STUDIO</span>

          <h1>POSTURA</h1>

          <p>
            Create with freedom. Operate with control.
            Publish with proof.
          </p>
        </div>

        <button
          onClick={() => navigate("/new")}
        >
          New campaign
        </button>
      </header>

      <section className="studio-metrics">
        <article>
          <span>CAMPAIGNS</span>
          <strong>{campaigns.length}</strong>
        </article>

        <article>
          <span>IN REVIEW</span>
          <strong>{reviewQueue.length}</strong>
        </article>

        <article>
          <span>SCHEDULED</span>
          <strong>{upcomingSchedules}</strong>
        </article>

        <article>
          <span>PUBLISHED</span>
          <strong>{publicationCount}</strong>
        </article>

        <article>
          <span>CONNECTED</span>
          <strong>{connectedPlatforms}</strong>
        </article>
      </section>

      <section className="studio-workspace">
        <div className="studio-current">
          <div className="studio-section-head">
            <div>
              <span>CURRENT WORK</span>
              <h2>Campaign Room</h2>
            </div>

            <button
              onClick={() => navigate("/campaigns")}
            >
              View all
              <ArrowRight size={14} />
            </button>
          </div>

          {latestCampaign ? (
            <article className="studio-current-campaign">
              <div>
                <CampaignStatus
                  status={latestCampaign.status}
                />

                <span>
                  v{latestCampaign.contentVersion ?? 1}
                </span>
              </div>

              <h3>{latestCampaign.title}</h3>

              <p>
                {latestCampaign.source?.trim()
                  ? latestCampaign.source
                  : "No source content added yet."}
              </p>

              <button
                onClick={() =>
                  navigate(
                    `/campaigns/${latestCampaign.id}`
                  )
                }
              >
                Open campaign
                <ArrowRight size={14} />
              </button>
            </article>
          ) : (
            <div className="studio-empty">
              <span>NO CAMPAIGNS</span>
              <p>Create your first campaign to begin.</p>
            </div>
          )}
        </div>

        <aside className="studio-actions">
          <button
            onClick={() => navigate("/review")}
          >
            <span>
              <ArrowRight size={16} />
            </span>

            <div>
              <strong>Review Queue</strong>
              <small>
                {reviewQueue.length} awaiting attention
              </small>
            </div>
          </button>

          <button
            onClick={() => navigate("/calendar")}
          >
            <span>
              <CalendarDays size={16} />
            </span>

            <div>
              <strong>Calendar</strong>
              <small>
                {upcomingSchedules} upcoming
              </small>
            </div>
          </button>

          <button
            onClick={() => navigate("/publishing")}
          >
            <span>
              <Send size={16} />
            </span>

            <div>
              <strong>Publishing</strong>
              <small>
                {publicationCount} receipts
              </small>
            </div>
          </button>

          <button
            onClick={() => navigate("/intelligence")}
          >
            <span>
              <BrainCircuit size={16} />
            </span>

            <div>
              <strong>Campaign Brain</strong>
              <small>Analyse campaign readiness</small>
            </div>
          </button>
        </aside>
      </section>

      <section className="studio-activity">
        <div className="studio-section-head">
          <div>
            <span>OPERATIONS</span>
            <h2>Recent Activity</h2>
          </div>
        </div>

        {activity.length > 0 ? (
          activity.slice(0, 6).map((event) => (
            <article
              key={event.id}
              className="studio-activity-item"
            >
              <div>
                <strong>
                  {event.message ??
                    event.type ??
                    "Campaign activity"}
                </strong>

                <span>
                  {new Date(
                    event.createdAt
                  ).toLocaleString()}
                </span>
              </div>

              {event.campaignId && (
                <button
                  onClick={() =>
                    navigate(
                      `/campaigns/${event.campaignId}`
                    )
                  }
                >
                  Open
                </button>
              )}
            </article>
          ))
        ) : (
          <div className="studio-empty">
            <p>No recent activity yet.</p>
          </div>
        )}
      </section>
    </main>
  );
}