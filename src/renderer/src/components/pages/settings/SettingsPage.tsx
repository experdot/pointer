import React from 'react'
import Settings from '../../settings/Settings'

interface SettingsPageProps {
  chatId: string
  defaultActiveTab?: string
}

export default function SettingsPage({
  chatId,
  defaultActiveTab = 'appearance'
}: SettingsPageProps) {
  return (
    <div className="settings-page" style={{ height: '100%', padding: '4px' }}>
      <Settings open={true} onClose={() => {}} defaultActiveTab={defaultActiveTab} />
    </div>
  )
}
