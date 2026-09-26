import { createFileRoute } from '@tanstack/react-router'
import AppPage from '#/pages/app'

const App = () => {
  return <AppPage />
}

export const Route = createFileRoute('/app')({
  component: App,
})
