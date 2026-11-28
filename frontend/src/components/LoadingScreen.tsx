/** Full-page loader: the logo in the middle, a blue ring drawing itself round it again and again */
export function LoadingScreen({ text }: { text?: string }) {
  return (
    <div className="loading-screen" role="status" aria-live="polite">
      <div className="loader">
        <div className="loader-ring">
          <svg viewBox="0 0 120 120" aria-hidden="true">
            <circle className="loader-track" cx="60" cy="60" r="54" />
            <circle className="loader-fill" cx="60" cy="60" r="54" pathLength={100} />
          </svg>
          <img src="/namotech-logo.png" alt="" />
        </div>
        {text ? <p>{text}</p> : <span className="sr-only">Loading</span>}
      </div>
    </div>
  )
}
