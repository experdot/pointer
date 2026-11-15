import React from 'react'
import { App, Flex, Form, Select, Tooltip } from 'antd'
import { QuestionCircleOutlined } from '@ant-design/icons'
import { useSettings } from '../../../hooks/useSettings'
import { useLocaleStore } from '../../../stores/localeStore'
import { useI18n } from '../../../i18n'
import { errorMessage } from '../../../runtime/client'

export function GeneralPanel(): React.JSX.Element {
  const { fontSize, setFontSize } = useSettings()
  const { t } = useI18n()
  const { message } = App.useApp()
  const { snapshot, saving, setPreference } = useLocaleStore()

  return (
    <Form layout="vertical" className="settings-general-panel">
      <Form.Item label={t('settings.language')}>
        <Flex align="center" gap={8}>
          <Select
            aria-label={t('settings.language')}
            value={snapshot?.preference ?? 'system'}
            disabled={saving || !snapshot}
            onChange={(preference) => {
              void setPreference(preference).catch((error) => {
                void message.error(
                  t('settings.language.saveFailed', { error: errorMessage(error) })
                )
              })
            }}
            options={[
              {
                value: 'system',
                label: t('settings.language.system', {
                  language: snapshot?.systemLanguage === 'zh-CN' ? '简体中文' : 'English'
                })
              },
              { value: 'zh-CN', label: '简体中文' },
              { value: 'en-US', label: 'English' }
            ]}
            style={{ width: 260, maxWidth: '100%', minWidth: 0 }}
          />
          <Tooltip title={t('settings.language.editorRestart')} trigger={['hover', 'focus']}>
            <QuestionCircleOutlined
              tabIndex={0}
              aria-label={t('settings.language.editorRestart')}
              style={{
                color: 'var(--ant-color-text-secondary)',
                cursor: 'help',
                flexShrink: 0
              }}
            />
          </Tooltip>
        </Flex>
      </Form.Item>
      <Form.Item label={t('settings.fontSize')}>
        <Select
          value={fontSize}
          onChange={setFontSize}
          options={[
            { value: 'small', label: t('settings.fontSmall') },
            { value: 'medium', label: t('settings.fontMedium') },
            { value: 'large', label: t('settings.fontLarge') }
          ]}
          style={{ width: 120 }}
        />
      </Form.Item>
    </Form>
  )
}
