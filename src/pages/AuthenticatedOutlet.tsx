import { useAppSelector } from 'app/hooks'
import { Loading } from 'components/Loading/Loading'
import { selectAuth } from 'features/auth/authSlice'
import { Outlet } from 'react-router-dom'
import { UnauthenticatedHome } from './UnauthenticatedHome'

export const AuthenticatedOutlet = () => {
  const auth = useAppSelector(selectAuth)

  if (auth.isLoggedIn === undefined) return <Loading>Authenticating...</Loading>

  if (auth.isLoggedIn === false) return <UnauthenticatedHome />

  return <Outlet />
}
