import React from 'react'
import Settings from '../../settings/Settings'

interface SettingsPageProps {
  chatId: string
}

export default function SettingsPage({ chatId }: SettingsPageProps) {
  return (
    <div className="settings-page" style={{ height: '100%', padding: '16px' }}>
      <Settings open={true} onClose={() => {}} embedded={true} />
    </div>
  )
}
