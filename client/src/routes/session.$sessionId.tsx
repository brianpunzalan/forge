import { createFileRoute } from '@tanstack/react-router'
import AppPage from '#/pages/app'

const Session = () => {
  const { sessionId } = Route.useParams()
  return <AppPage sessionId={sessionId} />
}

export const Route = createFileRoute('/session/$sessionId')({
  component: Session,
})
