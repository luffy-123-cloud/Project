import { useEffect, useState } from 'react'
import { ArrowLeft, ExternalLink, Calendar, Newspaper, Share2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { fetchAgriNews } from '../../services/newsService'
import type { NewsArticle } from '../../services/newsService'
import Card from '../../components/ui/Card'
import { formatLocalizedDate } from '../../i18n'

export default function DesiNews() {
  const [news, setNews] = useState<NewsArticle[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    const loadNews = async () => {
      setLoading(true)
      const data = await fetchAgriNews(5)
      setNews(data)
      setLoading(false)
    }
    loadNews()
  }, [])

  return (
    <div className="min-h-screen bg-[#f8f5f0] pb-28">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-md px-4 py-4 flex items-center gap-4 border-b border-neutral-100">
        <button 
          onClick={() => navigate(-1)}
          className="h-10 w-10 flex items-center justify-center rounded-full bg-neutral-50 text-neutral-600 active:scale-90 transition-transform"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-black text-neutral-900" style={{ fontFamily: 'Baloo 2, sans-serif' }}>
          Desi News
        </h1>
      </div>

      <div className="px-4 py-6 max-w-3xl mx-auto space-y-6">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <Card key={i} className="animate-pulse h-48 bg-white border-none shadow-sm" />
            ))}
          </div>
        ) : news.length > 0 ? (
          news.map((article, idx) => (
            <Card key={idx} className="overflow-hidden border-none shadow-sm bg-white p-0 flex flex-col group transition-all hover:shadow-md">
              {/* Image with fallback */}
              <div className="relative h-48 w-full bg-neutral-100 overflow-hidden">
                <img 
                  src={article.image_url || '/market-hero.png'} 
                  alt={article.title}
                  onError={(e) => {
                    const target = e.target as HTMLImageElement
                    target.src = '/market-hero.png'
                  }}
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute top-4 left-4">
                  <div className="px-3 py-1.5 bg-brand-600/90 backdrop-blur-sm text-white text-[10px] font-black uppercase tracking-widest rounded-lg shadow-lg">
                    {article.source_id}
                  </div>
                </div>
              </div>
              
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
                    <Calendar size={12} className="text-brand-500" />
                    {formatLocalizedDate(article.pubDate, { dateStyle: 'medium' })}
                  </div>
                  <Newspaper size={14} className="text-neutral-200" />
                </div>
                
                <h2 className="text-xl font-black text-neutral-900 leading-tight group-hover:text-brand-700 transition-colors line-clamp-2" style={{ fontFamily: 'Baloo 2, sans-serif' }}>
                  {article.title}
                </h2>
                
                <p className="text-sm text-neutral-500 line-clamp-3 leading-relaxed">
                  {article.description || "No description available for this agricultural update. Click 'Read Full Story' to view details on the official source."}
                </p>

                <div className="pt-4 flex items-center justify-between border-t border-neutral-50">
                  <a 
                    href={article.link} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm font-black text-brand-600 hover:text-brand-800 transition-colors"
                  >
                    Read Full Story
                    <ExternalLink size={14} strokeWidth={2.5} />
                  </a>
                  
                  <button className="h-9 w-9 flex items-center justify-center rounded-full bg-neutral-50 text-neutral-400 hover:bg-brand-50 hover:text-brand-600 transition-all">
                    <Share2 size={18} />
                  </button>
                </div>
              </div>
            </Card>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
            <div className="h-20 w-20 flex items-center justify-center rounded-3xl bg-neutral-100 text-neutral-400">
              <Newspaper size={40} />
            </div>
            <div className="space-y-1">
              <p className="text-lg font-bold text-neutral-900">No News Found</p>
              <p className="text-sm text-neutral-500">We couldn't fetch the latest agricultural news right now.</p>
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-brand-600 text-white rounded-xl font-bold"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
