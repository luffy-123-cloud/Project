import { useNavigate } from 'react-router-dom'
import { Globe, Megaphone, ShoppingCart, Newspaper, Info } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import Card from '../../components/ui/Card'

export default function InfoPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const sections = [
    {
      id: 'desi-news',
      title: t('info.desiNews'),
      desc: t('info.desiNewsDesc'),
      icon: Newspaper,
      iconBg: 'bg-orange-50',
      iconColor: 'text-orange-700',
      onClick: () => navigate('/info/desi-news')
    },
    {
      id: 'global-impact',
      title: t('info.globalImpact'),
      desc: t('info.globalImpactDesc'),
      icon: Globe,
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-700',
      onClick: () => {}
    }
  ]

  return (
    <div className="min-h-screen bg-[#f8f5f0] px-4 py-8 pb-28">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm text-brand-600 mb-2">
            <Info size={24} />
          </div>
          <h1 className="text-3xl font-black text-neutral-900" style={{ fontFamily: 'Baloo 2, sans-serif' }}>
            {t('info.title')}
          </h1>
          <p className="text-neutral-500 text-sm max-w-xs mx-auto">
            Stay updated with local news, global trends, and Mandi Saathi.
          </p>
        </header>

        <div className="grid grid-cols-2 gap-4">
          {sections.map((section) => {
            const Icon = section.icon
            return (
              <button
                key={section.id}
                onClick={section.onClick}
                className="group flex flex-col"
              >
                <Card className="flex-1 flex flex-col items-center text-center p-6 rounded-[32px] border-none shadow-sm hover:shadow-md transition-all active:scale-[0.98] bg-white">
                  <div className={`mb-5 flex h-20 w-20 items-center justify-center rounded-[28px] ${section.iconBg} ${section.iconColor} transition-transform group-hover:scale-110 duration-300`}>
                    <Icon size={32} strokeWidth={2.5} />
                  </div>
                  
                  <div className="space-y-2">
                    <h2 className="text-lg font-black text-[#1a3a1f]" style={{ fontFamily: 'Baloo 2, sans-serif' }}>
                      {section.title}
                    </h2>
                    <p className="text-[13px] leading-relaxed text-neutral-500 font-medium">
                      {section.desc}
                    </p>
                  </div>
                </Card>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
