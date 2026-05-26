import { BrowserRouter } from 'react-router-dom'
import AppRouter from './router'
import BackendLoader from './components/layout/BackendLoader'

export default function App() {
  return (
    <BackendLoader>
      <BrowserRouter>
        <AppRouter />
      </BrowserRouter>
    </BackendLoader>
  )
}
