type ErrorStateProps = {
  message?: string;
  onRetry?: () => void;
};

export function ErrorState({
  message = "Something went wrong.",
  onRetry,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      style={{
        display: "grid",
        minHeight: 180,
        placeItems: "center",
        padding: 24,
        textAlign: "center",
      }}
    >
      <div>
        <strong
          style={{
            display: "block",
            color: "#2b292f",
            fontSize: 14,
          }}
        >
          Unable to load this section
        </strong>

        <p
          style={{
            marginTop: 8,
            color: "#8d8992",
            fontSize: 11,
            lineHeight: 1.6,
          }}
        >
          {message}
        </p>

        {onRetry && (
          <button
            onClick={onRetry}
            style={{
              marginTop: 14,
              minHeight: 34,
              padding: "0 12px",
              border: "1px solid #d8d5dc",
              borderRadius: 8,
              background: "#fff",
              color: "#4f4b54",
              fontSize: 10,
              fontWeight: 700,
            }}
          >
            Try again
          </button>
        )}
      </div>
    </div>
  );
}