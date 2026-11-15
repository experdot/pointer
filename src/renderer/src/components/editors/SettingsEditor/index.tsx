import { t, useI18n } from '@renderer/i18n'
import React, { useState, useEffect } from 'react'
import { Tabs } from 'antd'
import type { TabsProps } from 'antd'
import {
  ApiOutlined,
  RobotOutlined,
  SettingOutlined,
  InfoCircleOutlined,
  DatabaseOutlined,
  KeyOutlined
} from '@ant-design/icons'
import { GeneralPanel } from './GeneralPanel'
import { LLMConfigPanel } from './LLMConfigPanel'
import { ModelConfigPanel } from './ModelConfigPanel'
import { DataPanel } from './DataPanel'
import { ShortcutsPanel } from './ShortcutsPanel'
import { AboutPanel } from './AboutPanel'
import { consumePendingSettingsTab } from '../../../services/settingsService'
import { useSettingsUIStore } from '../../../stores/settingsUIStore'
import './SettingsEditor.css'

export function SettingsEditor(): React.JSX.Element {
  useI18n()

  const [activeKey, setActiveKey] = useState('general')

  const pendingTab = useSettingsUIStore((state) => state.pendingTab)

  // 挂载时与之后的每次请求都要生效（页签已打开时不会重新挂载）
  useEffect(() => {
    if (!pendingTab) return
    setActiveKey(pendingTab)
    consumePendingSettingsTab()
  }, [pendingTab])
  const items: TabsProps['items'] = [
    {
      key: 'general',
      label: (
        <span>
          <SettingOutlined /> {t('settings.general')}
        </span>
      ),
      children: <GeneralPanel />
    },
    {
      key: 'llm',
      label: (
        <span>
          <ApiOutlined /> {t('settings.llm')}
        </span>
      ),
      children: <LLMConfigPanel />
    },
    {
      key: 'model',
      label: (
        <span>
          <RobotOutlined /> {t('config.model')}
        </span>
      ),
      children: <ModelConfigPanel />
    },
    {
      key: 'data',
      label: (
        <span>
          <DatabaseOutlined /> {t('settings.data')}
        </span>
      ),
      children: <DataPanel />
    },
    {
      key: 'shortcuts',
      label: (
        <span>
          <KeyOutlined /> {t('settings.shortcuts')}
        </span>
      ),
      children: <ShortcutsPanel />
    },
    {
      key: 'about',
      label: (
        <span>
          <InfoCircleOutlined /> {t('settings.about')}
        </span>
      ),
      children: <AboutPanel />
    }
  ]

  return (
    <div className="settings-editor">
      <Tabs items={items} activeKey={activeKey} onChange={setActiveKey} className="settings-tabs" />
    </div>
  )
}
