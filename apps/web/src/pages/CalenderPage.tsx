import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";

import {
  getSchedules,
  type Schedule,
} from "../api/publishing";

import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";

export function CalendarPage() {
  const navigate = useNavigate();

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadSchedules() {
    try {
      setLoading(true);
      setError("");

      const data = await getSchedules();
      setSchedules(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load schedules."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSchedules();
  }, []);

  const sortedSchedules = useMemo(() => {
    return [...schedules].sort(
      (a, b) =>
        new Date(a.scheduledAt).getTime() -
        new Date(b.scheduledAt).getTime()
    );
  }, [schedules]);

  if (loading) {
    return <LoadingState label="Loading content calendar..." />;
  }

  if (error) {
    return (
      <ErrorState
        message={error}
        onRetry={loadSchedules}
      />
    );
  }

  return (
    <main className="calendar-page">
      <header className="calendar-page-header">
        <div>
          <span>CONTENT CALENDAR</span>

          <h1>Scheduled publishing</h1>

          <p>
            Track upcoming, completed and failed campaign
            publications from one place.
          </p>
        </div>
      </header>

      {sortedSchedules.length > 0 ? (
        <section className="calendar-list">
          {sortedSchedules.map((schedule) => (
            <article
              key={schedule.id}
              className="calendar-item"
            >
              <div>
                <span>
                  {schedule.platform.replace(/_/g, " ")}
                </span>

                <h2>
                  {new Date(
                    schedule.scheduledAt
                  ).toLocaleString()}
                </h2>

                <small>
                  Campaign: {schedule.campaignId}
                </small>
              </div>

              <div>
                <span>STATUS</span>

                <strong>
                  {schedule.status.replace(/_/g, " ")}
                </strong>
              </div>

              <div>
                <span>EXECUTED</span>

                <strong>
                  {schedule.executedAt
                    ? new Date(
                        schedule.executedAt
                      ).toLocaleString()
                    : "Pending"}
                </strong>
              </div>

              <button
                onClick={() =>
                  navigate(
                    `/campaigns/${schedule.campaignId}`
                  )
                }
              >
                Open campaign
                <ArrowUpRight size={14} />
              </button>
            </article>
          ))}
        </section>
      ) : (
        <section className="calendar-empty">
          <span>NO SCHEDULES</span>

          <h2>Nothing is scheduled yet.</h2>

          <p>
            Approved campaigns scheduled for publication
            will appear here.
          </p>
        </section>
      )}
    </main>
  );
}