import { skipToken } from '@reduxjs/toolkit/dist/query'
import { api } from 'app/services/api'
import { comunicaApi } from 'app/services/comunicaApi'
import { Button, Loading } from 'components'
import { useAuth } from 'hooks/useAuth'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { URI } from 'types'
import styles from './Home.module.scss'

export const Home = () => {
  const { register, handleSubmit, setValue, watch } = useForm<{
    container: URI
    communityId: URI
    groupId: URI
    data: {
      name: string
      description: string
    }
  }>()

  const auth = useAuth()

  const { data } = api.endpoints.readSolidProfile.useQuery(
    auth.webId ?? skipToken,
  )

  const [saveCommunity] = comunicaApi.endpoints.saveCommunity.useMutation()

  useEffect(() => {
    const container = data?.storage?.[0]?.['@id']
    if (container) {
      setValue('container', container)
    }
  }, [data?.storage, setValue])

  useEffect(() => {
    const subscription = watch((value, { name }) => {
      if (
        name === 'container' &&
        value.container &&
        value.container?.endsWith('/')
      ) {
        setValue('communityId', value.container + 'community#us')
        setValue('groupId', value.container + 'group#us')
      }
    })

    return subscription.unsubscribe
  }, [setValue, watch])

  if (!auth.webId) return <Loading>Preparing...</Loading>

  const handleFormSubmit = handleSubmit(async data => {
    if (!auth.webId)
      throw new Error('cannot save community: no user webId is set up')
    await saveCommunity({ ...data, webId: auth.webId })
  })

  return (
    <div className={styles.container}>
      Where should we create the community?
      <form onSubmit={handleFormSubmit}>
        <input type="url" placeholder="container" {...register('container')} />
        <input
          type="url"
          placeholder="community uri"
          {...register('communityId')}
        />
        <input type="url" placeholder="group uri" {...register('groupId')} />
        <input
          placeholder="community name"
          {...register('data.name', { required: true })}
        />
        <textarea placeholder="description" {...register('data.description')} />
        <Button primary type="submit">
          Create
        </Button>
      </form>
    </div>
  )
}
