import { createFileRoute } from '@tanstack/react-router'
import HomePage from '#/pages/home'

const Home = () => {
  return <HomePage />
}

export const Route = createFileRoute('/')({
  component: Home,
})
