import { EmailSettingsPanel, EmailConfig } from './EmailSettingsPanel'
import { EmailLogTable } from './EmailLogTable'

interface EmailTabProps {
  config: EmailConfig
}

export function EmailTab({ config }: EmailTabProps) {
  return (
    <div className="flex flex-col lg:grid lg:grid-cols-12 gap-6 items-start">
      <section className="lg:col-span-4 w-full flex flex-col gap-6">
        <EmailSettingsPanel initialConfig={config} />
      </section>
      <section className="lg:col-span-8 w-full flex flex-col gap-6">
        <EmailLogTable />
      </section>
    </div>
  )
}
