import { skipToken } from '@reduxjs/toolkit/dist/query'
import { api } from 'app/services/api'
import { Button } from 'components'
import { useAuth } from 'hooks/useAuth'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { URI } from 'types'
import styles from './Home.module.scss'

export const Home = () => {
  const { register, handleSubmit, setValue } = useForm<{
    container: URI
    community: URI
    group: URI
    name: string
    description: string
  }>()

  const auth = useAuth()

  const { data } = api.endpoints.readSolidProfile.useQuery(
    auth.webId ?? skipToken,
  )

  const handleFormSubmit = handleSubmit(data => {})

  useEffect(() => {
    const container = data?.storage?.[0]?.['@id']
    if (container) {
      setValue('container', container)
      setValue('community', container + 'community#us')
      setValue('group', container + 'group#us')
    }
  }, [data?.storage, setValue])

  return (
    <div className={styles.container}>
      Where should we create the community?
      <form onSubmit={handleFormSubmit}>
        <input type="url" placeholder="container" {...register('container')} />
        <input
          type="url"
          placeholder="community uri"
          {...register('community')}
        />
        <input type="url" placeholder="group uri" {...register('group')} />
        <input placeholder="community name" {...register('name')} />
        <textarea placeholder="description" {...register('description')} />
        <Button primary type="submit">
          Create
        </Button>
      </form>
    </div>
  )
}
