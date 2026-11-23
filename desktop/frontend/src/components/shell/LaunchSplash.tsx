interface LaunchSplashProps {
  waiting: boolean;
  exiting: boolean;
  progress: number;
  isSlowLoad: boolean;
  statusText: string;
}

export function LaunchSplash({
  waiting,
  exiting,
  progress,
  isSlowLoad,
  statusText,
}: LaunchSplashProps) {
  return (
    <div
      className="launch-splash"
      data-waiting={waiting}
      data-exiting={exiting ? "true" : "false"}
      role="status"
      aria-live="polite"
      aria-label="OmniMail 启动加载中"
    >
      <div className="splash-center">
        <div className="splash-emblem">
          <div className="splash-prism-tile">
            <svg
              viewBox="0 0 64 64"
              width="64"
              height="64"
              fill="none"
              aria-hidden="true"
              className="splash-prism-svg"
            >
              <g className="splash-wing splash-wing-1">
                <g transform="translate(10.4 9.6)">
                  <path
                    d="M1.56 17.64C-0.55 16.81 -0.51 13.8 1.64 12.99L38.36 0.19C40.85 -0.7 43.24 1.71 42.35 4.2L36.8 19.5L17.79 24.15L1.56 17.64Z"
                    fill="#EA4335"
                  />
                </g>
              </g>

              <g className="splash-wing splash-wing-3">
                <g transform="translate(28.25 13.8)">
                  <path
                    d="M24.55 0L11.86 36.61C11.01 39.04 7.59 39.3 6.4 36.99L0 24.6L19.01 15.3L24.55 0Z"
                    fill="#34A853"
                  />
                </g>
              </g>

              <g className="splash-wing splash-wing-2">
                <g transform="translate(28.25 11.6)">
                  <path
                    d="M23.51 0L0 22.14L0 26.79L10.15 21.8L19.01 17.49L23.51 0Z"
                    fill="#FBBC04"
                  />
                </g>
              </g>

              <g className="splash-wing splash-wing-4">
                <g transform="translate(12.01 27.24)">
                  <path
                    d="M0 0L16.23 6.51L16.23 20.95C16.23 23.21 13.48 24.26 11.95 22.61L6.08 16.36C4.69 14.85 4.95 12.46 6.63 11.31L11.24 8.15L0 0Z"
                    fill="#1A73E8"
                  />
                </g>
                <g transform="translate(28.25 33.75)">
                  <path d="M0 0L6.85 1.3L0 12.35L0 0Z" fill="#174EA6" />
                </g>
              </g>
            </svg>
          </div>
          <span className="splash-emblem-sheen" />
        </div>

        <div className="splash-copy">
          <h1 className="splash-title">OmniMail</h1>
          <p className="splash-subtitle">
            多源统一收件箱 · 本地优先 · 边界清晰的 AI 邮件工作台
          </p>
        </div>

        <div className="splash-progress-group">
          <div className="splash-progress-track">
            <div
              className="splash-progress-fill"
              data-slow={isSlowLoad ? "true" : "false"}
              style={{ transform: `scaleX(${progress})` }}
            />
          </div>
          <div className="splash-status-row">
            <span className="splash-status-dot" aria-hidden="true" />
            <span key={statusText} className="splash-status-text">
              {statusText}
            </span>
          </div>
        </div>
      </div>

      <div className="splash-footer" aria-hidden="true">
        <span>v0.1.0 · Cold Launch</span>
        <span>Local-First Encrypted</span>
      </div>
    </div>
  );
}
