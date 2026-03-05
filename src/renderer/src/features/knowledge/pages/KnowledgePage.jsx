import FolderSettingsPanel from '../components/FolderSettingsPanel'
import IndexedFilesExplorer from '../components/IndexedFilesExplorer'

function KnowledgePage({
  folders,
  indexingPaused,
  indexingStatus,
  onGetIndexedChildren,
  onPauseIndexing,
  onPickAndAddFolder,
  onRemoveFolder,
  onResumeIndexing
}) {
  return (
    <section className="knowledge-page">
      <FolderSettingsPanel
        folders={folders}
        isPaused={indexingPaused}
        onPauseIndexing={onPauseIndexing}
        onPickAndAddFolder={onPickAndAddFolder}
        onRemoveFolder={onRemoveFolder}
        onResumeIndexing={onResumeIndexing}
        status={indexingStatus}
      />
      <IndexedFilesExplorer folders={folders} onGetIndexedChildren={onGetIndexedChildren} />
    </section>
  )
}

export default KnowledgePage
