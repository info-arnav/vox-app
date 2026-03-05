const NAV_WIDTHS = [68, 56, 72, 56, 50]

function WorkspaceSkeleton() {
  return (
    <section className="workspace-shell workspace-shell-loading">
      <div className="workspace-layout workspace-layout-loading">
        <aside className="workspace-sidebar">
          <div className="workspace-skeleton-sidebar-inner">
            <div
              className="workspace-skeleton-line workspace-skeleton-line-short"
              style={{ marginBottom: 24 }}
            />
            {NAV_WIDTHS.map((w, i) => (
              <div
                key={i}
                className="workspace-skeleton-line"
                style={{ width: `${w}%`, marginTop: i === 0 ? 0 : 12 }}
              />
            ))}
          </div>
        </aside>

        <main className="workspace-main workspace-skeleton-main">
          <div className="workspace-skeleton-line workspace-skeleton-line-wide" />
          <div
            className="workspace-skeleton-line workspace-skeleton-line-long"
            style={{ marginTop: 14 }}
          />
          <div
            className="workspace-skeleton-line workspace-skeleton-line-medium"
            style={{ marginTop: 10 }}
          />
          <div
            className="workspace-skeleton-line workspace-skeleton-line-long"
            style={{ marginTop: 10 }}
          />
          <div
            className="workspace-skeleton-line workspace-skeleton-line-short"
            style={{ marginTop: 10 }}
          />
        </main>
      </div>
    </section>
  )
}

export default WorkspaceSkeleton
