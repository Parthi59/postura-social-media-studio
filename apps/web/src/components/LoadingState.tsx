type LoadingStateProps = {
  label?: string;
};

export function LoadingState({
  label = "Loading...",
}: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: "flex",
        minHeight: 160,
        alignItems: "center",
        justifyContent: "center",
        color: "#8b8890",
        fontSize: 12,
      }}
    >
      {label}
    </div>
  );
}