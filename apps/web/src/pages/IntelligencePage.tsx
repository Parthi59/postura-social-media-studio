import { useEffect, useMemo, useState } from "react";
import { BrainCircuit, RefreshCw } from "lucide-react";

import {
  getCampaignInsights,
  runCampaignBrain,
} from "../api/intelligence";

import { getCampaigns } from "../api/campaigns";
import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";

import type {
  AiInsight,
  Campaign,
} from "../types";

export function IntelligencePage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState("");

  const [insights, setInsights] = useState<AiInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  async function loadCampaigns() {
    try {
      const data = await getCampaigns();

      setCampaigns(data);

      if (!selectedCampaignId && data.length > 0) {
        setSelectedCampaignId(data[0].id);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load campaigns."
      );
    }
  }

  async function loadInsights(campaignId: string) {
    try {
      setLoading(true);
      setError("");

      const data = await getCampaignInsights(campaignId);
      setInsights(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load Campaign Brain."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCampaigns();
  }, []);

  useEffect(() => {
    if (!selectedCampaignId) {
      setLoading(false);
      setInsights([]);
      return;
    }

    loadInsights(selectedCampaignId);
  }, [selectedCampaignId]);

  const selectedCampaign = useMemo(
    () =>
      campaigns.find(
        (campaign) =>
          campaign.id === selectedCampaignId
      ),
    [campaigns, selectedCampaignId]
  );

  const latestInsight = insights[0] ?? null;

  async function handleRunBrain() {
    if (!selectedCampaignId) {
      return;
    }

    try {
      setRunning(true);
      setError("");

      await runCampaignBrain(selectedCampaignId);
      await loadInsights(selectedCampaignId);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Campaign Brain analysis failed."
      );
    } finally {
      setRunning(false);
    }
  }

  if (loading && campaigns.length === 0) {
    return (
      <LoadingState label="Loading Campaign Brain..." />
    );
  }

  if (error && campaigns.length === 0) {
    return (
      <ErrorState
        message={error}
        onRetry={loadCampaigns}
      />
    );
  }

  return (
    <main className="intelligence-page">
      <header className="intelligence-page-header">
        <div>
          <span>CAMPAIGN BRAIN</span>

          <h1>Campaign Intelligence</h1>

          <p>
            Analyse campaign readiness, risks and next
            actions using the current campaign state.
          </p>
        </div>

        {campaigns.length > 0 && (
          <select
            value={selectedCampaignId}
            onChange={(event) =>
              setSelectedCampaignId(
                event.target.value
              )
            }
          >
            {campaigns.map((campaign) => (
              <option
                key={campaign.id}
                value={campaign.id}
              >
                {campaign.title}
              </option>
            ))}
          </select>
        )}
      </header>

      {!selectedCampaign ? (
        <section className="intelligence-empty">
          <BrainCircuit size={26} />

          <h2>No campaign selected.</h2>

          <p>
            Create a campaign before running Campaign Brain.
          </p>
        </section>
      ) : (
        <>
          <section className="intelligence-command">
            <div>
              <span>CURRENT CAMPAIGN</span>

              <h2>{selectedCampaign.title}</h2>

              <p>
                Version {selectedCampaign.contentVersion ?? 1}
                {" · "}
                {selectedCampaign.status.replace(
                  /_/g,
                  " "
                )}
              </p>
            </div>

            <button
              onClick={handleRunBrain}
              disabled={running}
            >
              <RefreshCw
                size={14}
                className={
                  running
                    ? "is-spinning"
                    : ""
                }
              />

              {running
                ? "Analysing..."
                : "Run Campaign Brain"}
            </button>
          </section>

          {error && (
            <ErrorState
              message={error}
              onRetry={() =>
                loadInsights(selectedCampaignId)
              }
            />
          )}

          {!error && latestInsight ? (
            <section className="intelligence-result">
              <div className="intelligence-readiness">
                <span>READINESS</span>

                <strong>
                  {latestInsight.analysis.readiness.replace(
                    /_/g,
                    " "
                  )}
                </strong>

                <p>
                  {latestInsight.analysis.summary}
                </p>
              </div>

              <div className="intelligence-grid">
                <article>
                  <span>RISKS</span>

                  {latestInsight.analysis.risks.length > 0 ? (
                    latestInsight.analysis.risks.map(
                      (risk, index) => (
                        <div
                          key={`${risk.area}-${index}`}
                        >
                          <strong>
                            {risk.severity}
                          </strong>

                          <b>{risk.area}</b>

                          <p>{risk.message}</p>
                        </div>
                      )
                    )
                  ) : (
                    <p>
                      No risks reported in the latest analysis.
                    </p>
                  )}
                </article>

                <article>
                  <span>NEXT ACTIONS</span>

                  {latestInsight.analysis.nextActions.length >
                  0 ? (
                    latestInsight.analysis.nextActions.map(
                      (action, index) => (
                        <div
                          key={`${action}-${index}`}
                        >
                          <strong>
                            {String(index + 1).padStart(
                              2,
                              "0"
                            )}
                          </strong>

                          <p>{action}</p>
                        </div>
                      )
                    )
                  ) : (
                    <p>No next actions returned.</p>
                  )}
                </article>
              </div>
            </section>
          ) : (
            !error && (
              <section className="intelligence-empty">
                <BrainCircuit size={26} />

                <h2>No analysis yet.</h2>

                <p>
                  Run Campaign Brain for this campaign to
                  generate readiness, risks and next actions.
                </p>
              </section>
            )
          )}
        </>
      )}
    </main>
  );
}