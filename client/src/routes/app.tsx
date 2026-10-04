import { createFileRoute } from '@tanstack/react-router'
import AppPage from '#/pages/app'

const App = () => {
  const { q } = Route.useSearch()
  return <AppPage prompt={q} />
}

export const Route = createFileRoute('/app')({
  validateSearch: (search: Record<string, unknown>): { q?: string } => ({
    q: typeof search.q === 'string' ? search.q : undefined,
  }),
  component: App,
})
