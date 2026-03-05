import BillingSettingsPanel from '../../billing/components/BillingSettingsPanel'
import ProfileSettingsPanel from '../components/ProfileSettingsPanel'

function SettingsPage({
  creditsBalance,
  models,
  onRefreshCredits,
  onSaveProfile,
  onStartCheckout,
  user
}) {
  const profileKey = `${user?.id || ''}:${user?.firstName || ''}:${user?.lastName || ''}:${
    user?.preferredModelId || ''
  }`

  return (
    <section className="settings-page-layout">
      <div className="settings-page-inner">
        <ProfileSettingsPanel key={profileKey} models={models} onSave={onSaveProfile} user={user} />
        <BillingSettingsPanel
          creditsBalance={creditsBalance}
          onRefreshCredits={onRefreshCredits}
          onStartCheckout={onStartCheckout}
        />
      </div>
    </section>
  )
}

export default SettingsPage
