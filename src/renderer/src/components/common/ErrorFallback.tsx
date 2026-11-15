import { useI18n } from '@renderer/i18n'
import { Result, Button } from 'antd'
import { formatError } from '@shared/i18n/message'

export function ErrorFallback({
  error,
  onReload
}: {
  error: Error | null
  onReload: () => void
}): React.JSX.Element {
  const { t } = useI18n()
  return (
    <Result
      status="error"
      title={t('app.errorTitle')}
      subTitle={error ? formatError(error, t) : t('app.unknownError')}
      extra={
        <Button type="primary" onClick={onReload}>
          {t('common.reload')}
        </Button>
      }
    />
  )
}
