import axios from 'axios'

const API_KEY = import.meta.env.VITE_NEWSDATA_API_KEY
const BASE_URL = 'https://newsdata.io/api/1/news'

export interface NewsArticle {
  title: string
  link: string
  description: string
  pubDate: string
  image_url: string | null
  source_id: string
}

export const fetchAgriNews = async (count = 5): Promise<NewsArticle[]> => {
  if (!API_KEY) {
    console.error('[NewsService] API Key is missing')
    return []
  }

  try {
    const response = await axios.get(BASE_URL, {
      params: {
        apikey: API_KEY,
        q: 'agriculture AND (farmer OR crop OR krishi OR mandi OR harvest OR fertilizer)',
        country: 'in',
        category: 'food,environment,science',
        language: 'en,hi',
        size: count
      }
    })

    if (response.data.status === 'success') {
      const results = response.data.results
      const uniqueNews: NewsArticle[] = []
      const seenTitles = new Set<string>()

      for (const item of results) {
        if (!seenTitles.has(item.title.toLowerCase().trim())) {
          seenTitles.add(item.title.toLowerCase().trim())
          uniqueNews.push({
            title: item.title,
            link: item.link,
            description: item.description || '',
            pubDate: item.pubDate,
            image_url: item.image_url,
            source_id: item.source_id
          })
        }
        if (uniqueNews.length >= count) break
      }

      return uniqueNews
    }
    return []
  } catch (error) {
    console.error('[NewsService] Failed to fetch news:', error)
    return []
  }
}
