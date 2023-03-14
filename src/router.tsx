import { App } from 'App'
import { About } from 'pages/About'
import { AuthenticatedOutlet } from 'pages/AuthenticatedOutlet'
import { Home } from 'pages/Home'
import { NotFound } from 'pages/NotFound'
import { createBrowserRouter } from 'react-router-dom'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      {
        path: '/',
        element: <AuthenticatedOutlet />,
        children: [{ index: true, element: <Home /> }],
      },
      { path: 'about', element: <About /> },
      { path: '*', element: <NotFound /> },
    ],
  },
])
